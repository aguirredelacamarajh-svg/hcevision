import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Cabecera compartida de la aplicación: logo + enlace de vuelta (o contenido
 * a medida vía `right`). Usada por examen, materiales, repaso, tutor, etc.
 */
export function AppHeader({
  logoHref = "/app",
  backHref = "/app",
  backLabel = "← Campus",
  center,
  right,
}: {
  logoHref?: string;
  backHref?: string;
  backLabel?: string;
  center?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <header className="px-6 py-4 shrink-0 flex items-center justify-between bg-white/70 backdrop-blur border-b border-slate-200 sticky top-0 z-10">
      <Link href={logoHref} className="font-bold text-lg tracking-tight font-display">
        HCE <span className="text-blue-600">Vision</span>
      </Link>
      {center}
      {right ?? (
        <Link href={backHref} className="text-sm text-slate-400 hover:text-slate-600 transition shrink-0">
          {backLabel}
        </Link>
      )}
    </header>
  );
}
