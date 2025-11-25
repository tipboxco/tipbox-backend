import request from 'supertest';
import { PrismaClient } from '@prisma/client';

// Test ortamında her zaman localhost kullan
const BASE_URL = 'http://localhost:3000';
const prisma = new PrismaClient();

export interface AuthResult {
  token: string;
  userId: string;
  email: string;
}

/**
 * Test için auth token ve userId alır
 * Önce login dener, başarısız olursa yeni kullanıcı kaydeder
 */
export async function getAuthToken(
  email?: string,
  password?: string
): Promise<AuthResult> {
  const defaultEmail = email || 'omer@tipbox.co';
  const defaultPassword = password || 'password123';

  // Önce login dene
  let loginRes = await request(BASE_URL)
    .post('/auth/login')
    .send({ email: defaultEmail, password: defaultPassword });

  console.log(`[Auth Helper] Login attempt - Status: ${loginRes.status}, Has token: ${!!loginRes.body.token}, Body keys: ${Object.keys(loginRes.body || {}).join(', ')}, Message: ${loginRes.body?.message || 'N/A'}`);

  // Login başarılıysa token'ı döndür
  if (loginRes.status === 200 && loginRes.body.token) {
    const userId = loginRes.body.id || loginRes.body.userId || loginRes.body.user?.id;
    
    // Eğer userId yoksa, /users/me endpoint'inden al
    if (!userId) {
      const userRes = await request(BASE_URL)
        .get('/users/me')
        .set('Authorization', `Bearer ${loginRes.body.token}`);
      
      if (userRes.status === 200 && userRes.body.id) {
        return {
          token: loginRes.body.token,
          userId: userRes.body.id,
          email: defaultEmail,
        };
      }
    }

    return {
      token: loginRes.body.token,
      userId: userId || '',
      email: defaultEmail,
    };
  }

  // Login başarısızsa, yeni kullanıcı kaydet
  const uniqueEmail = `e2e_${Date.now()}@tipbox.co`;
  console.log(`[Auth Helper] Registering new user: ${uniqueEmail}`);
  const registerRes = await request(BASE_URL)
    .post('/auth/register')
    .send({
      email: uniqueEmail,
      password: defaultPassword,
      name: 'E2E Test User',
    });

  console.log(`[Auth Helper] Register - Status: ${registerRes.status}, Has token: ${!!registerRes.body.token}, Body keys: ${Object.keys(registerRes.body).join(', ')}`);

  // Register başarılı ve token varsa
  if (registerRes.status === 201 && registerRes.body.token) {
    const userId = registerRes.body.id || registerRes.body.userId || registerRes.body.user?.id;
    return {
      token: registerRes.body.token,
      userId: userId || '',
      email: uniqueEmail,
    };
  }

  // Register başarılı ama token yoksa, email verify gerekebilir
  if (registerRes.status === 200 || registerRes.status === 201) {
    // DB'den verification code'u al
    const verificationCode = await prisma.emailVerificationCode.findFirst({
      where: { email: uniqueEmail },
      orderBy: { createdAt: 'desc' },
    });

    if (verificationCode) {
      await request(BASE_URL)
        .post('/auth/verify-email')
        .send({ email: uniqueEmail, code: verificationCode.code });
    }

    // Verify sonrası login dene
    loginRes = await request(BASE_URL)
      .post('/auth/login')
      .send({ email: uniqueEmail, password: defaultPassword });

    if (loginRes.status === 200 && loginRes.body.token) {
      const userId = loginRes.body.id || loginRes.body.userId || loginRes.body.user?.id;
      
      // Eğer userId yoksa, /users/me endpoint'inden al
      if (!userId) {
        const userRes = await request(BASE_URL)
          .get('/users/me')
          .set('Authorization', `Bearer ${loginRes.body.token}`);
        
        if (userRes.status === 200 && userRes.body.id) {
          return {
            token: loginRes.body.token,
            userId: userRes.body.id,
            email: uniqueEmail,
          };
        }
      }

      return {
        token: loginRes.body.token,
        userId: userId || '',
        email: uniqueEmail,
      };
    }
  }

  throw new Error('Failed to obtain auth token');
}

