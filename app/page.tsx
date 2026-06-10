import Link from "next/link";

export default function Landing() {
  return (
    <main className="min-h-screen bg-white text-slate-900 flex flex-col">
      {/* Nav */}
      <nav className="px-6 py-4 flex items-center justify-between max-w-6xl mx-auto w-full">
        <span className="font-bold text-xl tracking-tight">
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
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20 max-w-3xl mx-auto w-full">
        <span className="inline-block mb-5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold uppercase tracking-widest border border-blue-100">
          Para estudiantes de medicina
        </span>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
          Convierte tus apuntes
          <br />
          <span className="text-blue-600">en un examen real</span>
        </h1>

        <p className="mt-6 text-lg text-slate-500 max-w-xl leading-relaxed">
          Sube tus PDFs y en menos de 60 segundos tienes un test tipo examen con
          viñetas clínicas, corrección inmediata y explicación de cada respuesta.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-3 items-center">
          <Link
            href="/login"
            className="px-8 py-4 rounded-xl bg-blue-600 text-white font-semibold text-base hover:bg-blue-700 transition shadow-md shadow-blue-100"
          >
            Empezar gratis
          </Link>
          <span className="text-sm text-slate-400">Sin tarjeta. Sin límite.</span>
        </div>
      </section>

      {/* Features */}
      <section className="bg-slate-50 py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12 tracking-tight">
            Todo lo que necesitas para preparar tu examen
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                icon: "📄",
                title: "Hasta 3 PDFs",
                desc: "Combina apuntes, diapositivas y resúmenes. La IA lee todo el material de una vez.",
              },
              {
                icon: "🎯",
                title: "10 a 40 preguntas",
                desc: "Elige la cantidad según el tiempo que tienes. Desde un repaso rápido hasta un simulacro completo.",
              },
              {
                icon: "📊",
                title: "3 niveles de dificultad",
                desc: "Básico para consolidar, intermedio con viñetas clínicas, avanzado con diagnóstico diferencial.",
              },
              {
                icon: "⏱",
                title: "Timer y seguimiento",
                desc: "Sigue tu ritmo en tiempo real. Ve cuántas llevas bien y mal mientras avanzas.",
              },
              {
                icon: "💡",
                title: "Explicación en cada pregunta",
                desc: "Cada respuesta incluye la razón de por qué es correcta y por qué los demás distractores son falsos.",
              },
              {
                icon: "⬇",
                title: "Descarga el examen en PDF",
                desc: "Guarda el examen generado con preguntas, opciones y clave de respuestas lista para imprimir.",
              },
            ].map(({ icon, title, desc }) => (
              <div
                key={title}
                className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm"
              >
                <span className="text-3xl">{icon}</span>
                <h3 className="mt-4 font-semibold text-slate-800">{title}</h3>
                <p className="mt-2 text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ejemplo de pregunta */}
      <section className="py-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold tracking-tight mb-3">
            Preguntas generadas por IA médica
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
        <h2 className="text-3xl font-bold tracking-tight">
          ¿Listo para tu próximo examen?
        </h2>
        <p className="mt-4 text-blue-100 text-lg max-w-md mx-auto">
          Empieza ahora. Es gratis, no necesitas tarjeta y el primer examen
          está a 60 segundos.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-block px-10 py-4 bg-white text-blue-600 font-bold text-base rounded-xl hover:bg-blue-50 transition shadow-lg"
        >
          Crear mi cuenta gratis
        </Link>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 text-center text-sm text-slate-400 border-t border-slate-100">
        <span className="font-semibold text-slate-600">
          HCE <span className="text-blue-600">Vision</span>
        </span>{" "}
        — Hecho por un cardiólogo en formación para estudiantes de medicina.
        Uso educativo.
      </footer>
    </main>
  );
}
