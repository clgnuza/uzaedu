import { Controller, Get } from '@nestjs/common';
import OpenAI from 'openai';
import { env } from '../config/env';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', service: 'ogretmenpro-backend' };
  }

  /** Uptime / bellek — dış izleme (Prometheus vb.) için hafif uç. */
  @Get('metrics')
  metrics() {
    const m = process.memoryUsage();
    return {
      status: 'ok',
      uptime_sec: Math.round(process.uptime()),
      rss_mb: Math.round(m.rss / 1048576),
      heap_used_mb: Math.round(m.heapUsed / 1048576),
      heap_total_mb: Math.round(m.heapTotal / 1048576),
    };
  }

  /** Canlı doğrulama: git kısa hash (DEPLOY_GIT_SHA), ortam, /me oturumsuz davranışı */
  @Get('deployment')
  deployment() {
    return {
      status: 'ok',
      git: process.env.DEPLOY_GIT_SHA?.trim() || null,
      appEnv: env.nodeEnv,
      trustProxy: env.trustProxy,
      sessionCookieDomain: env.sessionCookieDomain ?? null,
      meGetWithoutSession: '200-json-null',
    };
  }

  /** GPT taslak özelliği için API anahtarı yüklü mü? (anahtar değeri dönülmez) */
  @Get('gpt-status')
  gptStatus() {
    const configured = !!process.env.OPENAI_API_KEY?.trim();
    return {
      configured,
      hint: configured
        ? undefined
        : "backend/.env dosyasına OPENAI_API_KEY=sk-... ekleyip backend'i yeniden başlatın.",
    };
  }

  /** OpenAI API anahtarını gerçek bir çağrı ile test et */
  @Get('gpt-test')
  async gptTest() {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return {
        configured: false,
        tested: false,
        ok: false,
        message: 'OPENAI_API_KEY tanımlı değil.',
      };
    }

    try {
      const openai = new OpenAI({ apiKey });
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Say only: OK' }],
        max_tokens: 10,
      });
      const reply = completion.choices[0]?.message?.content?.trim() ?? '';
      const ok = reply.toUpperCase().includes('OK');
      return {
        configured: true,
        tested: true,
        ok,
        message: ok ? 'OpenAI API anahtarı geçerli.' : `Beklenmeyen yanıt: ${reply}`,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        configured: true,
        tested: true,
        ok: false,
        message: `OpenAI çağrısı başarısız: ${msg}`,
      };
    }
  }
}
