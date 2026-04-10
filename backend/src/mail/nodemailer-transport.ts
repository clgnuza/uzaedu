import type { Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

/** Panel / env ile gelen ham SMTP alanları */
export type SmtpConnectionInput = {
  host: string;
  port: number;
  /** smtp_secure — 587 üzerinde true ise OpenSSL "wrong version number" üretir (STARTTLS gerekir) */
  secure: boolean;
  auth: { user: string; pass: string };
};

/**
 * 465 = doğrudan TLS; 587/2525 = düz bağlantı sonra STARTTLS (secure:false).
 * Aksi halde panelde "SSL" + 587 seçilince ssl3_get_record:wrong version number oluşur.
 */
export function smtpOptionsFromConfig(input: SmtpConnectionInput): SMTPTransport.Options {
  const host = input.host.trim();
  const port = input.port > 0 ? input.port : 587;

  let secure: boolean;
  if (port === 465) {
    secure = true;
  } else if (port === 587 || port === 2525 || port === 2587) {
    secure = false;
  } else if (port === 25) {
    secure = false;
  } else {
    secure = input.secure;
  }

  const opts: SMTPTransport.Options = {
    host,
    port,
    secure,
    auth: input.auth,
  };

  if (!secure && (port === 587 || port === 2525 || port === 2587)) {
    opts.requireTLS = true;
  }

  return opts;
}

/**
 * Dinamik import ile `nodemailer.default` bazen undefined olur (Node/CJS-ESM, prod).
 * `require('nodemailer')` kök modülü doğrudan verir; createTransport her zaman erişilebilir.
 */
export function createNodemailerTransporter(input: SmtpConnectionInput): Transporter {
  const options = smtpOptionsFromConfig(input);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodemailer = require('nodemailer') as {
    createTransport: (opts: SMTPTransport.Options) => Transporter;
  };
  return nodemailer.createTransport(options);
}
