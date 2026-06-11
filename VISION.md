# HCE Vision — Visión de producto y hoja de ruta

HCE Vision es una plataforma de aprendizaje médico impulsada por IA. No genera solo exámenes:
convierte cualquier material de estudio (apuntes, PDFs, guías clínicas) en un sistema completo
de aprendizaje personalizado — estructurado, visual y acompañado.

**Principios:**
- **Medicina-first.** Prompts y copy ajustados a terminología clínica. La expansión a otras
  disciplinas será una decisión consciente, no el estado actual.
- **Diseño cozy.** Papel, arcilla, salvia y tinta. Estudiar largas horas sin frío tecnológico.
  El sistema de diseño vive en `app/globals.css` (remapeo de paletas Tailwind v4) y en las
  fuentes Fraunces (display) + Karla (cuerpo) de `app/layout.tsx`.
- **Aprendizaje activo.** Todo material se transforma en recursos accionables: mapa conceptual,
  ruta de aprendizaje, exámenes, flashcards.
- **Seguridad primero.** RLS en todas las tablas, verificación de sesión + aprobación en cada
  ruta de API que consume Claude, secretos solo en variables de entorno.

---

## Estado actual (junio 2026)

### ✅ Fase 0 — Generador de exámenes (completa)
- Generación de exámenes tipo test desde PDFs/texto (`/api/generate`, tool calling forzado).
- Campus con carpetas, exámenes guardados, historial de intentos (`exam_attempts`).
- Rehacer examen (`/app/rehacer/[examId]`), exportar PDF, aprobación manual de usuarios.

### ✅ Fase 1 — Materiales de estudio (este sprint)
- **Tabla `study_materials`**: el material fuente se guarda una sola vez y se reutiliza.
- **Análisis conceptual** (`/api/analyze`): temas con importancia (fundamental / importante /
  complementario), dependencias entre temas, ruta de aprendizaje ordenada y resumen.
- **Mapa conceptual interactivo**: niveles por dependencias, conexiones SVG, detalle por tema.
- **Flashcards** (`/api/flashcards` + tablas `flashcards`, `flashcard_reviews`): generación
  por IA y modo estudio con active recall (Otra vez / Difícil / Bien, repetición de falladas).
- **Integración**: generar examen desde un material (`/app/nuevo?material=id`,
  `saved_exams.material_id`), sección Materiales en el campus.
- **Rediseño cozy global** vía remapeo de paletas en Tailwind v4.

> ⚠️ Requiere ejecutar `supabase/migrations/002_study_materials_flashcards.sql` antes de desplegar.

---

## Hoja de ruta

### Fase 2 — Memoria académica (completa)
- ✅ **Repaso espaciado real**: `lib/srs.ts` (SM-2 simplificado, escalera 0/1/3/7/14/30/60 días),
  sesión global en `/app/repaso` y banner "Repasos pendientes" en el campus.
- ✅ **Examen de refuerzo**: `/api/refuerzo` toma los errores del último intento, genera 10
  preguntas nuevas sobre esos conceptos y las guarda como examen "🎯 Refuerzo · ...".
  Botón en el panel de revisión del campus.
- ✅ **Dashboard de aprendizaje** (`/app/progreso`): racha de estudio (días con intentos o
  repasos), evolución de notas (SVG, últimos 30 intentos), media a 30 días, tarjetas dominadas
  (escalón SRS ≥ 3 = intervalo 7+ días) y desglose por material con temas
  dominado / en progreso / pendiente.

### Fase 3 — Tutor inteligente
- Chat por material: preguntas con contexto del material y del desempeño del usuario.
- Recomendación diaria: "hoy te conviene repasar X y hacer un examen corto de Y".
- Casos clínicos interactivos paso a paso (anamnesis → pruebas → diagnóstico → tratamiento).

### Fase 4 — Biblioteca y comunidad
- Vista biblioteca dedicada con buscador y etiquetas.
- Compartir exámenes/mapas/flashcards entre usuarios (lectura pública opt-in).
- Validación comunitaria de recursos (votos, reportes de errores en preguntas).

### Deuda técnica conocida
- Restyle fino de landing y login al lenguaje cozy (hoy heredan el retinte global).
- Extraer componentes compartidos (header, QuestionDot, pantalla de examen) usados por
  `nuevo`, `rehacer` y futuros modos.
- `pending`/`processing` de análisis: hoy se resuelve con recarga manual; valorar polling
  o Supabase Realtime.
