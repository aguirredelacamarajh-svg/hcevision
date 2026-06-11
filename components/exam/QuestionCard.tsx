import type { Question } from "@/lib/types";

/**
 * Pregunta en curso: cabecera con progreso, enunciado, opciones con
 * revelado de la correcta, explicación y botón de avance.
 * Compartida por nuevo y rehacer.
 */
export function QuestionCard({
  question,
  index,
  total,
  selected,
  onSelect,
  onNext,
  flagged,
  onToggleFlag,
}: {
  question: Question;
  index: number;
  total: number;
  selected: number | null;
  onSelect: (idx: number) => void;
  onNext: () => void;
  flagged?: boolean;
  onToggleFlag?: () => void;
}) {
  const answered = selected !== null;

  return (
    <div className="w-full max-w-xl">
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>Pregunta {index + 1} de {total}</span>
        {onToggleFlag && (
          <button
            onClick={onToggleFlag}
            className={`px-2 py-1 rounded transition ${flagged ? "text-amber-600 bg-amber-50" : "text-slate-400 hover:text-amber-600"}`}
          >
            ⚑ {flagged ? "Señalada" : "Señalar"}
          </button>
        )}
      </div>
      <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-600 rounded-full transition-all"
          style={{ width: `${((index + (answered ? 1 : 0)) / total) * 100}%` }}
        />
      </div>

      <p className="mt-6 font-medium leading-relaxed">{question.enunciado}</p>

      <div className="mt-5 space-y-3">
        {question.opciones.map((op, idx) => {
          const isCorrect = idx === question.correcta;
          const isChosen = idx === selected;
          let style = "border-slate-300 bg-white hover:border-blue-400 cursor-pointer";
          if (answered) {
            if (isCorrect) style = "border-green-500 bg-green-50 cursor-default";
            else if (isChosen) style = "border-red-500 bg-red-50 cursor-default";
            else style = "border-slate-200 bg-white opacity-60 cursor-default";
          }
          return (
            <button
              key={idx}
              onClick={() => onSelect(idx)}
              disabled={answered}
              className={`w-full text-left border rounded-xl px-4 py-3 text-sm transition flex gap-3 ${style}`}
            >
              <span className="font-semibold">{String.fromCharCode(65 + idx)})</span>
              <span>{op}</span>
            </button>
          );
        })}
      </div>

      {answered && (
        <div className="mt-5">
          <div className={`rounded-xl p-4 text-sm leading-relaxed ${selected === question.correcta ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
            <p className="font-semibold mb-1">
              {selected === question.correcta
                ? "✅ Correcto"
                : `❌ Incorrecto — la respuesta era la ${String.fromCharCode(65 + question.correcta)}`}
            </p>
            <p className="text-slate-700">{question.explicacion}</p>
          </div>
          <button
            onClick={onNext}
            className="mt-4 w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
          >
            {index + 1 < total ? "Siguiente pregunta" : "Ver resultado"}
          </button>
        </div>
      )}
    </div>
  );
}
