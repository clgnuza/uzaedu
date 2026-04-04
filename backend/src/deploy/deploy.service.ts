import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';
import { spawn } from 'child_process';
import type { Request } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { env } from '../config/env';
import type { DeployStatusDto } from './deploy.types';
import { getClientIp, isClientIpAllowed } from './deploy-request.util';

const MAX_OUTPUT_CHARS = 24_000;
const RUN_TIMEOUT_MS = 15 * 60 * 1000;
const DATA_MIRROR_EXPORT_TIMEOUT_MS = 15 * 60 * 1000;

function hashDeploySecret(s: string): Buffer {
  return createHash('sha256').update(s, 'utf8').digest();
}

function safeCompareDeploySecret(input: string, expected: string): boolean {
  const a = hashDeploySecret(input);
  const b = hashDeploySecret(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function isAllowedScriptPath(p: string): boolean {
  if (!path.isAbsolute(p)) return false;
  const n = path.normalize(p);
  if (n.includes('..')) return false;
  return n.endsWith('.sh');
}

function extractHeaderToken(req: Request, bodyToken?: string): string | undefined {
  const raw = req.headers['x-deploy-token'];
  const fromHeader = Array.isArray(raw) ? raw[0] : raw;
  if (typeof fromHeader === 'string' && fromHeader.trim()) return fromHeader.trim();
  if (bodyToken?.trim()) return bodyToken.trim();
  return undefined;
}

@Injectable()
export class DeployService {
  private readonly logger = new Logger(DeployService.name);

  /** Üretimde kapalı; yerel DB’den panel ile SQL indirmek için */
  dataMirrorExportAllowed(): boolean {
    const n = env.nodeEnv;
    if (n === 'production') return false;
    return n === 'local' || n === 'development' || n === 'test';
  }

  getStatus(): DeployStatusDto {
    const allowed = env.deploy.allowedIps;
    const headerTok = env.deploy.headerToken?.trim();
    const plat = process.platform;
    const dataMirrorExportAvailable = this.dataMirrorExportAllowed();
    if (plat === 'win32') {
      return {
        canDeploy: false,
        reason: 'windows',
        requiresHeaderToken: !!headerTok,
        requiresIpAllowlist: allowed.length > 0,
        runtimePlatform: plat,
        dataMirrorExportAvailable,
      };
    }
    if (!env.deploy.enabled) {
      return {
        canDeploy: false,
        reason: 'disabled',
        requiresHeaderToken: !!headerTok,
        requiresIpAllowlist: allowed.length > 0,
        runtimePlatform: plat,
        dataMirrorExportAvailable,
      };
    }
    const secret = env.deploy.secret?.trim();
    const scriptPath = env.deploy.scriptPath?.trim();
    if (!secret || !scriptPath) {
      return {
        canDeploy: false,
        reason: 'misconfigured',
        requiresHeaderToken: !!headerTok,
        requiresIpAllowlist: allowed.length > 0,
        runtimePlatform: plat,
        dataMirrorExportAvailable,
      };
    }
    return {
      canDeploy: true,
      reason: 'ready',
      requiresHeaderToken: !!headerTok,
      requiresIpAllowlist: allowed.length > 0,
      runtimePlatform: plat,
      dataMirrorExportAvailable,
    };
  }

  /**
   * tools/export-superadmin-full-sql.cjs ile yerel PostgreSQL → SQL dosyası (--skip-app-config).
   * Çalışma dizini backend kökü olmalı (npm run start:dev).
   */
  async writeDataMirrorExportFile(outputPath: string): Promise<void> {
    const script = path.join(process.cwd(), 'tools', 'export-superadmin-full-sql.cjs');
    if (!fs.existsSync(script)) {
      throw new BadRequestException('export aracı bulunamadı (tools/export-superadmin-full-sql.cjs).');
    }
    await new Promise<void>((resolve, reject) => {
      const child = spawn(process.execPath, [script, outputPath, '--skip-app-config'], {
        cwd: process.cwd(),
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let out = '';
      const append = (chunk: Buffer) => {
        out += chunk.toString('utf8');
        if (out.length > MAX_OUTPUT_CHARS) {
          out = `…(kesildi)\n${out.slice(-MAX_OUTPUT_CHARS)}`;
        }
      };
      child.stdout?.on('data', append);
      child.stderr?.on('data', append);
      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        reject(
          new BadRequestException(
            `SQL dışa aktarma zaman aşımı (${DATA_MIRROR_EXPORT_TIMEOUT_MS / 60000} dk).\n${out.trim()}`,
          ),
        );
      }, DATA_MIRROR_EXPORT_TIMEOUT_MS);
      child.on('error', (err: NodeJS.ErrnoException) => {
        clearTimeout(timer);
        reject(
          new BadRequestException(err.code === 'ENOENT' ? 'node çalıştırılamadı.' : err.message),
        );
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) {
          resolve();
        } else {
          reject(
            new BadRequestException(
              `export çıkış kodu: ${code}\n${out.trim() || '(stderr/stdout boş)'}`,
            ),
          );
        }
      });
    });
  }

  async run(
    req: Request,
    deployPassword: string,
    deployHeaderToken: string | undefined,
    initiatedByUserId?: string,
  ): Promise<{ output: string; durationMs: number }> {
    const status = this.getStatus();
    if (status.reason === 'windows') {
      throw new BadRequestException(
        'Panel dağıtımı yalnızca Linux sunucuda çalışır (/bin/bash).',
      );
    }
    if (status.reason === 'disabled') {
      throw new BadRequestException('Sunucu dağıtımı bu ortamda kapalı (DEPLOY_ENABLED).');
    }
    if (status.reason === 'misconfigured') {
      throw new BadRequestException('DEPLOY_SECRET ve DEPLOY_SCRIPT_PATH tanımlı olmalı.');
    }

    const allowedIps = env.deploy.allowedIps;
    if (allowedIps.length > 0) {
      const ip = getClientIp(req);
      if (!isClientIpAllowed(ip, allowedIps)) {
        this.logger.warn(`Deploy: IP reddedildi (${ip})`);
        throw new ForbiddenException('Bu ağ adresinden dağıtım izni yok.');
      }
    }

    const expectedHeader = env.deploy.headerToken?.trim();
    if (expectedHeader) {
      const sent = extractHeaderToken(req, deployHeaderToken);
      if (!sent || !safeCompareDeploySecret(sent, expectedHeader)) {
        this.logger.warn('Deploy: ek doğrulama reddedildi');
        throw new ForbiddenException('Dağıtım doğrulanamadı.');
      }
    }

    const secret = env.deploy.secret!.trim();
    const scriptPath = env.deploy.scriptPath!.trim();

    if (!deployPassword || !safeCompareDeploySecret(deployPassword, secret)) {
      this.logger.warn('Deploy: geçersiz şifre denemesi');
      throw new ForbiddenException('Dağıtım şifresi hatalı.');
    }

    if (!isAllowedScriptPath(scriptPath)) {
      throw new BadRequestException(
        'DEPLOY_SCRIPT_PATH mutlak yol olmalı, .sh ile bitmeli ve .. içermemeli.',
      );
    }
    if (!fs.existsSync(scriptPath)) {
      this.logger.error(`Deploy betiği yok: ${path.basename(scriptPath)}`);
      throw new BadRequestException('Dağıtım betiği dosyası bulunamadı (sunucu yolu).');
    }
    const stat = fs.statSync(scriptPath);
    if (!stat.isFile()) {
      throw new BadRequestException('DEPLOY_SCRIPT_PATH bir dosya olmalı.');
    }

    const userLog = initiatedByUserId ? ` user=${initiatedByUserId}` : '';
    this.logger.log(`Deploy başladı${userLog}`);
    const started = Date.now();
    try {
      const output = await this.runBashScript(scriptPath);
      const durationMs = Date.now() - started;
      this.logger.log(`Deploy bitti OK ${durationMs}ms${userLog}`);
      return { output, durationMs };
    } catch (e) {
      const durationMs = Date.now() - started;
      this.logger.warn(`Deploy hata ${durationMs}ms${userLog}: ${e instanceof Error ? e.message : String(e)}`);
      throw e;
    }
  }

  private runBashScript(scriptPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn('/bin/bash', [scriptPath], {
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let out = '';
      const append = (chunk: Buffer) => {
        out += chunk.toString('utf8');
        if (out.length > MAX_OUTPUT_CHARS) {
          out = `…(kesildi)\n${out.slice(-MAX_OUTPUT_CHARS)}`;
        }
      };
      child.stdout?.on('data', append);
      child.stderr?.on('data', append);
      const t = setTimeout(() => {
        child.kill('SIGTERM');
        reject(
          new BadRequestException(
            `Dağıtım zaman aşımı (${RUN_TIMEOUT_MS / 60000} dk).\n${out.trim()}`,
          ),
        );
      }, RUN_TIMEOUT_MS);
      child.on('error', (err: NodeJS.ErrnoException) => {
        clearTimeout(t);
        reject(
          new BadRequestException(
            err.code === 'ENOENT'
              ? '/bin/bash bulunamadı; sunucu Linux olmalı.'
              : err.message,
          ),
        );
      });
      child.on('close', (code) => {
        clearTimeout(t);
        if (code === 0) {
          resolve(out.trim() || '(çıktı yok)');
        } else {
          reject(
            new BadRequestException(
              `Betik çıkış kodu: ${code}\n${out.trim() || '(stderr/stdout boş)'}`,
            ),
          );
        }
      });
    });
  }
}
