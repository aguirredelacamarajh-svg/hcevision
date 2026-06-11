import Anthropic from "@anthropic-ai/sdk";
import type { CasoClinico, PasoCaso } from "@/lib/types";
import { FASES_CASO } from "@/lib/types";
import { CASO_SYSTEM_PROMPT, buildCasoPrompt, CASO_PROMPT_VERSION } from "@/lib/prompts";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const MAX_MATERIAL_CHARS = 30_000;
const MAX_ATTEMPTS = 2;

const casoTool: Anthropic.Tool = {
  name: "entregar_caso",
  description: "Entrega el caso clínico interactivo generado a partir del material.",
  input_schema: {
    type: "object",
    properties: {
      titulo: { type: "string" },
      presentacion: { type: "string" },
      pasos: {
        type: "array",
        minItems: 5,
        maxItems: 5,
        items: {
          type: "object",
          properties: {
            fase: { type: "string", enum: [...FASES_CASO] },
            situacion: { type: "string" },
            pregunta: { type: "string" },
            opciones: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
            correcta: { type: "integer", minimum: 0, maximum: 3 },
            feedback: { type: "string" },
          },
          required: ["fase", "situacion", "pregunta", "opciones", "correcta", "feedback"],
        },
      },
      perlas: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 5 },
    },
    required: ["titulo", "presentacion", "pasos", "perlas"],
  },
};

function validateCaso(input: unknown): CasoClinico | null {
  if (typeof input !== "object" || input === null) return null;
  const { titulo, presentacion, pasos, perlas } = input as Record<string, unknown>;
  if (typeof titulo !== "string" || titulo.trim().length < 5) return null;
  if (typeof presentacion !== "string" || presentacion.trim().length < 40) return null;
  if (!Array.isArray(pasos) || pasos.length !== 5) return null;
  if (!Array.isArray(perlas) || perlas.length < 3 || perlas.some((p) => typeof p !== "string" || !p.trim())) return null;

  for (let i = 0; i < pasos.length; i++) {
    const p = pasos[i];
    if (typeof p !== "object" || p === null) return null;
    const { fase, situacion, pregunta, opciones, correcta, feedback } = p as Record<string, unknown>;
    if (fase !== FASES_CASO[i]) return null; // orden estricto de fases
    if (typeof situacion !== "string" || situacion.trim().length < 20) return null;
    if (typeof pregunta !== "string" || pregunta.trim().length < 10) return null;
    if (!Array.isArray(opciones) || opciones.length !== 4 ||
      opciones.some((o) => typeof o !== "string" || o.trim().length === 0)) return null;
    if (typeof correcta !== "number" || !Number.isInteger(correcta) || correcta < 0 || correcta > 3) return null;
    if (typeof feedback !== "string" || feedback.trim().length < 30) return null;
  }
  return { titulo, presentacion, pasos: pasos as unknown as PasoCaso[], perlas: perlas as string[] };
}

export async function POST(req: Request) {
  // Verificar sesión y aprobación antes de consumir la API de Anthropic
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
  let tema: unknown;
  try {
    ({ materialId, tema } = await req.json());
  } catch {
    return Response.json({ error: "Petición inválida." }, { status: 400 });
  }
  if (typeof materialId !== "string" || !materialId) {
    return Response.json({ error: "Falta el material." }, { status: 400 });
  }
  const temaFiltro = typeof tema === "string" && tema.trim() ? tema.trim().slice(0, 120) : undefined;

  // El RLS garantiza que solo se lee un material propio
  const { data: material } = await supabase
    .from("study_materials")
    .select("id, source_text")
    .eq("id", materialId)
    .single();
  if (!material) {
    return Response.json({ error: "Material no encontrado." }, { status: 404 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY no configurada");
    return Response.json({ error: "Error de configuración del servidor." }, { status: 500 });
  }

  const client = new Anthropic();
  const materialText = (material.source_text as string).slice(0, MAX_MATERIAL_CHARS);

  try {
    for (let intento = 1; intento <= MAX_ATTEMPTS; intento++) {
      const message = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        temperature: 0.7, // variedad: cada caso debería ser distinto
        system: CASO_SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildCasoPrompt(materialText, temaFiltro) }],
        tools: [casoTool],
        tool_choice: { type: "tool", name: "entregar_caso" },
      });

      const toolUse = message.content.find((block) => block.type === "tool_use");
      const caso = toolUse ? validateCaso(toolUse.input) : null;

      if (caso) {
        return Response.json({ caso, promptVersion: CASO_PROMPT_VERSION });
      }
      console.warn(`Caso intento ${intento}: respuesta inválida del modelo`);
    }

    return Response.json(
      { error: "No hemos podido generar un caso válido. Vuelve a intentarlo en un momento." },
      { status: 502 }
    );
  } catch (err) {
    console.error("Error llamando a Claude API (caso):", err);
    return Response.json(
      { error: "Error generando el caso clínico. Inténtalo de nuevo." },
      { status: 500 }
    );
  }
}
