import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../app-config/app-config.service';

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
    try {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.default.createTransport({
        host: config.smtp_host,
        port: config.smtp_port,
        secure: config.smtp_secure,
        auth: { user: config.smtp_user, pass: config.smtp_pass },
      });
      const actionUrl = this.buildActionUrl(config.mail_app_base_url, params.targetScreen, params.entityId);
      const html = buildNotificationHtml({
        ...params,
        actionUrl,
        fromName: config.smtp_from_name,
      });
      await transporter.sendMail({
        from: config.smtp_from_name ? `"${config.smtp_from_name}" <${config.smtp_from}>` : config.smtp_from,
        to: toEmail.trim(),
        subject: params.title,
        html,
        text: `${params.title}\n\n${params.body || ''}\n${actionUrl ? `\nGörüntüle: ${actionUrl}` : ''}`,
      });
      return true;
    } catch {
      return false;
    }
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
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f4f6f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f6f9;">
    <tr>
      <td style="padding:24px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.06);">
          <tr>
            <td style="padding:28px 32px;">
              <div style="font-size:20px;font-weight:600;color:#1a1d23;margin-bottom:8px;">${escapeHtml(fromName)}</div>
              <div style="height:3px;width:48px;background:linear-gradient(90deg,#3b82f6,#60a5fa);border-radius:2px;margin-bottom:20px;"></div>
              <h1 style="margin:0 0 16px;font-size:18px;font-weight:600;color:#1a1d23;line-height:1.4;">${escapeHtml(title)}</h1>
              ${body?.trim() ? `<p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.6;">${escapeHtml(body)}</p>` : ''}
              ${actionUrl ? `
              <a href="${escapeHtml(actionUrl)}" style="display:inline-block;padding:12px 24px;background:#3b82f6;color:#fff!important;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;margin-top:8px;">Görüntüle</a>
              ` : ''}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;background:#f9fafb;border-radius:0 0 12px 12px;font-size:12px;color:#9ca3af;">
              Bu e-posta ${escapeHtml(fromName)} tarafından otomatik gönderilmiştir.
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
