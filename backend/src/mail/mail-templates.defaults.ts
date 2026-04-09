import type { MailTemplateBlock, MailTemplateId } from './mail-templates.types';

/** Kurumsal üst çizgi: düz #hex veya CSS gradient ifadesi ({{bar_gradient}}). */
const SHELL_START = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background:#f3f4f6;">
  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#f3f4f6;opacity:0;">{{preheader}}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;">
    <tr><td style="padding:32px 16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.06);">
        <tr><td style="height:3px;background:{{bar_gradient}};line-height:3px;font-size:0;mso-line-height-rule:exactly;">&#160;</td></tr>
        <tr><td style="padding:28px 32px 8px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td>
                <div style="font-size:19px;font-weight:600;color:#111827;letter-spacing:-0.02em;">{{app_name}}</div>
                <div style="margin-top:4px;font-size:11px;color:#6b7280;font-weight:500;letter-spacing:0.06em;text-transform:uppercase;">Kurumsal bildirim</div>
              </td>
            </tr>
          </table>
          <div style="margin-top:18px;display:inline-block;padding:5px 11px;border-radius:6px;background:{{badge_bg}};border:1px solid {{badge_border}};font-size:10px;font-weight:600;color:{{badge_color}};letter-spacing:0.05em;text-transform:uppercase;">{{badge_label}}</div>
`;

const SHELL_END = `
        </td></tr>
        <tr><td style="padding:16px 32px 22px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;line-height:1.55;">
          Bu ileti {{app_name}} tarafından otomatik gönderilmiştir. Güvenliğiniz için bağlantıları yalnızca güvendiğiniz kaynaklardan açın. Bu adrese yanıt vermeniz gerekmez.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

