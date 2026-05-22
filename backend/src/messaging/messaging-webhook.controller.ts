import { Body, Controller, Get, Headers, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { MessagingWebhookService } from './messaging-webhook.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessagingSettings } from './entities/messaging-settings.entity';

/** JWT yok — Meta/Twilio dış callback */
@Controller('messaging/webhooks')
export class MessagingWebhookController {
  constructor(
    private readonly webhooks: MessagingWebhookService,
    @InjectRepository(MessagingSettings)
    private readonly settingsRepo: Repository<MessagingSettings>,
  ) {}

  /** Meta webhook doğrulama */
  @Get('meta')
  metaVerify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const expected = process.env.META_WHATSAPP_VERIFY_TOKEN ?? 'uzaedu_meta_verify';
    if (mode === 'subscribe' && token === expected) {
      res.status(200).send(challenge);
      return;
    }
    res.status(403).send('Forbidden');
  }

  @Post('meta')
  async metaInbound(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(body));
    const secret = process.env.META_WHATSAPP_APP_SECRET ?? '';
    if (secret && !this.webhooks.verifyMetaSignature(raw, signature, secret)) {
      return { ok: false };
    }
    await this.webhooks.handleMetaWebhook(body);
    return { ok: true };
  }

  @Post('twilio')
  async twilioStatus(@Body() body: Record<string, string>) {
    const accountSid = body.AccountSid ?? '';
    const schoolId = accountSid ? await this.webhooks.resolveSchoolByTwilioAccountSid(accountSid) : null;
    if (!schoolId) return { ok: false };
    await this.webhooks.handleTwilioStatus(schoolId, body);
    return { ok: true };
  }
}
