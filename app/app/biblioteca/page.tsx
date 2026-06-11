"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { MaterialAnalysis } from "@/lib/types";

interface Folder { id: string; name: string; color: string; }

interface Material {
  id: string;
  title: string;
  folder_id: string | null;
  analysis: MaterialAnalysis | null;
  analysis_status: string;
  char_count: number;
  created_at: string;
}

interface Exam {
  id: string;
  title: string;
  nivel: string;
  folder_id: string | null;
  material_id: string | null;
  num_questions: number;
  created_at: string;
  is_public?: boolean;
}

const FOLDER_CHIP: Record<string, string> = {
  blue: "bg-blue-100 text-blue-700 border-blue-200",
  green: "bg-green-100 text-green-700 border-green-200",
  purple: "bg-purple-100 text-purple-700 border-purple-200",
  rose: "bg-rose-100 text-rose-700 border-rose-200",
  amber: "bg-amber-100 text-amber-700 border-amber-200",
  teal: "bg-teal-100 text-teal-700 border-teal-200",
};

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export default function BibliotecaPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const [{ data: foldersData }, { data: materialsData }, { data: examsData }] = await Promise.all([
        supabase.from("folders").select("id, name, color").order("created_at"),
        supabase.from("study_materials")
          .select("id, title, folder_id, analysis, analysis_status, char_count, created_at")
          .order("created_at", { ascending: false }),
        supabase.from("saved_exams")
          .select("id, title, nivel, folder_id, material_id, num_questions, created_at")
          .order("created_at", { ascending: false }),
      ]);

      setFolders(foldersData ?? []);
      setMaterials((materialsData ?? []) as Material[]);
      setExams((examsData ?? []) as Exam[]);
      setLoading(false);
    }
    load();
  }, []);

  // Etiquetas = temas de los análisis (las más repetidas primero)
  const tags = useMemo(() => {
    const freq = new Map<string, number>();
    for (const m of materials) {
      for (const t of m.analysis?.temas ?? []) {
        freq.set(t.nombre, (freq.get(t.nombre) ?? 0) + 1);
      }
    }
    return [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n).slice(0, 24);
  }, [materials]);

  const q = normalize(query.trim());

  const visibleMaterials = useMemo(() => materials.filter((m) => {
    const temas = (m.analysis?.temas ?? []).map((t) => t.nombre);
    if (activeTag && !temas.includes(activeTag)) return false;
    if (!q) return true;
    return normalize(m.title).includes(q)
      || temas.some((t) => normalize(t).includes(q))
      || (m.analysis?.temas ?? []).some((t) => t.conceptos.some((c) => normalize(c).includes(q)));
  }), [materials, q, activeTag]);

  const visibleExams = useMemo(() => exams.filter((e) => {
    if (activeTag) {
      // Un examen hereda las etiquetas de su material
      const mat = materials.find((m) => m.id === e.material_id);
      if (!mat || !(mat.analysis?.temas ?? []).some((t) => t.nombre === activeTag)) return false;
    }
    if (!q) return true;
    return normalize(e.title).includes(q) || normalize(e.nivel).includes(q);
  }), [exams, materials, q, activeTag]);

  return (
    <main className="min-h-screen text-slate-900">
      <header className="px-6 py-4 flex items-center justify-between bg-white/70 backdrop-blur border-b border-slate-200 sticky top-0 z-10">
        <Link href="/app" className="font-bold text-lg tracking-tight font-display">
          HCE <span className="text-blue-600">Vision</span>
        </Link>
        <Link href="/app" className="text-sm text-slate-400 hover:text-slate-600 transition">
          ← Campus
        </Link>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6 animate-fade-up">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600 mb-2">Biblioteca</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-800">Todo tu estudio, en un lugar 📚</h1>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Buscador */}
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por título, tema o concepto... (ej.: insuficiencia cardíaca)"
              className="w-full rounded-2xl border border-slate-300 bg-white px-5 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
            />

            {/* Etiquetas */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-8">
                {tags.map((t) => (
                  <button key={t} onClick={() => setActiveTag(activeTag === t ? null : t)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${activeTag === t
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-slate-600 border-slate-300 hover:border-blue-400"}`}>
                    {t}
                  </button>
                ))}
              </div>
            )}

            {/* Materiales */}
            <section className="mb-10">
              <h2 className="font-semibold text-slate-800 mb-3">
                Materiales <span className="text-slate-400 font-normal text-sm">{visibleMaterials.length}</span>
              </h2>
              {visibleMaterials.length === 0 ? (
                <p className="text-sm text-slate-400 py-6 text-center">Nada por aquí con ese filtro.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {visibleMaterials.map((m) => {
                    const folder = folders.find((f) => f.id === m.folder_id);
                    const temas = (m.analysis?.temas ?? []).map((t) => t.nombre).slice(0, 3);
                    return (
                      <Link key={m.id} href={`/app/material/${m.id}`}
                        className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md hover:border-slate-300 transition group">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-lg">📚</span>
                          {folder && (
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${FOLDER_CHIP[folder.color] ?? FOLDER_CHIP.blue}`}>
                              {folder.name}
                            </span>
                          )}
                        </div>
                        <p className="font-semibold text-slate-800 leading-tight mb-2 line-clamp-2 group-hover:text-blue-700 transition">
                          {m.title}
                        </p>
                        {temas.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {temas.map((t) => (
                              <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{t}</span>
                            ))}
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Exámenes */}
            <section>
              <h2 className="font-semibold text-slate-800 mb-3">
                Exámenes <span className="text-slate-400 font-normal text-sm">{visibleExams.length}</span>
              </h2>
              {visibleExams.length === 0 ? (
                <p className="text-sm text-slate-400 py-6 text-center">Ningún examen coincide.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {visibleExams.map((e) => {
                    const folder = folders.find((f) => f.id === e.folder_id);
                    return (
                      <Link key={e.id} href={`/app/rehacer/${e.id}`}
                        className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md hover:border-slate-300 transition group">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize bg-blue-100 text-blue-700">{e.nivel}</span>
                          {folder && (
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${FOLDER_CHIP[folder.color] ?? FOLDER_CHIP.blue}`}>
                              {folder.name}
                            </span>
                          )}
                        </div>
                        <p className="font-semibold text-slate-800 leading-tight mb-2 line-clamp-2 group-hover:text-blue-700 transition">
                          {e.title}
                        </p>
                        <p className="text-xs text-slate-400">{e.num_questions} preguntas · hacer ahora →</p>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
