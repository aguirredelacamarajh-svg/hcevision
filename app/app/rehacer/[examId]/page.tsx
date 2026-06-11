"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Question } from "@/lib/types";

type Screen = "loading" | "exam" | "result" | "error";
interface Answer { elegida: number; acierto: boolean; }

function formatTime(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

export default function RehacerExamen() {
  const params = useParams<{ examId: string }>();
  const examId = params.examId;
  const router = useRouter();
  const supabase = createClient();

  // ─── Meta ───────────────────────────────────────────────────────────────────
  const [screen, setScreen] = useState<Screen>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [examTitle, setExamTitle] = useState("");
  const [examNivel, setExamNivel] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [examDbId, setExamDbId] = useState("");

  // ─── Examen ─────────────────────────────────────────────────────────────────
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [flagged, setFlagged] = useState<Set<number>>(new Set());

  // ─── Timer ──────────────────────────────────────────────────────────────────
  const examStartRef = useRef<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [finalElapsed, setFinalElapsed] = useState(0);

  // ─── Guardado ───────────────────────────────────────────────────────────────
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const savedRef = useRef(false);

  // ─── Carga del examen ────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: exam, error } = await supabase
        .from("saved_exams")
        .select("id, title, nivel, questions")
        .eq("id", examId)
        .single();

      if (error || !exam) {
        setLoadError("El examen no existe o no tenés acceso a él.");
        setScreen("error");
        return;
      }

      setExamDbId(exam.id);
      setExamTitle(exam.title);
      setExamNivel(exam.nivel);
      setQuestions(exam.questions);
      setScreen("exam");
    }
    load();
  }, [examId]);

  // ─── Timer ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (screen !== "exam") return;
    examStartRef.current = Date.now();
    setElapsedSeconds(0);
    const id = setInterval(() => {
      if (examStartRef.current)
        setElapsedSeconds(Math.floor((Date.now() - examStartRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [screen]);

  // ─── Auto-guardado del intento ───────────────────────────────────────────────

  useEffect(() => {
    if (screen !== "result") return;
    if (savedRef.current) return;
    savedRef.current = true;

    const score = answers.filter(a => a.acierto).length;

    async function save() {
      setSaveStatus("saving");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setSaveStatus("error"); return; }

      const { error } = await supabase.from("exam_attempts").insert({
        exam_id: examDbId,
        user_id: user.id,
        score,
        num_questions: questions.length,
        time_seconds: finalElapsed,
        answers,
      });

      setSaveStatus(error ? "error" : "saved");
      if (error) console.warn("exam_attempts insert failed:", error.message);
    }
    save();
  }, [screen, finalElapsed]); // finalElapsed y screen se actualizan juntos en next()

  // ─── Derivados ───────────────────────────────────────────────────────────────

  const correctCount = answers.filter(a => a.acierto).length;
  const incorrectCount = answers.filter(a => !a.acierto).length;
  const pct = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
  const scoreColor = pct >= 70 ? "#16a34a" : pct >= 50 ? "#d97706" : "#dc2626";

  // ─── Handlers ────────────────────────────────────────────────────────────────

  function answerQuestion(idx: number) {
    if (selected !== null) return;
    setSelected(idx);
    setAnswers(a => [...a, { elegida: idx, acierto: idx === questions[current].correcta }]);
  }

  function next() {
    if (current + 1 < questions.length) {
      setCurrent(c => c + 1);
      setSelected(null);
    } else {
      // Capturar tiempo y cambiar pantalla en el mismo batch (React 18)
      const elapsed = examStartRef.current
        ? Math.floor((Date.now() - examStartRef.current) / 1000)
        : 0;
      examStartRef.current = null;
      setFinalElapsed(elapsed);
      setScreen("result");
    }
  }

  function toggleFlag() {
    setFlagged(f => { const c = new Set(f); c.has(current) ? c.delete(current) : c.add(current); return c; });
  }

  function retake() {
    setCurrent(0);
    setAnswers([]);
    setSelected(null);
    setFlagged(new Set());
    setSaveStatus("idle");
    savedRef.current = false;
    setScreen("exam");
  }

  // ─── QuestionDot ─────────────────────────────────────────────────────────────

  function QuestionDot({ i, size = "lg" }: { i: number; size?: "sm" | "lg" }) {
    const ans = answers[i];
    const isCurrent = i === current;
    if (size === "sm") {
      let cls = "w-3.5 h-3.5 rounded-full transition-colors";
      cls += isCurrent ? " bg-blue-500" : !ans ? " bg-slate-200" : ans.acierto ? " bg-green-400" : " bg-red-400";
      return <div className={cls} />;
    }
    let cls = "w-8 h-8 rounded-xl text-xs font-bold flex items-center justify-center transition-colors";
    if (isCurrent) cls += " bg-blue-600 text-white shadow-sm";
    else if (!ans) cls += " bg-slate-100 text-slate-400";
    else if (ans.acierto) cls += " bg-green-100 text-green-700 border border-green-300";
    else cls += " bg-red-100 text-red-600 border border-red-300";
    return <div className={cls}>{i + 1}</div>;
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <header className="px-6 py-4 shrink-0 flex items-center justify-between bg-white border-b border-slate-200 sticky top-0 z-10">
        <Link href="/app" className="font-bold text-lg tracking-tight">
          HCE <span className="text-blue-600">Vision</span>
        </Link>
        {examTitle && (
          <span className="text-sm text-slate-500 font-medium hidden sm:block truncate max-w-[240px]">
            {examTitle}
          </span>
        )}
        <Link href="/app" className="text-sm text-slate-400 hover:text-slate-600 transition shrink-0">
          ← Campus
        </Link>
      </header>

      <div className="flex-1 flex flex-col items-center px-4 pb-12">

        {/* ── Cargando ── */}
        {screen === "loading" && (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* ── Error ── */}
        {screen === "error" && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-sm">
              <p className="text-4xl mb-4">⚠️</p>
              <p className="font-semibold text-slate-800 mb-2">No se pudo cargar el examen</p>
              <p className="text-sm text-slate-500 mb-6">{loadError}</p>
              <Link href="/app"
                className="px-6 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition">
                Volver al campus
              </Link>
            </div>
          </div>
        )}

        {/* ── Examen ── */}
        {screen === "exam" && questions.length > 0 && (
          <>
            {/* Sidebar desktop */}
            <aside className="hidden lg:flex flex-col fixed right-6 top-20 w-48 gap-3">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Tiempo</p>
                <p className="font-mono text-2xl font-bold text-slate-800">{formatTime(elapsedSeconds)}</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3 text-center">Resultado</p>
                <div className="flex justify-around">
                  <div className="text-center">
                    <p className="text-xl font-bold text-green-600">{correctCount}</p>
                    <p className="text-xs text-slate-500 mt-0.5">correctas</p>
                  </div>
                  <div className="w-px bg-slate-100" />
                  <div className="text-center">
                    <p className="text-xl font-bold text-red-500">{incorrectCount}</p>
                    <p className="text-xs text-slate-500 mt-0.5">incorrectas</p>
                  </div>
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3 text-center">Preguntas</p>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {questions.map((_, i) => <QuestionDot key={i} i={i} size="lg" />)}
                </div>
              </div>
            </aside>

            {/* Barra móvil */}
            <div className="lg:hidden w-full max-w-xl mt-4 mb-4 bg-white border border-slate-200 rounded-2xl px-4 py-3 flex items-center justify-between">
              <span className="font-mono font-bold text-slate-700">{formatTime(elapsedSeconds)}</span>
              <div className="flex gap-3 text-sm font-semibold">
                <span className="text-green-600">✓ {correctCount}</span>
                <span className="text-red-500">✗ {incorrectCount}</span>
              </div>
              <div className="flex flex-wrap gap-1 justify-end max-w-[120px]">
                {questions.map((_, i) => <QuestionDot key={i} i={i} size="sm" />)}
              </div>
            </div>

            {/* Pregunta */}
            <div className="w-full max-w-xl lg:mt-4">
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>Pregunta {current + 1} de {questions.length}</span>
                <button onClick={toggleFlag}
                  className={`px-2 py-1 rounded transition ${flagged.has(current) ? "text-amber-600 bg-amber-50" : "text-slate-400 hover:text-amber-600"}`}>
                  ⚑ {flagged.has(current) ? "Señalada" : "Señalar"}
                </button>
              </div>
              <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full transition-all"
                  style={{ width: `${((current + (selected !== null ? 1 : 0)) / questions.length) * 100}%` }} />
              </div>

              <p className="mt-6 font-medium leading-relaxed">{questions[current].enunciado}</p>

              <div className="mt-5 space-y-3">
                {questions[current].opciones.map((op, idx) => {
                  const isAnswered = selected !== null;
                  const isCorrect = idx === questions[current].correcta;
                  const isSelected = idx === selected;
                  let cls = "w-full text-left border rounded-xl px-4 py-3 text-sm transition flex gap-3 ";
                  if (!isAnswered) cls += "border-slate-300 bg-white hover:border-blue-400 cursor-pointer";
                  else if (isCorrect) cls += "border-green-500 bg-green-50 cursor-default";
                  else if (isSelected) cls += "border-red-500 bg-red-50 cursor-default";
                  else cls += "border-slate-200 bg-white opacity-60 cursor-default";
                  return (
                    <button key={idx} onClick={() => answerQuestion(idx)} disabled={isAnswered} className={cls}>
                      <span className="font-semibold">{String.fromCharCode(65 + idx)})</span>
                      <span>{op}</span>
                    </button>
                  );
                })}
              </div>

              {selected !== null && (
                <div className="mt-5">
                  <div className={`rounded-xl p-4 text-sm leading-relaxed ${selected === questions[current].correcta ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                    <p className="font-semibold mb-1">
                      {selected === questions[current].correcta
                        ? "✅ Correcto"
                        : `❌ Incorrecto — la respuesta era la ${String.fromCharCode(65 + questions[current].correcta)}`}
                    </p>
                    <p className="text-slate-700">{questions[current].explicacion}</p>
                  </div>
                  <button onClick={next}
                    className="mt-4 w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition">
                    {current + 1 < questions.length ? "Siguiente pregunta" : "Ver resultado"}
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Resultado ── */}
        {screen === "result" && (
          <div className="w-full max-w-xl mt-10">
            {/* Score */}
            <div className="text-center mb-6">
              <p className="text-sm uppercase tracking-wide text-slate-500 mb-2">{examTitle}</p>
              <p className="text-6xl font-bold" style={{ color: scoreColor }}>{pct}%</p>
              <p className="mt-2 text-slate-600">
                {correctCount} de {questions.length} correctas
              </p>
              <div className="mt-3 inline-flex items-center gap-2 bg-slate-100 rounded-xl px-4 py-2">
                <span className="text-slate-500 text-sm">Tiempo:</span>
                <span className="font-mono font-bold text-slate-800">{formatTime(finalElapsed)}</span>
              </div>
            </div>

            {/* Estado del guardado */}
            <div className="h-6 flex items-center justify-center mb-4">
              {saveStatus === "saving" && <p className="text-sm text-slate-400">Guardando intento...</p>}
              {saveStatus === "saved" && <p className="text-sm text-green-600 font-medium">✓ Intento guardado</p>}
              {saveStatus === "error" && <p className="text-sm text-amber-600">⚠ No se pudo guardar el intento automáticamente</p>}
            </div>

            {/* Preguntas falladas */}
            {answers.some(a => !a.acierto) && (
              <div className="mt-2 mb-6 space-y-4">
                <p className="font-semibold text-slate-800">Preguntas a repasar:</p>
                {answers.map((a, i) => !a.acierto ? (
                  <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 text-sm">
                    <p className="font-medium text-slate-800 mb-2">{questions[i].enunciado}</p>
                    <p className="text-green-700">
                      ✓ {String.fromCharCode(65 + questions[i].correcta)}) {questions[i].opciones[questions[i].correcta]}
                    </p>
                    <p className="mt-1 text-red-600 text-xs">
                      Tu respuesta: {String.fromCharCode(65 + a.elegida)}) {questions[i].opciones[a.elegida]}
                    </p>
                    <p className="mt-2 text-slate-600 border-t border-slate-100 pt-2">
                      {questions[i].explicacion}
                    </p>
                  </div>
                ) : null)}
              </div>
            )}

            {/* Acciones */}
            <div className="flex gap-3 mt-2">
              <Link href="/app"
                className="flex-1 text-center py-3 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
                ← Campus
              </Link>
              <button onClick={retake}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition">
                ↺ Volver a intentar
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
