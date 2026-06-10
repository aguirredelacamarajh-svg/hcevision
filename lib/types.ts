// ─── Tipos compartidos entre cliente y servidor ──────────────────────────────

export type Nivel = "básico" | "intermedio" | "avanzado";

export const VALID_NUM_QUESTIONS = [10, 20, 30, 40] as const;
export type NumPreguntas = (typeof VALID_NUM_QUESTIONS)[number];

export interface Question {
  enunciado: string;
  opciones: string[]; // exactamente 4: [A, B, C, D]
  correcta: number; // índice 0-3
  explicacion: string;
}

export interface GenerateResponse {
  preguntas: Question[];
  recortado: boolean; // true si el material superaba el límite y se truncó
  promptVersion: string;
}

export interface GenerateError {
  error: string;
}
