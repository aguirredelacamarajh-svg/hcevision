import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { nombre, apellido, edad, nivel, institucion, materias_interes, telefono, email } = body;

  if (!nombre || !apellido || !edad || !nivel || !materias_interes || !telefono || !email) {
    return NextResponse.json({ error: "Todos los campos son requeridos." }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("access_requests").insert({
    nombre: nombre.trim(),
    apellido: apellido.trim(),
    edad: parseInt(edad),
    nivel,
    institucion: (institucion ?? "").trim(),
    materias_interes: materias_interes.trim(),
    telefono: telefono.trim(),
    email: email.trim().toLowerCase(),
  });

  if (error) {
    console.error("access_requests insert:", error);
    return NextResponse.json({ error: "Error al guardar. Intentá de nuevo." }, { status: 500 });
  }

  if (process.env.RESEND_API_KEY) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "HCE Vision <onboarding@resend.dev>",
        to: ["aguirredelacamara.jh@gmail.com"],
        subject: `Nueva solicitud — ${nombre} ${apellido}`,
        html: `
          <h2 style="font-family:sans-serif;color:#1e3a5f;">Nueva solicitud de acceso a HCE Vision</h2>
          <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse;">
            <tr><td style="padding:6px 16px 6px 0;color:#64748b;"><strong>Nombre</strong></td><td>${nombre} ${apellido}</td></tr>
            <tr><td style="padding:6px 16px 6px 0;color:#64748b;"><strong>Edad</strong></td><td>${edad} años</td></tr>
            <tr><td style="padding:6px 16px 6px 0;color:#64748b;"><strong>Nivel</strong></td><td>${nivel}</td></tr>
            <tr><td style="padding:6px 16px 6px 0;color:#64748b;"><strong>Institución</strong></td><td>${institucion || "—"}</td></tr>
            <tr><td style="padding:6px 16px 6px 0;color:#64748b;vertical-align:top;"><strong>Materias / temas</strong></td><td>${materias_interes}</td></tr>
            <tr><td style="padding:6px 16px 6px 0;color:#64748b;"><strong>Teléfono</strong></td><td>${telefono}</td></tr>
            <tr><td style="padding:6px 16px 6px 0;color:#64748b;"><strong>Email</strong></td><td>${email}</td></tr>
          </table>
        `,
      }),
    }).catch((err) => console.warn("Email notification failed:", err));
  }

  return NextResponse.json({ ok: true });
}
