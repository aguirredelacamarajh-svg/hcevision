import Anthropic from "@anthropic-ai/sdk";
import type { MaterialAnalysis, Tema, PasoRuta, Importancia } from "@/lib/types";
import {
  ANALYSIS_SYSTEM_PROMPT,
  buildAnalysisPrompt,
  ANALYSIS_PROMPT_VERSION,
} from "@/lib/prompts";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const MAX_CHARS = 40_000;
const MAX_ATTEMPTS = 2;

const analysisTool: Anthropic.Tool = {
  name: "entregar_analisis",
  description:
    "Entrega la estructura conceptual del material: temas, importancia, dependencias y ruta de aprendizaje.",
  input_schema: {
    type: "object",
    properties: {
      resumen: { type: "string" },
      temas: {
        type: "array",
        minItems: 3,
        maxItems: 12,
        items: {
          type: "object",
          properties: {
            nombre: { type: "string" },
            importancia: {
              type: "string",
              enum: ["fundamental", "importante", "complementario"],
            },
            resumen: { type: "string" },
            conceptos: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 10 },
            dependencias: { type: "array", items: { type: "string" } },
          },
          required: ["nombre", "importancia", "resumen", "conceptos", "dependencias"],
        },
      },
      ruta: {
        type: "array",
        items: {
          type: "object",
          properties: {
            tema: { type: "string" },
            razon: { type: "string" },
          },
          required: ["tema", "razon"],
        },
      },
    },
    required: ["resumen", "temas", "ruta"],
  },
};

const IMPORTANCIAS: Importancia[] = ["fundamental", "importante", "complementario"];

function validate(input: unknown): MaterialAnalysis | null {
  if (typeof input !== "object" || input === null) return null;
  const { resumen, temas, ruta } = input as Record<string, unknown>;

  if (typeof resumen !== "string" || resumen.trim().length < 20) return null;
  if (!Array.isArray(temas) || temas.length < 3) return null;
  if (!Array.isArray(ruta) || ruta.length < 1) return null;

  const temasValidos: Tema[] = [];
  for (const t of temas) {
    if (typeof t !== "object" || t === null) return null;
    const { nombre, importancia, resumen: tr, conceptos, dependencias } = t as Record<string, unknown>;
    if (typeof nombre !== "string" || !nombre.trim()) return null;
    if (typeof importancia !== "string" || !IMPORTANCIAS.includes(importancia as Importancia)) return null;
    if (typeof tr !== "string" || !tr.trim()) return null;
    if (!Array.isArray(conceptos) || conceptos.some((c) => typeof c !== "string")) return null;
    if (!Array.isArray(dependencias) || dependencias.some((d) => typeof d !== "string")) return null;
    temasValidos.push({
      nombre: nombre.trim(),
      importancia: importancia as Importancia,
      resumen: tr.trim(),
      conceptos: (conceptos as string[]).map((c) => c.trim()).filter(Boolean),
      dependencias: (dependencias as string[]).map((d) => d.trim()).filter(Boolean),
    });
  }

  const rutaValida: PasoRuta[] = [];
  for (const p of ruta) {
    if (typeof p !== "object" || p === null) return null;
    const { tema, razon } = p as Record<string, unknown>;
    if (typeof tema !== "string" || typeof razon !== "string") return null;
    rutaValida.push({ tema: tema.trim(), razon: razon.trim() });
  }

  return { resumen: resumen.trim(), temas: temasValidos, ruta: rutaValida };
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "No autenticado." }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("approved")
    .eq("id", user.id)
    .single();
  if (!profile?.approved) {
    return Response.json({ error: "Acceso pendiente de aprobación." }, { status: 403 });
  }

  let materialId: unknown;
  try {
    ({ materialId } = await req.json());
  } catch {
    return Response.json({ error: "Petición inválida." }, { status: 400 });
  }
  if (typeof materialId !== "string" || !materialId) {
    return Response.json({ error: "Falta el material." }, { status: 400 });
  }

  // RLS garantiza que solo se puede leer material propio
  const { data: material, error: loadError } = await supabase
    .from("study_materials")
    .select("id, source_text, analysis_status")
    .eq("id", materialId)
    .single();

  if (loadError || !material) {
    return Response.json({ error: "Material no encontrado." }, { status: 404 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY no configurada");
    return Response.json({ error: "Error de configuración del servidor." }, { status: 500 });
  }

  await supabase
    .from("study_materials")
    .update({ analysis_status: "processing" })
    .eq("id", materialId);

  const texto = material.source_text.slice(0, MAX_CHARS);
  const client = new Anthropic();

  try {
    for (let intento = 1; intento <= MAX_ATTEMPTS; intento++) {
      const message = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        temperature: 0.3,
        system: ANALYSIS_SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildAnalysisPrompt(texto) }],
        tools: [analysisTool],
        tool_choice: { type: "tool", name: "entregar_analisis" },
      });

      const toolUse = message.content.find((block) => block.type === "tool_use");
      const analysis = toolUse ? validate(toolUse.input) : null;

      if (analysis) {
        const { error: saveError } = await supabase
          .from("study_materials")
          .update({ analysis, analysis_status: "ready" })
          .eq("id", materialId);
        if (saveError) {
          console.error("Error guardando análisis:", saveError.message);
          return Response.json({ error: "No se pudo guardar el análisis." }, { status: 500 });
        }
        return Response.json({ analysis, promptVersion: ANALYSIS_PROMPT_VERSION });
      }
      console.warn(`Análisis intento ${intento}: respuesta inválida del modelo`);
    }

    await supabase.from("study_materials").update({ analysis_status: "error" }).eq("id", materialId);
    return Response.json(
      { error: "No hemos podido analizar este material. Vuelve a intentarlo en un momento." },
      { status: 502 }
    );
  } catch (err) {
    console.error("Error llamando a Claude API:", err);
    await supabase.from("study_materials").update({ analysis_status: "error" }).eq("id", materialId);
    return Response.json({ error: "Error analizando el material. Inténtalo de nuevo." }, { status: 500 });
  }
}
