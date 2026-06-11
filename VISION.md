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

### Fase 3 — Tutor inteligente (completa)
- ✅ **Chat por material** (`/app/material/[id]/tutor` + `/api/tutor` con streaming): el tutor
  recibe el material, su análisis y el desempeño real del estudiante (últimos intentos +
  temas flojos/dominados según SRS). Responde solo con base en el material y puede tomar
  la lección. Conversación en memoria (no persiste — candidato a tabla futura).
- ✅ **Recomendación diaria** ("🧭 Hoy te conviene" en el campus): heurística sin coste de IA —
  repasos pendientes según SRS + examen más flojo del último intento (umbral 70%).
- ✅ **Casos clínicos interactivos** (`/app/material/[id]/caso` + `/api/caso`): 5 fases
  (anamnesis → exploración → pruebas → diagnóstico → tratamiento), decisión con 4 opciones
  y feedback razonado por fase, perlas finales. Filtro por tema opcional. No persiste.

### Fase 4 — Biblioteca y comunidad (completa)
- ✅ **Biblioteca** (`/app/biblioteca`): buscador por título, tema y concepto (sin acentos),
  etiquetas derivadas automáticamente de los temas del análisis. Los exámenes heredan las
  etiquetas de su material.
- ✅ **Compartir exámenes** (lectura pública opt-in): toggle en el panel de revisión genera un
  enlace `/compartido/{share_id}`. Cualquiera (incluso sin cuenta) puede hacer el examen;
  con cuenta puede guardarlo en su campus. Las notas del autor nunca se exponen.
- ✅ **Validación comunitaria**: votos "👍 Me sirvió" (uno por usuario) y reportes de error por
  pregunta en la vista compartida. El autor ve los reportes como badge "⚠ N reportes" en cada
  pregunta de su panel.
- ⏳ Compartir mapas conceptuales y flashcards (solo exámenes por ahora).

> ⚠️ Requiere ejecutar `supabase/migrations/003_compartir_comunidad.sql` antes de usar
> compartir/votos/reportes. La UI degrada con elegancia si no está aplicada.

### Deuda técnica conocida
- ✅ Restyle de landing y login al lenguaje cozy: Fraunces en titulares, copy de plataforma
  completa (mapa, ruta, flashcards, tutor, casos, compartir), sección "cómo funciona".
- ✅ Componentes compartidos extraídos a `components/`: `AppHeader` (10 páginas),
  `exam/ExamHud` (sidebar + barra móvil con dots) y `exam/QuestionCard` (pregunta en curso),
  usados por `nuevo` y `rehacer`. Tipo `ExamAnswer` unificado en `lib/types.ts`.
- `pending`/`processing` de análisis: hoy se resuelve con recarga manual; valorar polling
  o Supabase Realtime.
- Persistir conversaciones del tutor y casos clínicos (hoy viven en memoria).
- Compartir mapas conceptuales y flashcards (hoy solo exámenes).
