import { BadRequestException, Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { MailService } from './mail.service';

class ContactFormDto {
  @IsString() @MinLength(2) @MaxLength(100)
  name: string;

  @IsEmail()
  email: string;

  @IsString() @MinLength(2) @MaxLength(200)
  subject: string;

  @IsString() @MinLength(10) @MaxLength(2000)
  message: string;

  /** Honeypot — bot doldurursa engelle, insan boş bırakır */
  @IsOptional() @IsString() @MaxLength(0)
  website?: string;
}

@Controller('contact')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 3, ttl: 300_000 } }) // 5 dakikada maks 3
export class ContactController {
  constructor(private readonly mail: MailService) {}

  @Post()
  @HttpCode(200)
  async submit(@Body() dto: ContactFormDto) {
    if (dto.website) throw new BadRequestException('Spam tespit edildi');
    await this.mail.sendContactEmail({
      name:    dto.name.trim(),
      email:   dto.email.trim(),
      subject: dto.subject.trim(),
      message: dto.message.trim(),
    });
    return { ok: true };
  }
}
