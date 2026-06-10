import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // El middleware ya redirige si no hay sesión, pero por si acaso:
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("approved")
    .eq("id", user.id)
    .single();

  if (!profile?.approved) {
    return (
      <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 text-center">
        <Link href="/" className="mb-10 font-bold text-xl tracking-tight">
          HCE <span className="text-blue-600">Vision</span>
        </Link>

        <div className="bg-white border border-slate-200 rounded-2xl p-10 max-w-sm w-full shadow-sm">
          <div className="w-14 h-14 bg-amber-50 border border-amber-200 rounded-full flex items-center justify-center mx-auto mb-5">
            <span className="text-2xl">⏳</span>
          </div>
          <h1 className="text-lg font-bold text-slate-800">Acceso pendiente</h1>
          <p className="mt-3 text-sm text-slate-500 leading-relaxed">
            Tu cuenta{" "}
            <span className="font-medium text-slate-700">{user.email}</span>{" "}
            está registrada y pendiente de validación. Te avisaremos por email
            cuando se active el acceso.
          </p>
          <p className="mt-5 text-xs text-slate-400">
            ¿Tienes alguna duda? Escríbenos a{" "}
            <a
              href="mailto:aguirredelacamara.jh@gmail.com"
              className="underline hover:text-slate-600"
            >
              aguirredelacamara.jh@gmail.com
            </a>
          </p>
        </div>

        <form action="/auth/signout" method="post" className="mt-6">
          <button className="text-sm text-slate-400 hover:text-slate-600 underline underline-offset-2">
            Cerrar sesión
          </button>
        </form>
      </main>
    );
  }

  return <>{children}</>;
}
