import { Request, Response, NextFunction } from 'express';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const log = `${req.method} ${req.originalUrl || req.url} ${res.statusCode} ${duration}ms`;
    console.log(`[Request] ${log}`);
  });
  next();
}
