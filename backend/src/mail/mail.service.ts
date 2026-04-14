import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService, MailConfigForSending } from '../app-config/app-config.service';
import { env } from '../config/env';
import { interpolateMailTemplate, escapeMailText } from './mail-template-render';
import type { MailTemplateId } from './mail-templates.types';
import { createNodemailerTransporter } from './nodemailer-transport';

export interface NotificationEmailParams {
  title: string;
  body?: string | null;
  eventType: string;
  targetScreen?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly appConfig: AppConfigService) {}

  /** Bildirim e-postası gönder. SMTP yapılandırılmamışsa sessizce atlar. */
  async sendNotificationEmail(
    toEmail: string,
    params: NotificationEmailParams,
  ): Promise<boolean> {
    if (!toEmail?.trim()) return false;
    const config = await this.appConfig.getMailConfigForSending();
    if (!config.mail_enabled || !config.smtp_host || !config.smtp_user || !config.smtp_pass) {
      return false;
    }
    const actionUrl = this.buildActionUrl(config.mail_app_base_url, params.targetScreen, params.entityId);
    const html = buildNotificationHtml({
      ...params,
      actionUrl,
      fromName: config.smtp_from_name,
    });
    const text = `${params.title}\n\n${params.body || ''}\n${actionUrl ? `\nGörüntüle: ${actionUrl}` : ''}`;
    return this.sendMailWithConfig(config, toEmail.trim(), params.title, html, text);
  }

  private buildActionUrl(baseUrl: string | null, targetScreen?: string | null, entityId?: string | null): string | null {
    if (!baseUrl?.trim()) return null;
    const base = baseUrl.replace(/\/$/, '');
    if (targetScreen?.trim()) {
      const path = targetScreen.startsWith('/') ? targetScreen.slice(1) : targetScreen;
      return `${base}/${path}`;
    }
    return base;
  }

  /** Okul seçerek kayıt: başvuru alındı (SMTP + mail_enabled kapalıysa atlanır). */
  async sendTeacherSchoolPendingEmail(
    toEmail: string,
    params: { schoolName: string; recipientName: string },
  ): Promise<boolean> {
    const config = await this.appConfig.getMailConfigForSending();
    if (!this.isMailReady(config)) return false;
    const base = (config.mail_app_base_url || env.frontendUrl).replace(/\/$/, '');
    const loginUrl = `${base}/login`;
    const registerUrl = `${base}/register`;
    const { schoolName, recipientName } = params;
    const appName = 'Öğretmen Pro';
    const fromName = (config.smtp_from_name || appName).trim();
    const rendered = await this.renderMailTemplate('teacher_school_pending', {
      app_name: appName,
      from_name: escapeMailText(fromName),
      preheader: escapeMailText(`${schoolName}: başvurunuz alındı. Onay sonrası bu adrese haber vereceğiz.`),
      recipient_name: escapeMailText(recipientName),
      school_name: escapeMailText(schoolName),
      primary_url: loginUrl,
      secondary_url: registerUrl,
      primary_label: 'Giriş yap',
      secondary_label: 'Kayıt bilgileri',
      bar_gradient: '#c2410c',
      badge_bg: '#fff7ed',
      badge_border: '#fed7aa',
      badge_color: '#9a3412',
      badge_label: 'İncelemede',
    });
    return this.sendMailWithConfig(config, toEmail.trim(), rendered.subject, rendered.html, rendered.text);
  }

  /** Okul yöneticisi öğretmeni onayladı. */
  async sendTeacherSchoolApprovedEmail(
    toEmail: string,
    params: { schoolName: string; recipientName: string },
  ): Promise<boolean> {
    const config = await this.appConfig.getMailConfigForSending();
    if (!this.isMailReady(config)) return false;
    const base = (config.mail_app_base_url || env.frontendUrl).replace(/\/$/, '');
    const dashboardUrl = `${base}/dashboard`;
    const loginUrl = `${base}/login`;
    const { schoolName, recipientName } = params;
    const appName = 'Öğretmen Pro';
    const fromName = (config.smtp_from_name || appName).trim();
    const rendered = await this.renderMailTemplate('teacher_school_approved', {
      app_name: appName,
      from_name: escapeMailText(fromName),
      preheader: escapeMailText(`${schoolName} üyeliğiniz onaylandı. Panele giriş yapabilirsiniz.`),
      recipient_name: escapeMailText(recipientName),
      school_name: escapeMailText(schoolName),
      primary_url: dashboardUrl,
      secondary_url: loginUrl,
      primary_label: 'Panele git',
      secondary_label: 'Giriş sayfası',
      bar_gradient: '#047857',
      badge_bg: '#ecfdf5',
      badge_border: '#a7f3d0',
      badge_color: '#065f46',
      badge_label: 'Onaylandı',
    });
    return this.sendMailWithConfig(config, toEmail.trim(), rendered.subject, rendered.html, rendered.text);
  }

  /** Okul yöneticisi başvuruyu reddetti. */
  async sendTeacherSchoolRejectedEmail(
    toEmail: string,
    params: { schoolName: string; recipientName: string },
  ): Promise<boolean> {
    const config = await this.appConfig.getMailConfigForSending();
    if (!this.isMailReady(config)) return false;
    const base = (config.mail_app_base_url || env.frontendUrl).replace(/\/$/, '');
    const registerUrl = `${base}/register`;
    const loginUrl = `${base}/login`;
    const { schoolName, recipientName } = params;
    const appName = 'Öğretmen Pro';
    const fromName = (config.smtp_from_name || appName).trim();
    const rendered = await this.renderMailTemplate('teacher_school_rejected', {
      app_name: appName,
      from_name: escapeMailText(fromName),
      preheader: escapeMailText(`${schoolName} başvurunuz sonuçlandı. Detaylar için e-postayı açın.`),
      recipient_name: escapeMailText(recipientName),
      school_name: escapeMailText(schoolName),
      primary_url: registerUrl,
      secondary_url: loginUrl,
      primary_label: 'Yeniden kayıt ol',
      secondary_label: 'Giriş yap',
      bar_gradient: '#9f1239',
      badge_bg: '#fef2f2',
      badge_border: '#fecaca',
      badge_color: '#991b1b',
      badge_label: 'Sonuçlandı',
    });
    return this.sendMailWithConfig(config, toEmail.trim(), rendered.subject, rendered.html, rendered.text);
  }

  /** Kurumsal e-posta sahipliğini doğrulama bağlantısı (okul kaydı). */
  async sendSchoolJoinVerifyEmail(
    toEmail: string,
    params: { schoolName: string; recipientName: string; verifyUrl: string },
  ): Promise<boolean> {
    const config = await this.appConfig.getMailConfigForSending();
    if (!this.isMailReady(config)) return false;
    const appName = 'Öğretmen Pro';
    const fromName = (config.smtp_from_name || appName).trim();
    const preheader = `${params.schoolName} kaydı: e-posta doğrulaması; ardından platform onay süreci.`;
    const rendered = await this.renderMailTemplate('school_join_verify', {
      app_name: appName,
      from_name: escapeMailText(fromName),
      preheader: escapeMailText(preheader),
      recipient_name: escapeMailText(params.recipientName),
      school_name: escapeMailText(params.schoolName),
      verify_url: params.verifyUrl,
      bar_gradient: '#1e40af',
      badge_bg: '#eff6ff',
      badge_border: '#bfdbfe',
      badge_color: '#1d4ed8',
      badge_label: 'Adres doğrulama',
    });
    return this.sendMailWithConfig(config, toEmail.trim(), rendered.subject, rendered.html, rendered.text);
  }

  /**
   * Şifre sıfırlama bağlantısı. Önce süperadmin SMTP (mail_enabled + alanlar);
   * yoksa backend `.env` SMTP_* (ör. Gmail uygulama şifresi) yedek.
   */
  async sendPasswordResetEmail(toEmail: string, resetUrl: string): Promise<boolean> {
    const config = await this.resolveSmtpConfigForPasswordReset();
    if (!config) {
      this.logger.warn(`Şifre sıfırlama SMTP yok; bağlantı (yalnız log): ${resetUrl}`);
      return false;
    }
    const appName = 'Öğretmen Pro';
    const fromName = (config.smtp_from_name || appName).trim();
    const rendered = await this.renderMailTemplate('password_reset', {
      app_name: appName,
      from_name: escapeMailText(fromName),
      preheader: 'Şifre sıfırlama bağlantısı',
      reset_url: resetUrl,
    });
    return this.sendMailWithConfig(config, toEmail.trim(), rendered.subject, rendered.html, rendered.text);
  }

  async sendVerificationCodeEmail(
    toEmail: string,
    params: { code: string; purposeLine: string; ttlMinutes: number },
  ): Promise<boolean> {
    const config = await this.resolveSmtpConfigForPasswordReset();
    if (!config) {
      this.logger.warn(`Doğrulama kodu SMTP yok; kod (log): ${params.code} → ${toEmail}`);
      return false;
    }
    const appName = 'Öğretmen Pro';
    const fromName = (config.smtp_from_name || appName).trim();
    const rendered = await this.renderMailTemplate('verification_code', {
      app_name: appName,
      from_name: escapeMailText(fromName),
      preheader: escapeMailText(`Doğrulama kodu: ${params.code}`),
      purpose_line: escapeMailText(params.purposeLine),
      code: escapeMailText(params.code),
      ttl_minutes: String(params.ttlMinutes),
    });
    return this.sendMailWithConfig(config, toEmail.trim(), rendered.subject, rendered.html, rendered.text);
  }

  private async renderMailTemplate(
    id: MailTemplateId,
    vars: Record<string, string>,
  ): Promise<{ subject: string; html: string; text: string }> {
    const merged = await this.appConfig.getMailTemplatesMerged();
    const t = merged[id];
    if (!t) {
      throw new Error(`mail template missing: ${id}`);
    }
    return {
      subject: interpolateMailTemplate(t.subject, vars),
      html: interpolateMailTemplate(t.html, vars),
      text: interpolateMailTemplate(t.text, vars),
    };
  }

  /** Web ve e-posta linkleri için kök URL (panel ayarı veya FRONTEND_URL). */
  async resolveAppBaseUrl(): Promise<string> {
    const c = await this.appConfig.getMailConfigForSending();
    return (c.mail_app_base_url || env.frontendUrl).replace(/\/$/, '');
  }

  private isMailReady(config: MailConfigForSending): boolean {
    return !!(config.mail_enabled && config.smtp_host && config.smtp_user && config.smtp_pass);
  }

  /** Süperadmin SMTP veya .env SMTP_* (Gmail: 587, güvenli bağlantı kapalı). */
  private async resolveSmtpConfigForPasswordReset(): Promise<MailConfigForSending | null> {
    const c = await this.appConfig.getMailConfigForSending();
    if (this.isMailReady(c)) return c;
    const host = env.smtp.host?.trim();
    const user = env.smtp.user?.trim();
    const pass = env.smtp.pass?.trim();
    if (!host || !user || !pass) return null;
    const port = env.smtp.port;
    return {
      mail_enabled: true,
      smtp_host: host,
      smtp_port: port,
      smtp_user: user,
      smtp_pass: pass,
      smtp_from: (env.smtp.from || user).trim(),
      smtp_from_name: 'Öğretmen Pro',
      smtp_secure: port === 465,
      mail_app_base_url: null,
    };
  }

  /** İletişim formu: uzaeduapp@gmail.com adresine iletir. */
  async sendContactEmail(params: {
    name: string;
    email: string;
    subject: string;
    message: string;
  }): Promise<boolean> {
    const config = await this.appConfig.getMailConfigForSending();
    const to = 'uzaeduapp@gmail.com';
    const subject = `[İletişim] ${params.subject}`;
    const esc = (s: string) => escapeHtml(s);
    const html = `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>İletişim Formu</title></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f3f4f6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;">
    <tr><td style="padding:28px 16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
        style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.06);">
        <tr><td style="height:3px;background:#007bff;line-height:3px;font-size:0;">&#160;</td></tr>
        <tr><td style="padding:26px 32px;">
          <div style="font-size:18px;font-weight:700;color:#111827;">Öğretmen Pro</div>
          <div style="font-size:11px;color:#6b7280;font-weight:500;letter-spacing:0.06em;text-transform:uppercase;margin-top:2px;">İletişim Formu</div>
          <table style="margin-top:20px;width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px 0;font-size:12px;color:#6b7280;font-weight:600;width:90px;">Ad Soyad</td>
                <td style="padding:8px 0;font-size:14px;color:#111827;">${esc(params.name)}</td></tr>
            <tr style="background:#f9fafb;">
                <td style="padding:8px 0;font-size:12px;color:#6b7280;font-weight:600;width:90px;">E-posta</td>
                <td style="padding:8px 0;font-size:14px;color:#111827;">${esc(params.email)}</td></tr>
            <tr><td style="padding:8px 0;font-size:12px;color:#6b7280;font-weight:600;width:90px;">Konu</td>
                <td style="padding:8px 0;font-size:14px;color:#111827;">${esc(params.subject)}</td></tr>
          </table>
          <div style="margin-top:16px;padding:16px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
            <div style="font-size:12px;color:#6b7280;font-weight:600;margin-bottom:8px;">Mesaj</div>
            <div style="font-size:14px;color:#374151;line-height:1.7;white-space:pre-wrap;">${esc(params.message)}</div>
          </div>
          <div style="margin-top:16px;">
            <a href="mailto:${esc(params.email)}" style="display:inline-block;padding:10px 20px;background:#007bff;color:#fff;font-size:13px;font-weight:600;text-decoration:none;border-radius:8px;">
              Yanıtla: ${esc(params.email)}
            </a>
          </div>
        </td></tr>
        <tr><td style="padding:14px 32px 18px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;">
          Öğretmen Pro · İletişim Formu · ogretmenpro.com
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
    const text = `İletişim Formu\n\nAd Soyad: ${params.name}\nE-posta: ${params.email}\nKonu: ${params.subject}\n\nMesaj:\n${params.message}`;

    if (config.mail_enabled && config.smtp_host && config.smtp_user && config.smtp_pass) {
      return this.sendMailWithConfig(config, to, subject, html, text);
    }
    // SMTP kapalıysa env üzerinden dene
    const envConfig = this._envMailConfig();
    if (envConfig) return this.sendMailWithConfig(envConfig, to, subject, html, text);
    this.logger.warn('Contact form submitted but SMTP not configured');
    return false;
  }

  private _envMailConfig(): MailConfigForSending | null {
    const { host, port, user, pass } = env.smtp ?? {};
    if (!host || !user || !pass) return null;
    return {
      mail_enabled: true,
      smtp_host: host,
      smtp_port: typeof port === 'number' ? port : parseInt(String(port ?? '587'), 10),
      smtp_user: user,
      smtp_pass: pass,
      smtp_from: user,
      smtp_from_name: 'Öğretmen Pro',
      smtp_secure: (typeof port === 'number' ? port : parseInt(String(port ?? '587'), 10)) === 465,
      mail_app_base_url: null,
    };
  }

  private async sendMailWithConfig(
    config: MailConfigForSending,
    to: string,
    subject: string,
    html: string,
    text: string,
  ): Promise<boolean> {
    try {
      const transporter = createNodemailerTransporter({
        host: config.smtp_host,
        port: config.smtp_port,
        secure: config.smtp_secure,
        auth: { user: config.smtp_user, pass: config.smtp_pass },
      });
      await transporter.sendMail({
        from: config.smtp_from_name ? `"${config.smtp_from_name}" <${config.smtp_from}>` : config.smtp_from,
        to,
        subject,
        html,
        text,
      });
      return true;
    } catch {
      return false;
    }
  }
}

function buildNotificationHtml(params: {
  title: string;
  body?: string | null;
  actionUrl?: string | null;
  fromName: string;
}): string {
  const { title, body, actionUrl, fromName } = params;
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f3f4f6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;">
    <tr>
      <td style="padding:28px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.06);">
          <tr><td style="height:3px;background:#1e40af;line-height:3px;font-size:0;">&#160;</td></tr>
          <tr>
            <td style="padding:26px 32px;">
              <div style="font-size:18px;font-weight:600;color:#111827;margin-bottom:4px;">${escapeHtml(fromName)}</div>
              <div style="font-size:11px;color:#6b7280;font-weight:500;letter-spacing:0.06em;text-transform:uppercase;">Bildirim</div>
              <h1 style="margin:18px 0 0;font-size:17px;font-weight:600;color:#111827;line-height:1.45;">${escapeHtml(title)}</h1>
              ${body?.trim() ? `<p style="margin:12px 0 0;font-size:15px;color:#4b5563;line-height:1.6;">${escapeHtml(body)}</p>` : ''}
              ${actionUrl ? `
              <a href="${escapeHtml(actionUrl)}" style="display:inline-block;margin-top:18px;padding:11px 20px;background:#1d4ed8;border:1px solid #1d4ed8;color:#fff!important;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">Görüntüle</a>
              ` : ''}
            </td>
          </tr>
          <tr>
            <td style="padding:14px 32px 18px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;line-height:1.5;">
              ${escapeHtml(fromName)} · Otomatik bildirim
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
