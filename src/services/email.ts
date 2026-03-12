// src/services/email.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Datos que llegan desde functionExecutor al crear una pre-reservación
export interface PrereservacionEmailData {
    folio: string;
    nombre: string;
    email: string;
    telefono: string;
    tipo_habitacion: string;
    fecha_entrada: string;
    fecha_salida: string;
    noches: number;
    personas: number;
    notas?: string;
}

export async function sendPrereservacionEmail(data: PrereservacionEmailData): Promise<void> {
    const destinatario = process.env.HOTEL_NOTIFY_EMAIL;

    if (!destinatario) {
        console.warn('[EMAIL] HOTEL_NOTIFY_EMAIL no configurado — se omite notificación');
        return;
    }

    const { error } = await resend.emails.send({
        // Resend permite usar onboarding@resend.dev mientras no tengas dominio verificado
        from: 'Sofía — Integra Hotel AI <onboarding@resend.dev>',
        to: destinatario,
        subject: `🏨 Nueva pre-reservación ${data.folio} — ${data.nombre}`,
        html: buildEmailHtml(data),
    });

    if (error) {
        // Lanzamos el error para que functionExecutor pueda loguearlo
        throw new Error(`Resend error: ${error.message}`);
    }

    console.log(`[EMAIL] Notificación enviada — ${data.folio} → ${destinatario}`);
}

// ── Template HTML del email ───────────────────────────────────────────────────
function buildEmailHtml(data: PrereservacionEmailData): string {
    const notasRow = data.notas
        ? `<tr>
        <td style="padding:8px 0;color:#666;font-size:14px;">Notas</td>
        <td style="padding:8px 0;font-size:14px;font-weight:500;">${data.notas}</td>
       </tr>`
        : '';

    return `
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="UTF-8"></head>
    <body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

            <!-- Header -->
            <tr>
              <td style="background:linear-gradient(135deg,#2E7DAF,#1a5f8a);padding:28px 32px;">
                <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.75);letter-spacing:1px;text-transform:uppercase;">Integra Hotel AI</p>
                <h1 style="margin:4px 0 0;font-size:22px;color:#fff;font-weight:600;">Nueva Pre-Reservación</h1>
              </td>
            </tr>

            <!-- Folio badge -->
            <tr>
              <td style="padding:24px 32px 0;">
                <span style="background:#EBF5FF;color:#2E7DAF;font-size:13px;font-weight:600;padding:6px 14px;border-radius:20px;letter-spacing:.5px;">
                  📋 ${data.folio}
                </span>
              </td>
            </tr>

            <!-- Datos del huésped -->
            <tr>
              <td style="padding:20px 32px 0;">
                <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#999;text-transform:uppercase;letter-spacing:.8px;">Huésped</p>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:8px 0;color:#666;font-size:14px;width:140px;">Nombre</td>
                    <td style="padding:8px 0;font-size:14px;font-weight:500;">${data.nombre}</td>
                  </tr>
                  <tr style="border-top:1px solid #f0f0f0;">
                    <td style="padding:8px 0;color:#666;font-size:14px;">Email</td>
                    <td style="padding:8px 0;font-size:14px;font-weight:500;">
                      <a href="mailto:${data.email}" style="color:#2E7DAF;text-decoration:none;">${data.email}</a>
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #f0f0f0;">
                    <td style="padding:8px 0;color:#666;font-size:14px;">Teléfono</td>
                    <td style="padding:8px 0;font-size:14px;font-weight:500;">${data.telefono}</td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Datos de la estancia -->
            <tr>
              <td style="padding:20px 32px 0;">
                <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#999;text-transform:uppercase;letter-spacing:.8px;">Estancia</p>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:8px 0;color:#666;font-size:14px;width:140px;">Habitación</td>
                    <td style="padding:8px 0;font-size:14px;font-weight:500;">${data.tipo_habitacion}</td>
                  </tr>
                  <tr style="border-top:1px solid #f0f0f0;">
                    <td style="padding:8px 0;color:#666;font-size:14px;">Check-in</td>
                    <td style="padding:8px 0;font-size:14px;font-weight:500;">${data.fecha_entrada}</td>
                  </tr>
                  <tr style="border-top:1px solid #f0f0f0;">
                    <td style="padding:8px 0;color:#666;font-size:14px;">Check-out</td>
                    <td style="padding:8px 0;font-size:14px;font-weight:500;">${data.fecha_salida}</td>
                  </tr>
                  <tr style="border-top:1px solid #f0f0f0;">
                    <td style="padding:8px 0;color:#666;font-size:14px;">Noches / Personas</td>
                    <td style="padding:8px 0;font-size:14px;font-weight:500;">${data.noches} noche${data.noches > 1 ? 's' : ''} · ${data.personas} persona${data.personas > 1 ? 's' : ''}</td>
                  </tr>
                  ${notasRow}
                </table>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:28px 32px;margin-top:8px;">
                <p style="margin:0;font-size:12px;color:#bbb;text-align:center;">
                  Generado automáticamente por Sofía · Integra Hotel AI<br>
                  Este mensaje es solo una pre-reservación — confirmar con el huésped antes de bloquear inventario.
                </p>
              </td>
            </tr>

          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
}