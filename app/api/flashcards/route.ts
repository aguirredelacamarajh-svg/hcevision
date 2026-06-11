import Anthropic from "@anthropic-ai/sdk";
import {
  FLASHCARDS_SYSTEM_PROMPT,
  buildFlashcardsPrompt,
  FLASHCARDS_PROMPT_VERSION,
} from "@/lib/prompts";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const MAX_CHARS = 40_000;
const MAX_ATTEMPTS = 2;
const DEFAULT_CANTIDAD = 12;
const MAX_CANTIDAD = 20;

interface RawCard {
  tema: string;
  front: string;
  back: string;
}

function makeFlashcardsTool(cantidad: number): Anthropic.Tool {
  return {
    name: "entregar_flashcards",
    description: "Entrega las flashcards generadas a partir del material.",
    input_schema: {
      type: "object",
      properties: {
        tarjetas: {
          type: "array",
          minItems: cantidad,
          maxItems: cantidad,
          items: {
            type: "object",
            properties: {
              tema: { type: "string" },
              front: { type: "string" },
              back: { type: "string" },
            },
            required: ["tema", "front", "back"],
          },
        },
      },
      required: ["tarjetas"],
    },
  };
}

function validate(input: unknown, cantidad: number): RawCard[] | null {
  if (typeof input !== "object" || input === null) return null;
  const tarjetas = (input as { tarjetas?: unknown }).tarjetas;
  if (!Array.isArray(tarjetas) || tarjetas.length !== cantidad) return null;

  const result: RawCard[] = [];
  for (const t of tarjetas) {
    if (typeof t !== "object" || t === null) return null;
    const { tema, front, back } = t as Record<string, unknown>;
    if (typeof tema !== "string" || !tema.trim()) return null;
    if (typeof front !== "string" || front.trim().length < 8) return null;
    if (typeof back !== "string" || back.trim().length < 3) return null;
    result.push({ tema: tema.trim(), front: front.trim(), back: back.trim() });
  }
  return result;
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
  let tema: unknown;
  let cantidad: unknown;
  try {
    ({ materialId, tema, cantidad } = await req.json());
  } catch {
    return Response.json({ error: "Petición inválida." }, { status: 400 });
  }
  if (typeof materialId !== "string" || !materialId) {
    return Response.json({ error: "Falta el material." }, { status: 400 });
  }
  const temaFiltro = typeof tema === "string" && tema.trim() ? tema.trim() : undefined;
  const n = Number(cantidad);
  const numTarjetas =
    Number.isInteger(n) && n >= 4 && n <= MAX_CANTIDAD ? n : DEFAULT_CANTIDAD;

  // RLS garantiza que solo se puede leer material propio
  const { data: material, error: loadError } = await supabase
    .from("study_materials")
    .select("id, source_text")
    .eq("id", materialId)
    .single();

  if (loadError || !material) {
    return Response.json({ error: "Material no encontrado." }, { status: 404 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY no configurada");
    return Response.json({ error: "Error de configuración del servidor." }, { status: 500 });
  }

  const texto = material.source_text.slice(0, MAX_CHARS);
  const client = new Anthropic();
  const tool = makeFlashcardsTool(numTarjetas);

  try {
    for (let intento = 1; intento <= MAX_ATTEMPTS; intento++) {
      const message = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        temperature: 0.3,
        system: FLASHCARDS_SYSTEM_PROMPT,
        messages: [
          { role: "user", content: buildFlashcardsPrompt(texto, numTarjetas, temaFiltro) },
        ],
        tools: [tool],
        tool_choice: { type: "tool", name: "entregar_flashcards" },
      });

      const toolUse = message.content.find((block) => block.type === "tool_use");
      const tarjetas = toolUse ? validate(toolUse.input, numTarjetas) : null;

      if (tarjetas) {
        const { data: inserted, error: insertError } = await supabase
          .from("flashcards")
          .insert(
            tarjetas.map((t) => ({
              material_id: materialId,
              user_id: user.id,
              tema: t.tema,
              front: t.front,
              back: t.back,
            }))
          )
          .select("id, material_id, tema, front, back");

        if (insertError || !inserted) {
          console.error("Error guardando flashcards:", insertError?.message);
          return Response.json({ error: "No se pudieron guardar las flashcards." }, { status: 500 });
        }
        return Response.json({ tarjetas: inserted, promptVersion: FLASHCARDS_PROMPT_VERSION });
      }
      console.warn(`Flashcards intento ${intento}: respuesta inválida del modelo`);
    }

    return Response.json(
      { error: "No hemos podido generar flashcards de este material. Vuelve a intentarlo." },
      { status: 502 }
    );
  } catch (err) {
    console.error("Error llamando a Claude API:", err);
    return Response.json({ error: "Error generando flashcards. Inténtalo de nuevo." }, { status: 500 });
  }
}
