import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { env } from '../../config/env';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    if (env.smtp.host && env.smtp.user && env.smtp.pass) {
      this.transporter = nodemailer.createTransport({
        host: env.smtp.host,
        port: env.smtp.port,
        secure: env.smtp.port === 465,
        auth: {
          user: env.smtp.user,
          pass: env.smtp.pass,
        },
      });
    }
  }

  isConfigured(): boolean {
    return !!this.transporter;
  }

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<boolean> {
    const subject = 'Öğretmen Pro – Şifre Sıfırlama';
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; line-height: 1.5; color: #333;">
  <h2>Şifre Sıfırlama</h2>
  <p>Öğretmen Pro hesabınız için şifre sıfırlama talebinde bulundunuz.</p>
  <p>Aşağıdaki bağlantıya tıklayarak yeni şifrenizi belirleyebilirsiniz. Bağlantı 1 saat içinde geçerliliğini yitirecektir.</p>
  <p><a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px;">Şifremi Sıfırla</a></p>
  <p>Bağlantı: <a href="${resetUrl}">${resetUrl}</a></p>
  <p style="color: #666; font-size: 12px;">Bu talebi siz yapmadıysanız bu e-postayı dikkate almayın.</p>
</body>
</html>`;
    if (this.transporter) {
      await this.transporter.sendMail({
        from: env.smtp.from,
        to,
        subject,
        html,
      });
      return true;
    }
    console.log('[EmailService] SMTP yapılandırılmamış – şifre sıfırlama bağlantısı:', resetUrl);
    return false;
  }
}
