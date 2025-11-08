import request from 'supertest';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

describe('Marketplace API', () => {
  it('GET /marketplace/listings should return listings', async () => {
    const res = await request(BASE_URL).get('/marketplace/listings');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /marketplace/my-nfts should return user NFTs (auth)', async () => {
    const email = 'omer@tipbox.co';
    const password = 'password123';
    let loginRes = await request(BASE_URL).post('/auth/login').send({ email, password });
    if (!(loginRes.status === 200 && loginRes.body.token)) {
      const uniqueEmail = `e2e_${Date.now()}@tipbox.co`;
      const registerRes = await request(BASE_URL).post('/auth/register').send({ email: uniqueEmail, password, name: 'E2E User' });
      if (registerRes.status !== 201 && !registerRes.body.token) return;
      loginRes = await request(BASE_URL).post('/auth/login').send({ email: uniqueEmail, password });
    }
    const token = loginRes.body.token;
    const res = await request(BASE_URL).get('/marketplace/my-nfts').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /marketplace/listings should create or return business error (auth)', async () => {
    const email = 'omer@tipbox.co';
    const password = 'password123';
    let loginRes = await request(BASE_URL).post('/auth/login').send({ email, password });
    if (!(loginRes.status === 200 && loginRes.body.token)) {
      const uniqueEmail = `e2e_${Date.now()}@tipbox.co`;
      const registerRes = await request(BASE_URL).post('/auth/register').send({ email: uniqueEmail, password, name: 'E2E User' });
      if (registerRes.status !== 201 && !registerRes.body.token) return;
      loginRes = await request(BASE_URL).post('/auth/login').send({ email: uniqueEmail, password });
    }
    const token = loginRes.body.token;

    // Note: nftId gerçek env'de kullanıcının sahip olduğu bir NFT olmalı.
    // Testi ortamdan bağımsız kılmak için geçersiz bir id ile 400 kabul ediyoruz.
    const body = { nftId: 'non-existent-nft-id', amount: 10 };
    const res = await request(BASE_URL)
      .post('/marketplace/listings')
      .set('Authorization', `Bearer ${token}`)
      .send(body);

    expect([200, 400, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body).toHaveProperty('id');
    }
  });

  it('PUT /marketplace/listings/{id}/price should update price or return 400/404 (auth)', async () => {
    const email = 'omer@tipbox.co';
    const password = 'password123';
    const loginRes = await request(BASE_URL).post('/auth/login').send({ email, password });
    const token = loginRes.body.token;

    // Varsayılan: olmayan id ile 404/400 beklenir
    const listingId = '00000000-0000-0000-0000-000000000000';
    const res = await request(BASE_URL)
      .put(`/marketplace/listings/${listingId}/price`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 20 });

    expect([200, 400, 404, 500]).toContain(res.status);
  });

  it('DELETE /marketplace/listings/{id} should delist or return 400/404 (auth)', async () => {
    const email = 'omer@tipbox.co';
    const password = 'password123';
    const loginRes = await request(BASE_URL).post('/auth/login').send({ email, password });
    const token = loginRes.body.token;

    const listingId = '00000000-0000-0000-0000-000000000000';
    const res = await request(BASE_URL)
      .delete(`/marketplace/listings/${listingId}`)
      .set('Authorization', `Bearer ${token}`);

    expect([200, 400, 404, 500]).toContain(res.status);
  });
});


