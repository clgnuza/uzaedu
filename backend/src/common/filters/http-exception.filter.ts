import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { env } from '../../config/env';

/** ERROR_CODES.md ile uyumlu: code, message (Türkçe), details */
const CODE_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: 'Oturum açmanız gerekiyor.',
  FORBIDDEN: 'Bu işlem için yetkiniz yok.',
  SCOPE_VIOLATION: 'Bu veriye erişim yetkiniz yok.',
  NOT_FOUND: 'İstediğiniz kayıt bulunamadı.',
  VALIDATION_ERROR: 'Lütfen girdiğiniz bilgileri kontrol edin.',
  CONFLICT: 'Bu işlem mevcut veri ile çakışıyor.',
  RATE_LIMIT: 'Çok fazla istek gönderdiniz. Biraz bekleyin.',
  ENTITLEMENT_REQUIRED: 'Bu özelliği kullanmak için yeterli hakkınız yok.',
  INSUFFICIENT_MARKET_CREDIT: 'Jeton veya ek ders bakiyeniz bu işlem için yetersiz.',
  SCHOOL_INACTIVE: 'Okulunuz şu an aktif değil.',
  USER_INACTIVE: 'Hesabınız aktif değil.',
  EXTERNAL_SERVICE_ERROR: 'Dış servis geçici olarak yanıt vermiyor.',
  INTERNAL_ERROR: 'Bir hata oluştu. Lütfen daha sonra tekrar deneyin.',
  INVALID_INPUT: 'Geçersiz token veya şifre.',
  INVALID_OR_EXPIRED_TOKEN: 'Şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş. Lütfen tekrar talep edin.',
  GPT_NOT_CONFIGURED: 'OpenAI API anahtarı tanımlı değil. backend/.env dosyasına OPENAI_API_KEY ekleyip backend\'i yeniden başlatın.',
  CALENDAR_EMPTY: 'Seçilen öğretim yılı için çalışma takvimi bulunamadı. Önce Çalışma Takvimi sekmesinden haftaları ekleyin.',
  DUTY_TEACHER_NOT_IN_SCHOOL: 'Bazı öğretmenler okulunuzda kayıtlı değil veya nöbetçi olarak atanamaz.',
};

export interface ErrorResponseBody {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = CODE_MESSAGES.INTERNAL_ERROR;
    let details: Record<string, unknown> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'object' && body !== null && 'code' in body) {
        code = (body as { code?: string }).code || code;
        message = CODE_MESSAGES[code] || (body as { message?: string }).message || message;
        details = (body as { details?: Record<string, unknown> }).details;
      } else if (typeof body === 'object' && body !== null && 'message' in body) {
        const msg = (body as { message?: string | string[] }).message;
        message = Array.isArray(msg) ? msg[0] : msg || message;
        if (status === HttpStatus.BAD_REQUEST) code = 'VALIDATION_ERROR';
      }
    }

    const responseBody: ErrorResponseBody = { code, message };
    if (details) responseBody.details = details;

    if (status >= 500) this.logger.error(`${req.method} ${req.url} ${status}`, exception);

    res.status(status).json(responseBody);
  }
}
