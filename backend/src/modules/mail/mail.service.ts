import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  private createTransport() {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendRecoveryCode(email: string, code: string): Promise<void> {
    const from = process.env.SMTP_FROM_EMAIL ?? 'noreply@bizwareapps.com';
    const html = `
      <div style="font-family:'Inter',Arial,sans-serif;max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.1)">
        <div style="background:linear-gradient(135deg,#0D3B5E 0%,#207E83 100%);padding:2rem;text-align:center">
          <div style="width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,0.15);display:inline-flex;align-items:center;justify-content:center;margin-bottom:1rem">
            <span style="font-size:1.5rem">🔐</span>
          </div>
          <h1 style="margin:0;color:#ffffff;font-size:1.4rem;font-weight:800;letter-spacing:-0.02em">S10 Intelligence Hub</h1>
          <p style="margin:0.25rem 0 0;color:rgba(255,255,255,0.7);font-size:0.8rem;letter-spacing:0.1em;text-transform:uppercase">Recuperación de contraseña</p>
        </div>

        <div style="padding:2rem">
          <p style="color:#374151;font-size:0.95rem;margin:0 0 1.5rem">Recibimos una solicitud para restablecer la contraseña de tu cuenta. Usa el siguiente código:</p>

          <div style="background:#F3F4F6;border-radius:12px;padding:1.5rem;text-align:center;margin-bottom:1.5rem">
            <div style="font-size:2.5rem;font-weight:900;letter-spacing:0.4em;color:#0D3B5E;font-family:'IBM Plex Mono',monospace">${code}</div>
            <p style="margin:0.5rem 0 0;color:#6B7280;font-size:0.78rem">Válido por 15 minutos</p>
          </div>

          <p style="color:#6B7280;font-size:0.82rem;margin:0">Si no solicitaste este código, ignora este mensaje. Tu contraseña no cambiará.</p>
        </div>

        <div style="background:#F9FAFB;padding:1rem 2rem;text-align:center;border-top:1px solid #E5E7EB">
          <p style="margin:0;color:#9CA3AF;font-size:0.72rem">© 2026 Bizware Consultoría. Todos los derechos reservados.</p>
        </div>
      </div>
    `;

    if (process.env.NODE_ENV !== 'production' && !process.env.SMTP_HOST) {
      this.logger.log(`[DEV] Recovery code for ${email}: ${code}`);
      return;
    }

    try {
      const transport = this.createTransport();
      await transport.sendMail({
        from: `"S10 BizSmartHub" <${from}>`,
        to: email,
        subject: 'Código de recuperación de contraseña',
        html,
      });
    } catch (err) {
      this.logger.error(`Failed to send recovery email to ${email}`, err);
      if (process.env.NODE_ENV !== 'production') {
        this.logger.log(`[DEV fallback] Recovery code for ${email}: ${code}`);
      } else {
        throw err;
      }
    }
  }
}
