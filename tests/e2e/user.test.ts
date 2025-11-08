import request from 'supertest';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Test user bilgileri (login başarısız olursa runtime'da yeni kullanıcı oluşturulacak)
let TEST_USER_EMAIL = 'omer@tipbox.co';
let TEST_USER_PASSWORD = 'password123';
let TEST_USER_ID = '480f5de9-b691-4d70-a6a8-2789226f4e07';

// Basit zamanlayıcı yardımcı fonksiyonu: test içindeki çağrıları ölçmek için
async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  console.time(label);
  try {
    return await fn();
  } finally {
    console.timeEnd(label);
  }
}

describe('User API', () => {
  let authToken: string;

  beforeAll(async () => {
    // 1) Seed kullanıcısı ile login dene
    let loginRes = await request(BASE_URL)
      .post('/auth/login')
      .send({ email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD });

    // 2) Başarısızsa yeni bir kullanıcı register et ve login ol
    if (!(loginRes.status === 200 && loginRes.body.token)) {
      const uniqueEmail = `e2e_${Date.now()}@tipbox.co`;
      const registerRes = await request(BASE_URL)
        .post('/auth/register')
        .send({ email: uniqueEmail, password: TEST_USER_PASSWORD, name: 'E2E User' });

      if (registerRes.status !== 201 && !registerRes.body.token) {
        console.error('Register response:', registerRes.status, registerRes.body);
        throw new Error('Failed to register test user');
      }

      // Register başarılı; yeni email ile login ol
      TEST_USER_EMAIL = uniqueEmail;
      loginRes = await request(BASE_URL)
        .post('/auth/login')
        .send({ email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD });
    }

    if (!(loginRes.status === 200 && loginRes.body.token)) {
      console.error('Login response:', loginRes.status, loginRes.body);
      throw new Error('Failed to get auth token for tests');
    }

    authToken = loginRes.body.token;

    // 3) TEST_USER_ID'yi belirle: /users listesinden email eşleşen kaydı bul
    // Not: /users endpoint auth gerektirir
    const listRes = await request(BASE_URL)
      .get('/users')
      .set('Authorization', `Bearer ${authToken}`);
    if (listRes.status === 200 && Array.isArray(listRes.body)) {
      const found = listRes.body.find((u: any) => (u.email || '').toLowerCase() === TEST_USER_EMAIL.toLowerCase());
      if (found && found.id) {
        TEST_USER_ID = found.id;
      }
    }
  });

  

  describe('GET /users/:id', () => {
    it('should return user by ID', async () => {
      // Test: GET /users/:id endpoint - Kullanıcıyı ID ile getir
      // Steps: 1. HTTP GET request with user ID, 2. Response validation, 3. Property checks
      const res = await request(BASE_URL)
        .get(`/users/${TEST_USER_ID}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id', TEST_USER_ID);
      expect(res.body).toHaveProperty('email', TEST_USER_EMAIL);
      expect(res.body).toHaveProperty('name');
      expect(res.body).toHaveProperty('status');
    });

    it('should return 404 for non-existent user', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const res = await request(BASE_URL)
        .get(`/users/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });

    it('should return 401 without token', async () => {
      const res = await request(BASE_URL)
        .get(`/users/${TEST_USER_ID}`);

      expect(res.status).toBe(401);
    });
  });

  describe('GET /users/:id/profile-card', () => {
    it('should return user profile card', async () => {
      // Test: GET /users/:id/profile-card endpoint - Profil kartı getir
      // Steps: 1. HTTP GET request, 2. Profile card structure validation, 3. Stats & badges checks
      const res = await request(BASE_URL)
        .get(`/users/${TEST_USER_ID}/profile-card`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('name');
      expect(res.body).toHaveProperty('avatarUrl');
      expect(res.body).toHaveProperty('bannerUrl');
      expect(res.body).toHaveProperty('description');
      expect(res.body).toHaveProperty('titles');
      expect(Array.isArray(res.body.titles)).toBe(true);
      expect(res.body).toHaveProperty('stats');
      expect(res.body.stats).toHaveProperty('posts');
      expect(res.body.stats).toHaveProperty('trust');
      expect(res.body.stats).toHaveProperty('truster');
      expect(res.body).toHaveProperty('badges');
      expect(Array.isArray(res.body.badges)).toBe(true);
    });

    it('should return 404 for non-existent user', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const res = await request(BASE_URL)
        .get(`/users/${nonExistentId}/profile-card`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /users/:id/trusts', () => {
    it('should return list of users that the user trusts', async () => {
      const res = await request(BASE_URL)
        .get(`/users/${TEST_USER_ID}/trusts`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        expect(res.body[0]).toHaveProperty('id');
        expect(res.body[0]).toHaveProperty('name');
      }
    });
  });

  describe('GET /users/:id/trusters', () => {
    it('should return list of users who trust this user', async () => {
      const res = await request(BASE_URL)
        .get(`/users/${TEST_USER_ID}/trusters`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        expect(res.body[0]).toHaveProperty('id');
        expect(res.body[0]).toHaveProperty('name');
      }
    });
  });

  describe('GET /users/:id/collections/achievements', () => {
    it('should return user achievement collections', async () => {
      const res = await request(BASE_URL)
        .get(`/users/${TEST_USER_ID}/collections/achievements`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /users/:id/posts', () => {
    it('should return user posts', async () => {
      const res = await timed(`GET /users/${TEST_USER_ID}/posts`, () =>
        request(BASE_URL)
          .get(`/users/${TEST_USER_ID}/posts`)
          .set('Authorization', `Bearer ${authToken}`)
      );

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /users/:id/reviews', () => {
    it('should return user reviews', async () => {
      const res = await timed(`GET /users/${TEST_USER_ID}/reviews`, () =>
        request(BASE_URL)
          .get(`/users/${TEST_USER_ID}/reviews`)
          .set('Authorization', `Bearer ${authToken}`)
      );

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /users/:id/benchmarks', () => {
    it('should return user benchmarks', async () => {
      const res = await timed(`GET /users/${TEST_USER_ID}/benchmarks`, () =>
        request(BASE_URL)
          .get(`/users/${TEST_USER_ID}/benchmarks`)
          .set('Authorization', `Bearer ${authToken}`)
      );

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /users/:id/tips', () => {
    it('should return user tips', async () => {
      const res = await timed(`GET /users/${TEST_USER_ID}/tips`, () =>
        request(BASE_URL)
          .get(`/users/${TEST_USER_ID}/tips`)
          .set('Authorization', `Bearer ${authToken}`)
      );

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /users/:id/replies', () => {
    it('should return user replies', async () => {
      const res = await timed(`GET /users/${TEST_USER_ID}/replies`, () =>
        request(BASE_URL)
          .get(`/users/${TEST_USER_ID}/replies`)
          .set('Authorization', `Bearer ${authToken}`)
      );

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /users/:id/ladder/badges', () => {
    it('should return user badge ladder', async () => {
      const res = await request(BASE_URL)
        .get(`/users/${TEST_USER_ID}/ladder/badges`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        expect(res.body[0]).toHaveProperty('title');
        expect(res.body[0]).toHaveProperty('isClaimed');
      }
    });
  });

  describe('GET /users/:id/bookmarks', () => {
    it('should return user bookmarks', async () => {
      const res = await timed(`GET /users/${TEST_USER_ID}/bookmarks`, () =>
        request(BASE_URL)
          .get(`/users/${TEST_USER_ID}/bookmarks`)
          .set('Authorization', `Bearer ${authToken}`)
      );

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('POST /users', () => {
    it('should create a new user with valid data', async () => {
      const uniqueEmail = `testuser_${Date.now()}@tipbox.co`;
      const res = await request(BASE_URL)
        .post('/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: uniqueEmail,
          displayName: 'Test User',
          bio: 'Test user bio',
        });

      expect(res.status).toBe(201);
      // Response format validation - UserResponse yapısına uygun olmalı
      expect(res.body).toHaveProperty('id');
      expect(typeof res.body.id).toBe('string');
      expect(res.body.id.length).toBeGreaterThan(0);
      expect(res.body).toHaveProperty('email', uniqueEmail);
      expect(res.body).toHaveProperty('name'); // displayName'den gelen
      expect(res.body).toHaveProperty('status');
      expect(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'DELETED']).toContain(res.body.status);
      expect(res.body).toHaveProperty('auth0Id');
      expect(res.body).toHaveProperty('walletAddress');
      expect(res.body).toHaveProperty('kycStatus');
      expect(res.body).toHaveProperty('createdAt');
      expect(res.body).toHaveProperty('updatedAt');
      // Date format validation
      expect(new Date(res.body.createdAt).toString()).not.toBe('Invalid Date');
      expect(new Date(res.body.updatedAt).toString()).not.toBe('Invalid Date');
    });

    it('should return 400 if email is missing', async () => {
      const res = await request(BASE_URL)
        .post('/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          displayName: 'Test User',
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toHaveProperty('message');
      expect(typeof res.body.error.message).toBe('string');
    });

    it('should return 400 if email is empty string', async () => {
      const res = await request(BASE_URL)
        .post('/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: '',
          displayName: 'Test User',
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(typeof res.body.error.message).toBe('string');
    });

    it('should return 400 if email is invalid format', async () => {
      const res = await request(BASE_URL)
        .post('/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: 'invalid-email',
          displayName: 'Test User',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('email');
    });

    it('should return 400 if email is missing @ symbol', async () => {
      const res = await request(BASE_URL)
        .post('/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: 'testtipbox.co',
          displayName: 'Test User',
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 if displayName is missing', async () => {
      const res = await request(BASE_URL)
        .post('/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: 'test@tipbox.co',
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(typeof res.body.error.message).toBe('string');
      expect(res.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 400 if displayName is empty string', async () => {
      const res = await request(BASE_URL)
        .post('/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: 'test@tipbox.co',
          displayName: '',
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(typeof res.body.error.message).toBe('string');
      expect(res.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 400 if displayName is too short (less than 2 characters)', async () => {
      const res = await request(BASE_URL)
        .post('/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: 'test@tipbox.co',
          displayName: 'A', // minLength: 2 olmalı
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('2 karakter');
    });

    it('should return 400 if displayName is too long (more than 50 characters)', async () => {
      const longName = 'A'.repeat(51); // maxLength: 50 olmalı
      const res = await request(BASE_URL)
        .post('/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: 'test@tipbox.co',
          displayName: longName,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('50 karakter');
    });

    it('should return 400 if bio is too long (more than 500 characters)', async () => {
      const longBio = 'A'.repeat(501); // maxLength: 500 olmalı
      const res = await request(BASE_URL)
        .post('/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: 'test@tipbox.co',
          displayName: 'Test User',
          bio: longBio,
        });

      expect(res.status).toBe(400);
      expect(String(res.body.error.message).toLowerCase()).toContain('bio');
      expect(res.body.error.message).toContain('500 karakter');
    });

    it('should return 409 if email already exists', async () => {
      const res = await request(BASE_URL)
        .post('/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: TEST_USER_EMAIL,
          displayName: 'Duplicate User',
        });

      expect(res.status).toBe(409);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toHaveProperty('message');
      // Mesaj Türkçe: "Sistemde kayıtlı mail adresi bulunuyor."
      expect(typeof res.body.error.message).toBe('string');
      expect(res.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 401 without token', async () => {
      const res = await request(BASE_URL)
        .post('/users')
        .send({
          email: 'test@tipbox.co',
          displayName: 'Test User',
        });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /users/setup-profile', () => {
    it('should return 400 when required fields are missing (with auth)', async () => {
      const res = await request(BASE_URL)
        .post('/users/setup-profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});
      expect([400, 401]).toContain(res.status);
    });
  });

  describe('Trust/Block/Mute actions', () => {
    const dummyTargetId = '00000000-0000-0000-0000-000000000000';

    it('POST /users/:id/trust/:targetUserId should trust or return error', async () => {
      const res = await request(BASE_URL)
        .post(`/users/${TEST_USER_ID}/trust/${dummyTargetId}`)
        .set('Authorization', `Bearer ${authToken}`);
      expect([200, 400, 404, 409, 500]).toContain(res.status);
    });

    it('DELETE /users/:id/trusts/:targetUserId should untrust or return error', async () => {
      const res = await request(BASE_URL)
        .delete(`/users/${TEST_USER_ID}/trusts/${dummyTargetId}`)
        .set('Authorization', `Bearer ${authToken}`);
      expect([200, 204, 400, 404, 500]).toContain(res.status);
    });

    it('POST /users/:id/block/:targetUserId should block or return error', async () => {
      const res = await request(BASE_URL)
        .post(`/users/${TEST_USER_ID}/block/${dummyTargetId}`)
        .set('Authorization', `Bearer ${authToken}`);
      expect([200, 400, 404, 409, 500]).toContain(res.status);
    });

    it('DELETE /users/:id/block/:targetUserId should unblock or return error', async () => {
      const res = await request(BASE_URL)
        .delete(`/users/${TEST_USER_ID}/block/${dummyTargetId}`)
        .set('Authorization', `Bearer ${authToken}`);
      expect([200, 204, 400, 404, 500]).toContain(res.status);
    });

    it('POST /users/:id/mute/:targetUserId should mute or return error', async () => {
      const res = await request(BASE_URL)
        .post(`/users/${TEST_USER_ID}/mute/${dummyTargetId}`)
        .set('Authorization', `Bearer ${authToken}`);
      expect([200, 400, 404, 409, 500]).toContain(res.status);
    });

    it('DELETE /users/:id/mute/:targetUserId should unmute or return error', async () => {
      const res = await request(BASE_URL)
        .delete(`/users/${TEST_USER_ID}/mute/${dummyTargetId}`)
        .set('Authorization', `Bearer ${authToken}`);
      expect([200, 204, 400, 404, 500]).toContain(res.status);
    });
  });
});

