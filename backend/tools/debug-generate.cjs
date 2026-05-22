require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { DersDagitService } = require('../dist/ders-dagit/ders-dagit.service');

const STUDIO = '1d812fc1-6a57-47b5-bf72-f22edafeeb2a';
const SCHOOL = '71b0646e-7f6a-469a-9039-b831f109c2b3';
const USER = '0c6cf4d6-72e8-4d1c-8a9a-5694b7ce88db';

(async () => {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const svc = app.get(DersDagitService);
  try {
    const r = await svc.generatePrograms(STUDIO, SCHOOL, USER, {
      duration_sec: 120,
      versions: 1,
      use_csp: false,
    });
    console.log('OK', { score: r.score, placed: r.placed, failed: r.failed });
  } catch (e) {
    console.error('FAIL', e?.message ?? e);
    if (e?.response) console.error(JSON.stringify(e.response, null, 2));
    console.error(e?.stack);
  }
  await app.close();
})();
