"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { ChatMessage, MaterialAnalysis } from "@/lib/types";
import { AppHeader } from "@/components/AppHeader";

const MAX_HISTORY = 20; // mensajes que se envían al servidor
const MAX_INPUT = 4_000;

export default function TutorPage() {
  const params = useParams<{ id: string }>();
  const materialId = params.id;
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [materialTitle, setMaterialTitle] = useState("");
  const [temas, setTemas] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);

      const [{ data }, { data: chatData }] = await Promise.all([
        supabase.from("study_materials").select("title, analysis").eq("id", materialId).single(),
        supabase.from("material_chats").select("messages").eq("user_id", user.id).eq("material_id", materialId).maybeSingle(),
      ]);

      if (!data) { setNotFound(true); setLoading(false); return; }
      setMaterialTitle(data.title);
      const analysis = data.analysis as MaterialAnalysis | null;
      setTemas((analysis?.temas ?? []).map((t) => t.nombre).slice(0, 4));
      if (chatData?.messages) setMessages(chatData.messages as ChatMessage[]);
      setLoading(false);
    }
    load();
  }, [materialId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const content = text.trim().slice(0, MAX_INPUT);
    if (!content || streaming) return;
    setError(null);
    setInput("");

    const history: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setStreaming(true);

    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materialId, messages: history.slice(-MAX_HISTORY) }),
      });

      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => null);
        setError(json?.error ?? "El tutor no pudo responder. Inténtalo de nuevo.");
        setMessages(history); // quitar el placeholder vacío del asistente
        setStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        const current = acc;
        setMessages([...history, { role: "assistant", content: current }]);
      }
      if (!acc.trim()) {
        setError("El tutor no pudo responder. Inténtalo de nuevo.");
        setMessages(history);
      } else if (userId) {
        const finalMessages = [...history, { role: "assistant" as const, content: acc }];
        supabase.from("material_chats").upsert(
          { user_id: userId, material_id: materialId, messages: finalMessages, updated_at: new Date().toISOString() },
          { onConflict: "user_id,material_id" }
        );
      }
    } catch {
      setError("Error de conexión con el tutor. Inténtalo de nuevo.");
      setMessages(history);
    }
    setStreaming(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  const starters = [
    ...(temas[0] ? [`Explícame "${temas[0]}" como si fuera la primera vez`] : []),
    ...(temas[1] ? [`Tómame la lección de "${temas[1]}"`] : []),
    "¿Qué es lo más preguntable de este material en un examen?",
    "¿Por dónde me conviene empezar hoy?",
  ].slice(0, 4);

  return (
    <main className="h-dvh text-slate-900 flex flex-col">
      <AppHeader
        backHref={`/app/material/${materialId}`}
        backLabel="← Material"
        right={messages.length > 0 && !streaming ? (
          <button
            onClick={() => {
              setMessages([]);
              if (userId) supabase.from("material_chats").delete().eq("user_id", userId).eq("material_id", materialId);
            }}
            className="text-xs text-slate-400 hover:text-red-500 transition"
          >
            🗑 Limpiar
          </button>
        ) : undefined}
      />

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : notFound ? (
        <div className="flex-1 flex items-center justify-center text-center">
          <div>
            <p className="text-4xl mb-4">📭</p>
            <p className="font-semibold text-slate-800 mb-6">Material no encontrado</p>
            <Link href="/app" className="px-6 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition">
              Volver al campus
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Conversación */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
              {messages.length === 0 && (
                <div className="text-center mt-10 animate-fade-up">
                  <p className="text-4xl mb-4">🧑‍⚕️</p>
                  <h1 className="text-2xl font-bold">Tu tutor de {materialTitle}</h1>
                  <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
                    Conoce tus apuntes, tus notas y tus temas flojos. Preguntale lo que quieras
                    o pedile que te tome la lección.
                  </p>
                  <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                    {starters.map((s) => (
                      <button key={s} onClick={() => send(s)}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 hover:border-blue-400 hover:text-blue-700 transition">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  {m.role === "user" ? (
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-blue-600 text-white px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
                      {m.content}
                    </div>
                  ) : (
                    <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-white border border-slate-200 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-slate-800">
                      {m.content || (
                        <span className="inline-flex gap-1 items-center text-slate-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:120ms]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:240ms]" />
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 text-center">
                  {error}
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* Entrada */}
          <div className="shrink-0 border-t border-slate-200 bg-white/80 backdrop-blur px-4 py-3">
            <div className="max-w-2xl mx-auto flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                rows={1}
                maxLength={MAX_INPUT}
                placeholder="Preguntale a tu tutor..."
                className="flex-1 resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-h-32"
              />
              <button
                onClick={() => send(input)}
                disabled={streaming || !input.trim()}
                className="shrink-0 px-5 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-40"
              >
                {streaming ? "..." : "Enviar"}
              </button>
            </div>
            <p className="max-w-2xl mx-auto mt-1.5 text-[11px] text-slate-400">
              El tutor responde solo con base en este material. Verificá lo importante con tus fuentes.
            </p>
          </div>
        </>
      )}
    </main>
  );
}
