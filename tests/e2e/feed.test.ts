import request from 'supertest';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

describe('Feed API', () => {
  let authToken: string;

  beforeAll(async () => {
    // Try login with default seed user; fallback to register
    const email = 'omer@tipbox.co';
    const password = 'password123';
    let loginRes = await request(BASE_URL).post('/auth/login').send({ email, password });
    if (!(loginRes.status === 200 && loginRes.body.token)) {
      const uniqueEmail = `e2e_${Date.now()}@tipbox.co`;
      const registerRes = await request(BASE_URL).post('/auth/register').send({ email: uniqueEmail, password, name: 'E2E User' });
      if (registerRes.status !== 201 && !registerRes.body.token) throw new Error('Failed to register test user');
      loginRes = await request(BASE_URL).post('/auth/login').send({ email: uniqueEmail, password });
    }
    authToken = loginRes.body.token;
  });

  it('GET /feed should return feed response', async () => {
    const res = await request(BASE_URL)
      .get('/feed')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('GET /feed/filtered should return filtered feed', async () => {
    const res = await request(BASE_URL)
      .get('/feed/filtered?limit=10&sort=recent')
      .set('Authorization', `Bearer ${authToken}`);
    expect([200, 204]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body).toHaveProperty('items');
      expect(Array.isArray(res.body.items)).toBe(true);
    }
  });
});


