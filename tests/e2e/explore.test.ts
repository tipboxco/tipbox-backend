import request from 'supertest';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

describe('Explore API', () => {
  async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
    console.time(label);
    try { return await fn(); } finally { console.timeEnd(label); }
  }
  let authToken: string;

  beforeAll(async () => {
    // /explore/hottest requires auth
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

  it('GET /explore/hottest should return items', async () => {
    const res = await timed('GET /explore/hottest', () => 
      request(BASE_URL)
        .get('/explore/hottest')
        .set('Authorization', `Bearer ${authToken}`)
    );
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('GET /explore/marketplace-banners should return banners', async () => {
    const res = await timed('GET /explore/marketplace-banners', () => request(BASE_URL).get('/explore/marketplace-banners'));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // Note: /explore/search route is not present; test removed

  it('GET /explore/events should return events or empty', async () => {
    const res = await timed('GET /explore/events', () => request(BASE_URL).get('/explore/events?limit=10'));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('GET /explore/brands/new should return brands list', async () => {
    const res = await timed('GET /explore/brands/new', () => request(BASE_URL).get('/explore/brands/new?limit=10'));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('GET /explore/products/new should return products list', async () => {
    const res = await timed('GET /explore/products/new', () => request(BASE_URL).get('/explore/products/new?limit=10'));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);
  });
});


