"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Question, ExamAnswer } from "@/lib/types";
import { AppHeader } from "@/components/AppHeader";
import { ExamHud } from "@/components/exam/ExamHud";
import { QuestionCard } from "@/components/exam/QuestionCard";

type Screen = "loading" | "exam" | "result" | "error";

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
  const [answers, setAnswers] = useState<ExamAnswer[]>([]);
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

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <AppHeader
        center={examTitle ? (
          <span className="text-sm text-slate-500 font-medium hidden sm:block truncate max-w-[240px]">
            {examTitle}
          </span>
        ) : undefined}
      />

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
            <ExamHud
              elapsedSeconds={elapsedSeconds}
              answers={answers}
              total={questions.length}
              current={current}
            />
            <div className="lg:mt-4 w-full flex justify-center">
              <QuestionCard
                question={questions[current]}
                index={current}
                total={questions.length}
                selected={selected}
                onSelect={answerQuestion}
                onNext={next}
                flagged={flagged.has(current)}
                onToggleFlag={toggleFlag}
              />
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
