// ─── Prompts de generación (activo central del producto — versionar SIEMPRE) ─

import type { Nivel } from "./types";

export const PROMPT_VERSION = "v0.2";

export const SYSTEM_PROMPT = `Eres un profesor de medicina con experiencia redactando exámenes parciales tipo test. Tu única tarea es generar preguntas de examen de alta calidad a partir del material de estudio que te proporciona el estudiante. Respondes exclusivamente usando la herramienta entregar_examen.`;

const NIVEL_INSTRUCCIONES: Record<Nivel, string> = {
  "básico":
    "Nivel BÁSICO: preguntas directas sobre definiciones, clasificaciones y conceptos fundamentales del material. Enunciados cortos y directos. Sin viñetas clínicas complejas.",
  "intermedio":
    "Nivel INTERMEDIO: combina preguntas conceptuales con viñetas clínicas sencillas. El estudiante debe aplicar lo aprendido a casos clínicos simples.",
  "avanzado":
    "Nivel AVANZADO: predominan las viñetas clínicas complejas. El estudiante debe razonar a través de diagnósticos diferenciales, interpretación de pruebas y decisiones terapéuticas. Evitar preguntas de memorización pura.",
};

export function buildUserPrompt(
  material: string,
  numPreguntas: number,
  nivel: Nivel
): string {
  return `A partir EXCLUSIVAMENTE del material de estudio adjunto, genera exactamente ${numPreguntas} preguntas tipo test (4 opciones, 1 correcta).

${NIVEL_INSTRUCCIONES[nivel]}

Reglas obligatorias:
1. Los 3 distractores deben representar errores conceptuales reales y plausibles. Nunca opciones absurdas o evidentemente falsas.
2. La explicación debe razonar por qué la opción correcta es correcta Y por qué cada distractor es falso.
3. Cada pregunta debe poder responderse y verificarse con el material adjunto. Si un concepto requiere conocimiento externo al material, descártalo y elige otro.
4. Español de España, terminología clínica estándar.
5. Prohibido usar "todas las anteriores" o "ninguna de las anteriores".
6. Reparte las preguntas entre los conceptos más importantes del material, no las concentres en una sola sección.

MATERIAL DE ESTUDIO:
"""
${material}
"""`;
}
