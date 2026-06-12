"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import type { Question, Nivel, NumPreguntas, ExamAnswer } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { generateExamPDF } from "@/lib/pdf";
import { AppHeader } from "@/components/AppHeader";
import { ExamHud } from "@/components/exam/ExamHud";
import { QuestionCard } from "@/components/exam/QuestionCard";

// ─── Tipos locales ────────────────────────────────────────────────────────────

type Screen = "upload" | "loading" | "exam" | "result";

interface PdfEntry { name: string; text: string; }
interface Folder { id: string; name: string; color: string; }

const MAX_PDFS = 3;
const NUM_OPTIONS: NumPreguntas[] = [10, 20, 30, 40];
const NIVEL_OPTIONS: Nivel[] = ["básico", "intermedio", "avanzado"];
const LOADING_MESSAGES = [
  "Leyendo tu material...",
  "Identificando conceptos clave...",
  "Redactando preguntas tipo examen...",
];

// ─── Utilidades ───────────────────────────────────────────────────────────────

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

function nivelLabel(n: Nivel) { return n.charAt(0).toUpperCase() + n.slice(1); }

// ─── Componente principal ─────────────────────────────────────────────────────

export default function NuevoExamen() {
  const supabase = createClient();

  const [screen, setScreen] = useState<Screen>("upload");

  // Upload
  const [pdfs, setPdfs] = useState<PdfEntry[]>([]);
  const [pastedText, setPastedText] = useState("");
  const [showTextarea, setShowTextarea] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Opciones
  const [numQuestions, setNumQuestions] = useState<NumPreguntas>(10);
  const [nivel, setNivel] = useState<Nivel>("intermedio");
  const [examNivel, setExamNivel] = useState<Nivel>("intermedio");

  // Loading
  const [loadingMsg, setLoadingMsg] = useState(0);

  // Examen
  const [truncated, setTruncated] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<ExamAnswer[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [flagged, setFlagged] = useState<Set<number>>(new Set());

  // Timer
  const examStartRef = useRef<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [finalElapsed, setFinalElapsed] = useState(0);

  // Guardado
  const [folders, setFolders] = useState<Folder[]>([]);
  const [examTitle, setExamTitle] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  // Material de origen (cuando se llega desde /app/material/[id])
  const [materialId, setMaterialId] = useState<string | null>(null);
  const [materialTitle, setMaterialTitle] = useState("");

  // ─── Efectos ───────────────────────────────────────────────────────────────

  // Cargar material de origen si se llega con ?material=
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("material");
    if (!id) return;
    supabase
      .from("study_materials")
      .select("id, title, source_text")
      .eq("id", id)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setMaterialId(data.id);
        setMaterialTitle(data.title);
        setPastedText(data.source_text);
      });
  }, [supabase]);

  useEffect(() => {
    if (screen !== "loading") return;
    const id = setInterval(() => setLoadingMsg((m) => (m + 1) % LOADING_MESSAGES.length), 2500);
    return () => clearInterval(id);
  }, [screen]);

  // Tick del cronómetro mientras el examen está en curso (el reset del timer
  // ocurre en startGeneration, al entrar en la pantalla de examen)
  useEffect(() => {
    if (screen !== "exam") return;
    const id = setInterval(() => {
      if (examStartRef.current)
        setElapsedSeconds(Math.floor((Date.now() - examStartRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [screen]);

  // Cargar carpetas al llegar al resultado
  useEffect(() => {
    if (screen !== "result") return;
    supabase.from("folders").select("id, name, color").order("created_at")
      .then(({ data }) => setFolders(data ?? []));
  }, [screen, supabase]);

  // ─── Datos derivados ───────────────────────────────────────────────────────

  const combinedText = [...pdfs.map((p) => p.text), pastedText]
    .filter((t) => t.trim().length > 0).join("\n\n---\n\n");
  const canGenerate = combinedText.trim().length >= 300 && !pdfLoading;
  const correctSoFar = answers.filter((a) => a.acierto).length;
  const score = correctSoFar;
  const failed = answers.map((a, i) => ({ ...a, i })).filter((a) => !a.acierto);

  // ─── Handlers PDF ──────────────────────────────────────────────────────────

  async function extractText(file: File): Promise<string> {
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const content = await (await pdf.getPage(i)).getTextContent();
      pages.push(content.items.map((it) => ("str" in it ? (it as { str: string }).str : "")).join(" "));
    }
    return pages.join("\n\n").trim();
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    const remaining = MAX_PDFS - pdfs.length;
    if (!remaining) { setError(`Máximo ${MAX_PDFS} PDFs.`); return; }
    const files = Array.from(fileList).filter((f) => f.type === "application/pdf").slice(0, remaining);
    if (!files.length) { setError("Solo se aceptan PDFs."); return; }
    setError(null);
    setPdfLoading(true);
    const results: PdfEntry[] = [];
    for (const file of files) {
      try {
        const text = await extractText(file);
        if (text.length < 100) setError(`"${file.name}" no tiene texto extraíble.`);
        else results.push({ name: file.name, text });
      } catch { setError(`Error leyendo "${file.name}".`); }
    }
    if (results.length) setPdfs((p) => [...p, ...results].slice(0, MAX_PDFS));
    setPdfLoading(false);
  }

  // ─── Generación ────────────────────────────────────────────────────────────

  async function startGeneration() {
    setLoadingMsg(0); setCurrent(0); setAnswers([]); setSelected(null);
    setFlagged(new Set()); setError(null); setExamNivel(nivel); setScreen("loading");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: combinedText, numQuestions, nivel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo generar el examen.");
      setTruncated(!!data.recortado);
      setQuestions(data.preguntas);
      examStartRef.current = Date.now();
      setElapsedSeconds(0);
      setScreen("exam");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
      setScreen("upload");
    }
  }

  function answer(idx: number) {
    if (selected !== null) return;
    setSelected(idx);
    setAnswers((a) => [...a, { elegida: idx, acierto: idx === questions[current].correcta }]);
  }

  function next() {
    if (current + 1 < questions.length) { setCurrent((c) => c + 1); setSelected(null); return; }
    if (examStartRef.current !== null) {
      setFinalElapsed(Math.floor((Date.now() - examStartRef.current) / 1000));
      examStartRef.current = null;
    }
    // Solo poner título por defecto si el usuario no escribió uno
    if (!examTitle.trim()) {
      const date = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "short" });
      setExamTitle(`Examen ${nivelLabel(examNivel)} · ${date}`);
    }
    setSavedId(null);
    setScreen("result");
  }

  function toggleFlag() {
    setFlagged((f) => {
      const c = new Set(f);
      if (c.has(current)) c.delete(current);
      else c.add(current);
      return c;
    });
  }

  function reset() {
    setPdfs([]); setPastedText(""); setShowTextarea(false);
    setPdfLoading(false); setError(null); setElapsedSeconds(0);
    setExamTitle(""); setTruncated(false); setScreen("upload");
  }

  // ─── Guardar examen ────────────────────────────────────────────────────────

  async function saveExam() {
    if (!examTitle.trim()) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const { data, error } = await supabase.from("saved_exams").insert({
      user_id: user.id,
      folder_id: selectedFolderId || null,
      title: examTitle.trim(),
      nivel: examNivel,
      num_questions: questions.length,
      questions,
      score,
      time_seconds: finalElapsed,
      answers,
      attempted_at: new Date().toISOString(),
      ...(materialId ? { material_id: materialId } : {}),
    }).select("id").single();

    if (!error && data) {
      setSavedId(data.id);
      const { error: attemptError } = await supabase.from("exam_attempts").insert({
        exam_id: data.id,
        user_id: user.id,
        score,
        num_questions: questions.length,
        time_seconds: finalElapsed,
        answers,
      });
      if (attemptError) console.warn("exam_attempts insert failed:", attemptError.message);
    }
    setSaving(false);
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <AppHeader />

      <div className="flex-1 flex flex-col items-center px-4 pb-12">

        {/* ── PANTALLA 1: UPLOAD ── */}
        {screen === "upload" && (
          <div className="w-full max-w-xl mt-8 sm:mt-12 text-center">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Nuevo examen
            </h1>
            <p className="mt-2 text-slate-500">Sube hasta 3 PDFs o pega tu texto</p>

            {materialId && (
              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">
                <span>📚</span>
                <span>Material cargado: <span className="font-semibold">{materialTitle}</span></span>
                <button
                  onClick={() => { setMaterialId(null); setMaterialTitle(""); setPastedText(""); }}
                  className="ml-1 text-green-700/60 hover:text-green-800"
                  title="Quitar material"
                >
                  ✕
                </button>
              </div>
            )}

            {error && (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
            )}

            {pdfs.length > 0 && (
              <div className="mt-5 space-y-2 text-left">
                {pdfs.map((pdf, i) => (
                  <div key={i} className="flex items-center justify-between bg-white border border-green-200 rounded-xl px-4 py-3">
                    <span className="text-sm font-medium truncate">📄 {pdf.name}</span>
                    <button onClick={() => setPdfs((p) => p.filter((_, j) => j !== i))}
                      className="ml-3 shrink-0 text-slate-400 hover:text-red-500 transition text-lg">✕</button>
                  </div>
                ))}
              </div>
            )}

            {pdfs.length < MAX_PDFS && (
              <div onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
                onClick={() => fileInputRef.current?.click()}
                className={`mt-4 border-2 border-dashed rounded-2xl p-8 cursor-pointer transition
                  ${dragOver ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-white hover:border-blue-400"}`}>
                <input ref={fileInputRef} type="file" accept="application/pdf" multiple className="hidden"
                  onChange={(e) => handleFiles(e.target.files)} />
                {pdfLoading ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <p className="font-medium text-blue-700">Extrayendo texto...</p>
                  </div>
                ) : (
                  <>
                    <p className="font-medium">
                      {pdfs.length === 0 ? "Arrastra tus PDFs o haz clic" : `Añadir otro PDF (${MAX_PDFS - pdfs.length} restante${MAX_PDFS - pdfs.length !== 1 ? "s" : ""})`}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">Hasta {MAX_PDFS} PDFs</p>
                  </>
                )}
              </div>
            )}

            <button onClick={() => setShowTextarea((s) => !s)}
              className="mt-4 text-sm text-slate-500 underline underline-offset-2">
              o pega tu texto directamente
            </button>
            {showTextarea && (
              <textarea value={pastedText} onChange={(e) => setPastedText(e.target.value)}
                placeholder="Pega aquí el contenido de tus apuntes..."
                className="mt-3 w-full h-40 rounded-xl border border-slate-300 p-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            )}

            <div className="mt-7 text-left">
              <p className="text-sm font-semibold text-slate-700 mb-2">Número de preguntas</p>
              <div className="flex gap-2 flex-wrap">
                {NUM_OPTIONS.map((n) => (
                  <button key={n} onClick={() => setNumQuestions(n)}
                    className={`px-5 py-2 rounded-xl text-sm font-medium border transition ${numQuestions === n ? "bg-blue-600 text-white border-blue-600" : "bg-white border-slate-300 text-slate-700 hover:border-blue-400"}`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 text-left">
              <p className="text-sm font-semibold text-slate-700 mb-2">Nivel de dificultad</p>
              <div className="flex gap-2 flex-wrap">
                {NIVEL_OPTIONS.map((n) => (
                  <button key={n} onClick={() => setNivel(n)}
                    className={`px-5 py-2 rounded-xl text-sm font-medium border transition ${nivel === n ? "bg-blue-600 text-white border-blue-600" : "bg-white border-slate-300 text-slate-700 hover:border-blue-400"}`}>
                    {nivelLabel(n)}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 text-left">
              <p className="text-sm font-semibold text-slate-700 mb-2">
                Nombre del examen{" "}
                <span className="font-normal text-slate-400">(opcional)</span>
              </p>
              <input
                value={examTitle}
                onChange={(e) => setExamTitle(e.target.value)}
                placeholder={`Examen ${nivelLabel(nivel)} · ${new Date().toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`}
                maxLength={80}
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <button onClick={startGeneration} disabled={!canGenerate}
              className="mt-8 w-full sm:w-auto px-10 py-3.5 rounded-xl bg-blue-600 text-white font-semibold text-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 transition">
              Generar examen
            </button>
          </div>
        )}

        {/* ── PANTALLA 2: GENERANDO ── */}
        {screen === "loading" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="mt-6 text-lg font-medium">{LOADING_MESSAGES[loadingMsg]}</p>
            <p className="mt-2 text-sm text-slate-500">Menos de un minuto</p>
          </div>
        )}

        {/* ── PANTALLA 3: EXAMEN ── */}
        {screen === "exam" && questions.length > 0 && (
          <>
            <ExamHud
              elapsedSeconds={elapsedSeconds}
              answers={answers}
              total={questions.length}
              current={current}
            />

            {/* Aviso de truncamiento */}
            {truncated && (
              <div className="w-full max-w-xl mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 leading-relaxed">
                <span className="font-semibold">Material recortado:</span> tu contenido superó el límite de procesamiento (40 000 caracteres). Las preguntas se generaron solo con la primera parte del material.
              </div>
            )}

            <div className="w-full flex justify-center">
              <QuestionCard
                question={questions[current]}
                index={current}
                total={questions.length}
                selected={selected}
                onSelect={answer}
                onNext={next}
                flagged={flagged.has(current)}
                onToggleFlag={toggleFlag}
              />
            </div>
          </>
        )}

        {/* ── PANTALLA 4: RESULTADO ── */}
        {screen === "result" && (
          <div className="w-full max-w-xl mt-10 text-center">
            <p className="text-sm uppercase tracking-wide text-slate-500">Tu resultado</p>
            <p className="mt-2 text-6xl font-bold text-blue-600">{score}/{questions.length}</p>
            <p className="mt-2 text-slate-600">
              {score === questions.length ? "Impecable. Este material es tuyo."
                : score >= questions.length / 2 ? "Buen nivel — repasa las falladas antes del examen."
                : "Has encontrado tus lagunas a tiempo. Para eso estamos."}
            </p>
            <div className="mt-4 inline-flex items-center gap-2 bg-slate-100 rounded-xl px-4 py-2">
              <span className="text-slate-500 text-sm">Tiempo:</span>
              <span className="font-mono font-bold text-slate-800">{formatTime(finalElapsed)}</span>
            </div>

            {/* Falladas */}
            {failed.length > 0 && (
              <div className="mt-8 text-left space-y-4">
                <p className="font-semibold">Preguntas a repasar:</p>
                {failed.map((f) => (
                  <div key={f.i} className="bg-white border border-slate-200 rounded-xl p-4 text-sm">
                    <p className="font-medium">{questions[f.i].enunciado}</p>
                    <p className="mt-2 text-green-700">✓ {String.fromCharCode(65 + questions[f.i].correcta)}) {questions[f.i].opciones[questions[f.i].correcta]}</p>
                    <p className="mt-2 text-slate-600">{questions[f.i].explicacion}</p>
                  </div>
                ))}
              </div>
            )}

            {/* ── Guardar examen ── */}
            <div className="mt-8 bg-white border border-slate-200 rounded-2xl p-6 text-left">
              {savedId ? (
                <div className="text-center">
                  <p className="text-green-700 font-semibold mb-3">✓ Examen guardado correctamente</p>
                  <Link href="/app"
                    className="inline-block px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition">
                    Ver en el campus
                  </Link>
                </div>
              ) : (
                <>
                  <p className="font-semibold text-slate-800 mb-4">Guardar este examen</p>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 block">Nombre</label>
                      <input value={examTitle} onChange={(e) => setExamTitle(e.target.value)}
                        placeholder="Nombre del examen"
                        className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 block">Carpeta</label>
                      <select value={selectedFolderId} onChange={(e) => setSelectedFolderId(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Sin carpeta</option>
                        {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                      {folders.length === 0 && (
                        <p className="text-xs text-slate-400 mt-1">
                          Puedes crear carpetas desde el{" "}
                          <Link href="/app" className="underline hover:text-slate-600">campus</Link>.
                        </p>
                      )}
                    </div>
                    <button onClick={saveExam} disabled={saving || !examTitle.trim()}
                      className="w-full py-3 rounded-xl bg-slate-800 text-white font-semibold text-sm hover:bg-slate-700 transition disabled:opacity-40">
                      {saving ? "Guardando..." : "Guardar examen"}
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* PDF */}
            <button onClick={() => generateExamPDF({ title: examTitle, nivel: examNivel, questions })}
              className="mt-4 w-full py-3.5 rounded-xl bg-white border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition flex items-center justify-center gap-2">
              <span>⬇</span> Descargar examen en PDF
            </button>

            <button onClick={reset}
              className="mt-4 w-full py-3.5 rounded-xl bg-blue-600 text-white font-semibold text-lg hover:bg-blue-700 transition">
              Generar otro examen
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
