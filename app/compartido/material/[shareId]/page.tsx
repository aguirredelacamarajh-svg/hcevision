"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { MaterialAnalysis, Tema } from "@/lib/types";
import { AppHeader } from "@/components/AppHeader";

interface PublicMaterial {
  id: string;
  title: string;
  share_id: string;
  analysis: MaterialAnalysis | null;
  analysis_status: string;
  created_at: string;
}

const IMPORTANCIA_CHIP: Record<string, string> = {
  fundamental:    "bg-blue-600 text-white border-blue-600",
  importante:     "bg-white border-blue-300 text-slate-800",
  complementario: "bg-slate-50 border-slate-200 text-slate-500",
};

function TemaCard({ t, selected, onSelect }: { t: Tema; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`rounded-2xl border-2 px-4 py-2.5 text-sm font-semibold transition text-left ${
        IMPORTANCIA_CHIP[t.importancia] ?? IMPORTANCIA_CHIP.complementario
      } ${selected ? "ring-2 ring-offset-1 ring-blue-400 scale-[1.03]" : "hover:shadow-md"}`}
    >
      {t.nombre}
    </button>
  );
}

export default function MaterialCompartido() {
  const params = useParams<{ shareId: string }>();
  const shareId = params.shareId;
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [material, setMaterial] = useState<PublicMaterial | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Tema | null>(null);

  useEffect(() => {
    async function load() {
      const [{ data: { user } }, { data }] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from("study_materials")
          .select("id, title, share_id, analysis, analysis_status, created_at")
          .eq("share_id", shareId)
          .eq("is_public", true)
          .single(),
      ]);

      setUserId(user?.id ?? null);
      setMaterial(data as PublicMaterial ?? null);
      setLoading(false);
    }
    load();
  }, [shareId]);

  const analysis = material?.analysis ?? null;

  return (
    <main className="min-h-screen text-slate-900 flex flex-col">
      <AppHeader
        logoHref="/"
        right={userId ? (
          <Link href="/app" className="text-sm text-slate-400 hover:text-slate-600 transition">Mi campus →</Link>
        ) : (
          <Link href="/login" className="text-sm text-blue-600 hover:text-blue-700 font-medium transition">Iniciar sesión</Link>
        )}
      />

      <div className="flex-1 flex flex-col items-center px-4 pb-16">
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && !material && (
          <div className="flex-1 flex items-center justify-center text-center">
            <div>
              <p className="text-4xl mb-4">🔒</p>
              <p className="font-semibold text-slate-800 mb-2">Este material no está disponible</p>
              <p className="text-sm text-slate-500 mb-6">El enlace puede haber caducado o el autor dejó de compartirlo.</p>
              <Link href="/" className="px-6 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition">
                Conocer HCE Vision
              </Link>
            </div>
          </div>
        )}

        {!loading && material && (
          <div className="w-full max-w-3xl mt-10 animate-fade-up">
            {/* Cabecera */}
            <div className="mb-8 text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600 mb-2">Material compartido</p>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">{material.title}</h1>
              {analysis && (
                <p className="mt-4 text-slate-500 max-w-2xl mx-auto leading-relaxed">{analysis.resumen}</p>
              )}
            </div>

            {!userId && (
              <div className="mb-8 rounded-2xl border border-blue-100 bg-blue-50 p-5 text-center">
                <p className="text-sm text-slate-700">
                  Un estudiante de HCE Vision compartió este material contigo.{" "}
                  <Link href="/login" className="text-blue-600 font-semibold underline underline-offset-2">
                    Creá tu cuenta gratis
                  </Link>{" "}
                  para convertir cualquier apunte en tu propio campus.
                </p>
              </div>
            )}

            {/* Leyenda */}
            {analysis && (
              <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500 mb-6">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-blue-600" /> Fundamental</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-white border-2 border-blue-300" /> Importante</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-slate-50 border-2 border-slate-200" /> Complementario</span>
              </div>
            )}

            {/* Temas (mapa simplificado) */}
            {analysis && analysis.temas.length > 0 && (
              <section className="mb-10">
                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                  <h2 className="font-semibold text-slate-800 mb-4 text-lg">Mapa de temas</h2>
                  <div className="flex flex-wrap gap-2.5">
                    {analysis.temas.map((t) => (
                      <TemaCard
                        key={t.nombre}
                        t={t}
                        selected={selected?.nombre === t.nombre}
                        onSelect={() => setSelected(selected?.nombre === t.nombre ? null : t)}
                      />
                    ))}
                  </div>

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
              </section>
            )}

            {/* Ruta de aprendizaje */}
            {analysis && analysis.ruta.length > 0 && (
              <section className="mb-10">
                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                  <h2 className="font-semibold text-slate-800 mb-5 text-lg">Ruta de aprendizaje</h2>
                  <ol className="relative border-l-2 border-dashed border-slate-300 ml-4 space-y-6">
                    {analysis.ruta.map((paso, i) => (
                      <li key={i} className="relative pl-8">
                        <span className="absolute -left-[17px] top-0 w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center border-4 border-white">
                          {i + 1}
                        </span>
                        <p className="font-semibold text-slate-800 leading-tight pt-1">{paso.tema}</p>
                        <p className="text-sm text-slate-500 mt-1 leading-relaxed">{paso.razon}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              </section>
            )}

            {/* CTA */}
            <div className="text-center py-6">
              <p className="text-sm text-slate-500 mb-4">
                ¿Querés estudiar con exámenes, flashcards y tutor a partir de tus propios apuntes?
              </p>
              <Link href="/login"
                className="inline-block px-8 py-3.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition shadow-md shadow-blue-100">
                Crear mi campus gratis
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
