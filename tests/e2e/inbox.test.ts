import request from 'supertest';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

describe('Inbox API', () => {
  let authToken: string;

  beforeAll(async () => {
    const email = 'omer@tipbox.co';
    const password = 'password123';
    let loginRes = await request(BASE_URL).post('/auth/login').send({ email, password });
    if (!(loginRes.status === 200 && loginRes.body.token)) {
      const uniqueEmail = `e2e_inbox_${Date.now()}@tipbox.co`;
      const registerRes = await request(BASE_URL)
        .post('/auth/register')
        .send({ email: uniqueEmail, password, name: 'E2E Inbox User' });
      if (registerRes.status !== 201 && !registerRes.body.token) {
        throw new Error('Failed to register test user');
      }
      loginRes = await request(BASE_URL).post('/auth/login').send({ email: uniqueEmail, password });
    }
    authToken = loginRes.body.token;
  });

  describe('GET /messages - Messages Endpoint', () => {
    it('should return 200 and array of inbox messages', async () => {
      const res = await request(BASE_URL)
        .get('/messages')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should return messages with correct structure', async () => {
      const res = await request(BASE_URL)
        .get('/messages')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      if (res.body.length > 0) {
        const message = res.body[0];
        expect(message).toHaveProperty('id');
        expect(message).toHaveProperty('senderName');
        expect(message).toHaveProperty('senderTitle');
        expect(message).toHaveProperty('senderAvatar');
        expect(message).toHaveProperty('lastMessage');
        expect(message).toHaveProperty('timestamp');
        expect(message).toHaveProperty('isUnread');
        expect(message).toHaveProperty('unreadCount');
        expect(typeof message.id).toBe('string');
        expect(typeof message.senderName).toBe('string');
        expect(typeof message.isUnread).toBe('boolean');
        expect(typeof message.unreadCount).toBe('number');
      }
    });

    it('should filter by search query', async () => {
      const res = await request(BASE_URL)
        .get('/messages')
        .query({ search: 'test' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should filter by unreadOnly', async () => {
      const res = await request(BASE_URL)
        .get('/messages')
        .query({ unreadOnly: true })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // If there are results, all should be unread
      if (res.body.length > 0) {
        res.body.forEach((message: any) => {
          expect(message.isUnread).toBe(true);
        });
      }
    });

    it('should respect limit parameter', async () => {
      const res = await request(BASE_URL)
        .get('/messages')
        .query({ limit: 5 })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeLessThanOrEqual(5);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(BASE_URL).get('/messages');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /messages/support-requests - 1-On-1 Support Request Endpoint', () => {
    it('should return 200 and array of support requests', async () => {
      const res = await request(BASE_URL)
        .get('/messages/support-requests')
        .set('Authorization', `Bearer ${authToken}`);

      if (res.status !== 200) {
        console.error('Error response:', res.status, res.body);
      }
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should return support requests with correct structure', async () => {
      const res = await request(BASE_URL)
        .get('/messages/support-requests')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      if (res.body.length > 0) {
        const supportRequest = res.body[0];
        expect(supportRequest).toHaveProperty('id');
        expect(supportRequest).toHaveProperty('userName');
        expect(supportRequest).toHaveProperty('userTitle');
        expect(supportRequest).toHaveProperty('userAvatar');
        expect(supportRequest).toHaveProperty('requestDescription');
        expect(supportRequest).toHaveProperty('status');
        expect(typeof supportRequest.id).toBe('string');
        expect(typeof supportRequest.userName).toBe('string');
        expect(typeof supportRequest.requestDescription).toBe('string');
        expect(typeof supportRequest.status).toBe('string');
        expect(['active', 'pending', 'completed']).toContain(supportRequest.status);
      }
    });

    it('should filter by status=active', async () => {
      const res = await request(BASE_URL)
        .get('/messages/support-requests')
        .query({ status: 'active' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        res.body.forEach((request: any) => {
          expect(request.status).toBe('active');
        });
      }
    });

    it('should filter by status=pending', async () => {
      const res = await request(BASE_URL)
        .get('/messages/support-requests')
        .query({ status: 'pending' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        res.body.forEach((request: any) => {
          expect(request.status).toBe('pending');
        });
      }
    });

    it('should filter by status=completed', async () => {
      const res = await request(BASE_URL)
        .get('/messages/support-requests')
        .query({ status: 'completed' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        res.body.forEach((request: any) => {
          expect(request.status).toBe('completed');
        });
      }
    });

    it('should filter by search query', async () => {
      const res = await request(BASE_URL)
        .get('/messages/support-requests')
        .query({ search: 'test' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const res = await request(BASE_URL)
        .get('/messages/support-requests')
        .query({ limit: 10 })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeLessThanOrEqual(10);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(BASE_URL).get('/messages/support-requests');
      expect(res.status).toBe(401);
    });

    it('should ignore invalid status values', async () => {
      const res = await request(BASE_URL)
        .get('/messages/support-requests')
        .query({ status: 'invalid_status' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Should return all requests when invalid status is provided
    });
  });
});

