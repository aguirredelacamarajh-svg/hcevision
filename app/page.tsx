"use client";

import { useState, useEffect, useRef } from "react";

// ─── Tipos ───────────────────────────────────────────────────────────────────

type Screen = "upload" | "loading" | "exam" | "result";

interface Question {
  enunciado: string;
  opciones: string[]; // [A, B, C, D]
  correcta: number; // índice 0-3
  explicacion: string;
}

interface Answer {
  elegida: number;
  acierto: boolean;
}

// ─── Preguntas mock (se sustituirán por la generación con IA) ────────────────

const MOCK_QUESTIONS: Question[] = [
  {
    enunciado:
      "Varón de 62 años, fumador, acude a urgencias por dolor torácico opresivo de 40 minutos de evolución irradiado a brazo izquierdo. El ECG muestra elevación del segmento ST en derivaciones II, III y aVF. ¿Cuál es la arteria más probablemente responsable?",
    opciones: [
      "Arteria coronaria derecha",
      "Arteria descendente anterior",
      "Arteria circunfleja",
      "Tronco coronario izquierdo",
    ],
    correcta: 0,
    explicacion:
      "La elevación de ST en derivaciones inferiores (II, III, aVF) indica un infarto de cara inferior, irrigada en la mayoría de los pacientes por la arteria coronaria derecha (dominancia derecha en ~85%). La descendente anterior produciría cambios en precordiales (V1-V4, cara anterior), la circunfleja en cara lateral (I, aVL, V5-V6) y la oclusión del tronco un compromiso extenso con frecuente inestabilidad hemodinámica.",
  },
  {
    enunciado:
      "Mujer de 74 años con disnea de esfuerzo progresiva y un episodio de síncope durante el ejercicio. En la auscultación destaca un soplo sistólico rudo en foco aórtico irradiado a carótidas, con pulso de ascenso lento. ¿Cuál es el diagnóstico más probable?",
    opciones: [
      "Insuficiencia mitral",
      "Estenosis aórtica severa",
      "Miocardiopatía hipertrófica obstructiva",
      "Estenosis pulmonar",
    ],
    correcta: 1,
    explicacion:
      "La tríada clásica de la estenosis aórtica severa es angina, síncope (típicamente de esfuerzo) y disnea, junto con soplo sistólico eyectivo irradiado a carótidas y pulso parvus et tardus. La insuficiencia mitral produce soplo irradiado a axila; la miocardiopatía hipertrófica obstructiva aumenta su soplo con Valsalva y no suele dar pulso parvus; la estenosis pulmonar se ausculta en foco pulmonar sin irradiación carotídea.",
  },
  {
    enunciado:
      "Varón de 68 años, hipertenso y diabético, diagnosticado de fibrilación auricular no valvular. ¿Qué herramienta debe utilizarse para decidir la indicación de anticoagulación?",
    opciones: [
      "Escala HAS-BLED",
      "Escala CHA₂DS₂-VASc",
      "Score de Wells",
      "Clasificación de Killip",
    ],
    correcta: 1,
    explicacion:
      "La escala CHA₂DS₂-VASc estima el riesgo embólico en fibrilación auricular no valvular y es la que indica la anticoagulación (en este paciente: HTA + diabetes + edad 65-74 = mínimo 3 puntos, indicación clara). HAS-BLED estima el riesgo hemorrágico (modula, pero no contraindica por sí sola), el score de Wells se usa en sospecha de TEP/TVP y la clasificación de Killip estratifica la insuficiencia cardiaca en el seno del infarto.",
  },
  {
    enunciado:
      "Paciente con insuficiencia cardiaca crónica y fracción de eyección del 30%. ¿Cuál de los siguientes fármacos ha demostrado aumentar la supervivencia?",
    opciones: [
      "Furosemida",
      "Digoxina",
      "Bisoprolol",
      "Nitroglicerina transdérmica",
    ],
    correcta: 2,
    explicacion:
      "Los betabloqueantes (bisoprolol, carvedilol, metoprolol succinato, nebivolol) reducen la mortalidad en la insuficiencia cardiaca con FEVI reducida, junto con IECA/ARNI, antagonistas del receptor mineralocorticoide e iSGLT2. La furosemida mejora síntomas y congestión pero no la supervivencia; la digoxina reduce ingresos sin efecto en mortalidad; los nitratos aislados no han demostrado beneficio pronóstico.",
  },
  {
    enunciado:
      "En un ECG se observa un intervalo PR de 240 ms, constante en todos los latidos, con todas las ondas P seguidas de QRS. ¿Cuál es el diagnóstico?",
    opciones: [
      "Bloqueo AV de primer grado",
      "Bloqueo AV de segundo grado Mobitz I",
      "Bloqueo AV de segundo grado Mobitz II",
      "Bloqueo AV de tercer grado",
    ],
    correcta: 0,
    explicacion:
      "Un PR > 200 ms constante y con conducción 1:1 (toda P conduce) define el bloqueo AV de primer grado. En el Mobitz I el PR se alarga progresivamente hasta una P bloqueada; en el Mobitz II hay P bloqueadas con PR constante; en el de tercer grado existe disociación completa entre ondas P y QRS.",
  },
];

