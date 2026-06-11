import Link from "next/link";

const FEATURES = [
  {
    icon: "🗺",
    title: "Mapa conceptual y ruta",
    desc: "La IA lee tu material y te dibuja qué temas hay, cuáles son fundamentales y en qué orden estudiarlos.",
  },
  {
    icon: "📝",
    title: "Exámenes tipo test",
    desc: "Viñetas clínicas con 4 opciones, corrección inmediata y explicación de por qué cada distractor es falso.",
  },
  {
    icon: "🔁",
    title: "Flashcards con memoria",
    desc: "Active recall con repaso espaciado: la plataforma sabe qué tarjetas te tocan hoy y cuáles ya dominas.",
  },
  {
    icon: "🧑‍⚕️",
    title: "Un tutor que te conoce",
    desc: "Chatea con un tutor que ha leído tus apuntes y conoce tus notas: insiste en lo flojo, no en lo que ya sabes.",
  },
  {
    icon: "🏥",
    title: "Casos clínicos",
    desc: "Simulaciones paso a paso: anamnesis, exploración, pruebas, diagnóstico y tratamiento. Tú decides.",
  },
  {
    icon: "🤝",
    title: "Comparte con tu clase",
    desc: "Genera un enlace de cualquier examen y tus compañeros lo hacen sin cuenta. Ellos validan tus preguntas.",
  },
];

const STEPS = [
  { n: "1", title: "Sube tus apuntes", desc: "PDFs o texto. Una sola vez." },
  { n: "2", title: "La IA construye tu campus", desc: "Mapa conceptual, ruta de estudio, exámenes y flashcards." },
  { n: "3", title: "Estudia con memoria", desc: "Cada repaso, intento y error alimenta tu plan del día siguiente." },
];

export default function Landing() {
  return (
    <main className="min-h-screen text-slate-900 flex flex-col">
      {/* Nav */}
      <nav className="px-6 py-4 flex items-center justify-between max-w-6xl mx-auto w-full">
        <span className="font-bold text-xl tracking-tight font-display">
          HCE <span className="text-blue-600">Vision</span>
        </span>
        <Link
          href="/login"
          className="px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition"
        >
          Acceder
        </Link>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center text-center px-6 pt-16 pb-20 max-w-3xl mx-auto w-full">
        <span className="inline-block mb-6 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold uppercase tracking-widest border border-blue-100">
          Para estudiantes de medicina
        </span>

        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]">
          Tus apuntes,
          <br />
          <span className="text-blue-600">convertidos en tu campus</span>
        </h1>

        <p className="mt-6 text-lg text-slate-500 max-w-xl leading-relaxed">
          Sube tu material una vez y obtén un mapa conceptual, una ruta de estudio,
          exámenes con viñetas clínicas, flashcards con repaso espaciado y un tutor
          que sabe qué te cuesta.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-3 items-center">
          <Link
            href="/login"
            className="px-8 py-4 rounded-xl bg-blue-600 text-white font-semibold text-base hover:bg-blue-700 transition shadow-md shadow-blue-100"
          >
            Crear mi campus gratis
          </Link>
          <span className="text-sm text-slate-400">Sin tarjeta. Sin límite.</span>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="px-6 pb-20">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4">
          {STEPS.map(({ n, title, desc }) => (
            <div key={n} className="bg-white/70 rounded-2xl p-6 border border-slate-200 text-center">
              <span className="inline-flex w-9 h-9 items-center justify-center rounded-full bg-blue-600 text-white font-display font-bold mb-3">
                {n}
              </span>
              <h3 className="font-display font-semibold text-slate-800">{title}</h3>
              <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="bg-white/60 border-y border-slate-200 py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-center mb-3 tracking-tight">
            Un sistema completo de estudio
          </h2>
          <p className="text-center text-slate-500 mb-12 max-w-xl mx-auto">
            No es solo un generador de exámenes: es memoria académica.
            Lo que fallas hoy es lo que repasas mañana.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ icon, title, desc }) => (
              <div
                key={title}
                className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition"
              >
                <span className="text-3xl">{icon}</span>
                <h3 className="mt-4 font-display font-semibold text-slate-800">{title}</h3>
                <p className="mt-2 text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ejemplo de pregunta */}
      <section className="py-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight mb-3">
            Preguntas con criterio clínico
          </h2>
          <p className="text-slate-500 mb-10">
            No son preguntas genéricas: son viñetas clínicas extraídas directamente
            de tu material de estudio.
          </p>

          <div className="text-left bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 mb-3">
              Ejemplo — Cardiología
            </p>
            <p className="font-medium leading-relaxed text-slate-800">
              Varón de 62 años con dolor torácico opresivo de 45 minutos de
              evolución, diaforesis y elevación del segmento ST en II, III y
              aVF. ¿Cuál es la arteria coronaria más probablemente responsable?
            </p>
            <div className="mt-5 space-y-2">
              {[
                { l: "A", t: "Arteria coronaria derecha", correct: true },
                { l: "B", t: "Arteria descendente anterior", correct: false },
                { l: "C", t: "Arteria circunfleja", correct: false },
                { l: "D", t: "Tronco coronario izquierdo", correct: false },
              ].map(({ l, t, correct }) => (
                <div
                  key={l}
                  className={`flex gap-3 text-sm px-4 py-3 rounded-xl border ${
                    correct
                      ? "bg-green-50 border-green-300 text-green-800"
                      : "bg-white border-slate-200 text-slate-600"
                  }`}
                >
                  <span className="font-semibold">{l})</span>
                  <span>{t}</span>
                  {correct && (
                    <span className="ml-auto font-semibold text-green-600">✓ Correcta</span>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-slate-700 leading-relaxed">
              <span className="font-semibold">Explicación: </span>El infarto
              inferior (elevación en II, III y aVF) es irrigado por la coronaria
              derecha en el 80 % de los pacientes con dominancia derecha. La
              descendente anterior irriga la cara anterior; la circunfleja, la
              cara lateral.
            </div>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="bg-blue-600 py-20 px-6 text-center text-white">
        <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
          Estudiar largas horas, sin frío
        </h2>
        <p className="mt-4 text-blue-100 text-lg max-w-md mx-auto">
          Papel, calma y un sistema que recuerda por ti.
          Tu primer mapa de estudio está a un PDF de distancia.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-block px-10 py-4 bg-white text-blue-600 font-bold text-base rounded-xl hover:bg-blue-50 transition shadow-lg"
        >
          Crear mi cuenta gratis
        </Link>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 text-center text-sm text-slate-400 border-t border-slate-200 bg-white/50">
        <span className="font-semibold text-slate-600 font-display">
          HCE <span className="text-blue-600">Vision</span>
        </span>{" "}
        — Hecho por un cardiólogo en formación para estudiantes de medicina.
        Uso educativo.
      </footer>
    </main>
  );
}
