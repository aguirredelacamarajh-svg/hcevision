// ─── Repaso espaciado (SM-2 simplificado) ────────────────────────────────────
//
// Cada tarjeta avanza por una escalera de intervalos según sus repasos:
//   rating 3 (bien)    → sube un escalón
//   rating 2 (difícil) → repite el escalón actual
//   rating 1 (otra vez)→ vuelve al escalón 0 (repasar hoy mismo)
// Una tarjeta sin repasos es "nueva" y está pendiente desde su creación.

import type { FlashcardRating } from "./types";

export const SRS_STEPS_DAYS = [0, 1, 3, 7, 14, 30, 60] as const;

export interface ReviewRecord {
  flashcard_id: string;
  rating: FlashcardRating | number;
  reviewed_at: string;
}

export interface SrsState {
  step: number; // índice en SRS_STEPS_DAYS
  due: Date; // cuándo vuelve a tocar
  lastReviewedAt: Date | null; // null = tarjeta nueva
}

/** Calcula el estado SRS de una tarjeta a partir de su historial (en cualquier orden). */
export function computeSrsState(reviews: ReviewRecord[]): SrsState {
  if (reviews.length === 0) {
    return { step: 0, due: new Date(0), lastReviewedAt: null };
  }

  const ordered = [...reviews].sort(
    (a, b) => new Date(a.reviewed_at).getTime() - new Date(b.reviewed_at).getTime()
  );

  let step = 0;
  for (const r of ordered) {
    if (r.rating === 3) step = Math.min(step + 1, SRS_STEPS_DAYS.length - 1);
    else if (r.rating === 1) step = 0;
    // rating 2: repite el escalón actual
  }

  const last = new Date(ordered[ordered.length - 1].reviewed_at);
  const due = new Date(last.getTime() + SRS_STEPS_DAYS[step] * 86_400_000);
  return { step, due, lastReviewedAt: last };
}

/** Agrupa repasos por flashcard_id y devuelve el estado SRS de cada tarjeta. */
export function computeSrsStates(reviews: ReviewRecord[]): Map<string, SrsState> {
  const byCard = new Map<string, ReviewRecord[]>();
  for (const r of reviews) {
    const list = byCard.get(r.flashcard_id);
    if (list) list.push(r);
    else byCard.set(r.flashcard_id, [r]);
  }
  const states = new Map<string, SrsState>();
  for (const [id, list] of byCard) states.set(id, computeSrsState(list));
  return states;
}

/** Una tarjeta toca hoy si su fecha de vencimiento ya pasó (las nuevas siempre tocan). */
export function isDue(state: SrsState | undefined, now = new Date()): boolean {
  if (!state) return true; // sin historial = nueva = pendiente
  return state.due.getTime() <= now.getTime();
}
