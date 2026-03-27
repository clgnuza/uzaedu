import { Injectable } from '@nestjs/common';
import { AppConfigService, MailConfigForSending } from '../app-config/app-config.service';
import { env } from '../config/env';

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
    const subject = 'Öğretmen Pro – Okul başvurunuz alındı';
    const { schoolName, recipientName } = params;
    const preheader = `${schoolName}: başvurunuz alındı. Onay sonrası bu adrese haber vereceğiz.`;
    const html = buildSchoolMembershipHtml({
      fromName: config.smtp_from_name,
      variant: 'pending',
      preheader,
      recipientName,
      schoolName,
      primaryUrl: loginUrl,
      primaryLabel: 'Giriş yap',
      secondaryUrl: registerUrl,
      secondaryLabel: 'Kayıt bilgileri',
    });
    const text = [
      `Merhaba ${recipientName},`,
      '',
      `${schoolName} için başvurunuz kaydedildi.`,
      'Okul yöneticisi inceleyip onayladığında bu adrese bilgilendirme e-postası gönderilir.',
      '',
      `Giriş: ${loginUrl}`,
      `Kayıt: ${registerUrl}`,
    ].join('\n');
    return this.sendMailWithConfig(config, toEmail.trim(), subject, html, text);
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
    const subject = 'Öğretmen Pro – Okul üyeliğiniz onaylandı';
    const { schoolName, recipientName } = params;
    const preheader = `${schoolName} üyeliğiniz onaylandı. Panele giriş yapabilirsiniz.`;
    const html = buildSchoolMembershipHtml({
      fromName: config.smtp_from_name,
      variant: 'approved',
      preheader,
      recipientName,
      schoolName,
      primaryUrl: dashboardUrl,
      primaryLabel: 'Panele git',
      secondaryUrl: loginUrl,
      secondaryLabel: 'Giriş sayfası',
    });
    const text = [
      `Merhaba ${recipientName},`,
      '',
      `${schoolName} okuluna yönelik üyeliğiniz onaylandı.`,
      'Artık panele giriş yaparak okul özelliklerini kullanabilirsiniz.',
      '',
      `Panel: ${dashboardUrl}`,
      `Giriş: ${loginUrl}`,
    ].join('\n');
    return this.sendMailWithConfig(config, toEmail.trim(), subject, html, text);
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
    const subject = 'Öğretmen Pro – Okul başvurusu hakkında';
    const { schoolName, recipientName } = params;
    const preheader = `${schoolName} başvurunuz sonuçlandı. Detaylar için e-postayı açın.`;
    const html = buildSchoolMembershipHtml({
      fromName: config.smtp_from_name,
      variant: 'rejected',
      preheader,
      recipientName,
      schoolName,
      primaryUrl: registerUrl,
      primaryLabel: 'Yeniden kayıt ol',
      secondaryUrl: loginUrl,
      secondaryLabel: 'Giriş yap',
    });
    const text = [
      `Merhaba ${recipientName},`,
      '',
      `${schoolName} okuluna yönelik başvurunuz okul yöneticisi tarafından kabul edilmedi.`,
      'Hesabınız açık kalmaya devam eder; isterseniz kurumsal e-postanızla başka okul seçerek yeniden başvurabilirsiniz.',
      '',
      `Kayıt: ${registerUrl}`,
      `Giriş: ${loginUrl}`,
    ].join('\n');
    return this.sendMailWithConfig(config, toEmail.trim(), subject, html, text);
  }

  /** Kurumsal e-posta sahipliğini doğrulama bağlantısı (okul kaydı). */
  async sendSchoolJoinVerifyEmail(
    toEmail: string,
    params: { schoolName: string; recipientName: string; verifyUrl: string },
  ): Promise<boolean> {
    const config = await this.appConfig.getMailConfigForSending();
    if (!this.isMailReady(config)) return false;
    const subject = 'Öğretmen Pro – Kurumsal e-postanızı doğrulayın';
    const preheader = `${params.schoolName} kaydı için e-postanızı onaylayın; ardından süper admin incelemesine düşer.`;
    const html = buildVerifySchoolEmailHtml({
      fromName: config.smtp_from_name,
      preheader,
      recipientName: params.recipientName,
      schoolName: params.schoolName,
      verifyUrl: params.verifyUrl,
    });
    const text = [
      `Merhaba ${params.recipientName},`,
      '',
      `${params.schoolName} okuluna kayıt için kurumsal e-postanızı doğrulamanız gerekiyor.`,
      'Aşağıdaki bağlantıya tıklayın (48 saat geçerli):',
      '',
      params.verifyUrl,
      '',
      'Doğrulamadan sonra başvurunuz süper yönetici onayına iletilir.',
    ].join('\n');
    return this.sendMailWithConfig(config, toEmail.trim(), subject, html, text);
  }

  /** Web ve e-posta linkleri için kök URL (panel ayarı veya FRONTEND_URL). */
  async resolveAppBaseUrl(): Promise<string> {
    const c = await this.appConfig.getMailConfigForSending();
    return (c.mail_app_base_url || env.frontendUrl).replace(/\/$/, '');
  }

  private isMailReady(config: MailConfigForSending): boolean {
    return !!(config.mail_enabled && config.smtp_host && config.smtp_user && config.smtp_pass);
  }

  private async sendMailWithConfig(
    config: MailConfigForSending,
    to: string,
    subject: string,
    html: string,
    text: string,
  ): Promise<boolean> {
    try {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.default.createTransport({
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

function buildVerifySchoolEmailHtml(params: {
  fromName: string;
  preheader: string;
  recipientName: string;
  schoolName: string;
  verifyUrl: string;
}): string {
  const { fromName, preheader, recipientName, schoolName, verifyUrl } = params;
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>E-postanızı doğrulayın</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',system-ui,sans-serif;background:#f1f5f9;">
  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#f1f5f9;opacity:0;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;">
    <tr><td style="padding:28px 16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(15,23,42,0.08);">
        <tr><td style="height:4px;background:linear-gradient(90deg,#6366f1,#8b5cf6);"></td></tr>
        <tr><td style="padding:28px 32px;">
          <div style="font-size:18px;font-weight:700;color:#0f172a;">${escapeHtml(fromName)}</div>
          <div style="margin-top:12px;display:inline-block;padding:6px 12px;border-radius:999px;background:#eef2ff;border:1px solid #c7d2fe;font-size:11px;font-weight:600;color:#4338ca;text-transform:uppercase;">E-posta doğrulama</div>
          <h1 style="margin:18px 0 0;font-size:22px;font-weight:700;color:#0f172a;line-height:1.25;">Kurumsal adresinizi onaylayın</h1>
          <p style="margin:14px 0 0;font-size:15px;color:#475569;line-height:1.65;">Merhaba <strong style="color:#0f172a;">${escapeHtml(recipientName)}</strong>,</p>
          <p style="margin:12px 0 0;font-size:15px;color:#475569;line-height:1.65;">
            <strong style="color:#0f172a;">${escapeHtml(schoolName)}</strong> için kaydınızı tamamlamak üzere bu adresin size ait olduğunu doğrulamanız gerekiyor.
          </p>
          <div style="margin:24px 0 0;">
            <a href="${escapeHtml(verifyUrl)}" style="display:inline-block;padding:14px 28px;background:linear-gradient(90deg,#4f46e5,#6366f1);color:#fff!important;font-size:15px;font-weight:600;text-decoration:none;border-radius:12px;box-shadow:0 4px 14px rgba(79,70,229,0.35);">E-postamı doğrula</a>
          </div>
          <p style="margin:18px 0 0;font-size:12px;color:#94a3b8;line-height:1.5;word-break:break-all;">Bağlantı 48 saat geçerlidir.<br/><span style="color:#64748b;">${escapeHtml(verifyUrl)}</span></p>
        </td></tr>
        <tr><td style="padding:18px 32px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;">
          Doğrulamadan sonra başvurunuz süper yönetici onayına düşer. Bu e-postayı siz talep etmediyseniz yok sayın.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildSchoolMembershipHtml(params: {
  fromName: string;
  variant: 'pending' | 'approved' | 'rejected';
  preheader: string;
  recipientName: string;
  schoolName: string;
  primaryUrl: string;
  primaryLabel: string;
  secondaryUrl?: string;
  secondaryLabel?: string;
}): string {
  const {
    fromName,
    variant,
    preheader,
    recipientName,
    schoolName,
    primaryUrl,
    primaryLabel,
    secondaryUrl,
    secondaryLabel,
  } = params;

  const theme =
    variant === 'pending'
      ? {
          badgeBg: '#fffbeb',
          badgeBorder: '#fcd34d',
          badgeText: '#b45309',
          badgeLabel: 'Onay bekleniyor',
          barGradient: 'linear-gradient(90deg,#f59e0b,#fbbf24)',
        }
      : variant === 'approved'
        ? {
            badgeBg: '#ecfdf5',
            badgeBorder: '#6ee7b7',
            badgeText: '#047857',
            badgeLabel: 'Onaylandı',
            barGradient: 'linear-gradient(90deg,#10b981,#34d399)',
          }
        : {
            badgeBg: '#fff1f2',
            badgeBorder: '#fecdd3',
            badgeText: '#be123c',
            badgeLabel: 'Başvuru reddedildi',
            barGradient: 'linear-gradient(90deg,#f43f5e,#fb7185)',
          };

  const headline =
    variant === 'pending'
      ? 'Başvurunuz alındı'
      : variant === 'approved'
        ? 'Okul üyeliğiniz aktif'
        : 'Başvurunuz sonuçlandı';

  const lead =
    variant === 'pending'
      ? `<strong style="color:#111827;">${escapeHtml(schoolName)}</strong> için kurumsal e-postanızla yaptığınız başvuru kaydedildi. Okul yöneticisi inceledikten sonra sonucu yine bu adrese bildiririz.`
      : variant === 'approved'
        ? `<strong style="color:#111827;">${escapeHtml(schoolName)}</strong> okuluna yönelik üyeliğiniz onaylandı. Aşağıdaki bağlantıdan panele giriş yaparak okul özelliklerini kullanmaya başlayabilirsiniz.`
        : `<strong style="color:#111827;">${escapeHtml(schoolName)}</strong> okuluna yönelik başvurunuz okul yöneticisi tarafından kabul edilmedi. Hesabınız açık kalır; kurumsal e-postanızla başka bir okul seçerek yeniden başvurabilirsiniz.`;

  const steps =
    variant === 'pending'
      ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0;border-collapse:separate;border-spacing:0 10px;">
        <tr><td style="font-size:13px;color:#6b7280;line-height:1.55;">
          <span style="display:inline-block;width:22px;height:22px;margin-right:8px;border-radius:999px;background:#fef3c7;color:#b45309;font-weight:700;text-align:center;line-height:22px;font-size:12px;vertical-align:middle;">1</span>
          Okul yöneticisi başvurunuzu inceler
        </td></tr>
        <tr><td style="font-size:13px;color:#6b7280;line-height:1.55;">
          <span style="display:inline-block;width:22px;height:22px;margin-right:8px;border-radius:999px;background:#fef3c7;color:#b45309;font-weight:700;text-align:center;line-height:22px;font-size:12px;vertical-align:middle;">2</span>
          Sonuç bu e-posta adresinize iletilir
        </td></tr>
      </table>`
      : '';

  const secondaryBlock =
    secondaryUrl && secondaryLabel
      ? `
              <div style="margin-top:12px;">
                <a href="${escapeHtml(secondaryUrl)}" style="display:inline-block;padding:12px 24px;background:#ffffff;color:#334155!important;font-size:14px;font-weight:600;text-decoration:none;border-radius:12px;border:1px solid #e2e8f0;box-shadow:0 1px 2px rgba(15,23,42,0.06);">${escapeHtml(secondaryLabel)}</a>
              </div>`
      : '';

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(headline)}</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;background-color:#f1f5f9;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#f1f5f9;opacity:0;">
    ${escapeHtml(preheader)}
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f1f5f9;">
    <tr>
      <td style="padding:28px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(15,23,42,0.08);">
          <tr>
            <td style="height:4px;background:${theme.barGradient};"></td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px;">
              <div style="font-size:18px;font-weight:700;color:#0f172a;letter-spacing:-0.02em;">${escapeHtml(fromName)}</div>
              <div style="margin-top:14px;display:inline-block;padding:6px 12px;border-radius:999px;background:${theme.badgeBg};border:1px solid ${theme.badgeBorder};font-size:11px;font-weight:600;color:${theme.badgeText};text-transform:uppercase;letter-spacing:0.04em;">${theme.badgeLabel}</div>
              <h1 style="margin:18px 0 0;font-size:22px;font-weight:700;color:#0f172a;line-height:1.25;letter-spacing:-0.02em;">${escapeHtml(headline)}</h1>
              <p style="margin:14px 0 0;font-size:15px;color:#475569;line-height:1.65;">Merhaba <strong style="color:#0f172a;">${escapeHtml(recipientName)}</strong>,</p>
              <p style="margin:12px 0 0;font-size:15px;color:#475569;line-height:1.65;">${lead}</p>
              ${steps}
              <div style="margin:24px 0 0;">
                <a href="${escapeHtml(primaryUrl)}" style="display:inline-block;padding:14px 28px;background:linear-gradient(90deg,#2563eb,#3b82f6);color:#ffffff!important;font-size:15px;font-weight:600;text-decoration:none;border-radius:12px;box-shadow:0 4px 14px rgba(37,99,235,0.35);">${escapeHtml(primaryLabel)}</a>
              </div>
              ${secondaryBlock}
              <p style="margin:18px 0 0;font-size:12px;color:#94a3b8;line-height:1.5;word-break:break-all;">Bağlantı çalışmıyorsa adresi tarayıcıya yapıştırın:<br/><span style="color:#64748b;">${escapeHtml(primaryUrl)}</span>${secondaryUrl ? `<br/><span style="color:#64748b;">${escapeHtml(secondaryUrl)}</span>` : ''}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;line-height:1.5;">
              Bu e-posta ${escapeHtml(fromName)} tarafından otomatik gönderilmiştir. Yanıtlamanız gerekmez.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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
