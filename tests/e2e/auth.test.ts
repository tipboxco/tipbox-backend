
import request from 'supertest';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

describe('Auth API', () => {
  describe('POST /auth/register', () => {
    it('should register a new user and return token', async () => {
      const res = await request(BASE_URL)
        .post('/auth/register')
        .send({
          name: 'Test User',
          email: `testuser_${Date.now()}@mail.com`,
          password: 'password123!',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('token');
      expect(typeof res.body.token).toBe('string');
    });

    // Note: Server-side validation for empty fields is not enforced here; client handles it.
  });

  describe('POST /auth/login', () => {
    const email = 'omer@tipbox.co';
    const password = 'password123';

    it('should login with seeded user credentials', async () => {
      const res = await request(BASE_URL)
        .post('/auth/login')
        .send({ email, password });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body).toHaveProperty('email');
      expect(res.body.email).toBe(email);
    });

    it('should return 401 on invalid credentials', async () => {
      const res = await request(BASE_URL)
        .post('/auth/login')
        .send({ email, password: 'wrongPassword' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /auth/me', () => {
    let token: string;

    beforeAll(async () => {
      const loginRes = await request(BASE_URL)
        .post('/auth/login')
        .send({ email: 'omer@tipbox.co', password: 'password123' });

      token = loginRes.body.token;
    });

    it('should return current authenticated user', async () => {
      const res = await request(BASE_URL)
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('email');
    });

    it('should return 401 without token', async () => {
      const res = await request(BASE_URL).get('/auth/me');
      expect(res.status).toBe(401);
    });
  });
});