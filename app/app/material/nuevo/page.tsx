"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AppHeader } from "@/components/AppHeader";

interface PdfEntry { name: string; text: string; }
interface Folder { id: string; name: string; color: string; }

const MAX_PDFS = 3;

export default function NuevoMaterial() {
  const router = useRouter();
  const supabase = createClient();

  const [title, setTitle] = useState("");
  const [pdfs, setPdfs] = useState<PdfEntry[]>([]);
  const [pastedText, setPastedText] = useState("");
  const [showTextarea, setShowTextarea] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from("folders").select("id, name, color").order("created_at")
      .then(({ data }) => setFolders(data ?? []));
  }, []);

  const combinedText = [...pdfs.map((p) => p.text), pastedText]
    .filter((t) => t.trim().length > 0).join("\n\n---\n\n");
  const canSubmit = combinedText.trim().length >= 300 && title.trim().length > 0 && !pdfLoading && !submitting;

  // ─── PDFs ──────────────────────────────────────────────────────────────────

  async function extractText(file: File): Promise<string> {
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const content = await (await pdf.getPage(i)).getTextContent();
      pages.push(content.items.map((it) => ("str" in it ? (it as { str: string }).str : "")).join(" "));
    }
    return pages.join("\n\n").trim();
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    const remaining = MAX_PDFS - pdfs.length;
    if (!remaining) { setError(`Máximo ${MAX_PDFS} PDFs.`); return; }
    const files = Array.from(fileList).filter((f) => f.type === "application/pdf").slice(0, remaining);
    if (!files.length) { setError("Solo se aceptan PDFs."); return; }
    setError(null);
    setPdfLoading(true);
    const results: PdfEntry[] = [];
    for (const file of files) {
      try {
        const text = await extractText(file);
        if (text.length < 100) setError(`"${file.name}" no tiene texto extraíble.`);
        else results.push({ name: file.name, text });
      } catch { setError(`Error leyendo "${file.name}".`); }
    }
    if (results.length) {
      setPdfs((p) => [...p, ...results].slice(0, MAX_PDFS));
      // Sugerir título a partir del primer PDF si aún no hay
      if (!title.trim() && results[0]) {
        setTitle(results[0].name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim().slice(0, 80));
      }
    }
    setPdfLoading(false);
  }

  // ─── Crear material + analizar ─────────────────────────────────────────────

  async function createMaterial() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { data, error: insertError } = await supabase
      .from("study_materials")
      .insert({
        user_id: user.id,
        folder_id: selectedFolderId || null,
        title: title.trim(),
        source_text: combinedText,
        char_count: combinedText.length,
      })
      .select("id")
      .single();

    if (insertError || !data) {
      setError("No se pudo guardar el material. Inténtalo de nuevo.");
      setSubmitting(false);
      return;
    }

    // Navegar de inmediato — la página del material dispara el análisis automáticamente
    router.push(`/app/material/${data.id}`);
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen text-slate-900 flex flex-col">
      <AppHeader backHref="/app" backLabel="← Campus" />

      <div className="flex-1 flex flex-col items-center px-4 pb-16">

        <div className="w-full max-w-xl mt-8 sm:mt-12 animate-fade-up">
            <div className="text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600 mb-2">Biblioteca</p>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Nuevo material de estudio</h1>
              <p className="mt-3 text-slate-500 leading-relaxed">
                Sube tus apuntes y los convertimos en un mapa conceptual,<br className="hidden sm:block" />
                una ruta de aprendizaje, exámenes y flashcards.
              </p>
            </div>

            {error && (
              <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
            )}

            {/* Título */}
            <div className="mt-8">
              <label className="text-sm font-semibold text-slate-700 mb-2 block">Nombre del material</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej.: Insuficiencia cardíaca — Cardiología"
                maxLength={80}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* PDFs */}
            {pdfs.length > 0 && (
              <div className="mt-5 space-y-2">
                {pdfs.map((pdf, i) => (
                  <div key={i} className="flex items-center justify-between bg-white border border-green-200 rounded-xl px-4 py-3">
                    <span className="text-sm font-medium truncate">📄 {pdf.name}</span>
                    <button onClick={() => setPdfs((p) => p.filter((_, j) => j !== i))}
                      className="ml-3 shrink-0 text-slate-400 hover:text-red-500 transition text-lg">✕</button>
                  </div>
                ))}
              </div>
            )}

            {pdfs.length < MAX_PDFS && (
              <div onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
                onClick={() => fileInputRef.current?.click()}
                className={`mt-5 border-2 border-dashed rounded-2xl p-8 cursor-pointer transition text-center
                  ${dragOver ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-white hover:border-blue-400"}`}>
                <input ref={fileInputRef} type="file" accept="application/pdf" multiple className="hidden"
                  onChange={(e) => handleFiles(e.target.files)} />
                {pdfLoading ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <p className="font-medium text-blue-700">Extrayendo texto...</p>
                  </div>
                ) : (
                  <>
                    <p className="font-medium">
                      {pdfs.length === 0 ? "Arrastra tus PDFs o haz clic" : `Añadir otro PDF (${MAX_PDFS - pdfs.length} restante${MAX_PDFS - pdfs.length !== 1 ? "s" : ""})`}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">Hasta {MAX_PDFS} PDFs</p>
                  </>
                )}
              </div>
            )}

            <button onClick={() => setShowTextarea((s) => !s)}
              className="mt-4 text-sm text-slate-500 underline underline-offset-2 block mx-auto">
              o pega tu texto directamente
            </button>
            {showTextarea && (
              <textarea value={pastedText} onChange={(e) => setPastedText(e.target.value)}
                placeholder="Pega aquí el contenido de tus apuntes..."
                className="mt-3 w-full h-40 rounded-xl border border-slate-300 bg-white p-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            )}

            {/* Carpeta */}
            <div className="mt-6">
              <label className="text-sm font-semibold text-slate-700 mb-2 block">
                Carpeta <span className="font-normal text-slate-400">(opcional)</span>
              </label>
              <select value={selectedFolderId} onChange={(e) => setSelectedFolderId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Sin carpeta</option>
                {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>

            <button onClick={createMaterial} disabled={!canSubmit}
              className="mt-8 w-full px-10 py-3.5 rounded-xl bg-blue-600 text-white font-semibold text-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 transition">
              {submitting ? "Guardando..." : "Analizar material"}
            </button>
            <p className="mt-3 text-center text-xs text-slate-400">
              Mínimo 300 caracteres de contenido · El material queda guardado en tu biblioteca
            </p>
        </div>
      </div>
    </main>
  );
}
