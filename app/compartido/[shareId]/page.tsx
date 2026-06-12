"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Question } from "@/lib/types";
import { AppHeader } from "@/components/AppHeader";

type Screen = "loading" | "cover" | "exam" | "result" | "error";
interface Answer { elegida: number; acierto: boolean; }

interface SharedExam {
  id: string;
  title: string;
  nivel: string;
  num_questions: number;
  questions: Question[];
  created_at: string;
}

export default function ExamenCompartido() {
  const params = useParams<{ shareId: string }>();
  const shareId = params.shareId;
  const supabase = createClient();

  const [screen, setScreen] = useState<Screen>("loading");
  const [exam, setExam] = useState<SharedExam | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Examen
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [selected, setSelected] = useState<number | null>(null);

  // Comunidad
  const [votes, setVotes] = useState(0);
  const [myVote, setMyVote] = useState(false);
  const [voting, setVoting] = useState(false);
  const [reportingIdx, setReportingIdx] = useState<number | null>(null);
  const [reportText, setReportText] = useState("");
  const [reportedIdxs, setReportedIdxs] = useState<Set<number>>(new Set());
  const [savingCopy, setSavingCopy] = useState(false);
  const [copySaved, setCopySaved] = useState(false);

  useEffect(() => {
    async function load() {
      const [{ data: { user } }, { data: examData }] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from("saved_exams")
          .select("id, title, nivel, num_questions, questions, created_at")
          .eq("share_id", shareId)
          .eq("is_public", true)
          .single(),
      ]);

      if (!examData) { setScreen("error"); return; }
      setUserId(user?.id ?? null);
      setExam(examData as SharedExam);

      const { count } = await supabase
        .from("exam_votes")
        .select("*", { count: "exact", head: true })
        .eq("exam_id", examData.id);
      setVotes(count ?? 0);

      if (user) {
        const { data: mine } = await supabase
          .from("exam_votes")
          .select("id")
          .eq("exam_id", examData.id)
          .eq("user_id", user.id)
          .maybeSingle();
        setMyVote(!!mine);
      }

      setScreen("cover");
    }
    load();
  }, [shareId, supabase]);

  // ─── Handlers ────────────────────────────────────────────────────────────────

  function answerQuestion(idx: number) {
    if (selected !== null || !exam) return;
    setSelected(idx);
    setAnswers((a) => [...a, { elegida: idx, acierto: idx === exam.questions[current].correcta }]);
  }

  function next() {
    if (!exam) return;
    if (current + 1 < exam.questions.length) {
      setCurrent((c) => c + 1);
      setSelected(null);
    } else {
      setScreen("result");
    }
  }

  async function toggleVote() {
    if (!exam || !userId || voting) return;
    setVoting(true);
    if (myVote) {
      await supabase.from("exam_votes").delete().eq("exam_id", exam.id).eq("user_id", userId);
      setMyVote(false);
      setVotes((v) => Math.max(0, v - 1));
    } else {
      const { error } = await supabase.from("exam_votes").insert({ exam_id: exam.id, user_id: userId });
      if (!error) { setMyVote(true); setVotes((v) => v + 1); }
    }
    setVoting(false);
  }

  async function sendReport(idx: number) {
    if (!exam || !userId || reportText.trim().length < 5) return;
    const { error } = await supabase.from("question_reports").insert({
      exam_id: exam.id,
      question_index: idx,
      user_id: userId,
      motivo: reportText.trim().slice(0, 500),
    });
    if (!error) {
      setReportedIdxs((s) => new Set(s).add(idx));
      setReportingIdx(null);
      setReportText("");
    }
  }

  async function copyToMyCampus() {
    if (!exam || !userId || savingCopy) return;
    setSavingCopy(true);
    const { error } = await supabase.from("saved_exams").insert({
      user_id: userId,
      title: exam.title,
      nivel: exam.nivel,
      num_questions: exam.num_questions,
      questions: exam.questions,
    });
    if (!error) setCopySaved(true);
    setSavingCopy(false);
  }

  const correctCount = answers.filter((a) => a.acierto).length;
  const pct = exam ? Math.round((correctCount / exam.questions.length) * 100) : 0;
  const q = exam?.questions[current];

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

        {screen === "loading" && (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {screen === "error" && (
          <div className="flex-1 flex items-center justify-center text-center">
            <div>
              <p className="text-4xl mb-4">🔒</p>
              <p className="font-semibold text-slate-800 mb-2">Este examen no está disponible</p>
              <p className="text-sm text-slate-500 mb-6">El enlace puede haber caducado o el autor dejó de compartirlo.</p>
              <Link href="/" className="px-6 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition">
                Conocer HCE Vision
              </Link>
            </div>
          </div>
        )}

        {screen === "cover" && exam && (
          <div className="w-full max-w-xl mt-12 sm:mt-20 text-center animate-fade-up">
            <p className="text-5xl mb-4">🤝</p>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600 mb-2">Examen compartido</p>
            <h1 className="text-3xl font-bold tracking-tight">{exam.title}</h1>
            <div className="mt-4 flex items-center justify-center gap-3 text-sm text-slate-500">
              <span className="capitalize px-3 py-1 rounded-full bg-blue-100 text-blue-700 font-semibold text-xs">{exam.nivel}</span>
              <span>{exam.questions.length} preguntas</span>
              {votes > 0 && <span>👍 {votes}</span>}
            </div>
            <p className="mt-4 text-slate-500 text-sm">
              Un estudiante de HCE Vision compartió este examen contigo.
            </p>
            <button onClick={() => { setCurrent(0); setAnswers([]); setSelected(null); setScreen("exam"); }}
              className="mt-8 px-10 py-3.5 rounded-xl bg-blue-600 text-white font-semibold text-lg hover:bg-blue-700 transition">
              Empezar el examen
            </button>
            {!userId && (
              <p className="mt-4 text-xs text-slate-400">
                No hace falta cuenta para hacerlo. <Link href="/login" className="text-blue-600 underline underline-offset-2">Crea la tuya</Link> para guardarlo y ver tu progreso.
              </p>
            )}
          </div>
        )}

        {screen === "exam" && exam && q && (
          <div className="w-full max-w-2xl mt-8 animate-fade-up">
            <div className="mb-6">
              <div className="flex items-center justify-between text-sm text-slate-500 mb-2">
                <span className="font-medium truncate mr-3">{exam.title}</span>
                <span className="shrink-0">{current + 1} de {exam.questions.length}</span>
              </div>
              <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full transition-all"
                  style={{ width: `${(current / exam.questions.length) * 100}%` }} />
              </div>
            </div>

            <p className="font-semibold text-slate-800 mb-5 leading-relaxed font-display text-lg">{q.enunciado}</p>

            <div className="space-y-2.5">
              {q.opciones.map((op, j) => {
                const revealed = selected !== null;
                const isCorrect = j === q.correcta;
                const isChosen = j === selected;
                let cls = "w-full text-left flex gap-3 px-4 py-3.5 rounded-xl border-2 text-sm transition ";
                if (!revealed) cls += "bg-white border-slate-200 hover:border-blue-400 cursor-pointer";
                else if (isCorrect) cls += "bg-green-50 border-green-400 text-green-800";
                else if (isChosen) cls += "bg-red-50 border-red-300 text-red-700";
                else cls += "bg-white border-slate-200 text-slate-400";
                return (
                  <button key={j} onClick={() => answerQuestion(j)} disabled={selected !== null} className={cls}>
                    <span className="font-bold shrink-0">{String.fromCharCode(65 + j)})</span>
                    <span className="leading-relaxed">{op}</span>
                    {revealed && isCorrect && <span className="ml-auto shrink-0 font-bold">✓</span>}
                  </button>
                );
              })}
            </div>

            {selected !== null && (
              <div className="mt-5 animate-fade-up">
                {q.explicacion && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700 leading-relaxed">
                    {q.explicacion}
                  </div>
                )}
                <button onClick={next}
                  className="mt-4 w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition">
                  {current + 1 < exam.questions.length ? "Siguiente →" : "Ver resultado"}
                </button>
              </div>
            )}
          </div>
        )}

        {screen === "result" && exam && (
          <div className="w-full max-w-2xl mt-10 animate-fade-up">
            <div className="text-center">
              <p className="text-5xl mb-4">{pct >= 70 ? "🏆" : pct >= 50 ? "🌿" : "📖"}</p>
              <h1 className="text-3xl font-bold">
                {correctCount} de {exam.questions.length} <span className="text-slate-400 font-semibold">({pct}%)</span>
              </h1>

              {/* Voto */}
              <div className="mt-6 flex items-center justify-center gap-3">
                {userId ? (
                  <button onClick={toggleVote} disabled={voting}
                    className={`px-5 py-2.5 rounded-xl border-2 text-sm font-semibold transition ${myVote
                      ? "border-green-400 bg-green-50 text-green-700"
                      : "border-slate-300 bg-white text-slate-600 hover:border-green-400"}`}>
                    👍 {myVote ? "Te sirvió" : "Me sirvió"} {votes > 0 && `· ${votes}`}
                  </button>
                ) : (
                  votes > 0 && <span className="text-sm text-slate-500">👍 A {votes} {votes === 1 ? "persona le sirvió" : "personas les sirvió"}</span>
                )}
              </div>

              {/* Copiar a mi campus */}
              <div className="mt-4">
                {userId ? (
                  copySaved ? (
                    <p className="text-sm text-green-700 font-medium">✓ Guardado en tu campus — <Link href="/app" className="underline underline-offset-2">ir ahora</Link></p>
                  ) : (
                    <button onClick={copyToMyCampus} disabled={savingCopy}
                      className="px-6 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-60">
                      {savingCopy ? "Guardando..." : "💾 Guardar en mi campus"}
                    </button>
                  )
                ) : (
                  <Link href="/login" className="text-sm text-blue-600 underline underline-offset-2">
                    Inicia sesión para guardarlo en tu campus y rehacerlo cuando quieras
                  </Link>
                )}
              </div>
            </div>

            {/* Revisión */}
            <div className="mt-10 space-y-4">
              <h2 className="font-semibold text-slate-800">Revisión</h2>
              {exam.questions.map((qq, i) => {
                const ans = answers[i];
                const ok = ans?.acierto ?? false;
                return (
                  <div key={i} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                    <div className={`px-4 py-2.5 flex items-center justify-between gap-2 text-sm font-medium ${ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                      <span>{ok ? "✅" : "❌"} Pregunta {i + 1}</span>
                      {userId && !reportedIdxs.has(i) && (
                        <button onClick={() => { setReportingIdx(reportingIdx === i ? null : i); setReportText(""); }}
                          className="text-xs text-slate-400 hover:text-amber-600 transition">
                          ⚠ Reportar error
                        </button>
                      )}
                      {reportedIdxs.has(i) && <span className="text-xs text-amber-600">⚠ Reportado, gracias</span>}
                    </div>
                    <div className="p-4">
                      <p className="text-sm font-medium text-slate-800 mb-2 leading-relaxed">{qq.enunciado}</p>
                      <p className="text-xs text-slate-500">
                        Correcta: <span className="font-semibold text-green-700">{String.fromCharCode(65 + qq.correcta)}) {qq.opciones[qq.correcta]}</span>
                        {ans && !ok && (
                          <> · Tu respuesta: <span className="font-semibold text-red-600">{String.fromCharCode(65 + ans.elegida)}) {qq.opciones[ans.elegida]}</span></>
                        )}
                      </p>
                      {qq.explicacion && (
                        <p className="mt-2 text-xs text-slate-500 leading-relaxed border-t border-slate-100 pt-2">{qq.explicacion}</p>
                      )}
                      {reportingIdx === i && (
                        <div className="mt-3 border-t border-slate-100 pt-3">
                          <textarea value={reportText} onChange={(e) => setReportText(e.target.value)}
                            placeholder="¿Qué está mal en esta pregunta? (mín. 5 caracteres)"
                            maxLength={500}
                            className="w-full h-20 rounded-xl border border-slate-300 p-3 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400" />
                          <div className="mt-2 flex gap-2 justify-end">
                            <button onClick={() => setReportingIdx(null)}
                              className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700">Cancelar</button>
                            <button onClick={() => sendReport(i)} disabled={reportText.trim().length < 5}
                              className="px-4 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 transition disabled:opacity-40">
                              Enviar reporte
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <button onClick={() => { setCurrent(0); setAnswers([]); setSelected(null); setScreen("exam"); }}
              className="mt-8 w-full py-3 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-white transition">
              ↺ Volver a intentar
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
