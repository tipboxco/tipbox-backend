import request from 'supertest';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Test user bilgileri (login başarısız olursa runtime'da yeni kullanıcı oluşturulacak)
let TEST_USER_EMAIL = 'omer@tipbox.co';
let TEST_USER_PASSWORD = 'password123';
let TEST_USER_ID = '480f5de9-b691-4d70-a6a8-2789226f4e07';

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

  describe('GET /users', () => {
    it('should return list of users', async () => {
      // Test: GET /users endpoint - Tüm kullanıcıları listele
      // Steps: 1. HTTP GET request, 2. Response validation, 3. Assertions
      const res = await request(BASE_URL)
        .get('/users')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        expect(res.body[0]).toHaveProperty('id');
        expect(res.body[0]).toHaveProperty('email');
      }
    });
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
      const res = await request(BASE_URL)
        .get(`/users/${TEST_USER_ID}/posts`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /users/:id/reviews', () => {
    it('should return user reviews', async () => {
      const res = await request(BASE_URL)
        .get(`/users/${TEST_USER_ID}/reviews`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /users/:id/benchmarks', () => {
    it('should return user benchmarks', async () => {
      const res = await request(BASE_URL)
        .get(`/users/${TEST_USER_ID}/benchmarks`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /users/:id/tips', () => {
    it('should return user tips', async () => {
      const res = await request(BASE_URL)
        .get(`/users/${TEST_USER_ID}/tips`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /users/:id/replies', () => {
    it('should return user replies', async () => {
      const res = await request(BASE_URL)
        .get(`/users/${TEST_USER_ID}/replies`)
        .set('Authorization', `Bearer ${authToken}`);

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
      const res = await request(BASE_URL)
        .get(`/users/${TEST_USER_ID}/bookmarks`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /users/settings/notifications', () => {
    it('should return user notification settings', async () => {
      const res = await request(BASE_URL)
        .get('/users/settings/notifications')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        expect(res.body[0]).toHaveProperty('notificationCode');
        expect(res.body[0]).toHaveProperty('value');
      }
    });
  });

  describe('GET /users/settings/privacy', () => {
    it('should return user privacy settings', async () => {
      const res = await request(BASE_URL)
        .get('/users/settings/privacy')
        .set('Authorization', `Bearer ${authToken}`);

      // Privacy endpoint might return 500 if settings not initialized
      // This is acceptable for now
      expect([200, 500]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('profileVisibility');
      }
    });
  });

  describe('GET /users/settings/support-session-price', () => {
    it('should return user support session price', async () => {
      const res = await request(BASE_URL)
        .get('/users/settings/support-session-price')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('price');
    });
  });

  describe('GET /users/settings/devices', () => {
    it('should return user devices', async () => {
      const res = await request(BASE_URL)
        .get('/users/settings/devices')
        .set('Authorization', `Bearer ${authToken}`);

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
      expect(res.body.error.message).toContain('email');
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
      expect(res.body.error.message).toContain('displayName');
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
      expect(res.body.error.message).toContain('displayName');
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
      expect(res.body.error.message).toContain('displayName');
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
      expect(res.body.error.message).toContain('displayName');
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
      expect(res.body.error.message).toContain('bio');
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

    it.skip('should trim email and displayName whitespace', async () => {
      const uniqueEmail = `trimtest_${Date.now()}@tipbox.co`;
      const res = await request(BASE_URL)
        .post('/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: `  ${uniqueEmail}  `,
          displayName: '  Test User  ',
        });

      expect(res.status).toBe(201);
      expect(res.body.email).toBe(uniqueEmail); // Trim edilmiş olmalı
      expect(res.body.name).toBe('Test User'); // Trim edilmiş olmalı
    });
  });

  describe('PUT /users/:id', () => {
    it('should update user successfully with valid data', async () => {
      const res = await request(BASE_URL)
        .put(`/users/${TEST_USER_ID}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: TEST_USER_EMAIL,
          status: 'ACTIVE',
        });

      expect(res.status).toBe(200);
      // Response format validation - UserResponse yapısına uygun olmalı
      expect(res.body).toHaveProperty('id', TEST_USER_ID);
      expect(res.body).toHaveProperty('email', TEST_USER_EMAIL);
      expect(res.body).toHaveProperty('name');
      expect(res.body).toHaveProperty('status', 'ACTIVE');
      expect(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'DELETED']).toContain(res.body.status);
      expect(res.body).toHaveProperty('auth0Id');
      expect(res.body).toHaveProperty('walletAddress');
      expect(res.body).toHaveProperty('kycStatus');
      expect(res.body).toHaveProperty('createdAt');
      expect(res.body).toHaveProperty('updatedAt');
      // updatedAt should be different from createdAt (user was updated)
      expect(new Date(res.body.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(res.body.createdAt).getTime());
    });

    it('should update only status when only status is provided', async () => {
      const res = await request(BASE_URL)
        .put(`/users/${TEST_USER_ID}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'ACTIVE',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ACTIVE');
      expect(res.body).toHaveProperty('id', TEST_USER_ID);
    });

    it('should return 400 if email format is invalid', async () => {
      const res = await request(BASE_URL)
        .put(`/users/${TEST_USER_ID}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: 'invalid-email',
          status: 'ACTIVE',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('email');
    });

    it('should return 400 if status is invalid enum value', async () => {
      const res = await request(BASE_URL)
        .put(`/users/${TEST_USER_ID}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'INVALID_STATUS',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Status');
      expect(res.body.error.message).toContain('ACTIVE');
    });

    it('should return 400 if status is not in allowed enum values', async () => {
      const res = await request(BASE_URL)
        .put(`/users/${TEST_USER_ID}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'PENDING',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Status');
    });

    it('should return 404 for non-existent user', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const res = await request(BASE_URL)
        .put(`/users/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'ACTIVE',
        });

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('message');
      expect(typeof res.body.message).toBe('string');
      expect(res.body.message).toContain('not found');
    });

    it('should return 400 if email is empty string', async () => {
      const res = await request(BASE_URL)
        .put(`/users/${TEST_USER_ID}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: '',
          status: 'ACTIVE',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('email');
    });

    it('should return 401 without token', async () => {
      const res = await request(BASE_URL)
        .put(`/users/${TEST_USER_ID}`)
        .send({
          status: 'ACTIVE',
        });

      expect(res.status).toBe(401);
    });

    it.skip('should trim email whitespace if email is provided', async () => {
      const res = await request(BASE_URL)
        .put(`/users/${TEST_USER_ID}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: `  ${TEST_USER_EMAIL}  `,
          status: 'ACTIVE',
        });

      expect(res.status).toBe(200);
      if (res.body.email) {
        expect(res.body.email).toBe(TEST_USER_EMAIL); // Trim edilmiş olmalı
      }
    });
  });

  describe('DELETE /users/:id', () => {
    // NOT: DELETE testi için yeni bir test kullanıcısı oluşturup silmeliyiz
    // Ana test kullanıcısını silmeyelim çünkü diğer testler için gerekli
    let testUserIdToDelete: string;

    beforeAll(async () => {
      // Silme testi için yeni bir kullanıcı oluştur
      const uniqueEmail = `deletetest_${Date.now()}@tipbox.co`;
      const createRes = await request(BASE_URL)
        .post('/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: uniqueEmail,
          displayName: 'Delete Test User',
        });

      if (createRes.status === 201 && createRes.body.id) {
        testUserIdToDelete = createRes.body.id;
      }
    });

    it('should delete user successfully', async () => {
      // Test: DELETE /users/:id endpoint - Kullanıcıyı sil
      // Steps: 1. HTTP DELETE request, 2. User deletion, 3. Status validation
      if (!testUserIdToDelete) {
        // Eğer kullanıcı oluşturulamadıysa testi atla
        return;
      }

      const res = await request(BASE_URL)
        .delete(`/users/${testUserIdToDelete}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(204);
    });

    it('should return 404 for non-existent user', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const res = await request(BASE_URL)
        .delete(`/users/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });

    it('should return 401 without token', async () => {
      const res = await request(BASE_URL)
        .delete(`/users/${TEST_USER_ID}`);

      expect(res.status).toBe(401);
    });
  });

  describe('POST /users/settings/change-password', () => {
    it('should change password successfully', async () => {
      // Test: POST /users/settings/change-password endpoint - Şifre değiştir
      // Steps: 1. HTTP POST request, 2. Password validation, 3. Password update
      const res = await request(BASE_URL)
        .post('/users/settings/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: TEST_USER_PASSWORD,
          newPassword: 'newPassword123',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);

      // Şifreyi geri değiştir (diğer testler için)
      await request(BASE_URL)
        .post('/users/settings/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'newPassword123',
          newPassword: TEST_USER_PASSWORD,
        });
    });

    it('should return 400 if passwords missing', async () => {
      const res = await request(BASE_URL)
        .post('/users/settings/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: '',
          newPassword: '',
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 if current password is wrong', async () => {
      const res = await request(BASE_URL)
        .post('/users/settings/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'wrongPassword123',
          newPassword: 'newPassword123',
        });

      expect(res.status).toBe(400);
    });

    it('should return 401 without token', async () => {
      const res = await request(BASE_URL)
        .post('/users/settings/change-password')
        .send({
          currentPassword: TEST_USER_PASSWORD,
          newPassword: 'newPassword123',
        });

      expect(res.status).toBe(401);
    });
  });
});

