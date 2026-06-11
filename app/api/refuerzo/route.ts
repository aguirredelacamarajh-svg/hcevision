import Anthropic from "@anthropic-ai/sdk";
import type { Nivel, Question } from "@/lib/types";
import {
  SYSTEM_PROMPT,
  buildRefuerzoPrompt,
  REFUERZO_PROMPT_VERSION,
  type PreguntaFallada,
} from "@/lib/prompts";
import { makeExamTool, validateQuestions } from "@/lib/exam-tool";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const NUM_PREGUNTAS = 10;
const MAX_MATERIAL_CHARS = 30_000;
const MAX_ATTEMPTS = 2;

interface AttemptAnswer {
  elegida: number;
  acierto: boolean;
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

  let examId: unknown;
  try {
    ({ examId } = await req.json());
  } catch {
    return Response.json({ error: "Petición inválida." }, { status: 400 });
  }
  if (typeof examId !== "string" || !examId) {
    return Response.json({ error: "Falta el examen." }, { status: 400 });
  }

  // El RLS garantiza que solo se lee un examen propio
  const { data: exam } = await supabase
    .from("saved_exams")
    .select("id, title, nivel, folder_id, material_id, questions, answers")
    .eq("id", examId)
    .single();
  if (!exam) {
    return Response.json({ error: "Examen no encontrado." }, { status: 404 });
  }

  // Respuestas del último intento; si no hay intentos, las guardadas en el examen
  const { data: lastAttempt } = await supabase
    .from("exam_attempts")
    .select("answers")
    .eq("exam_id", examId)
    .order("attempted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const answers = (lastAttempt?.answers ?? exam.answers ?? []) as AttemptAnswer[];
  const questions = (exam.questions ?? []) as Question[];

  const falladas: PreguntaFallada[] = [];
  answers.forEach((a, i) => {
    const q = questions[i];
    if (a && !a.acierto && q) {
      falladas.push({
        enunciado: q.enunciado,
        respuestaCorrecta: q.opciones[q.correcta],
        explicacion: q.explicacion,
      });
    }
  });

  if (falladas.length === 0) {
    return Response.json(
      { error: "No hay errores que reforzar en el último intento. 🎉" },
      { status: 400 }
    );
  }

  // Material original si el examen está vinculado a uno
  let material = "";
  if (exam.material_id) {
    const { data: mat } = await supabase
      .from("study_materials")
      .select("source_text")
      .eq("id", exam.material_id)
      .single();
    if (mat?.source_text) material = mat.source_text.slice(0, MAX_MATERIAL_CHARS);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY no configurada");
    return Response.json({ error: "Error de configuración del servidor." }, { status: 500 });
  }

  const nivel = (exam.nivel ?? "intermedio") as Nivel;
  const client = new Anthropic();
  const examTool = makeExamTool(NUM_PREGUNTAS);

  try {
    for (let intento = 1; intento <= MAX_ATTEMPTS; intento++) {
      const message = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        temperature: 0.3,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: buildRefuerzoPrompt(material, falladas, NUM_PREGUNTAS, nivel),
          },
        ],
        tools: [examTool],
        tool_choice: { type: "tool", name: "entregar_examen" },
      });

      const toolUse = message.content.find((block) => block.type === "tool_use");
      const preguntas = toolUse ? validateQuestions(toolUse.input, NUM_PREGUNTAS) : null;

      if (preguntas) {
        // Guardar como examen nuevo para que aparezca en el campus y se pueda rehacer
        const { data: saved, error: saveError } = await supabase
          .from("saved_exams")
          .insert({
            user_id: user.id,
            folder_id: exam.folder_id,
            title: `🎯 Refuerzo · ${exam.title}`.slice(0, 120),
            nivel,
            num_questions: NUM_PREGUNTAS,
            questions: preguntas,
            ...(exam.material_id ? { material_id: exam.material_id } : {}),
          })
          .select("id")
          .single();

        if (saveError || !saved) {
          console.error("No se pudo guardar el examen de refuerzo:", saveError?.message);
          return Response.json(
            { error: "El examen se generó pero no se pudo guardar. Inténtalo de nuevo." },
            { status: 500 }
          );
        }

        return Response.json({
          examId: saved.id,
          numFalladas: falladas.length,
          promptVersion: REFUERZO_PROMPT_VERSION,
        });
      }
      console.warn(`Refuerzo intento ${intento}: respuesta inválida del modelo`);
    }

    return Response.json(
      { error: "No hemos podido generar el examen de refuerzo. Vuelve a intentarlo en un momento." },
      { status: 502 }
    );
  } catch (err) {
    console.error("Error llamando a Claude API (refuerzo):", err);
    return Response.json(
      { error: "Error generando el examen de refuerzo. Inténtalo de nuevo." },
      { status: 500 }
    );
  }
}
