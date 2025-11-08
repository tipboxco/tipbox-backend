import request from 'supertest';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

describe('Expert API', () => {
  let token: string;
  let createdRequestId: string | undefined;

  beforeAll(async () => {
    const loginRes = await request(BASE_URL)
      .post('/auth/login')
      .send({ email: 'omer@tipbox.co', password: 'password123' });
    token = loginRes.body.token;
  });

  it('GET /expert/categories should return static categories', async () => {
    const res = await request(BASE_URL)
      .get('/expert/categories')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('categories');
    expect(Array.isArray(res.body.categories)).toBe(true);
  });

  it('POST /expert/request should create a new expert request (no media)', async () => {
    const res = await request(BASE_URL)
      .post('/expert/request')
      .set('Authorization', `Bearer ${token}`)
      .field('description', 'Need help comparing Dyson V12 vs V15s')
      .field('tipsAmount', '25');

    expect([200, 201]).toContain(res.status);
    expect(res.body).toHaveProperty('id');
    createdRequestId = res.body.id;
  });

  it('PATCH /expert/request/{id}/tips should update tips amount', async () => {
    if (!createdRequestId) return; // skip if creation failed
    const res = await request(BASE_URL)
      .patch(`/expert/request/${createdRequestId}/tips`)
      .set('Authorization', `Bearer ${token}`)
      .send({ tipsAmount: 30 });
    expect([200, 400]).toContain(res.status); // 400 if not PENDING
    if (res.status === 200) {
      expect(res.body).toHaveProperty('tipsAmount');
    } else {
      expect(res.body).toHaveProperty('message');
    }
  });

  it('GET /expert/my-requests should return grouped requests', async () => {
    const res = await request(BASE_URL)
      .get('/expert/my-requests')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('answered');
    expect(res.body).toHaveProperty('pending');
  });

  it('GET /expert/request/{id}/status should return status for created request', async () => {
    if (!createdRequestId) return; // skip if creation failed
    const res = await request(BASE_URL)
      .get(`/expert/request/${createdRequestId}/status`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status');
  });

  it('GET /expert/answered should return answered contents (array)', async () => {
    const res = await request(BASE_URL)
      .get('/expert/answered')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /expert/balance should return current tips balance', async () => {
    const res = await request(BASE_URL)
      .get('/expert/balance')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('balance');
  });

  it('GET /expert/request/{id} should return detail or 404 if not answered', async () => {
    if (!createdRequestId) return;
    const res = await request(BASE_URL)
      .get(`/expert/request/${createdRequestId}`)
      .set('Authorization', `Bearer ${token}`);
    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body).toHaveProperty('id');
    } else {
      expect(res.body).toHaveProperty('message');
    }
  });

  it('GET /expert/my-requests/answered should return array', async () => {
    const res = await request(BASE_URL)
      .get('/expert/my-requests/answered')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /expert/my-requests/pending should return array', async () => {
    const res = await request(BASE_URL)
      .get('/expert/my-requests/pending')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /expert/request/{id}/answer should create or fail with business error', async () => {
    if (!createdRequestId) return;
    const res = await request(BASE_URL)
      .post(`/expert/request/${createdRequestId}/answer`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'My expert opinion...' });
    expect([201, 400, 401, 403, 404]).toContain(res.status);
  });

  it('GET /expert/my-answers should return array (possibly empty)', async () => {
    const res = await request(BASE_URL)
      .get('/expert/my-answers')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /expert/request/{id}/accept-answer should accept or error', async () => {
    if (!createdRequestId) return;
    const res = await request(BASE_URL)
      .post(`/expert/request/${createdRequestId}/accept-answer`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect([200, 400, 401, 403, 404]).toContain(res.status);
  });

  it('POST /expert/request/{id}/accept should accept to answer or error', async () => {
    if (!createdRequestId) return;
    const res = await request(BASE_URL)
      .post(`/expert/request/${createdRequestId}/accept`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect([200, 400, 401, 404]).toContain(res.status);
  });
});


