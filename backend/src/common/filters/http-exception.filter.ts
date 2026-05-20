import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

function stringifyHttpExceptionMessage(raw: unknown, depth = 0): string {
  if (depth > 4) return '';
  if (typeof raw === 'string') return raw.trim();
  if (Array.isArray(raw)) {
    return raw
      .map((x) => (typeof x === 'string' ? x.trim() : ''))
      .filter(Boolean)
      .join(' · ')
      .trim();
  }
  if (raw && typeof raw === 'object' && 'message' in (raw as Record<string, unknown>)) {
    const inner = (raw as Record<string, unknown>).message;
    const nested = stringifyHttpExceptionMessage(inner, depth + 1);
    if (nested) return nested;
  }
  return '';
}

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
  MODULE_ACTIVATION_REQUIRED:
    'Bu özelliği kullanmak için modülü Market sayfasından aylık veya yıllık tarifeye göre etkinleştirmeniz gerekir.',
  FILE_REQUIRED: 'Dosya yükleyin (.xlsx, .xls veya .pdf).',
  INVALID_FILE_TYPE: 'Desteklenmeyen dosya türü. .xlsx, .xls veya .pdf kullanın.',
  INVALID_SHEET: 'Excel’de "DersProgram" sayfası bulunamadı veya geçersiz. Örnek şablonu indirip doldurun.',
  INVALID_FILE: 'Yüklenen dosya okunamadı veya boş.',
  INVALID_FORMAT: 'Şablon başlığı geçersiz. Örnek Excel ile aynı sütun yapısını kullanın.',
  NO_VALID_ROWS: 'Geçerli ders satırı yok. Öğretmen adları sistemdeki kayıtlarla eşleşmeli.',
  PDF_GPT_DISABLED: 'PDF ile yükleme kapalı. Süperadmin ayarlarından açın veya Excel kullanın.',
  OPENAI_NOT_CONFIGURED: 'OpenAI API anahtarı yok. Optik ayarlarına anahtar ekleyin veya sunucuda OPENAI_API_KEY tanımlayın.',
  PDF_PARSE_FAILED: 'PDF okunamadı. Dosyayı yeniden indirin veya Excel ile deneyin.',
  PDF_TEXT_TOO_SHORT: 'PDF’te yeterli metin yok (taranmış PDF olabilir). Excel şablonu kullanın.',
  OPENAI_TIMETABLE_FAILED: 'OpenAI ders programı çıkarımı başarısız. Model veya kota ayarlarını kontrol edin.',
  GPT_TIMETABLE_PARSE_FAILED: 'PDF’ten tablo çıkarılamadı. Excel ile yüklemeyi deneyin.',
  PDF_LOW_CONFIDENCE: 'PDF güven skoru düşük; yanlış veri riski. Excel ile devam edin.',
  PDF_USE_GPT_MODE: 'PDF için aşağıdaki «e-Okul / GPT ile yükle» bölümünü kullanın.',
  GPT_TEXT_TOO_SHORT: 'Dosyada GPT için yeterli tablo metni yok. Taranmış PDF veya boş sayfa olabilir.',
  GPT_RECONCILE_FILES_REQUIRED: 'GPT uzlaştırma için e-Okul PDF (öğretmen) ve Excel (kurumsal program) birlikte gerekli.',
  GPT_RECONCILE_REQUIRES_PAIR: 'Tek PDF yerine PDF + Excel çiftini «e-Okul / GPT ile yükle» alanından gönderin.',
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
        const rawMsg = (body as { message?: unknown }).message;
        const explicit = stringifyHttpExceptionMessage(rawMsg);
        message = explicit !== '' ? explicit : CODE_MESSAGES[code] || message;
        details = (body as { details?: Record<string, unknown> }).details;
      } else if (typeof body === 'object' && body !== null && 'message' in body) {
        const msg = (body as { message?: unknown }).message;
        const explicit = stringifyHttpExceptionMessage(msg);
        message =
          explicit !== '' ? explicit : typeof msg === 'string' ? msg : typeof message === 'string' ? message : CODE_MESSAGES.INTERNAL_ERROR;
        if (status === HttpStatus.BAD_REQUEST) code = 'VALIDATION_ERROR';
      }
    }

    if (typeof message !== 'string') {
      message = CODE_MESSAGES[code] || CODE_MESSAGES.INTERNAL_ERROR;
    }
    const responseBody: ErrorResponseBody = { code, message };
    if (details) responseBody.details = details;

    if (status >= 500) this.logger.error(`${req.method} ${req.url} ${status}`, exception);

    res.status(status).json(responseBody);
  }
}
