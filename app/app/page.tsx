"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Question } from "@/lib/types";
import { generateExamPDF } from "@/lib/pdf";

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Folder {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

interface SavedExam {
  id: string;
  folder_id: string | null;
  title: string;
  nivel: string;
  num_questions: number;
  questions: Question[];
  score: number | null;
  time_seconds: number | null;
  answers: { elegida: number; acierto: boolean }[] | null;
  created_at: string;
  attempted_at: string | null;
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const COLORS: Record<string, { chip: string; dot: string; btn: string }> = {
  blue:   { chip: "bg-blue-100 text-blue-700 border-blue-200",   dot: "bg-blue-500",   btn: "bg-blue-600 hover:bg-blue-700" },
  green:  { chip: "bg-green-100 text-green-700 border-green-200", dot: "bg-green-500",  btn: "bg-green-600 hover:bg-green-700" },
  purple: { chip: "bg-purple-100 text-purple-700 border-purple-200", dot: "bg-purple-500", btn: "bg-purple-600 hover:bg-purple-700" },
  rose:   { chip: "bg-rose-100 text-rose-700 border-rose-200",   dot: "bg-rose-500",   btn: "bg-rose-600 hover:bg-rose-700" },
  amber:  { chip: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-500",  btn: "bg-amber-600 hover:bg-amber-700" },
  teal:   { chip: "bg-teal-100 text-teal-700 border-teal-200",   dot: "bg-teal-500",   btn: "bg-teal-600 hover:bg-teal-700" },
};
const COLOR_KEYS = Object.keys(COLORS);

const NIVEL_BADGE: Record<string, string> = {
  básico:      "bg-green-100 text-green-700",
  intermedio:  "bg-blue-100 text-blue-700",
  avanzado:    "bg-purple-100 text-purple-700",
};

// ─── PDF ─────────────────────────────────────────────────────────────────────

function formatTime(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

function relativeDate(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days}d`;
  if (days < 30) return `hace ${Math.floor(days / 7)}s`;
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

const PAGE_SIZE = 20;

// ─── Componente principal ─────────────────────────────────────────────────────

export default function CampusPage() {
  const router = useRouter();
  const supabase = createClient();

  const [folders, setFolders] = useState<Folder[]>([]);
  const [exams, setExams] = useState<SavedExam[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");

  // Filtro activo
  const [activeFolder, setActiveFolder] = useState<string | null>(null);

  // Panel de revisión
  const [reviewExam, setReviewExam] = useState<SavedExam | null>(null);

  // Crear carpeta
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState("blue");
  const [savingFolder, setSavingFolder] = useState(false);
  const newFolderInputRef = useRef<HTMLInputElement>(null);

  // ─── Carga inicial ──────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUserEmail(user.email ?? "");

      const [{ data: foldersData }, { data: examsData }] = await Promise.all([
        supabase.from("folders").select("*").order("created_at"),
        supabase.from("saved_exams").select("*").order("created_at", { ascending: false }).range(0, PAGE_SIZE - 1),
      ]);

      setFolders(foldersData ?? []);
      setExams(examsData ?? []);
      setHasMore((examsData ?? []).length === PAGE_SIZE);
      setLoading(false);
    }
    load();
  }, []);

  async function loadMore() {
    setLoadingMore(true);
    const { data } = await supabase
      .from("saved_exams")
      .select("*")
      .order("created_at", { ascending: false })
      .range(exams.length, exams.length + PAGE_SIZE - 1);
    const next = data ?? [];
    setExams((prev) => [...prev, ...next]);
    setHasMore(next.length === PAGE_SIZE);
    setLoadingMore(false);
  }

  useEffect(() => {
    if (showNewFolder) setTimeout(() => newFolderInputRef.current?.focus(), 50);
  }, [showNewFolder]);

  // ─── Acciones ───────────────────────────────────────────────────────────────

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  async function createFolder() {
    if (!newFolderName.trim()) return;
    setSavingFolder(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("folders")
      .insert({ name: newFolderName.trim(), color: newFolderColor, user_id: user!.id })
      .select()
      .single();
    if (!error && data) {
      setFolders((f) => [...f, data]);
      setNewFolderName("");
      setShowNewFolder(false);
    }
    setSavingFolder(false);
  }

  async function deleteExam(id: string) {
    if (!confirm("¿Eliminar este examen guardado?")) return;
    await supabase.from("saved_exams").delete().eq("id", id);
    setExams((e) => e.filter((ex) => ex.id !== id));
    if (reviewExam?.id === id) setReviewExam(null);
  }

  // ─── Datos filtrados ────────────────────────────────────────────────────────

  const visibleExams = activeFolder
    ? exams.filter((e) => e.folder_id === activeFolder)
    : exams;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <span className="font-bold text-lg tracking-tight">
          HCE <span className="text-blue-600">Vision</span>
        </span>
        <div className="flex items-center gap-3">
          <Link
            href="/app/nuevo"
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition"
          >
            + Nuevo examen
          </Link>
          <button
            onClick={handleLogout}
            className="text-sm text-slate-400 hover:text-slate-600 transition hidden sm:block"
          >
            Salir
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Saludo */}
        {userEmail && (
          <p className="text-slate-500 text-sm mb-6">
            Hola, <span className="font-medium text-slate-700">{userEmail.split("@")[0]}</span> 👋
          </p>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* ── Carpetas ── */}
            <section className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-slate-800">Carpetas</h2>
                {!showNewFolder && (
                  <button
                    onClick={() => setShowNewFolder(true)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    + Nueva carpeta
                  </button>
                )}
              </div>

              {/* Form nueva carpeta */}
              {showNewFolder && (
                <div className="mb-3 flex flex-wrap items-center gap-3 bg-white border border-slate-200 rounded-2xl p-4">
                  <input
                    ref={newFolderInputRef}
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && createFolder()}
                    placeholder="Nombre de la carpeta"
                    className="flex-1 min-w-[160px] text-sm border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {/* Color picker */}
                  <div className="flex gap-1.5">
                    {COLOR_KEYS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setNewFolderColor(c)}
                        className={`w-6 h-6 rounded-full transition ${COLORS[c].dot} ${
                          newFolderColor === c ? "ring-2 ring-offset-1 ring-slate-400" : "opacity-60 hover:opacity-100"
                        }`}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={createFolder}
                      disabled={savingFolder || !newFolderName.trim()}
                      className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-40 transition"
                    >
                      Crear
                    </button>
                    <button
                      onClick={() => { setShowNewFolder(false); setNewFolderName(""); }}
                      className="px-3 py-2 text-slate-500 text-sm hover:text-slate-700"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Chips */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setActiveFolder(null)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition ${
                    activeFolder === null
                      ? "bg-slate-800 text-white border-slate-800"
                      : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"
                  }`}
                >
                  Todos ({exams.length})
                </button>
                {folders.map((f) => {
                  const col = COLORS[f.color] ?? COLORS.blue;
                  const count = exams.filter((e) => e.folder_id === f.id).length;
                  return (
                    <button
                      key={f.id}
                      onClick={() => setActiveFolder(activeFolder === f.id ? null : f.id)}
                      className={`px-4 py-2 rounded-full text-sm font-medium border transition flex items-center gap-2 ${
                        activeFolder === f.id
                          ? col.chip + " border-current"
                          : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                      {f.name} ({count})
                    </button>
                  );
                })}
              </div>
            </section>

            {/* ── Exámenes ── */}
            <section>
              <h2 className="font-semibold text-slate-800 mb-3">
                {activeFolder
                  ? `${folders.find((f) => f.id === activeFolder)?.name ?? "Carpeta"}`
                  : "Exámenes guardados"}
                <span className="ml-2 text-slate-400 font-normal text-sm">
                  {visibleExams.length}
                </span>
              </h2>

              {visibleExams.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <p className="text-slate-400 text-lg mb-2">
                    {exams.length === 0 ? "Aún no has guardado ningún examen" : "Ningún examen en esta carpeta"}
                  </p>
                  <p className="text-slate-400 text-sm mb-6">
                    Genera un examen y guárdalo desde la pantalla de resultados
                  </p>
                  <Link
                    href="/app/nuevo"
                    className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition"
                  >
                    Crear primer examen
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {visibleExams.map((exam) => {
                    const folder = folders.find((f) => f.id === exam.folder_id);
                    const col = folder ? (COLORS[folder.color] ?? COLORS.blue) : null;
                    const pct = exam.score != null ? Math.round((exam.score / exam.num_questions) * 100) : null;
                    return (
                      <div
                        key={exam.id}
                        onClick={() => setReviewExam(exam)}
                        className="bg-white border border-slate-200 rounded-2xl p-5 cursor-pointer hover:shadow-md hover:border-slate-300 transition group"
                      >

                        {/* Nivel + folder */}
                        <div className="flex items-center justify-between mb-3">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${NIVEL_BADGE[exam.nivel] ?? "bg-slate-100 text-slate-600"}`}>
                            {exam.nivel}
                          </span>
                          {folder && col && (
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${col.chip}`}>
                              {folder.name}
                            </span>
                          )}
                        </div>

                        {/* Título */}
                        <p className="font-semibold text-slate-800 leading-tight mb-3 line-clamp-2">
                          {exam.title}
                        </p>

                        {/* Score */}
                        {pct != null && (
                          <div className="mb-3">
                            <div className="flex justify-between text-xs text-slate-500 mb-1">
                              <span>{exam.score}/{exam.num_questions} correctas</span>
                              <span>{pct}%</span>
                            </div>
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${pct >= 70 ? "bg-green-500" : pct >= 50 ? "bg-amber-400" : "bg-red-400"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Meta */}
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span>{relativeDate(exam.attempted_at ?? exam.created_at)}</span>
                          {exam.time_seconds != null && (
                            <span className="font-mono">{formatTime(exam.time_seconds)}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Cargar más */}
              {hasMore && !activeFolder && (
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="px-6 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-600 hover:border-slate-400 hover:text-slate-800 transition disabled:opacity-50"
                  >
                    {loadingMore ? "Cargando..." : "Cargar más exámenes"}
                  </button>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* ── Panel de revisión ── */}
      {reviewExam && (
        <ReviewPanel
          exam={reviewExam}
          folders={folders}
          onClose={() => setReviewExam(null)}
          onDelete={() => deleteExam(reviewExam.id)}
          onRename={async (newTitle) => {
            await supabase
              .from("saved_exams")
              .update({ title: newTitle })
              .eq("id", reviewExam.id);
            setExams((prev) =>
              prev.map((e) => e.id === reviewExam.id ? { ...e, title: newTitle } : e)
            );
            setReviewExam((e) => e ? { ...e, title: newTitle } : null);
          }}
        />
      )}
    </div>
  );
}

// ─── Panel lateral de revisión ────────────────────────────────────────────────

function ReviewPanel({
  exam,
  folders,
  onClose,
  onDelete,
  onRename,
}: {
  exam: SavedExam;
  folders: Folder[];
  onClose: () => void;
  onDelete: () => void;
  onRename: (newTitle: string) => void;
}) {
  const folder = folders.find((f) => f.id === exam.folder_id);
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(exam.title);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraftTitle(exam.title); }, [exam.title]);
  useEffect(() => { if (editingTitle) titleInputRef.current?.select(); }, [editingTitle]);

  function commitRename() {
    const trimmed = draftTitle.trim();
    if (trimmed && trimmed !== exam.title) onRename(trimmed);
    else setDraftTitle(exam.title);
    setEditingTitle(false);
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/30 z-30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <aside className="fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl z-40 flex flex-col overflow-hidden">
        {/* Header del panel */}
        <div className="flex items-start justify-between p-6 border-b border-slate-200 shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${NIVEL_BADGE[exam.nivel] ?? "bg-slate-100 text-slate-600"}`}>
                {exam.nivel}
              </span>
              {folder && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${COLORS[folder.color]?.chip ?? COLORS.blue.chip}`}>
                  {folder.name}
                </span>
              )}
            </div>
            {editingTitle ? (
              <input
                ref={titleInputRef}
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") { setDraftTitle(exam.title); setEditingTitle(false); }
                }}
                className="font-bold text-slate-800 text-lg leading-tight w-full border-b-2 border-blue-500 outline-none bg-transparent pb-0.5"
              />
            ) : (
              <button
                onClick={() => setEditingTitle(true)}
                className="font-bold text-slate-800 text-lg leading-tight text-left hover:text-blue-600 transition group flex items-center gap-2"
                title="Clic para renombrar"
              >
                {exam.title}
                <span className="text-slate-300 group-hover:text-blue-400 text-sm font-normal">✏</span>
              </button>
            )}
            <p className="text-sm text-slate-400 mt-1">
              {relativeDate(exam.attempted_at ?? exam.created_at)}
              {exam.time_seconds != null && ` · ${formatTime(exam.time_seconds)}`}
              {exam.score != null && ` · ${exam.score}/${exam.num_questions} correctas`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none ml-4 shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Score bar */}
        {exam.score != null && (
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 shrink-0">
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-green-600 font-semibold">{exam.score} correctas</span>
              <span className="text-red-500 font-semibold">{exam.num_questions - exam.score} incorrectas</span>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full"
                style={{ width: `${(exam.score / exam.num_questions) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Preguntas */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {exam.questions.map((q, i) => {
            const ans = exam.answers?.[i];
            const userIdx = ans?.elegida ?? -1;
            const wasCorrect = ans?.acierto ?? false;

            return (
              <div key={i} className="border border-slate-200 rounded-xl overflow-hidden">
                {/* Cabecera pregunta */}
                <div className={`px-4 py-2.5 flex items-center gap-2 text-sm font-medium ${wasCorrect ? "bg-green-50 text-green-700" : ans ? "bg-red-50 text-red-600" : "bg-slate-50 text-slate-500"}`}>
                  <span>{wasCorrect ? "✅" : ans ? "❌" : "—"}</span>
                  <span>Pregunta {i + 1}</span>
                </div>

                <div className="p-4">
                  <p className="text-sm font-medium text-slate-800 mb-3 leading-relaxed">
                    {q.enunciado}
                  </p>
                  <div className="space-y-2">
                    {q.opciones.map((op, j) => {
                      const isCorrectOpt = j === q.correcta;
                      const isChosenOpt = j === userIdx;
                      let cls = "flex gap-2.5 text-xs px-3 py-2.5 rounded-lg border ";
                      if (isCorrectOpt && isChosenOpt)
                        cls += "bg-green-50 border-green-300 text-green-800";
                      else if (isCorrectOpt)
                        cls += "bg-green-50 border-green-300 text-green-700";
                      else if (isChosenOpt)
                        cls += "bg-red-50 border-red-300 text-red-700";
                      else
                        cls += "bg-white border-slate-200 text-slate-500";
                      return (
                        <div key={j} className={cls}>
                          <span className="font-semibold shrink-0">{String.fromCharCode(65 + j)})</span>
                          <span>{op}</span>
                          {isCorrectOpt && <span className="ml-auto font-semibold shrink-0">✓</span>}
                        </div>
                      );
                    })}
                  </div>
                  {q.explicacion && (
                    <p className="mt-3 text-xs text-slate-500 leading-relaxed border-t border-slate-100 pt-3">
                      {q.explicacion}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Acciones */}
        <div className="p-4 border-t border-slate-200 flex gap-2 shrink-0">
          <button
            onClick={() => generateExamPDF({
                title: exam.title,
                nivel: exam.nivel,
                questions: exam.questions,
                date: new Date(exam.attempted_at ?? exam.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }),
              })}
            className="flex-1 py-2.5 rounded-xl bg-slate-800 text-white text-sm font-semibold hover:bg-slate-700 transition flex items-center justify-center gap-1.5"
          >
            <span>⬇</span> Exportar PDF
          </button>
          <Link
            href="/app/nuevo"
            className="flex-1 text-center py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition"
          >
            Nuevo examen
          </Link>
          <button
            onClick={onDelete}
            className="px-3 py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition"
            title="Eliminar"
          >
            🗑
          </button>
        </div>
      </aside>
    </>
  );
}
