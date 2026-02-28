import jwt, { JwtPayload } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || '';
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');

// Varsayılan access token süresi: 7 gün
export function signJwt(payload: Record<string, unknown>, expiresIn: string = '7d'): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export function verifyJwt(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
} 