import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage, MaterialAnalysis } from "@/lib/types";
import { buildTutorSystemPrompt } from "@/lib/prompts";
import { computeSrsStates, type ReviewRecord } from "@/lib/srs";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const MAX_MATERIAL_CHARS = 30_000;
const MAX_MESSAGES = 24;
const MAX_MESSAGE_CHARS = 4_000;

function validateMessages(input: unknown): ChatMessage[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_MESSAGES) return null;
  const out: ChatMessage[] = [];
  for (const m of input) {
    if (typeof m !== "object" || m === null) return null;
    const { role, content } = m as Record<string, unknown>;
    if (role !== "user" && role !== "assistant") return null;
    if (typeof content !== "string" || content.trim().length === 0 || content.length > MAX_MESSAGE_CHARS)
      return null;
    out.push({ role, content });
  }
  if (out[out.length - 1].role !== "user") return null;
  return out;
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
  let rawMessages: unknown;
  try {
    ({ materialId, messages: rawMessages } = await req.json());
  } catch {
    return Response.json({ error: "Petición inválida." }, { status: 400 });
  }
  if (typeof materialId !== "string" || !materialId) {
    return Response.json({ error: "Falta el material." }, { status: 400 });
  }
  const messages = validateMessages(rawMessages);
  if (!messages) {
    return Response.json({ error: "Conversación inválida." }, { status: 400 });
  }

  // El RLS garantiza que solo se lee un material propio
  const { data: material } = await supabase
    .from("study_materials")
    .select("id, title, source_text, analysis")
    .eq("id", materialId)
    .single();
  if (!material) {
    return Response.json({ error: "Material no encontrado." }, { status: 404 });
  }

  // ── Contexto de desempeño: notas recientes + estado de memoria por tema ──
  const partes: string[] = [];

  const { data: exams } = await supabase
    .from("saved_exams")
    .select("id, title")
    .eq("material_id", materialId);

  if (exams && exams.length > 0) {
    const { data: attempts } = await supabase
      .from("exam_attempts")
      .select("exam_id, score, num_questions, attempted_at")
      .in("exam_id", exams.map((e) => e.id))
      .order("attempted_at", { ascending: false })
      .limit(5);
    if (attempts && attempts.length > 0) {
      const titleById = new Map(exams.map((e) => [e.id, e.title]));
      const lineas = attempts.map((a) => {
        const pct = Math.round((a.score / a.num_questions) * 100);
        return `- ${titleById.get(a.exam_id) ?? "Examen"}: ${a.score}/${a.num_questions} (${pct}%)`;
      });
      partes.push(`Últimos intentos de examen de este material:\n${lineas.join("\n")}`);
    }
  }

  const { data: cards } = await supabase
    .from("flashcards")
    .select("id, tema")
    .eq("material_id", materialId);

  if (cards && cards.length > 0) {
    const { data: reviews } = await supabase
      .from("flashcard_reviews")
      .select("flashcard_id, rating, reviewed_at")
      .in("flashcard_id", cards.map((c) => c.id));
    const states = computeSrsStates((reviews ?? []) as ReviewRecord[]);

    const porTema = new Map<string, { total: number; sumStep: number }>();
    for (const c of cards) {
      const st = states.get(c.id);
      const step = st?.lastReviewedAt ? st.step : 0;
      const t = porTema.get(c.tema) ?? { total: 0, sumStep: 0 };
      t.total++;
      t.sumStep += step;
      porTema.set(c.tema, t);
    }
    const flojos: string[] = [];
    const dominados: string[] = [];
    for (const [tema, t] of porTema) {
      const avg = t.sumStep / t.total;
      if (avg >= 3) dominados.push(tema);
      else if (avg < 1) flojos.push(tema);
    }
    if (flojos.length > 0) partes.push(`Temas flojos en flashcards (insistir aquí): ${flojos.join(", ")}.`);
    if (dominados.length > 0) partes.push(`Temas ya dominados en flashcards: ${dominados.join(", ")}.`);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY no configurada");
    return Response.json({ error: "Error de configuración del servidor." }, { status: 500 });
  }

  const analysis = material.analysis as MaterialAnalysis | null;
  const system = buildTutorSystemPrompt({
    titulo: material.title,
    material: (material.source_text as string).slice(0, MAX_MATERIAL_CHARS),
    resumen: analysis?.resumen,
    desempeno: partes.length > 0 ? partes.join("\n\n") : undefined,
  });

  const client = new Anthropic();
  const encoder = new TextEncoder();

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const stream = client.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 1500,
          temperature: 0.6,
          system,
          messages,
        });
        stream.on("text", (text) => controller.enqueue(encoder.encode(text)));
        await stream.finalMessage();
        controller.close();
      } catch (err) {
        console.error("Error en streaming del tutor:", err);
        controller.enqueue(
          encoder.encode("\n\n[Se cortó la conexión con el tutor. Volvé a enviar tu pregunta.]")
        );
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
