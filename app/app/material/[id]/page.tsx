"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { StudyMaterial, Tema, MaterialAnalysis } from "@/lib/types";
import { AppHeader } from "@/components/AppHeader";

interface LinkedExam {
  id: string;
  title: string;
  score: number | null;
  num_questions: number;
  created_at: string;
}

interface FolderInfo { id: string; name: string; color: string; }

const FOLDER_CHIP: Record<string, string> = {
  blue:   "bg-blue-100 text-blue-700 border-blue-200",
  green:  "bg-green-100 text-green-700 border-green-200",
  purple: "bg-purple-100 text-purple-700 border-purple-200",
  rose:   "bg-rose-100 text-rose-700 border-rose-200",
  amber:  "bg-amber-100 text-amber-700 border-amber-200",
  teal:   "bg-teal-100 text-teal-700 border-teal-200",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

// ─── Mapa conceptual ──────────────────────────────────────────────────────────
// Distribuye los temas en niveles según sus dependencias y dibuja las
// conexiones con curvas SVG medidas sobre el layout real.

function ConceptMap({ temas }: { temas: Tema[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [edges, setEdges] = useState<{ d: string; key: string }[]>([]);
  const [selected, setSelected] = useState<Tema | null>(null);

  const byName = useMemo(() => {
    const m = new Map<string, Tema>();
    for (const t of temas) m.set(t.nombre.toLowerCase(), t);
    return m;
  }, [temas]);

  // Nivel = profundidad máxima de la cadena de dependencias (con tope anticiclos)
  const levels = useMemo(() => {
    const depthCache = new Map<string, number>();
    function depth(t: Tema, seen: Set<string>): number {
      const key = t.nombre.toLowerCase();
      if (depthCache.has(key)) return depthCache.get(key)!;
      if (seen.has(key) || seen.size > 8) return 0;
      seen.add(key);
      let d = 0;
      for (const dep of t.dependencias) {
        const parent = byName.get(dep.toLowerCase());
        if (parent) d = Math.max(d, 1 + depth(parent, seen));
      }
      seen.delete(key);
      depthCache.set(key, d);
      return d;
    }
    const grouped: Tema[][] = [];
    for (const t of temas) {
      const d = depth(t, new Set());
      if (!grouped[d]) grouped[d] = [];
      grouped[d].push(t);
    }
    return grouped.filter(Boolean);
  }, [temas, byName]);

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const cRect = container.getBoundingClientRect();
    const next: { d: string; key: string }[] = [];
    for (const t of temas) {
      const toEl = nodeRefs.current.get(t.nombre.toLowerCase());
      if (!toEl) continue;
      const toRect = toEl.getBoundingClientRect();
      for (const dep of t.dependencias) {
        const fromEl = nodeRefs.current.get(dep.toLowerCase());
        if (!fromEl) continue;
        const fromRect = fromEl.getBoundingClientRect();
        const x1 = fromRect.left + fromRect.width / 2 - cRect.left;
        const y1 = fromRect.bottom - cRect.top;
        const x2 = toRect.left + toRect.width / 2 - cRect.left;
        const y2 = toRect.top - cRect.top;
        const bend = Math.max(24, (y2 - y1) / 2);
        next.push({
          key: `${dep}→${t.nombre}`,
          d: `M ${x1} ${y1} C ${x1} ${y1 + bend}, ${x2} ${y2 - bend}, ${x2} ${y2}`,
        });
      }
    }
    setEdges(next);
  }, [temas]);

  useEffect(() => {
    measure();
    const obs = new ResizeObserver(measure);
    if (containerRef.current) obs.observe(containerRef.current);
    window.addEventListener("resize", measure);
    return () => { obs.disconnect(); window.removeEventListener("resize", measure); };
  }, [measure]);

  function nodeClass(t: Tema) {
    const isSelected = selected?.nombre === t.nombre;
    const base = "relative z-10 rounded-2xl border-2 px-4 py-2.5 text-sm font-semibold transition shadow-sm cursor-pointer text-left ";
    if (t.importancia === "fundamental")
      return base + (isSelected
        ? "bg-blue-600 border-blue-700 text-white shadow-md scale-[1.03]"
        : "bg-blue-600/90 border-blue-600 text-white hover:bg-blue-600 hover:shadow-md");
    if (t.importancia === "importante")
      return base + (isSelected
        ? "bg-blue-50 border-blue-500 text-blue-800 shadow-md scale-[1.03]"
        : "bg-white border-blue-300 text-slate-800 hover:border-blue-500");
    return base + (isSelected
      ? "bg-slate-100 border-slate-400 text-slate-700 shadow-md scale-[1.03]"
      : "bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-400");
  }

  return (
    <div>
      <div ref={containerRef} className="relative py-2">
        <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
          {edges.map((e) => (
            <path key={e.key} d={e.d} fill="none" stroke="#d8c5a6" strokeWidth="2" strokeDasharray="1 6" strokeLinecap="round" />
          ))}
        </svg>
        <div className="flex flex-col gap-10">
          {levels.map((level, li) => (
            <div key={li} className="flex flex-wrap justify-center gap-3">
              {level.map((t) => (
                <button
                  key={t.nombre}
                  ref={(el) => {
                    if (el) nodeRefs.current.set(t.nombre.toLowerCase(), el);
                    else nodeRefs.current.delete(t.nombre.toLowerCase());
                  }}
                  onClick={() => setSelected(selected?.nombre === t.nombre ? null : t)}
                  className={nodeClass(t)}
                >
                  {t.nombre}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Leyenda */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-blue-600" /> Fundamental</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-white border-2 border-blue-300" /> Importante</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-slate-50 border-2 border-slate-200" /> Complementario</span>
      </div>

      {/* Detalle del tema seleccionado */}
      {selected && (
        <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50/60 p-5 animate-fade-up">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-bold text-slate-800 text-lg">{selected.nombre}</h3>
            <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>
          </div>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">{selected.resumen}</p>
          {selected.conceptos.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Conceptos clave</p>
              <div className="flex flex-wrap gap-2">
                {selected.conceptos.map((c) => (
                  <span key={c} className="text-xs font-medium bg-white border border-blue-200 text-slate-700 rounded-full px-3 py-1">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}
          {selected.dependencias.length > 0 && (
            <p className="mt-4 text-xs text-slate-500">
              <span className="font-semibold">Antes conviene dominar:</span> {selected.dependencias.join(" · ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function MaterialPage() {
  const params = useParams<{ id: string }>();
  const materialId = params.id;
  const router = useRouter();
  const supabase = createClient();

  const [material, setMaterial] = useState<StudyMaterial | null>(null);
  const [folder, setFolder] = useState<FolderInfo | null>(null);
  const [cardCount, setCardCount] = useState(0);
  const [exams, setExams] = useState<LinkedExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [generatingCards, setGeneratingCards] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { data: mat, error } = await supabase
      .from("study_materials")
      .select("id, folder_id, title, source_text, char_count, analysis, analysis_status, created_at")
      .eq("id", materialId)
      .single();

    if (error || !mat) { setNotFound(true); setLoading(false); return; }
    setMaterial(mat as StudyMaterial);

    const [{ count }, { data: examsData }] = await Promise.all([
      supabase.from("flashcards").select("id", { count: "exact", head: true }).eq("material_id", materialId),
      supabase.from("saved_exams").select("id, title, score, num_questions, created_at")
        .eq("material_id", materialId).order("created_at", { ascending: false }),
    ]);
    setCardCount(count ?? 0);
    setExams(examsData ?? []);

    if (mat.folder_id) {
      const { data: f } = await supabase.from("folders").select("id, name, color").eq("id", mat.folder_id).single();
      setFolder(f ?? null);
    }
    setLoading(false);
  }, [materialId]);

  useEffect(() => { load(); }, [load]);

  // Auto-disparar análisis cuando el material llega con status "pending"
  useEffect(() => {
    if (material?.analysis_status === "pending" && !analyzing) {
      analyze();
    }
  }, [material?.analysis_status]);

  async function analyze() {
    setAnalyzing(true);
    setActionError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materialId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setActionError(data?.error ?? "No se pudo analizar el material.");
      }
    } catch {
      setActionError("Error de conexión durante el análisis.");
    }
    await load();
    setAnalyzing(false);
  }

  async function generateFlashcards() {
    setGeneratingCards(true);
    setActionError(null);
    try {
      const res = await fetch("/api/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materialId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setActionError(data?.error ?? "No se pudieron generar las flashcards.");
        setGeneratingCards(false);
        return;
      }
      router.push(`/app/material/${materialId}/flashcards`);
    } catch {
      setActionError("Error de conexión generando flashcards.");
      setGeneratingCards(false);
    }
  }

  const analysis: MaterialAnalysis | null = material?.analysis ?? null;

  return (
    <main className="min-h-screen text-slate-900">
      <AppHeader backHref="/app" backLabel="← Campus" />

      <div className="max-w-3xl mx-auto px-4 py-10">
        {loading && (
          <div className="flex items-center justify-center py-32">
            <div className="w-8 h-8 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {notFound && (
          <div className="text-center py-32">
            <p className="text-4xl mb-4">📭</p>
            <p className="font-semibold text-slate-800 mb-2">Material no encontrado</p>
            <p className="text-sm text-slate-500 mb-6">No existe o no tenés acceso a él.</p>
            <Link href="/app" className="px-6 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition">
              Volver al campus
            </Link>
          </div>
        )}

        {material && (
          <div className="animate-fade-up">
            {/* Cabecera */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Material de estudio</span>
                {folder && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${FOLDER_CHIP[folder.color] ?? FOLDER_CHIP.blue}`}>
                    {folder.name}
                  </span>
                )}
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">{material.title}</h1>
              <p className="mt-2 text-sm text-slate-400">
                {formatDate(material.created_at)} · {Math.round(material.char_count / 1000)} mil caracteres
                {cardCount > 0 && ` · ${cardCount} flashcards`}
              </p>
            </div>

            {actionError && (
              <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{actionError}</div>
            )}

            {/* Estado del análisis */}
            {material.analysis_status !== "ready" && (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center mb-8">
                {analyzing || material.analysis_status === "processing" ? (
                  <>
                    <div className="w-8 h-8 mx-auto border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <p className="mt-4 font-medium text-slate-700">Analizando el material...</p>
                    <p className="mt-1 text-sm text-slate-400">Puede tardar hasta un minuto</p>
                    {material.analysis_status === "processing" && !analyzing && (
                      <button onClick={load} className="mt-4 text-sm text-blue-600 underline underline-offset-2">
                        Actualizar estado
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-3xl mb-3">{material.analysis_status === "error" ? "🌧" : "🗺"}</p>
                    <p className="font-semibold text-slate-800">
                      {material.analysis_status === "error"
                        ? "El análisis no pudo completarse"
                        : "Este material aún no fue analizado"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      El análisis construye el mapa conceptual y la ruta de aprendizaje.
                    </p>
                    <button onClick={analyze}
                      className="mt-5 px-6 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition">
                      {material.analysis_status === "error" ? "Reintentar análisis" : "Analizar material"}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Resumen */}
            {analysis && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 mb-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">En pocas palabras</p>
                <p className="text-slate-700 leading-relaxed">{analysis.resumen}</p>
              </div>
            )}

            {/* Acciones */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-10">
              <Link href={`/app/material/${material.id}/tutor`}
                className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-blue-400 hover:shadow-md transition group">
                <p className="text-2xl mb-2">🧑‍⚕️</p>
                <p className="font-semibold text-slate-800 group-hover:text-blue-700">Tutor</p>
                <p className="text-xs text-slate-400 mt-1">Preguntale o pedile que te tome la lección</p>
              </Link>
              <Link href={`/app/material/${material.id}/caso`}
                className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-blue-400 hover:shadow-md transition group">
                <p className="text-2xl mb-2">🏥</p>
                <p className="font-semibold text-slate-800 group-hover:text-blue-700">Caso clínico</p>
                <p className="text-xs text-slate-400 mt-1">Simulación paso a paso con decisiones</p>
              </Link>
              <Link href={`/app/nuevo?material=${material.id}`}
                className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-blue-400 hover:shadow-md transition group">
                <p className="text-2xl mb-2">📝</p>
                <p className="font-semibold text-slate-800 group-hover:text-blue-700">Generar examen</p>
                <p className="text-xs text-slate-400 mt-1">Tipo test a partir de este material</p>
              </Link>
              <button onClick={generateFlashcards} disabled={generatingCards}
                className="rounded-2xl border border-slate-200 bg-white p-5 text-left hover:border-blue-400 hover:shadow-md transition group disabled:opacity-60">
                <p className="text-2xl mb-2">{generatingCards ? "⏳" : "🃏"}</p>
                <p className="font-semibold text-slate-800 group-hover:text-blue-700">
                  {generatingCards ? "Generando..." : "Generar flashcards"}
                </p>
                <p className="text-xs text-slate-400 mt-1">12 tarjetas de active recall</p>
              </button>
              <Link href={`/app/material/${material.id}/flashcards`}
                className={`rounded-2xl border p-5 transition group ${cardCount > 0
                  ? "border-slate-200 bg-white hover:border-blue-400 hover:shadow-md"
                  : "border-slate-200 bg-slate-50 opacity-60 pointer-events-none"}`}>
                <p className="text-2xl mb-2">🔁</p>
                <p className="font-semibold text-slate-800 group-hover:text-blue-700">Repasar</p>
                <p className="text-xs text-slate-400 mt-1">
                  {cardCount > 0 ? `${cardCount} flashcards te esperan` : "Primero generá flashcards"}
                </p>
              </Link>
            </div>

            {/* Mapa conceptual */}
            {analysis && (
              <section className="mb-10">
                <h2 className="text-xl font-bold mb-1">Mapa conceptual</h2>
                <p className="text-sm text-slate-500 mb-6">
                  Las líneas punteadas indican qué temas conviene dominar antes. Tocá un tema para ver sus conceptos.
                </p>
                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                  <ConceptMap temas={analysis.temas} />
                </div>
              </section>
            )}

            {/* Ruta de aprendizaje */}
            {analysis && analysis.ruta.length > 0 && (
              <section className="mb-10">
                <h2 className="text-xl font-bold mb-1">Ruta de aprendizaje</h2>
                <p className="text-sm text-slate-500 mb-6">El orden recomendado para estudiar este material.</p>
                <ol className="relative border-l-2 border-dashed border-slate-300 ml-4 space-y-6">
                  {analysis.ruta.map((paso, i) => (
                    <li key={i} className="relative pl-8">
                      <span className="absolute -left-[17px] top-0 w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center border-4 border-slate-50">
                        {i + 1}
                      </span>
                      <p className="font-semibold text-slate-800 leading-tight pt-1">{paso.tema}</p>
                      <p className="text-sm text-slate-500 mt-1 leading-relaxed">{paso.razon}</p>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {/* Exámenes vinculados */}
            {exams.length > 0 && (
              <section className="mb-10">
                <h2 className="text-xl font-bold mb-4">Exámenes de este material</h2>
                <div className="space-y-2">
                  {exams.map((e) => {
                    const pct = e.score != null ? Math.round((e.score / e.num_questions) * 100) : null;
                    return (
                      <div key={e.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800 text-sm truncate">{e.title}</p>
                          <p className="text-xs text-slate-400">{formatDate(e.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-3">
                          {pct != null && (
                            <span className={`text-sm font-bold ${pct >= 70 ? "text-green-600" : pct >= 50 ? "text-amber-600" : "text-red-500"}`}>
                              {pct}%
                            </span>
                          )}
                          <Link href={`/app/rehacer/${e.id}`}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-700 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-50 transition">
                            ↺ Rehacer
                          </Link>
                        </div>
                      </div>
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
