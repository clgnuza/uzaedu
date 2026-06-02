import type { Request, Response, NextFunction } from 'express';

/** Yerel perf: yavaş API isteklerini konsola yazar */
export function httpPerfMiddleware(thresholdMs = 400) {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const path = (req.originalUrl ?? req.url ?? '').split('?')[0];
    res.on('finish', () => {
      if (!path.startsWith('/api')) return;
      const ms = Date.now() - start;
      if (ms < thresholdMs) return;
      const tag = ms >= 2000 ? 'SLOW' : 'PERF';
      console.log(`[${tag}] ${req.method} ${path} ${ms}ms ${res.statusCode}`);
    });
    next();
  };
}
