import { loadedEnvPath } from './bootstrap-env';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import compression = require('compression');
import cookieParser = require('cookie-parser');
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { env } from './config/env';
import { corsOriginCallback } from './config/dev-cors';
import { initFirebase, isFirebaseAdminReady } from './config/firebase';

async function bootstrap() {
  initFirebase();
  if (isFirebaseAdminReady()) {
    console.log(`[Firebase] Admin hazır — proje: ${env.firebase.projectId} (web-admin .env.local NEXT_PUBLIC_FIREBASE_PROJECT_ID ile aynı olmalı)`);
  } else {
    console.warn(
      '[Firebase] Admin kapalı: backend/.env içinde FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY eksik veya anahtar hatalı.',
    );
  }
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  if (env.trustProxy) {
    app.set('trust proxy', 1);
  }
  /** gzip/deflate — JSON yanıtlarda bant genişliği */
  app.use(
    compression({
      threshold: 1024,
      filter: (req, res) => {
        if (req.headers['x-no-compression']) return false;
        return compression.filter(req, res);
      },
    }),
  );
  app.use(cookieParser());
  app.use(json({ limit: '20mb' }));
  app.use(urlencoded({ limit: '20mb', extended: true }));
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
  app.enableCors({ origin: corsOriginCallback, credentials: true });
  await app.listen(env.port, '0.0.0.0');
  console.log(`Backend çalışıyor: http://localhost:${env.port}/api (tüm arayüzler: 0.0.0.0:${env.port})`);
  if (loadedEnvPath) {
    console.log(`.env yüklendi: ${loadedEnvPath}`);
  } else {
    console.warn('UYARI: .env dosyası bulunamadı.');
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