function blockPasswordReset(): MailTemplateBlock {
  const html = `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f3f4f6;">
  <div style="display:none;max-height:0;overflow:hidden;">{{preheader}}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr><td style="padding:32px 16px;">
      <table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.06);">
        <tr><td style="height:3px;background:#1e40af;line-height:3px;font-size:0;">&#160;</td></tr>
        <tr><td style="padding:28px 32px 26px;">
          <div style="font-size:18px;font-weight:600;color:#111827;letter-spacing:-0.02em;">{{app_name}}</div>
          <div style="margin-top:4px;font-size:11px;color:#6b7280;font-weight:500;letter-spacing:0.06em;text-transform:uppercase;">Hesap güvenliği</div>
          <h1 style="margin:22px 0 0;font-size:21px;font-weight:600;color:#111827;line-height:1.3;letter-spacing:-0.02em;">Şifre sıfırlama</h1>
          <p style="margin:14px 0 0;font-size:15px;color:#4b5563;line-height:1.65;">Merhaba,</p>
          <p style="margin:12px 0 0;font-size:15px;color:#4b5563;line-height:1.65;">Hesabınız için güvenli şifre sıfırlama talebi alınmıştır. Aşağıdaki düğmeyi kullanarak yeni şifrenizi belirleyebilirsiniz. Bağlantı <strong style="color:#111827;">1 saat</strong> süreyle geçerlidir.</p>
          <div style="margin:26px 0 0;">
            <a href="{{reset_url}}" style="display:inline-block;padding:12px 22px;background:#1d4ed8;color:#ffffff!important;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;border:1px solid #1d4ed8;">Şifreyi yenile</a>
          </div>
          <p style="margin:22px 0 0;font-size:12px;color:#9ca3af;line-height:1.55;word-break:break-all;">Bağlantı çalışmıyorsa adresi tarayıcıya yapıştırın:<br/><span style="color:#6b7280;">{{reset_url}}</span></p>
          <p style="margin:18px 0 0;padding-top:16px;border-top:1px solid #f3f4f6;font-size:13px;color:#9ca3af;line-height:1.5;">Bu isteği siz oluşturmadıysanız bu e-postayı yok sayabilirsiniz; hesabınız değişmez.</p>
        </td></tr>
        <tr><td style="padding:14px 32px 18px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;line-height:1.5;">
          {{from_name}} · Otomatik ileti · Yanıt gerekmez
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  const text = `{{app_name}} — Şifre sıfırlama

Hesabınız için şifre sıfırlama talebi alınmıştır. Bağlantı 1 saat geçerlidir:
{{reset_url}}

Bu isteği siz yapmadıysanız bu mesajı yok sayın.

— {{from_name}}`;
  const subject = '{{app_name}} – Şifre sıfırlama talebi';
  return { subject, html, text };
}

function blockSchoolVerify(): MailTemplateBlock {
  const shell = SHELL_START.replace('{{bar_gradient}}', '#1e40af')
    .replace('{{badge_bg}}', '#eff6ff')
    .replace('{{badge_border}}', '#bfdbfe')
    .replace('{{badge_color}}', '#1d4ed8')
    .replace('{{badge_label}}', 'Adres doğrulama');
  const html = `${shell}
          <h1 style="margin:6px 0 0;font-size:20px;font-weight:600;color:#111827;line-height:1.3;letter-spacing:-0.02em;">Kurumsal e-posta doğrulaması</h1>
          <p style="margin:14px 0 0;font-size:15px;color:#4b5563;line-height:1.65;">Sayın <strong style="color:#111827;">{{recipient_name}}</strong>,</p>
          <p style="margin:12px 0 0;font-size:15px;color:#4b5563;line-height:1.65;"><strong style="color:#111827;">{{school_name}}</strong> ile ilişkilendirilen kaydınızı tamamlamak için bu e-posta adresinin size ait olduğunu doğrulamanız gerekmektedir.</p>
          <div style="margin:24px 0 0;">
            <a href="{{verify_url}}" style="display:inline-block;padding:12px 22px;background:#1d4ed8;color:#ffffff!important;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;border:1px solid #1d4ed8;">E-postayı doğrula</a>
          </div>
          <p style="margin:18px 0 0;font-size:12px;color:#9ca3af;word-break:break-all;line-height:1.5;">Bağlantı 48 saat içinde kullanılmalıdır.<br/><span style="color:#6b7280;">{{verify_url}}</span></p>
          <p style="margin:14px 0 0;font-size:13px;color:#6b7280;line-height:1.55;">Doğrulama sonrası başvurunuz sıraya alınır ve platform onayı ile işleme alınır.</p>
${SHELL_END}`;
  const text = `{{app_name}} — Kurumsal e-posta doğrulaması

Sayın {{recipient_name}},

{{school_name}} kaydı için e-posta adresinizi 48 saat içinde doğrulayın:
{{verify_url}}

Doğrulama sonrası başvurunuz platform onayı için işleme alınır.

— {{app_name}}`;
  const subject = '{{app_name}} – E-posta adresinizi doğrulayın';
  return { subject, html, text };
}

function membershipInner(
  headline: string,
  lead: string,
  steps: string,
  bar: string,
  badgeBg: string,
  badgeBorder: string,
  badgeColor: string,
  badgeLabel: string,
): string {
  return `${SHELL_START.replace('{{bar_gradient}}', bar)
    .replace('{{badge_bg}}', badgeBg)
    .replace('{{badge_border}}', badgeBorder)
    .replace('{{badge_color}}', badgeColor)
    .replace('{{badge_label}}', badgeLabel)}
          <h1 style="margin:6px 0 0;font-size:20px;font-weight:600;color:#111827;line-height:1.3;letter-spacing:-0.02em;">${headline}</h1>
          <p style="margin:14px 0 0;font-size:15px;color:#4b5563;line-height:1.65;">Sayın <strong style="color:#111827;">{{recipient_name}}</strong>,</p>
          <p style="margin:12px 0 0;font-size:15px;color:#4b5563;line-height:1.65;">${lead}</p>
          ${steps}
          <div style="margin:24px 0 0;">
            <a href="{{primary_url}}" style="display:inline-block;padding:12px 22px;background:#1d4ed8;color:#ffffff!important;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;border:1px solid #1d4ed8;">{{primary_label}}</a>
          </div>
          <div style="margin-top:10px;">
            <a href="{{secondary_url}}" style="display:inline-block;padding:10px 20px;background:#ffffff;color:#374151!important;font-size:13px;font-weight:600;text-decoration:none;border-radius:8px;border:1px solid #d1d5db;">{{secondary_label}}</a>
          </div>
          <p style="margin:18px 0 0;font-size:11px;color:#9ca3af;word-break:break-all;line-height:1.5;">Bağlantılar: {{primary_url}} · {{secondary_url}}</p>
${SHELL_END}`;
}

function blockPending(): MailTemplateBlock {
  const steps = `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 0;border-collapse:collapse;">
        <tr><td style="padding:10px 0;font-size:13px;color:#4b5563;line-height:1.55;border-bottom:1px solid #f3f4f6;">
          <span style="display:inline-block;min-width:22px;font-weight:600;color:#111827;">1.</span> Okul yöneticisi başvurunuzu inceler.
        </td></tr>
        <tr><td style="padding:10px 0 0;font-size:13px;color:#4b5563;line-height:1.55;">
          <span style="display:inline-block;min-width:22px;font-weight:600;color:#111827;">2.</span> Sonuç bu e-posta adresinize iletilir.
        </td></tr>
      </table>`;
  const lead = `<strong style="color:#111827;">{{school_name}}</strong> için ilettiğiniz kurumsal başvuru kayda alınmıştır. İnceleme tamamlandığında sonuç aynı adrese bildirilecektir.`;
  const html = membershipInner(
    'Başvurunuz kayda alındı',
    lead,
    steps,
    '#c2410c',
    '#fff7ed',
    '#fed7aa',
    '#9a3412',
    'İncelemede',
  );
  const text = `{{app_name}} — Okul başvurusu

Sayın {{recipient_name}},

{{school_name}} için başvurunuz kayda alınmıştır. Okul yöneticisi inceledikten sonra sonuç bu adrese iletilecektir.

Giriş: {{primary_url}}
Kayıt bilgisi: {{secondary_url}}

— {{app_name}}`;
  const subject = '{{app_name}} – Okul başvurunuz alındı';
  return { subject, html, text };
}

function blockApproved(): MailTemplateBlock {
  const lead = `<strong style="color:#111827;">{{school_name}}</strong> ile ilişkili üyeliğiniz onaylanmıştır. Panele giriş yaparak okul kapsamındaki işlemlerinize devam edebilirsiniz.`;
  const html = membershipInner(
    'Üyelik onayı',
    lead,
    '',
    '#047857',
    '#ecfdf5',
    '#a7f3d0',
    '#065f46',
    'Onaylandı',
  );
  const text = `{{app_name}} — Üyelik onayı

Sayın {{recipient_name}},

{{school_name}} üyeliğiniz onaylanmıştır.

Panel: {{primary_url}}
Giriş: {{secondary_url}}

— {{app_name}}`;
  const subject = '{{app_name}} – Okul üyeliğiniz onaylandı';
  return { subject, html, text };
}

function blockRejected(): MailTemplateBlock {
  const lead = `<strong style="color:#111827;">{{school_name}}</strong> başvurunuz okul yöneticisi tarafından kabul edilmemiştir. Hesabınız açık kalmaya devam eder; kurumsal e-postanız ile uygun başka bir okul için yeniden başvurabilirsiniz.`;
  const html = membershipInner(
    'Başvuru sonucu',
    lead,
    '',
    '#9f1239',
    '#fef2f2',
    '#fecaca',
    '#991b1b',
    'Sonuçlandı',
  );
  const text = `{{app_name}} — Başvuru sonucu

Sayın {{recipient_name}},

{{school_name}} başvurunuz kabul edilmemiştir.

Kayıt: {{primary_url}}
Giriş: {{secondary_url}}

— {{app_name}}`;
  const subject = '{{app_name}} – Okul başvurusu hakkında';
  return { subject, html, text };
}

export const MAIL_TEMPLATE_IDS: MailTemplateId[] = [
  'password_reset',
  'school_join_verify',
  'teacher_school_pending',
  'teacher_school_approved',
  'teacher_school_rejected',
];

export const DEFAULT_MAIL_TEMPLATES: Record<MailTemplateId, MailTemplateBlock> = {
  password_reset: blockPasswordReset(),
  school_join_verify: blockSchoolVerify(),
  teacher_school_pending: blockPending(),
  teacher_school_approved: blockApproved(),
  teacher_school_rejected: blockRejected(),
};

export const MAIL_TEMPLATE_UI_META: {
  id: MailTemplateId;
  title: string;
  hint: string;
  placeholders: string[];
}[] = [
  {
    id: 'password_reset',
    title: 'Şifremi unuttum',
    hint: 'Şifre sıfırlama bağlantısı.',
    placeholders: ['app_name', 'from_name', 'preheader', 'reset_url'],
  },
  {
    id: 'school_join_verify',
    title: 'Kayıt — kurumsal e-posta doğrulama',
    hint: 'Okul seçerek kayıt; e-posta doğrulama.',
    placeholders: ['app_name', 'from_name', 'preheader', 'recipient_name', 'school_name', 'verify_url', 'bar_gradient', 'badge_bg', 'badge_border', 'badge_color', 'badge_label'],
  },
  {
    id: 'teacher_school_pending',
    title: 'Başvuru alındı',
    hint: 'Okul başvurusu kaydedildiğinde.',
    placeholders: [
      'app_name',
      'from_name',
      'preheader',
      'recipient_name',
      'school_name',
      'primary_url',
      'primary_label',
      'secondary_url',
      'secondary_label',
      'bar_gradient',
      'badge_bg',
      'badge_border',
      'badge_color',
      'badge_label',
    ],
  },
  {
    id: 'teacher_school_approved',
    title: 'Okul onayı',
    hint: 'Yönetici başvuruyu onayladığında.',
    placeholders: [
      'app_name',
      'from_name',
      'preheader',
      'recipient_name',
      'school_name',
      'primary_url',
      'primary_label',
      'secondary_url',
      'secondary_label',
      'bar_gradient',
      'badge_bg',
      'badge_border',
      'badge_color',
      'badge_label',
    ],
  },
  {
    id: 'teacher_school_rejected',
    title: 'Başvuru reddedildi',
    hint: 'Yönetici başvuruyu reddettiğinde.',
    placeholders: [
      'app_name',
      'from_name',
      'preheader',
      'recipient_name',
      'school_name',
      'primary_url',
      'primary_label',
      'secondary_url',
      'secondary_label',
      'bar_gradient',
      'badge_bg',
      'badge_border',
      'badge_color',
      'badge_label',
    ],
  },
];
