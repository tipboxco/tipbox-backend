import type { Request, Response, NextFunction } from 'express';

/**
 * Response body içindeki BigInt değerlerini string'e çevirir.
 * JSON.stringify BigInt desteklemediği için Express response'ta hata önlenir.
 * Web3/blockchain işlemlerinde (transaction receipt, gas, blockNumber vb.) BigInt kullanımı yaygındır.
 */
function serializeBigInt(value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map(serializeBigInt);
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = serializeBigInt(v);
    }
    return out;
  }
  return value;
}

/**
 * Tüm JSON response'larda BigInt değerlerini otomatik olarak string'e çeviren Express middleware.
 * res.json() çağrılmadan önce body serialize edilir.
 */
export function bigIntSerializerMiddleware(_req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json.bind(res);
  res.json = function (body: unknown): Response {
    return originalJson(serializeBigInt(body));
  };
  next();
}
