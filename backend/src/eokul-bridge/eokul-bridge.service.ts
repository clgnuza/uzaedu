import { Injectable } from '@nestjs/common';
import { env } from '../config/env';
import {
  buildEokulBridgeBootstrap,
  EOKUL_BRIDGE_MIN_EXTENSION_VERSION,
} from './eokul-bridge.bootstrap';

function parseSemver(v: string): [number, number, number] {
  const parts = String(v || '0.0.0')
    .trim()
    .split('.')
    .map((x) => parseInt(x, 10) || 0);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

function semverGte(a: string, b: string): boolean {
  const [am, ai, ap] = parseSemver(a);
  const [bm, bi, bp] = parseSemver(b);
  if (am !== bm) return am > bm;
  if (ai !== bi) return ai > bi;
  return ap >= bp;
}

@Injectable()
export class EokulBridgeService {
  resolvePortalOrigin(): string {
    const fromEnv = process.env.EOKUL_BRIDGE_PORTAL_ORIGIN?.trim();
    if (fromEnv?.startsWith('http')) return fromEnv.replace(/\/+$/, '');
    if (env.nodeEnv === 'local' || env.nodeEnv === 'development') {
      return 'http://localhost:3000';
    }
    return 'https://admin.uzaedu.com';
  }

  resolveApiBase(): string {
    const fromEnv = process.env.EOKUL_BRIDGE_API_BASE?.trim();
    if (fromEnv?.startsWith('http')) return fromEnv.replace(/\/+$/, '');
    if (env.nodeEnv === 'local' || env.nodeEnv === 'development') {
      return `http://127.0.0.1:${env.port}/api`;
    }
    return 'https://api.uzaedu.com/api';
  }

  getBootstrap() {
    return buildEokulBridgeBootstrap(this.resolvePortalOrigin(), this.resolveApiBase());
  }

  checkExtensionVersion(clientVersion: string) {
    const min = EOKUL_BRIDGE_MIN_EXTENSION_VERSION;
    const enabled = semverGte(clientVersion, min);
    return {
      ok: true,
      enabled,
      minVersion: min,
      clientVersion: clientVersion || '',
      message: enabled
        ? undefined
        : `Lütfen eklentinin güncel sürümünü (${min}+) yükleyin.`,
    };
  }

  isFeatureEnabled() {
    const enabled = process.env.EOKUL_BRIDGE_ENABLED !== 'false';
    return {
      ok: true,
      enabled,
      message: enabled
        ? undefined
        : 'Okul köprüsü geçici olarak devre dışı bırakıldı.',
    };
  }
}
