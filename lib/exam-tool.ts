// ─── Herramienta de tool-calling y validación del examen ─────────────────────
// Compartida por /api/generate y /api/refuerzo.

import type Anthropic from "@anthropic-ai/sdk";
import type { Question } from "./types";

export function makeExamTool(numPreguntas: number): Anthropic.Tool {
  return {
    name: "entregar_examen",
    description: "Entrega el examen tipo test generado a partir del material.",
    input_schema: {
      type: "object",
      properties: {
        preguntas: {
          type: "array",
          items: {
            type: "object",
            properties: {
              enunciado: { type: "string" },
              opciones: {
                type: "array",
                items: { type: "string" },
                minItems: 4,
                maxItems: 4,
              },
              correcta: { type: "integer", minimum: 0, maximum: 3 },
              explicacion: { type: "string" },
            },
            required: ["enunciado", "opciones", "correcta", "explicacion"],
          },
          minItems: numPreguntas,
          maxItems: numPreguntas,
        },
      },
      required: ["preguntas"],
    },
  };
}

export function validateQuestions(
  input: unknown,
  numPreguntas: number
): Question[] | null {
  if (typeof input !== "object" || input === null) return null;
  const preguntas = (input as { preguntas?: unknown }).preguntas;
  if (!Array.isArray(preguntas) || preguntas.length !== numPreguntas)
    return null;

  for (const q of preguntas) {
    if (typeof q !== "object" || q === null) return null;
    const { enunciado, opciones, correcta, explicacion } = q as Record<
      string,
      unknown
    >;
    if (typeof enunciado !== "string" || enunciado.trim().length < 20)
      return null;
    if (
      !Array.isArray(opciones) ||
      opciones.length !== 4 ||
      opciones.some((o) => typeof o !== "string" || o.trim().length === 0)
    )
      return null;
    if (
      typeof correcta !== "number" ||
      !Number.isInteger(correcta) ||
      correcta < 0 ||
      correcta > 3
    )
      return null;
    if (typeof explicacion !== "string" || explicacion.trim().length < 30)
      return null;
  }
  return preguntas as unknown as Question[];
}
