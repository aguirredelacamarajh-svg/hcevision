"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Flashcard, FlashcardRating } from "@/lib/types";
import { computeSrsStates, isDue, type ReviewRecord } from "@/lib/srs";
import { AppHeader } from "@/components/AppHeader";

type Screen = "loading" | "empty" | "clear" | "study" | "done";

const MAX_SESSION_CARDS = 40;

const RATING_LABELS: { rating: FlashcardRating; label: string; emoji: string; cls: string }[] = [
  { rating: 1, label: "Otra vez", emoji: "🔄", cls: "border-red-300 text-red-600 hover:bg-red-50" },
  { rating: 2, label: "Difícil", emoji: "🤔", cls: "border-amber-300 text-amber-700 hover:bg-amber-50" },
  { rating: 3, label: "Bien", emoji: "✨", cls: "border-green-300 text-green-700 hover:bg-green-50" },
];

interface DueCard extends Flashcard {
  materialTitle: string;
}

export default function RepasoGlobal() {
  const router = useRouter();
  const supabase = createClient();

  const [screen, setScreen] = useState<Screen>("loading");
  const [userId, setUserId] = useState("");
  const [queue, setQueue] = useState<DueCard[]>([]);
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [initialCount, setInitialCount] = useState(0);
  const [totalCards, setTotalCards] = useState(0);
  const [counts, setCounts] = useState({ again: 0, hard: 0, good: 0 });

  const load = useCallback(async () => {
    setScreen("loading");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    setUserId(user.id);

    const [{ data: cards }, { data: reviews }, { data: materials }] = await Promise.all([
      supabase.from("flashcards").select("id, material_id, tema, front, back"),
      supabase.from("flashcard_reviews").select("flashcard_id, rating, reviewed_at"),
      supabase.from("study_materials").select("id, title"),
    ]);

    const deck = (cards ?? []) as Flashcard[];
    setTotalCards(deck.length);
    if (deck.length === 0) { setScreen("empty"); return; }

    const titleById = new Map((materials ?? []).map((m) => [m.id, m.title as string]));
    const states = computeSrsStates((reviews ?? []) as ReviewRecord[]);

    const due = deck
      .filter((c) => isDue(states.get(c.id)))
      .sort((a, b) => {
        const da = states.get(a.id)?.due.getTime() ?? 0;
        const db = states.get(b.id)?.due.getTime() ?? 0;
        return da - db; // las más atrasadas (y las nuevas) primero
      })
      .slice(0, MAX_SESSION_CARDS)
      .map((c) => ({ ...c, materialTitle: titleById.get(c.material_id) ?? "" }));

    if (due.length === 0) { setScreen("clear"); return; }

    // Barajar la selección para que cada sesión sea distinta
    const shuffled = [...due].sort(() => Math.random() - 0.5);
    setQueue(shuffled);
    setInitialCount(shuffled.length);
    setPos(0);
    setFlipped(false);
    setCounts({ again: 0, hard: 0, good: 0 });
    setScreen("study");
  }, []);

  useEffect(() => { load(); }, [load]);

  function rate(rating: FlashcardRating) {
    const card = queue[pos];
    if (!card) return;

    // Registrar el repaso (sin bloquear la UI; la sesión sigue aunque falle)
    supabase.from("flashcard_reviews")
      .insert({ flashcard_id: card.id, user_id: userId, rating })
      .then(({ error }) => { if (error) console.warn("review insert failed:", error.message); });

    setCounts((c) => ({
      again: c.again + (rating === 1 ? 1 : 0),
      hard: c.hard + (rating === 2 ? 1 : 0),
      good: c.good + (rating === 3 ? 1 : 0),
    }));

    let nextQueue = queue;
    if (rating === 1) nextQueue = [...queue, card]; // vuelve al final de la cola
    const nextPos = pos + 1;

    if (nextPos >= nextQueue.length) {
      setScreen("done");
    } else {
      setQueue(nextQueue);
      setPos(nextPos);
      setFlipped(false);
    }
  }

  const card = queue[pos];
  const reviewed = pos;
  const total = queue.length;

  return (
    <main className="min-h-screen text-slate-900 flex flex-col">
      <AppHeader backHref="/app" backLabel="← Campus" />

      <div className="flex-1 flex flex-col items-center px-4 pb-16">

        {screen === "loading" && (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {screen === "empty" && (
          <div className="flex-1 flex items-center justify-center text-center animate-fade-up">
            <div className="max-w-sm">
              <p className="text-4xl mb-4">🃏</p>
              <h1 className="text-2xl font-bold mb-2">Aún no tenés flashcards</h1>
              <p className="text-sm text-slate-500 mb-6">
                Generá flashcards desde cualquier material de estudio y acá te avisaremos cuándo toca repasarlas.
              </p>
              <Link href="/app" className="px-8 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition inline-block">
                Ir a mis materiales
              </Link>
            </div>
          </div>
        )}

        {screen === "clear" && (
          <div className="flex-1 flex items-center justify-center text-center animate-fade-up">
            <div className="max-w-sm">
              <p className="text-4xl mb-4">🌿</p>
              <h1 className="text-2xl font-bold mb-2">Todo al día</h1>
              <p className="text-sm text-slate-500 mb-6">
                Ninguna de tus {totalCards} tarjetas toca hoy. La memoria se construye descansando también.
              </p>
              <Link href="/app" className="px-8 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition inline-block">
                ← Volver al campus
              </Link>
            </div>
          </div>
        )}

        {screen === "study" && card && (
          <div className="w-full max-w-lg mt-8 animate-fade-up">
            {/* Progreso */}
            <div className="mb-6">
              <div className="flex items-center justify-between text-sm text-slate-500 mb-2">
                <span className="font-medium">🔁 Repaso del día</span>
                <span className="shrink-0">{reviewed + 1} de {total}</span>
              </div>
              <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full transition-all"
                  style={{ width: `${(reviewed / total) * 100}%` }} />
              </div>
            </div>

            {/* Tarjeta */}
            <div className="perspective-1200">
              <div
                onClick={() => setFlipped((f) => !f)}
                className={`relative w-full min-h-[300px] cursor-pointer transition-transform duration-500 preserve-3d ${flipped ? "rotate-y-180" : ""}`}
              >
                {/* Frente */}
                <div className="absolute inset-0 backface-hidden rounded-3xl border-2 border-slate-200 bg-white shadow-md p-8 flex flex-col">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <span className="text-xs font-semibold uppercase tracking-wide text-blue-600">{card.tema}</span>
                    {card.materialTitle && (
                      <span className="text-xs text-slate-400 truncate">📚 {card.materialTitle}</span>
                    )}
                  </div>
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-lg sm:text-xl font-semibold text-center leading-relaxed font-display">{card.front}</p>
                  </div>
                  <p className="text-xs text-slate-400 text-center mt-4">Tocá la tarjeta para ver la respuesta</p>
                </div>
                {/* Dorso */}
                <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-3xl border-2 border-blue-300 bg-blue-50 shadow-md p-8 flex flex-col">
                  <span className="text-xs font-semibold uppercase tracking-wide text-blue-600 mb-4">Respuesta</span>
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-base sm:text-lg text-slate-800 text-center leading-relaxed">{card.back}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Calificación */}
            <div className={`mt-6 grid grid-cols-3 gap-3 transition-opacity ${flipped ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
              {RATING_LABELS.map((r) => (
                <button key={r.rating} onClick={() => rate(r.rating)}
                  className={`py-3.5 rounded-2xl border-2 bg-white text-sm font-semibold transition ${r.cls}`}>
                  <span className="block text-xl mb-1">{r.emoji}</span>
                  {r.label}
                </button>
              ))}
            </div>
            {!flipped && (
              <p className="mt-6 text-center text-sm text-slate-400">
                Primero intentá responder de memoria 🧠
              </p>
            )}
          </div>
        )}

        {screen === "done" && (
          <div className="w-full max-w-md mt-16 text-center animate-fade-up">
            <p className="text-5xl mb-4">🌿</p>
            <h1 className="text-3xl font-bold">Repaso completado</h1>
            <p className="mt-2 text-slate-500">
              Repasaste {initialCount} tarjetas{counts.again > 0 ? ` (+${counts.again} repeticiones)` : ""}. Tu memoria de mañana te lo agradece.
            </p>

            <div className="mt-8 grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
                <p className="text-2xl font-bold text-green-700">{counts.good}</p>
                <p className="text-xs text-green-700 mt-1">Bien</p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-2xl font-bold text-amber-700">{counts.hard}</p>
                <p className="text-xs text-amber-700 mt-1">Difícil</p>
              </div>
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <p className="text-2xl font-bold text-red-600">{counts.again}</p>
                <p className="text-xs text-red-600 mt-1">Otra vez</p>
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <Link href="/app"
                className="flex-1 py-3 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-white transition">
                ← Campus
              </Link>
              <button onClick={load}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition">
                ↺ ¿Queda algo pendiente?
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
