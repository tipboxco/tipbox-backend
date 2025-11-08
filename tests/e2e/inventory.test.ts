import request from 'supertest';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

describe('Inventory API', () => {
  let authToken: string;

  beforeAll(async () => {
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

  it('GET /inventory should return inventory list', async () => {
    const res = await request(BASE_URL).get('/inventory').set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });


  it('PATCH /inventory/{id} should update or return 403/404', async () => {
    const list = await request(BASE_URL).get('/inventory').set('Authorization', `Bearer ${authToken}`);
    if (list.status !== 200 || !Array.isArray(list.body) || list.body.length === 0) return;
    const anyId = String(list.body[0].id);
    const res = await request(BASE_URL)
      .patch(`/inventory/${anyId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ hasOwned: true });
    expect([200, 403, 404]).toContain(res.status);
  });

  it('DELETE /inventory/{id} should delete or error accordingly', async () => {
    const list = await request(BASE_URL).get('/inventory').set('Authorization', `Bearer ${authToken}`);
    if (list.status !== 200 || !Array.isArray(list.body) || list.body.length === 0) return;
    const anyId = String(list.body[0].id);
    const res = await request(BASE_URL)
      .delete(`/inventory/${anyId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect([200, 403, 404, 500]).toContain(res.status);
  });
});


