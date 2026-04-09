import type { Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

/**
 * Dinamik import ile `nodemailer.default` bazen undefined olur (Node/CJS-ESM, prod).
 * `require('nodemailer')` kök modülü doğrudan verir; createTransport her zaman erişilebilir.
 */
export function createNodemailerTransporter(options: SMTPTransport.Options): Transporter {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodemailer = require('nodemailer') as {
    createTransport: (opts: SMTPTransport.Options) => Transporter;
  };
  return nodemailer.createTransport(options);
}
