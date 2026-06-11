"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { CasoClinico, MaterialAnalysis } from "@/lib/types";
import { AppHeader } from "@/components/AppHeader";

type Screen = "intro" | "generating" | "play" | "done" | "error";

const FASE_META: Record<string, { emoji: string; label: string }> = {
  anamnesis: { emoji: "🗣", label: "Anamnesis" },
  exploración: { emoji: "🩺", label: "Exploración" },
  pruebas: { emoji: "🔬", label: "Pruebas" },
  diagnóstico: { emoji: "🧩", label: "Diagnóstico" },
  tratamiento: { emoji: "💊", label: "Tratamiento" },
};

const GENERATING_MESSAGES = [
  "Eligiendo al paciente...",
  "Redactando la historia clínica...",
  "Preparando los resultados de las pruebas...",
  "Afinando las decisiones difíciles...",
];

export default function CasoClinicoPage() {
  const params = useParams<{ id: string }>();
  const materialId = params.id;
  const router = useRouter();
  const supabase = createClient();

  const [screen, setScreen] = useState<Screen>("intro");
  const [materialTitle, setMaterialTitle] = useState("");
  const [temas, setTemas] = useState<string[]>([]);
  const [temaSel, setTemaSel] = useState<string>("");
  const [genMsg, setGenMsg] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [caso, setCaso] = useState<CasoClinico | null>(null);
  const [paso, setPaso] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [aciertos, setAciertos] = useState(0);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data } = await supabase
        .from("study_materials")
        .select("title, analysis")
        .eq("id", materialId)
        .single();
      if (!data) { setError("Material no encontrado."); setScreen("error"); return; }
      setMaterialTitle(data.title);
      const analysis = data.analysis as MaterialAnalysis | null;
      setTemas((analysis?.temas ?? []).map((t) => t.nombre));
    }
    load();
  }, [materialId]);

  useEffect(() => {
    if (screen !== "generating") return;
    const id = setInterval(() => setGenMsg((m) => (m + 1) % GENERATING_MESSAGES.length), 3000);
    return () => clearInterval(id);
  }, [screen]);

  async function generar() {
    setScreen("generating");
    setError(null);
    try {
      const res = await fetch("/api/caso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materialId, ...(temaSel ? { tema: temaSel } : {}) }),
      });
      const json = await res.json();
      if (!res.ok || !json.caso) {
        setError(json.error ?? "No se pudo generar el caso.");
        setScreen("intro");
        return;
      }
      setCaso(json.caso);
      setPaso(0);
      setSelected(null);
      setAciertos(0);
      setScreen("play");
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.");
      setScreen("intro");
    }
  }

  function elegir(idx: number) {
    if (selected !== null || !caso) return;
    setSelected(idx);
    if (idx === caso.pasos[paso].correcta) setAciertos((a) => a + 1);
  }

  function continuar() {
    if (!caso) return;
    if (paso + 1 < caso.pasos.length) {
      setPaso((p) => p + 1);
      setSelected(null);
    } else {
      setScreen("done");
    }
  }

  const pasoActual = caso?.pasos[paso];

  return (
    <main className="min-h-screen text-slate-900 flex flex-col">
      <AppHeader backHref={`/app/material/${materialId}`} backLabel="← Material" />

      <div className="flex-1 flex flex-col items-center px-4 pb-16">

        {screen === "error" && (
          <div className="flex-1 flex items-center justify-center text-center">
            <div>
              <p className="text-4xl mb-4">📭</p>
              <p className="font-semibold text-slate-800 mb-6">{error ?? "Algo salió mal"}</p>
              <Link href="/app" className="px-6 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition">
                Volver al campus
              </Link>
            </div>
          </div>
        )}

        {screen === "intro" && (
          <div className="w-full max-w-xl mt-10 sm:mt-16 text-center animate-fade-up">
            <p className="text-5xl mb-4">🏥</p>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600 mb-2">Simulación clínica</p>
            <h1 className="text-3xl font-bold tracking-tight">Caso clínico interactivo</h1>
            <p className="mt-3 text-slate-500 leading-relaxed">
              Un paciente te espera. Vas a recorrer anamnesis, exploración, pruebas,
              diagnóstico y tratamiento tomando las decisiones vos.
            </p>

            {error && (
              <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
            )}

            {temas.length > 0 && (
              <div className="mt-8">
                <p className="text-sm font-semibold text-slate-700 mb-3">¿Sobre qué tema? <span className="font-normal text-slate-400">(opcional)</span></p>
                <div className="flex flex-wrap justify-center gap-2">
                  <button onClick={() => setTemaSel("")}
                    className={`px-4 py-2 rounded-full text-sm font-medium border transition ${temaSel === "" ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"}`}>
                    Sorprendeme
                  </button>
                  {temas.map((t) => (
                    <button key={t} onClick={() => setTemaSel(temaSel === t ? "" : t)}
                      className={`px-4 py-2 rounded-full text-sm font-medium border transition ${temaSel === t ? "bg-blue-100 text-blue-700 border-blue-300" : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button onClick={generar}
              className="mt-10 px-10 py-3.5 rounded-xl bg-blue-600 text-white font-semibold text-lg hover:bg-blue-700 transition">
              Recibir al paciente
            </button>
            <p className="mt-3 text-xs text-slate-400">Basado en «{materialTitle}» · Tarda hasta un minuto</p>
          </div>
        )}

        {screen === "generating" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center animate-fade-up">
            <div className="relative w-20 h-20 mb-8">
              <div className="absolute inset-0 rounded-full bg-blue-100 animate-ping opacity-40" />
              <div className="relative w-20 h-20 rounded-full bg-blue-50 border-2 border-blue-200 flex items-center justify-center text-3xl">
                🏥
              </div>
            </div>
            <h1 className="text-2xl font-bold">El paciente está llegando</h1>
            <p className="mt-3 text-slate-500 max-w-sm">{GENERATING_MESSAGES[genMsg]}</p>
          </div>
        )}

        {screen === "play" && caso && pasoActual && (
          <div className="w-full max-w-2xl mt-8 animate-fade-up">
            {/* Progreso por fases */}
            <div className="flex items-center gap-1.5 mb-6">
              {caso.pasos.map((p, i) => {
                const meta = FASE_META[p.fase];
                return (
                  <div key={i} className={`flex-1 text-center py-2 rounded-xl text-xs font-semibold border transition
                    ${i < paso ? "bg-green-50 border-green-200 text-green-700"
                      : i === paso ? "bg-blue-50 border-blue-300 text-blue-700"
                      : "bg-white border-slate-200 text-slate-300"}`}>
                    <span className="block text-base">{meta?.emoji}</span>
                    <span className="hidden sm:block mt-0.5">{meta?.label}</span>
                  </div>
                );
              })}
            </div>

            {/* Presentación del caso (solo en el primer paso) */}
            {paso === 0 && (
              <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">{caso.titulo}</p>
                <p className="text-sm text-slate-700 leading-relaxed">{caso.presentacion}</p>
              </div>
            )}

            {/* Situación de la fase */}
            <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 mb-2">
                {FASE_META[pasoActual.fase]?.emoji} {FASE_META[pasoActual.fase]?.label}
              </p>
              <p className="text-sm text-slate-700 leading-relaxed">{pasoActual.situacion}</p>
            </div>

            {/* Pregunta */}
            <p className="font-semibold text-slate-800 mb-4 leading-relaxed font-display text-lg">
              {pasoActual.pregunta}
            </p>

            <div className="space-y-2.5">
              {pasoActual.opciones.map((op, j) => {
                const revealed = selected !== null;
                const isCorrect = j === pasoActual.correcta;
                const isChosen = j === selected;
                let cls = "w-full text-left flex gap-3 px-4 py-3.5 rounded-xl border-2 text-sm transition ";
                if (!revealed) cls += "bg-white border-slate-200 hover:border-blue-400 cursor-pointer";
                else if (isCorrect) cls += "bg-green-50 border-green-400 text-green-800";
                else if (isChosen) cls += "bg-red-50 border-red-300 text-red-700";
                else cls += "bg-white border-slate-200 text-slate-400";
                return (
                  <button key={j} onClick={() => elegir(j)} disabled={selected !== null} className={cls}>
                    <span className="font-bold shrink-0">{String.fromCharCode(65 + j)})</span>
                    <span className="leading-relaxed">{op}</span>
                    {revealed && isCorrect && <span className="ml-auto shrink-0 font-bold">✓</span>}
                  </button>
                );
              })}
            </div>

            {/* Feedback */}
            {selected !== null && (
              <div className="mt-5 animate-fade-up">
                <div className={`rounded-2xl border p-5 ${selected === pasoActual.correcta ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
                  <p className="font-semibold text-sm mb-1.5">
                    {selected === pasoActual.correcta ? "✅ Buena decisión" : "🤔 No era la mejor opción"}
                  </p>
                  <p className="text-sm text-slate-700 leading-relaxed">{pasoActual.feedback}</p>
                </div>
                <button onClick={continuar}
                  className="mt-4 w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition">
                  {paso + 1 < caso.pasos.length ? "Continuar →" : "Ver el cierre del caso"}
                </button>
              </div>
            )}
          </div>
        )}

        {screen === "done" && caso && (
          <div className="w-full max-w-xl mt-12 text-center animate-fade-up">
            <p className="text-5xl mb-4">{aciertos >= 4 ? "🏆" : aciertos >= 3 ? "🌿" : "📖"}</p>
            <h1 className="text-3xl font-bold">Caso resuelto</h1>
            <p className="mt-2 text-slate-500">
              {caso.titulo} · {aciertos} de {caso.pasos.length} decisiones correctas
            </p>

            <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 text-left">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 mb-3">💎 Perlas del caso</p>
              <ul className="space-y-2.5">
                {caso.perlas.map((p, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-slate-700 leading-relaxed">
                    <span className="text-blue-500 shrink-0">•</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8 flex gap-3">
              <Link href={`/app/material/${materialId}`}
                className="flex-1 py-3 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-white transition">
                ← Material
              </Link>
              <button onClick={() => { setCaso(null); setScreen("intro"); }}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition">
                🏥 Otro caso
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
