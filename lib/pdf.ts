import type { Question } from "./types";

export interface ExamPDFOptions {
  title: string;
  nivel: string;
  questions: Question[];
  date?: string;
}

const CSS = `*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Helvetica Neue',Arial,sans-serif;color:#1e293b;padding:40px;max-width:800px;margin:0 auto;font-size:14px;line-height:1.6}.header{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #2563eb;padding-bottom:16px;margin-bottom:28px}.logo{font-size:22px;font-weight:800;letter-spacing:-0.02em}.logo-blue{color:#2563eb}.badge{background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;border-radius:6px;padding:4px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em}.meta{font-size:12px;color:#64748b;margin-bottom:28px}.exam-title{font-size:18px;font-weight:700;color:#1e293b;margin-bottom:6px}.question{margin-bottom:24px;page-break-inside:avoid}.question-num{font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px}.question-text{font-weight:500;margin-bottom:10px}.option{display:flex;gap:10px;margin-bottom:4px;font-size:13px}.option-letter{font-weight:600;min-width:20px;color:#475569}.answers{margin-top:40px;border-top:2px solid #e2e8f0;padding-top:24px;page-break-before:always}.answers-title{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:16px}.answer-item{margin-bottom:18px}.answer-header{display:flex;gap:10px;align-items:baseline;margin-bottom:3px}.answer-num{font-weight:700;min-width:24px;color:#475569;font-size:13px}.answer-correct{font-weight:600;color:#16a34a;font-size:13px}.answer-explanation{font-size:12px;color:#475569;line-height:1.6;padding-left:34px}.footer{margin-top:40px;border-top:1px solid #e2e8f0;padding-top:14px;font-size:11px;color:#94a3b8;text-align:center}@media print{body{padding:15mm 20mm}.question{page-break-inside:avoid}.answers{page-break-before:always}}`;

export function generateExamPDF({ title, nivel, questions, date }: ExamPDFOptions): void {
  const nivelCap = nivel.charAt(0).toUpperCase() + nivel.slice(1);
  const dateStr = date ?? new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });

  const questionsHtml = questions.map((q, i) => `
    <div class="question">
      <p class="question-num">Pregunta ${i + 1}</p>
      <p class="question-text">${q.enunciado}</p>
      <div class="options">${q.opciones.map((op, j) => `
        <div class="option"><span class="option-letter">${String.fromCharCode(65 + j)})</span><span>${op}</span></div>`).join("")}
      </div>
    </div>`).join("");

  const answersHtml = questions.map((q, i) => `
    <div class="answer-item">
      <div class="answer-header">
        <span class="answer-num">${i + 1}.</span>
        <span class="answer-correct">${String.fromCharCode(65 + q.correcta)}) ${q.opciones[q.correcta]}</span>
      </div>
      <p class="answer-explanation">${q.explicacion}</p>
    </div>`).join("");

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${title}</title>
  <style>${CSS}</style></head>
  <body>
  <div class="header"><div class="logo">HCE <span class="logo-blue">Vision</span></div><div class="badge">Examen ${nivelCap}</div></div>
  <p class="exam-title">${title}</p>
  <p class="meta">${questions.length} preguntas · ${dateStr} · Generado con HCE Vision</p>
  ${questionsHtml}
  <div class="answers"><p class="answers-title">Clave de respuestas y explicaciones</p>${answersHtml}</div>
  <div class="footer">Material educativo generado con HCE Vision — solo para uso personal de estudio</div>
  <script>window.onload=()=>window.print()</script></body></html>`;

  const win = window.open("", "_blank");
  if (!win) { alert("Permite las ventanas emergentes para descargar el PDF."); return; }
  win.document.write(html);
  win.document.close();
}
