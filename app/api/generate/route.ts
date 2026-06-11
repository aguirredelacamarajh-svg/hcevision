import Anthropic from "@anthropic-ai/sdk";
import type { Nivel, NumPreguntas } from "@/lib/types";
import { VALID_NUM_QUESTIONS } from "@/lib/types";
import { SYSTEM_PROMPT, buildUserPrompt, PROMPT_VERSION } from "@/lib/prompts";
import { makeExamTool, validateQuestions } from "@/lib/exam-tool";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const MIN_CHARS = 300;
const MAX_CHARS = 40_000;
const MAX_ATTEMPTS = 2;

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

  let text: unknown;
  let numQuestions: unknown;
  let nivel: unknown;

  try {
    ({ text, numQuestions, nivel } = await req.json());
  } catch {
    return Response.json({ error: "Petición inválida." }, { status: 400 });
  }

  if (typeof text !== "string" || text.trim().length < MIN_CHARS) {
    return Response.json(
      {
        error: `El material es demasiado corto. Pega al menos unos párrafos de tus apuntes (mínimo ${MIN_CHARS} caracteres).`,
      },
      { status: 400 }
    );
  }

  const parsedNum = Number(numQuestions);
  if (
    !VALID_NUM_QUESTIONS.includes(parsedNum as NumPreguntas)
  ) {
    return Response.json(
      { error: "Número de preguntas no válido." },
      { status: 400 }
    );
  }
  const numPreguntas = parsedNum as NumPreguntas;

  const VALID_NIVELES: Nivel[] = ["básico", "intermedio", "avanzado"];
  if (typeof nivel !== "string" || !VALID_NIVELES.includes(nivel as Nivel)) {
    return Response.json({ error: "Nivel no válido." }, { status: 400 });
  }
  const nivelValidado = nivel as Nivel;

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY no configurada");
    return Response.json(
      { error: "Error de configuración del servidor." },
      { status: 500 }
    );
  }

  const recortado = text.length > MAX_CHARS;
  const material = text.slice(0, MAX_CHARS);
  const client = new Anthropic();
  const examTool = makeExamTool(numPreguntas);

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
            content: buildUserPrompt(material, numPreguntas, nivelValidado),
          },
        ],
        tools: [examTool],
        tool_choice: { type: "tool", name: "entregar_examen" },
      });

      const toolUse = message.content.find(
        (block) => block.type === "tool_use"
      );
      const preguntas = toolUse ? validateQuestions(toolUse.input, numPreguntas) : null;

      if (preguntas) {
        return Response.json({
          preguntas,
          recortado,
          promptVersion: PROMPT_VERSION,
        });
      }
      console.warn(`Intento ${intento}: respuesta inválida del modelo`);
    }

    return Response.json(
      {
        error:
          "No hemos podido generar un examen válido de este material. Vuelve a intentarlo en un momento.",
      },
      { status: 502 }
    );
  } catch (err) {
    console.error("Error llamando a Claude API:", err);
    return Response.json(
      { error: "Error generando el examen. Inténtalo de nuevo." },
      { status: 500 }
    );
  }
}
