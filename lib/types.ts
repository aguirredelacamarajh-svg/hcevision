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

// ─── Análisis conceptual de materiales ───────────────────────────────────────

export type Importancia = "fundamental" | "importante" | "complementario";

export interface Tema {
  nombre: string;
  importancia: Importancia;
  resumen: string;
  conceptos: string[];
  dependencias: string[]; // nombres de temas que conviene dominar antes
}

export interface PasoRuta {
  tema: string;
  razon: string;
}

export interface MaterialAnalysis {
  resumen: string;
  temas: Tema[];
  ruta: PasoRuta[];
}

export type AnalysisStatus = "pending" | "processing" | "ready" | "error";

export interface StudyMaterial {
  id: string;
  folder_id: string | null;
  title: string;
  source_text: string;
  char_count: number;
  analysis: MaterialAnalysis | null;
  analysis_status: AnalysisStatus;
  created_at: string;
}

// ─── Flashcards ──────────────────────────────────────────────────────────────

export interface Flashcard {
  id: string;
  material_id: string;
  tema: string;
  front: string;
  back: string;
}

export type FlashcardRating = 1 | 2 | 3; // 1 otra vez · 2 difícil · 3 bien

// ─── Tutor ───────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ─── Casos clínicos ──────────────────────────────────────────────────────────

export const FASES_CASO = [
  "anamnesis",
  "exploración",
  "pruebas",
  "diagnóstico",
  "tratamiento",
] as const;
export type FaseCaso = (typeof FASES_CASO)[number];

export interface PasoCaso {
  fase: FaseCaso;
  situacion: string; // nueva información que se revela en esta fase
  pregunta: string;
  opciones: string[]; // exactamente 4
  correcta: number; // índice 0-3
  feedback: string; // por qué la correcta es correcta y las demás no
}

export interface CasoClinico {
  titulo: string;
  presentacion: string; // viñeta inicial del paciente
  pasos: PasoCaso[]; // exactamente 5, uno por fase en orden
  perlas: string[]; // 3-5 puntos clave para llevarse
}
