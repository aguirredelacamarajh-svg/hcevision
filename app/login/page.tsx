"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("Email o contraseña incorrectos.");
    } else {
      router.push("/app");
      router.refresh();
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="block text-center mb-3">
          <span className="font-bold text-2xl tracking-tight font-display">
            HCE <span className="text-blue-600">Vision</span>
          </span>
        </Link>
        <p className="text-center text-sm text-slate-500 mb-8">
          Tu espacio de estudio te espera 🌿
        </p>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
          <h1 className="text-lg font-semibold text-slate-800 mb-1">Iniciar sesión</h1>
          <p className="text-sm text-slate-500 mb-6">
            El acceso es con la clave personal que te generamos.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
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
              {loading ? "..." : "Entrar"}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-sm text-slate-400">
          ¿Aún no tenés acceso?{" "}
          <Link href="/solicitar-acceso" className="text-blue-600 hover:text-blue-700 transition">
            Solicitalo aquí
          </Link>
        </p>
        <p className="mt-3 text-center text-xs text-slate-400">
          Plataforma de uso educativo para estudiantes de medicina.
        </p>
      </div>
    </main>
  );
}
