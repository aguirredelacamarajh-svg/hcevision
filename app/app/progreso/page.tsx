"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { computeSrsStates, isDue, type ReviewRecord, type SrsState } from "@/lib/srs";
import { AppHeader } from "@/components/AppHeader";

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface AttemptPoint {
  examId: string;
  examTitle: string;
  pct: number;
  date: string; // ISO
}

interface MaterialStats {
  id: string;
  title: string;
  examCount: number;
  attemptCount: number;
  lastPct: number | null;
  bestPct: number | null;
  cards: { total: number; dominadas: number; enProgreso: number; nuevas: number };
  temas: { nombre: string; estado: "dominado" | "progreso" | "pendiente" }[];
}

// ─── Utilidades ──────────────────────────────────────────────────────────────

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function computeStreak(activeDays: Set<string>): { streak: number; activeToday: boolean } {
  const d = new Date();
  const activeToday = activeDays.has(dayKey(d));
  // Si hoy aún no estudiaste, la racha sigue viva desde ayer
  if (!activeToday) d.setDate(d.getDate() - 1);
  let streak = 0;
  while (activeDays.has(dayKey(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return { streak, activeToday };
}

function pctColor(pct: number): string {
  return pct >= 70 ? "#6f8a4a" : pct >= 50 ? "#d97706" : "#bb4e33";
}

// Dominio de una tarjeta según su escalón SRS:
//   step >= 3 (intervalo ≥ 7 días) → dominada
//   step 1-2                       → en progreso
//   step 0 / sin repasos           → nueva
function cardBucket(state: SrsState | undefined): "dominada" | "enProgreso" | "nueva" {
  if (!state || state.lastReviewedAt === null) return "nueva";
  if (state.step >= 3) return "dominada";
  if (state.step >= 1) return "enProgreso";
  return "nueva";
}

// ─── Página ──────────────────────────────────────────────────────────────────

export default function ProgresoPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState<AttemptPoint[]>([]);
  const [streak, setStreak] = useState(0);
  const [activeToday, setActiveToday] = useState(false);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [avgPct30, setAvgPct30] = useState<number | null>(null);
  const [dueCount, setDueCount] = useState(0);
  const [cardTotals, setCardTotals] = useState({ total: 0, dominadas: 0 });
  const [materialStats, setMaterialStats] = useState<MaterialStats[]>([]);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const [
        { data: exams },
        { data: attempts },
        { data: cards },
        { data: reviews },
        { data: materials },
      ] = await Promise.all([
        supabase.from("saved_exams").select("id, title, folder_id, material_id, score, num_questions, attempted_at"),
        supabase.from("exam_attempts").select("exam_id, score, num_questions, attempted_at"),
        supabase.from("flashcards").select("id, material_id, tema"),
        supabase.from("flashcard_reviews").select("flashcard_id, rating, reviewed_at"),
        supabase.from("study_materials").select("id, title"),
      ]);

      const examById = new Map((exams ?? []).map((e) => [e.id, e]));

      // ── Intentos cronológicos (exam_attempts + legado en saved_exams sin intentos) ──
      const examsWithAttempts = new Set((attempts ?? []).map((a) => a.exam_id));
      const allAttempts: AttemptPoint[] = [
        ...(attempts ?? []).map((a) => ({
          examId: a.exam_id,
          examTitle: examById.get(a.exam_id)?.title ?? "Examen",
          pct: Math.round((a.score / a.num_questions) * 100),
          date: a.attempted_at,
        })),
        ...(exams ?? [])
          .filter((e) => e.score != null && !examsWithAttempts.has(e.id))
          .map((e) => ({
            examId: e.id,
            examTitle: e.title,
            pct: Math.round((e.score / e.num_questions) * 100),
            date: e.attempted_at ?? new Date().toISOString(),
          })),
      ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setPoints(allAttempts.slice(-30));
      setTotalAttempts(allAttempts.length);

      const cutoff = Date.now() - 30 * 86_400_000;
      const recent = allAttempts.filter((p) => new Date(p.date).getTime() >= cutoff);
      setAvgPct30(recent.length > 0
        ? Math.round(recent.reduce((s, p) => s + p.pct, 0) / recent.length)
        : null);

      // ── Racha: días con algún intento o repaso ──
      const activeDays = new Set<string>();
      for (const p of allAttempts) activeDays.add(dayKey(new Date(p.date)));
      for (const r of (reviews ?? [])) activeDays.add(dayKey(new Date(r.reviewed_at)));
      const s = computeStreak(activeDays);
      setStreak(s.streak);
      setActiveToday(s.activeToday);

      // ── SRS global ──
      const states = computeSrsStates((reviews ?? []) as ReviewRecord[]);
      const allCards = cards ?? [];
      setDueCount(allCards.filter((c) => isDue(states.get(c.id))).length);
      setCardTotals({
        total: allCards.length,
        dominadas: allCards.filter((c) => cardBucket(states.get(c.id)) === "dominada").length,
      });

      // ── Por material ──
      const stats: MaterialStats[] = (materials ?? []).map((m) => {
        const matExams = (exams ?? []).filter((e) => e.material_id === m.id);
        const matExamIds = new Set(matExams.map((e) => e.id));
        const matAttempts = allAttempts.filter((p) => matExamIds.has(p.examId));
        const last = matAttempts[matAttempts.length - 1];
        const best = matAttempts.length > 0 ? Math.max(...matAttempts.map((p) => p.pct)) : null;

        const matCards = allCards.filter((c) => c.material_id === m.id);
        const buckets = { dominadas: 0, enProgreso: 0, nuevas: 0 };
        const byTema = new Map<string, SrsState[]>();
        for (const c of matCards) {
          const st = states.get(c.id);
          buckets[cardBucket(st) === "dominada" ? "dominadas" : cardBucket(st) === "enProgreso" ? "enProgreso" : "nuevas"]++;
          const list = byTema.get(c.tema);
          const entry = st ?? { step: 0, due: new Date(0), lastReviewedAt: null };
          if (list) list.push(entry);
          else byTema.set(c.tema, [entry]);
        }

        const temas = [...byTema.entries()].map(([nombre, sts]) => {
          const avgStep = sts.reduce((acc, x) => acc + (x.lastReviewedAt ? x.step : 0), 0) / sts.length;
          const estado: "dominado" | "progreso" | "pendiente" =
            avgStep >= 3 ? "dominado" : avgStep >= 1 ? "progreso" : "pendiente";
          return { nombre, estado };
        });

        return {
          id: m.id,
          title: m.title,
          examCount: matExams.length,
          attemptCount: matAttempts.length,
          lastPct: last?.pct ?? null,
          bestPct: best,
          cards: { total: matCards.length, ...buckets },
          temas,
        };
      }).filter((m) => m.examCount > 0 || m.cards.total > 0);

      setMaterialStats(stats);
      setLoading(false);
    }
    load();
  }, []);

  // ── Gráfica SVG de evolución ──
  const W = 600, H = 180, PAD = 28;
  const chartPoints = points.map((p, i) => ({
    x: points.length === 1 ? W / 2 : PAD + (i * (W - PAD * 2)) / (points.length - 1),
    y: H - PAD - (p.pct / 100) * (H - PAD * 2),
    ...p,
  }));
  const polyline = chartPoints.map((p) => `${p.x},${p.y}`).join(" ");
  const yFor = (pct: number) => H - PAD - (pct / 100) * (H - PAD * 2);

  const TEMA_ESTADO = {
    dominado: "bg-green-100 text-green-700 border-green-200",
    progreso: "bg-amber-100 text-amber-700 border-amber-200",
    pendiente: "bg-slate-100 text-slate-500 border-slate-200",
  } as const;

  return (
    <main className="min-h-screen text-slate-900">
      <AppHeader backHref="/app" backLabel="← Campus" />

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8 animate-fade-up">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600 mb-2">Memoria académica</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-800">Tu progreso 📈</h1>
          <p className="text-slate-500 text-sm mt-1">Lo que se mide, se mejora. Lo que se repasa, se recuerda.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* ── Resumen ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-3xl font-bold text-slate-800">
                  {streak > 0 ? `🔥 ${streak}` : "🌱 0"}
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  {streak === 1 ? "día de racha" : "días de racha"}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {activeToday ? "Hoy ya estudiaste ✓" : streak > 0 ? "Estudiá hoy para mantenerla" : "Un repaso de 2 minutos la enciende"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-3xl font-bold text-slate-800">{totalAttempts}</p>
                <p className="text-sm text-slate-500 mt-1">exámenes realizados</p>
                {avgPct30 != null && (
                  <p className="text-xs mt-1 font-semibold" style={{ color: pctColor(avgPct30) }}>
                    {avgPct30}% de media (30 días)
                  </p>
                )}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-3xl font-bold text-slate-800">
                  {cardTotals.dominadas}<span className="text-lg text-slate-400 font-semibold">/{cardTotals.total}</span>
                </p>
                <p className="text-sm text-slate-500 mt-1">tarjetas dominadas</p>
                <p className="text-xs text-slate-400 mt-1">intervalo de 7+ días</p>
              </div>
              <Link href="/app/repaso" className={`rounded-2xl border p-5 transition hover:shadow-md ${dueCount > 0 ? "border-amber-200 bg-amber-50 hover:border-amber-300" : "border-slate-200 bg-white"}`}>
                <p className="text-3xl font-bold text-slate-800">{dueCount > 0 ? `🔁 ${dueCount}` : "🌿 0"}</p>
                <p className="text-sm text-slate-500 mt-1">repasos pendientes</p>
                <p className="text-xs mt-1 font-semibold text-blue-600">
                  {dueCount > 0 ? "Repasar ahora →" : "Todo al día"}
                </p>
              </Link>
            </div>

            {/* ── Evolución de notas ── */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="font-semibold text-slate-800 mb-1">Evolución de notas</h2>
              <p className="text-xs text-slate-400 mb-4">
                {points.length > 0 ? `Últimos ${points.length} intentos` : "Aún sin intentos"}
              </p>

              {points.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-slate-400 text-sm mb-4">Hacé tu primer examen para empezar a dibujar la curva.</p>
                  <Link href="/app/nuevo" className="px-6 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition">
                    + Examen
                  </Link>
                </div>
              ) : (
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Evolución de notas">
                  {/* Rejilla */}
                  {[0, 50, 70, 100].map((pct) => (
                    <g key={pct}>
                      <line x1={PAD} x2={W - PAD} y1={yFor(pct)} y2={yFor(pct)}
                        stroke={pct === 70 ? "#6f8a4a" : "#e7e0d2"}
                        strokeWidth="1" strokeDasharray={pct === 70 ? "4 4" : undefined} />
                      <text x={PAD - 6} y={yFor(pct) + 3} textAnchor="end" fontSize="9" fill="#a8a094">{pct}</text>
                    </g>
                  ))}
                  {/* Área + línea */}
                  {chartPoints.length > 1 && (
                    <>
                      <polygon
                        points={`${PAD},${H - PAD} ${polyline} ${W - PAD},${H - PAD}`}
                        fill="#c76a3c" opacity="0.08"
                      />
                      <polyline points={polyline} fill="none" stroke="#c76a3c" strokeWidth="2" strokeLinejoin="round" />
                    </>
                  )}
                  {/* Puntos */}
                  {chartPoints.map((p, i) => (
                    <g key={i}>
                      <circle cx={p.x} cy={p.y} r="4" fill={pctColor(p.pct)} stroke="#fff" strokeWidth="1.5" />
                      {(i === chartPoints.length - 1 || chartPoints.length <= 8) && (
                        <text x={p.x} y={p.y - 9} textAnchor="middle" fontSize="9" fontWeight="600" fill={pctColor(p.pct)}>
                          {p.pct}%
                        </text>
                      )}
                    </g>
                  ))}
                </svg>
              )}
            </section>

            {/* ── Por material ── */}
            {materialStats.length > 0 && (
              <section>
                <h2 className="font-semibold text-slate-800 mb-3">Por material</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {materialStats.map((m) => {
                    const pctDom = m.cards.total > 0 ? (m.cards.dominadas / m.cards.total) * 100 : 0;
                    const pctProg = m.cards.total > 0 ? (m.cards.enProgreso / m.cards.total) * 100 : 0;
                    return (
                      <Link key={m.id} href={`/app/material/${m.id}`}
                        className="rounded-2xl border border-slate-200 bg-white p-5 hover:shadow-md hover:border-slate-300 transition block">
                        <p className="font-semibold text-slate-800 mb-3 line-clamp-1">📚 {m.title}</p>

                        <div className="flex items-center gap-4 text-sm text-slate-500 mb-3">
                          <span>{m.attemptCount} {m.attemptCount === 1 ? "intento" : "intentos"}</span>
                          {m.lastPct != null && (
                            <span>Última: <span className="font-semibold" style={{ color: pctColor(m.lastPct) }}>{m.lastPct}%</span></span>
                          )}
                          {m.bestPct != null && m.bestPct !== m.lastPct && (
                            <span>Mejor: <span className="font-semibold" style={{ color: pctColor(m.bestPct) }}>{m.bestPct}%</span></span>
                          )}
                        </div>

                        {m.cards.total > 0 && (
                          <>
                            <div className="flex justify-between text-xs text-slate-400 mb-1">
                              <span>Memoria · {m.cards.dominadas} de {m.cards.total} dominadas</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex">
                              <div className="h-full bg-green-500" style={{ width: `${pctDom}%` }} />
                              <div className="h-full bg-amber-400" style={{ width: `${pctProg}%` }} />
                            </div>
                          </>
                        )}

                        {m.temas.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {m.temas.map((t) => (
                              <span key={t.nombre}
                                className={`text-xs px-2 py-0.5 rounded-full border ${TEMA_ESTADO[t.estado]}`}>
                                {t.estado === "dominado" ? "✓ " : ""}{t.nombre}
                              </span>
                            ))}
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
