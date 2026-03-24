import { BadRequestException, Injectable } from '@nestjs/common';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { AppConfigService } from '../app-config/app-config.service';

@Injectable()
export class UploadService {
  constructor(private readonly appConfig: AppConfigService) {}

  private getExtFromMime(mime: string, purpose?: string): string {
    const map: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'application/pdf': 'pdf',
    };
    return map[mime] ?? (purpose === 'document_template' ? 'bin' : 'bin');
  }

  private sanitizeFilename(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 64) || 'file';
  }

  /** Content-Disposition için güvenli dosya adı (Türkçe/Latin korunur) */
  private sanitizeDownloadFilename(name: string): string {
    return (
      String(name || 'evrak')
        .replace(/[^\w\u00C0-\u024F\s.-]/gi, '')
        .replace(/\s+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 128) || 'evrak'
    );
  }

  /** Evrak şablonları için izin verilen MIME türleri */
  private static DOCUMENT_TEMPLATE_TYPES = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/pdf',
  ] as const;

  async getPresignedUploadUrl(
    filename: string,
    contentType: string,
    purpose: string,
  ): Promise<{ uploadUrl: string; publicUrl: string; key: string }> {
    const limits = await this.appConfig.getUploadLimits();
    const isDocTemplate = purpose === 'document_template';
    const isTicketAttachment = purpose === 'ticket_attachment';
    const isAgendaNote = purpose === 'agenda_note';
    const allowDocTypes = isDocTemplate || isTicketAttachment || isAgendaNote;
    const allowed = isDocTemplate
      ? [...UploadService.DOCUMENT_TEMPLATE_TYPES, ...limits.allowedTypes]
      : allowDocTypes
        ? [...UploadService.DOCUMENT_TEMPLATE_TYPES, ...limits.allowedTypes]
        : limits.allowedTypes;
    if (!allowed.includes(contentType)) {
      throw new BadRequestException({
        code: 'INVALID_TYPE',
        message: isDocTemplate
          ? 'Desteklenmeyen format. Word (.docx), Excel (.xlsx) veya PDF yükleyin.'
          : allowDocTypes
            ? 'Desteklenmeyen format. Görsel, PDF, Word (.docx) veya Excel (.xlsx) yükleyin.'
            : `Desteklenmeyen format. İzin verilenler: ${limits.allowedTypes.join(', ')}`,
      });
    }

    const config = await this.appConfig.getR2Config();
    const { r2_account_id, r2_access_key_id, r2_secret_access_key, r2_bucket, r2_public_url } = config;

    if (!r2_account_id || !r2_access_key_id || !r2_secret_access_key || !r2_bucket || !r2_public_url) {
      throw new BadRequestException({
        code: 'R2_NOT_CONFIGURED',
        message: 'R2 depolama ayarları eksik. Superadmin Ayarlar → Depolama (R2) bölümünden yapılandırın.',
      });
    }

    const ext = this.getExtFromMime(contentType, purpose);
    const base = this.sanitizeFilename(filename.replace(/\.[^.]+$/, ''));
    const key = `${purpose}/${uuidv4()}-${base}.${ext}`;

    const endpoint = `https://${r2_account_id}.r2.cloudflarestorage.com`;
    const client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId: r2_access_key_id,
        secretAccessKey: r2_secret_access_key,
      },
    });

    const command = new PutObjectCommand({
      Bucket: r2_bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 });
    const baseUrl = r2_public_url.replace(/\/$/, '');
    const publicUrl = `${baseUrl}/${key}`;
    return { uploadUrl, publicUrl, key };
  }

  private async getS3Client(): Promise<S3Client> {
    const config = await this.appConfig.getR2Config();
    const { r2_account_id, r2_access_key_id, r2_secret_access_key, r2_bucket } = config;
    if (!r2_account_id || !r2_access_key_id || !r2_secret_access_key || !r2_bucket) {
      throw new BadRequestException({
        code: 'R2_NOT_CONFIGURED',
        message: 'R2 depolama ayarları eksik. Superadmin Ayarlar → Depolama (R2) bölümünden yapılandırın.',
      });
    }
    return new S3Client({
      region: 'auto',
      endpoint: `https://${r2_account_id}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: r2_access_key_id,
        secretAccessKey: r2_secret_access_key,
      },
    });
  }

  /** R2'den dosya içeriğini Buffer olarak alır. */
  async getObjectBuffer(key: string): Promise<Buffer> {
    const config = await this.appConfig.getR2Config();
    const { r2_bucket } = config;
    if (!r2_bucket) throw new BadRequestException({ code: 'R2_NOT_CONFIGURED', message: 'R2 ayarları eksik.' });
    const client = await this.getS3Client();
    const res = await client.send(new GetObjectCommand({ Bucket: r2_bucket, Key: key }));
    const chunks: Uint8Array[] = [];
    for await (const chunk of res.Body as any) chunks.push(chunk);
    return Buffer.concat(chunks);
  }

  /** Buffer'ı R2'ye yükler, key döner. */
  async uploadBuffer(
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    const config = await this.appConfig.getR2Config();
    const { r2_bucket } = config;
    if (!r2_bucket) throw new BadRequestException({ code: 'R2_NOT_CONFIGURED', message: 'R2 ayarları eksik.' });
    const client = await this.getS3Client();
    await client.send(
      new PutObjectCommand({ Bucket: r2_bucket, Key: key, Body: buffer, ContentType: contentType }),
    );
    return key;
  }

  /**
   * R2 key için signed download URL üretir.
   * @param key R2 object key (örn. document-templates/xxx/v1.docx)
   * @param expiresIn saniye (varsayılan 3600 = 1 saat)
   * @param filename İndirilen dosya adı (Content-Disposition; opsiyonel)
   */
  async getSignedDownloadUrl(
    key: string,
    expiresIn = 3600,
    filename?: string,
  ): Promise<string> {
    const config = await this.appConfig.getR2Config();
    const { r2_bucket } = config;
    if (!r2_bucket) throw new BadRequestException({ code: 'R2_NOT_CONFIGURED', message: 'R2 ayarları eksik.' });
    const client = await this.getS3Client();
    const safeName = filename ? this.sanitizeDownloadFilename(filename) : undefined;
    const command = new GetObjectCommand({
      Bucket: r2_bucket,
      Key: key,
      ...(safeName && {
        ResponseContentDisposition: `attachment; filename="${safeName}"`,
      }),
    });
    return getSignedUrl(client, command, { expiresIn });
  }
}
