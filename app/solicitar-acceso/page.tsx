"use client";

import { useState } from "react";
import Link from "next/link";

const NIVELES = [
  "1° año de medicina",
  "2° año de medicina",
  "3° año de medicina",
  "4° año de medicina",
  "5° año de medicina",
  "6° año de medicina",
  "Internado / Año de práctica",
  "Residencia",
  "Fellowship",
  "Otra formación",
];

export default function SolicitarAcceso() {
  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    edad: "",
    nivel: "",
    institucion: "",
    materias_interes: "",
    telefono: "",
    email: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/solicitar-acceso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      setSuccess(true);
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Error inesperado. Intentá de nuevo.");
    }
    setLoading(false);
  }

  if (success) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <Link href="/" className="block mb-6">
            <span className="font-bold text-2xl tracking-tight font-display">
              HCE <span className="text-blue-600">Vision</span>
            </span>
          </Link>
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-10">
            <p className="text-4xl mb-4">✅</p>
            <h1 className="text-xl font-bold text-slate-800 mb-2">Solicitud enviada</h1>
            <p className="text-sm text-slate-500 leading-relaxed">
              Recibimos tus datos. En cuanto revisemos tu solicitud te enviamos las credenciales de acceso al mail que indicaste.
            </p>
          </div>
          <Link href="/" className="mt-6 inline-block text-sm text-slate-400 hover:text-slate-600 transition">
            ← Volver al inicio
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <Link href="/" className="block text-center mb-3">
          <span className="font-bold text-2xl tracking-tight font-display">
            HCE <span className="text-blue-600">Vision</span>
          </span>
        </Link>
        <p className="text-center text-sm text-slate-500 mb-8">
          Completá el formulario y te enviamos tu acceso 🌿
        </p>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
          <h1 className="text-lg font-semibold text-slate-800 mb-1">Solicitar acceso</h1>
          <p className="text-sm text-slate-500 mb-6">
            El acceso es personal. Revisamos cada solicitud y te enviamos tus credenciales.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nombre y Apellido */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Nombre</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => set("nombre", e.target.value)}
                  placeholder="Juan"
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Apellido</label>
                <input
                  type="text"
                  value={form.apellido}
                  onChange={(e) => set("apellido", e.target.value)}
                  placeholder="Pérez"
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Edad */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Edad</label>
              <input
                type="number"
                value={form.edad}
                onChange={(e) => set("edad", e.target.value)}
                placeholder="22"
                min={16}
                max={80}
                required
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Nivel */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Año de cursada o grado alcanzado
              </label>
              <select
                value={form.nivel}
                onChange={(e) => set("nivel", e.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="" disabled>Seleccioná una opción</option>
                {NIVELES.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            {/* Institución */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Institución</label>
              <input
                type="text"
                value={form.institucion}
                onChange={(e) => set("institucion", e.target.value)}
                placeholder="Ej: UBA, UNC, Hospital Italiano..."
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Materias */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Materias o temas de interés
              </label>
              <textarea
                value={form.materias_interes}
                onChange={(e) => set("materias_interes", e.target.value)}
                placeholder="Ej: Farmacología, Semiología, Cardiología, Preparación MIR..."
                required
                rows={3}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Teléfono */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Número de teléfono</label>
              <input
                type="tel"
                value={form.telefono}
                onChange={(e) => set("telefono", e.target.value)}
                placeholder="+54 9 11 1234-5678"
                required
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="tu@email.com"
                required
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Enviando..." : "Enviar solicitud"}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-sm text-slate-400">
          ¿Ya tenés acceso?{" "}
          <Link href="/login" className="text-blue-600 hover:text-blue-700 transition">
            Iniciá sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
