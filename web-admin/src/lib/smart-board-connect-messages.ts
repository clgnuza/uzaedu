/** Öğretmen tahta bağlantı — toast metinleri */

export function smartBoardConnectErrorMessage(err: { code?: string; message?: string } | unknown): string {
  const code = (err as { code?: string })?.code;
  const message = (err as { message?: string })?.message;
  switch (code) {
    case 'DEVICE_BUSY':
      return 'Bu tahta başka bir öğretmen tarafından kullanılıyor. Önce o öğretmenin oturumu kapanmalı (veya idare bağlantıyı kesmeli).';
    case 'TEACHER_ALREADY_CONNECTED':
      return 'Başka bir tahtaya bağlısınız. Önce «Bağlantıyı kes» ile mevcut oturumu kapatın.';
    case 'FORBIDDEN':
      return message ?? 'Bu tahtaya bağlanma yetkiniz yok.';
    case 'NOT_FOUND':
      return 'Tahta kaydı bulunamadı. Okul idaresine bildirin.';
    case 'QR_SESSION_INVALID':
      return 'QR süresi doldu. Tahtada «Öğretmen girişi» ile yeni QR oluşturun.';
    case 'QR_CODE_INVALID':
      return 'QR kodu geçersiz. Tahtadaki kodu yenileyip tekrar deneyin.';
    case 'SCOPE_VIOLATION':
      return 'Bu okul tahtası için işlem yetkiniz yok.';
    default:
      return message ?? (err instanceof Error ? err.message : 'Tahtaya bağlanılamadı.');
  }
}
