import type { ExamAnswer } from "@/lib/types";

function formatTime(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

function QuestionDot({
  index,
  isCurrent,
  answer,
  size,
}: {
  index: number;
  isCurrent: boolean;
  answer: ExamAnswer | undefined;
  size: "sm" | "lg";
}) {
  if (size === "sm") {
    let cls = "w-3.5 h-3.5 rounded-full transition-colors";
    cls += isCurrent ? " bg-blue-500" : !answer ? " bg-slate-200" : answer.acierto ? " bg-green-400" : " bg-red-400";
    return <div className={cls} />;
  }
  let cls = "w-8 h-8 rounded-xl text-xs font-bold flex items-center justify-center transition-colors";
  if (isCurrent) cls += " bg-blue-600 text-white shadow-sm";
  else if (!answer) cls += " bg-slate-100 text-slate-400";
  else if (answer.acierto) cls += " bg-green-100 text-green-700 border border-green-300";
  else cls += " bg-red-100 text-red-600 border border-red-300";
  return <div className={cls}>{index + 1}</div>;
}

/**
 * HUD del examen en curso: sidebar fija en desktop (tiempo, marcador, mapa de
 * preguntas) y barra compacta en móvil. Compartido por nuevo y rehacer.
 */
export function ExamHud({
  elapsedSeconds,
  answers,
  total,
  current,
}: {
  elapsedSeconds: number;
  answers: ExamAnswer[];
  total: number;
  current: number;
}) {
  const correct = answers.filter((a) => a.acierto).length;
  const incorrect = answers.length - correct;
  const indices = Array.from({ length: total }, (_, i) => i);

  return (
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
              <p className="text-xl font-bold text-green-600">{correct}</p>
              <p className="text-xs text-slate-500 mt-0.5">correctas</p>
            </div>
            <div className="w-px bg-slate-100" />
            <div className="text-center">
              <p className="text-xl font-bold text-red-500">{incorrect}</p>
              <p className="text-xs text-slate-500 mt-0.5">incorrectas</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3 text-center">Preguntas</p>
          <div className="flex flex-wrap gap-1.5 justify-center">
            {indices.map((i) => (
              <QuestionDot key={i} index={i} isCurrent={i === current} answer={answers[i]} size="lg" />
            ))}
          </div>
        </div>
      </aside>

      {/* Barra móvil */}
      <div className="lg:hidden w-full max-w-xl mt-4 mb-4 bg-white border border-slate-200 rounded-2xl px-4 py-3 flex items-center justify-between">
        <span className="font-mono font-bold text-slate-700">{formatTime(elapsedSeconds)}</span>
        <div className="flex gap-3 text-sm font-semibold">
          <span className="text-green-600">✓ {correct}</span>
          <span className="text-red-500">✗ {incorrect}</span>
        </div>
        <div className="flex flex-wrap gap-1 justify-end max-w-[120px]">
          {indices.map((i) => (
            <QuestionDot key={i} index={i} isCurrent={i === current} answer={answers[i]} size="sm" />
          ))}
        </div>
      </div>
    </>
  );
}