const LOADING_MESSAGES = [
  "Leyendo tu material...",
  "Identificando conceptos clave...",
  "Redactando preguntas tipo examen...",
];

// ─── Componente principal ────────────────────────────────────────────────────

export default function Home() {
  const [screen, setScreen] = useState<Screen>("upload");

  // Upload
  const [fileName, setFileName] = useState<string | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [showTextarea, setShowTextarea] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Loading
  const [loadingMsg, setLoadingMsg] = useState(0);

  // Examen
  const [questions, setQuestions] = useState<Question[]>([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [flagged, setFlagged] = useState<Set<number>>(new Set());

  // Resultado
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  // Rotación de mensajes de carga + transición simulada
  useEffect(() => {
    if (screen !== "loading") return;
    const msgInterval = setInterval(
      () => setLoadingMsg((m) => (m + 1) % LOADING_MESSAGES.length),
      1700
    );
    const done = setTimeout(() => {
      setQuestions(MOCK_QUESTIONS);
      setScreen("exam");
    }, 5000); // simulación: 5 s (la IA real tardará 30-60 s)
    return () => {
      clearInterval(msgInterval);
      clearTimeout(done);
    };
  }, [screen]);

  const canGenerate = fileName !== null || pastedText.trim().length > 200;

  function handleFile(file: File | undefined | null) {
    if (!file) return;
    if (file.type !== "application/pdf") {
      alert("Por ahora solo aceptamos PDF. También puedes pegar tu texto.");
      return;
    }
    setFileName(file.name);
  }

  function startGeneration() {
    setLoadingMsg(0);
    setCurrent(0);
    setAnswers([]);
    setSelected(null);
    setFlagged(new Set());
    setEmail("");
    setEmailSent(false);
    setScreen("loading");
  }

  function answer(idx: number) {
    if (selected !== null) return; // ya respondida
    setSelected(idx);
    setAnswers((a) => [
      ...a,
      { elegida: idx, acierto: idx === questions[current].correcta },
    ]);
  }

  function next() {
    if (current + 1 < questions.length) {
      setCurrent((c) => c + 1);
      setSelected(null);
    } else {
      setScreen("result");
    }
  }

  function toggleFlag() {
    setFlagged((f) => {
      const copy = new Set(f);
      if (copy.has(current)) copy.delete(current);
      else copy.add(current);
      return copy; // TODO v0+: enviar evento a /api/event
    });
  }

  function reset() {
    setFileName(null);
    setPastedText("");
    setShowTextarea(false);
    setScreen("upload");
  }

  const score = answers.filter((a) => a.acierto).length;
  const failed = answers
    .map((a, i) => ({ ...a, i }))
    .filter((a) => !a.acierto);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Header */}
      <header className="px-6 py-4">
        <span className="font-bold text-lg tracking-tight">
          HCE <span className="text-blue-600">Vision</span>
        </span>
      </header>

      <div className="flex-1 flex flex-col items-center px-4 pb-12">
        {/* ── PANTALLA 1: UPLOAD ── */}
        {screen === "upload" && (
          <div className="w-full max-w-xl mt-8 sm:mt-16 text-center">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Convierte tus apuntes en un examen
            </h1>
            <p className="mt-3 text-slate-600">
              Sube el PDF de tu asignatura y haz un test tipo examen real en 2
              minutos. Gratis.
            </p>

            {/* Drag & drop */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                handleFile(e.dataTransfer.files?.[0]);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`mt-8 border-2 border-dashed rounded-2xl p-10 cursor-pointer transition
                ${
                  dragOver
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-300 bg-white hover:border-blue-400"
                }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              {fileName ? (
                <p className="font-medium text-blue-700">📄 {fileName}</p>
              ) : (
                <>
                  <p className="font-medium">
                    Arrastra tu PDF aquí o haz clic para elegirlo
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Apuntes, diapositivas, resúmenes... (máx. 50 páginas)
                  </p>
                </>
              )}
            </div>

            {/* Fallback texto */}
            <button
              onClick={() => setShowTextarea((s) => !s)}
              className="mt-4 text-sm text-slate-500 underline underline-offset-2"
            >
              o pega tu texto directamente
            </button>
            {showTextarea && (
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Pega aquí el contenido de tus apuntes (mínimo unos párrafos)..."
                className="mt-3 w-full h-40 rounded-xl border border-slate-300 p-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}

            {/* CTA */}
            <button
              onClick={startGeneration}
              disabled={!canGenerate}
              className="mt-6 w-full sm:w-auto px-10 py-3.5 rounded-xl bg-blue-600 text-white font-semibold text-lg
                disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 transition"
            >
              Generar examen
            </button>

            {/* Pregunta de ejemplo */}
            <div className="mt-14 text-left bg-white border border-slate-200 rounded-2xl p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                Ejemplo de pregunta generada
              </p>
              <p className="mt-2 text-sm text-slate-800">
                Varón de 62 años con dolor torácico opresivo y elevación de ST
                en II, III y aVF. ¿Cuál es la arteria más probablemente
                responsable?
              </p>
              <p className="mt-2 text-xs text-slate-500">
                A) Coronaria derecha · B) Descendente anterior · C) Circunfleja
                · D) Tronco coronario izquierdo
              </p>
            </div>

            <p className="mt-10 text-xs text-slate-400">
              Hecho por un cardiólogo en formación para estudiantes de
              medicina. Tu material se usa solo para generar tu examen y se
              elimina a los 30 días.
            </p>
          </div>
        )}

        {/* ── PANTALLA 2: GENERANDO ── */}
        {screen === "loading" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="mt-6 text-lg font-medium">
              {LOADING_MESSAGES[loadingMsg]}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Esto suele tardar menos de un minuto
            </p>
          </div>
        )}

        {/* ── PANTALLA 3: EXAMEN ── */}
        {screen === "exam" && questions.length > 0 && (
          <div className="w-full max-w-xl mt-6">
            {/* Progreso */}
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>
                Pregunta {current + 1} de {questions.length}
              </span>
              <button
                onClick={toggleFlag}
                title="Señalar un error en esta pregunta"
                className={`px-2 py-1 rounded transition ${
                  flagged.has(current)
                    ? "text-amber-600 bg-amber-50"
                    : "text-slate-400 hover:text-amber-600"
                }`}
              >
                ⚑ {flagged.has(current) ? "Señalada" : "Señalar error"}
              </button>
            </div>
            <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all"
                style={{
                  width: `${((current + (selected !== null ? 1 : 0)) / questions.length) * 100}%`,
                }}
              />
            </div>

            {/* Enunciado */}
            <p className="mt-6 font-medium leading-relaxed">
              {questions[current].enunciado}
            </p>

            {/* Opciones */}
            <div className="mt-5 space-y-3">
              {questions[current].opciones.map((op, idx) => {
                const isCorrect = idx === questions[current].correcta;
                const isChosen = idx === selected;
                let style =
                  "border-slate-300 bg-white hover:border-blue-400 cursor-pointer";
                if (selected !== null) {
                  if (isCorrect)
                    style = "border-green-500 bg-green-50 cursor-default";
                  else if (isChosen)
                    style = "border-red-500 bg-red-50 cursor-default";
                  else
                    style = "border-slate-200 bg-white opacity-60 cursor-default";
                }
                return (
                  <button
                    key={idx}
                    onClick={() => answer(idx)}
                    className={`w-full text-left border rounded-xl px-4 py-3 text-sm transition flex gap-3 ${style}`}
                  >
                    <span className="font-semibold">
                      {String.fromCharCode(65 + idx)})
                    </span>
                    <span>{op}</span>
                  </button>
                );
              })}
            </div>

            {/* Feedback + siguiente */}
            {selected !== null && (
              <div className="mt-5">
                <div
                  className={`rounded-xl p-4 text-sm leading-relaxed ${
                    selected === questions[current].correcta
                      ? "bg-green-50 border border-green-200"
                      : "bg-red-50 border border-red-200"
                  }`}
                >
                  <p className="font-semibold mb-1">
                    {selected === questions[current].correcta
                      ? "✅ Correcto"
                      : `❌ Incorrecto — la respuesta era la ${String.fromCharCode(
                          65 + questions[current].correcta
                        )}`}
                  </p>
                  <p className="text-slate-700">
                    {questions[current].explicacion}
                  </p>
                </div>
                <button
                  onClick={next}
                  className="mt-4 w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
                >
                  {current + 1 < questions.length
                    ? "Siguiente pregunta"
                    : "Ver resultado"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── PANTALLA 4: RESULTADO ── */}
        {screen === "result" && (
          <div className="w-full max-w-xl mt-10 text-center">
            <p className="text-sm uppercase tracking-wide text-slate-500">
              Tu resultado
            </p>
            <p className="mt-2 text-6xl font-bold text-blue-600">
              {score}/{questions.length}
            </p>
            <p className="mt-2 text-slate-600">
              {score === questions.length
                ? "Impecable. Este material es tuyo."
                : score >= questions.length / 2
                  ? "Buen nivel — repasa las falladas antes del examen."
                  : "Has encontrado tus lagunas a tiempo. Para eso estamos."}
            </p>

            {/* Revisión de falladas */}
            {failed.length > 0 && (
              <div className="mt-8 text-left space-y-4">
                <p className="font-semibold">Preguntas a repasar:</p>
                {failed.map((f) => (
                  <div
                    key={f.i}
                    className="bg-white border border-slate-200 rounded-xl p-4 text-sm"
                  >
                    <p className="font-medium">{questions[f.i].enunciado}</p>
                    <p className="mt-2 text-green-700">
                      ✓ {String.fromCharCode(65 + questions[f.i].correcta)}){" "}
                      {questions[f.i].opciones[questions[f.i].correcta]}
                    </p>
                    <p className="mt-2 text-slate-600">
                      {questions[f.i].explicacion}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Email opcional */}
            <div className="mt-10 bg-white border border-slate-200 rounded-2xl p-6">
              {emailSent ? (
                <p className="text-sm text-green-700 font-medium">
                  ✅ Apuntado. Te avisaremos.
                </p>
              ) : (
                <>
                  <p className="text-sm font-medium">
                    ¿Quieres que te avisemos cuando haya más funciones?
                  </p>
                  <div className="mt-3 flex gap-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@email.com"
                      className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => email.includes("@") && setEmailSent(true)}
                      className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 transition"
                    >
                      Avisadme
                    </button>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={reset}
              className="mt-6 w-full py-3.5 rounded-xl bg-blue-600 text-white font-semibold text-lg hover:bg-blue-700 transition"
            >
              Generar otro examen
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
