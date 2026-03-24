import { config } from 'dotenv';
import { resolve } from 'path';
// Backend root'taki .env (cwd veya dist/src'den bir üst)
const envPaths = [
  resolve(process.cwd(), '.env'),
  resolve(__dirname, '..', '.env'), // dist/main.js veya src/main.ts'den
];
let loadedFrom: string | null = null;
for (const p of envPaths) {
  const result = config({ path: p });
  if (!result.error) {
    loadedFrom = p;
    break;
  }
}

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import cookieParser = require('cookie-parser');
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { env } from './config/env';
import { initFirebase } from './config/firebase';

async function bootstrap() {
  initFirebase();
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.use(json({ limit: '2mb' }));
  app.use(urlencoded({ limit: '2mb', extended: true }));
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors({ origin: env.corsOrigins, credentials: true });
  await app.listen(env.port);
  console.log(`Backend çalışıyor: http://localhost:${env.port}/api`);
  if (loadedFrom) {
    console.log(`.env yüklendi: ${loadedFrom}`);
  } else {
    console.warn('UYARI: .env dosyası bulunamadı. Denenen yollar:', envPaths);
  }
  const hasOpenAiKey = !!process.env.OPENAI_API_KEY?.trim();
  if (!hasOpenAiKey) {
    console.warn('UYARI: OPENAI_API_KEY tanımlı değil. GPT taslak özelliği çalışmaz. backend/.env dosyasına ekleyip backend\'i yeniden başlatın.');
  } else {
    console.log('OPENAI_API_KEY: tanımlı (GPT taslak kullanılabilir)');
  }
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
