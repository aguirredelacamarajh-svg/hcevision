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

// ─── Análisis conceptual ──────────────────────────────────────────────────────

export const ANALYSIS_PROMPT_VERSION = "v0.1";

export const ANALYSIS_SYSTEM_PROMPT = `Eres un profesor de medicina experto en didáctica y organización del conocimiento. Tu tarea es analizar material de estudio médico y construir una representación estructurada: los temas principales, su importancia relativa, las relaciones de dependencia entre ellos y el orden óptimo de estudio. Respondes exclusivamente usando la herramienta entregar_analisis.`;

export function buildAnalysisPrompt(material: string): string {
  return `Analiza EXCLUSIVAMENTE el material de estudio adjunto y construye su estructura conceptual.

Reglas obligatorias:
1. Identifica entre 4 y 10 temas. Cada tema debe existir realmente en el material; no inventes contenido externo.
2. Clasifica cada tema por importancia: "fundamental" (imprescindible para entender la materia), "importante" (núcleo del temario) o "complementario" (detalle o profundización).
3. En "dependencias" lista los nombres EXACTOS de otros temas de tu propia lista que conviene dominar antes. Un tema sin requisitos lleva lista vacía. No crees ciclos.
4. En "conceptos" lista de 3 a 8 conceptos clave concretos del tema (términos, clasificaciones, criterios, fármacos, valores).
5. La "ruta" ordena TODOS los temas para estudiarlos de forma óptima, respetando las dependencias. Cada paso explica en una frase por qué va en esa posición.
6. El "resumen" general explica en 2-4 frases qué cubre el material y qué debe lograr el estudiante.
7. Español de España, terminología clínica estándar.

MATERIAL DE ESTUDIO:
"""
${material}
"""`;
}

// ─── Flashcards ───────────────────────────────────────────────────────────────

export const FLASHCARDS_PROMPT_VERSION = "v0.1";

export const FLASHCARDS_SYSTEM_PROMPT = `Eres un profesor de medicina experto en active recall y repetición espaciada. Tu tarea es crear flashcards de alta calidad a partir de material de estudio médico. Respondes exclusivamente usando la herramienta entregar_flashcards.`;

export function buildFlashcardsPrompt(
  material: string,
  cantidad: number,
  tema?: string
): string {
  return `A partir EXCLUSIVAMENTE del material de estudio adjunto, genera exactamente ${cantidad} flashcards para active recall.${tema ? `\n\nCéntrate únicamente en el tema: "${tema}".` : ""}

Reglas obligatorias:
1. El frente ("front") es una pregunta concreta y autocontenida, o un concepto a definir. Nunca "¿Qué dice el texto sobre...?".
2. El dorso ("back") es la respuesta precisa y breve (1-3 frases). Sin rodeos.
3. Cada tarjeta evalúa UN solo concepto. Prohibidas las tarjetas con listas de más de 4 elementos.
4. Prioriza lo clínicamente relevante: criterios diagnósticos, mecanismos, valores de referencia, tratamientos de elección, contraindicaciones.
5. En "tema" indica a qué tema del material pertenece la tarjeta (nombre corto).
6. Todo debe poder verificarse con el material adjunto. Español de España.

MATERIAL DE ESTUDIO:
"""
${material}
"""`;
}
