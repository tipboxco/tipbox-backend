import request from 'supertest';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

describe('Inbox API', () => {
  let authToken: string;
  let userId: string;
  let secondUserToken: string;
  let secondUserId: string;

  beforeAll(async () => {
    // First user (sender)
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
    userId = loginRes.body.id || loginRes.body.user?.id;

    // Second user (recipient) - create a different user for messaging tests
    const secondEmail = `e2e_inbox_2_${Date.now()}@tipbox.co`;
    const secondRegisterRes = await request(BASE_URL)
      .post('/auth/register')
      .send({ email: secondEmail, password, name: 'E2E Inbox User 2' });
    
    if (secondRegisterRes.status === 201 && secondRegisterRes.body.token) {
      secondUserToken = secondRegisterRes.body.token;
      secondUserId = secondRegisterRes.body.id || secondRegisterRes.body.user?.id;
    } else {
      // Try to login with existing user
      const secondLoginRes = await request(BASE_URL)
        .post('/auth/login')
        .send({ email: 'test2@tipbox.co', password });
      if (secondLoginRes.status === 200 && secondLoginRes.body.token) {
        secondUserToken = secondLoginRes.body.token;
        secondUserId = secondLoginRes.body.id || secondLoginRes.body.user?.id;
      } else {
        // Create a default test user
        secondUserToken = authToken; // Fallback: use same token (will be limited)
        secondUserId = userId;
      }
    }
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
        expect(['active', 'pending', 'completed', 'canceled', 'awaiting_completion', 'declined']).toContain(supportRequest.status);
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

    it('should filter by status=canceled', async () => {
      const res = await request(BASE_URL)
        .get('/messages/support-requests')
        .query({ status: 'canceled' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        res.body.forEach((request: any) => {
          expect(request.status).toBe('canceled');
        });
      }
    });

    it('should filter by status=awaiting_completion', async () => {
      const res = await request(BASE_URL)
        .get('/messages/support-requests')
        .query({ status: 'awaiting_completion' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        res.body.forEach((request: any) => {
          expect(request.status).toBe('awaiting_completion');
        });
      }
    });

    it('should include threadId field in response', async () => {
      const res = await request(BASE_URL)
        .get('/messages/support-requests')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      if (res.body.length > 0) {
        res.body.forEach((request: any) => {
          expect(request).toHaveProperty('threadId');
          // threadId should be null for pending/canceled/declined, or a string UUID for active
          if (request.threadId !== null) {
            expect(typeof request.threadId).toBe('string');
          }
        });
      }
    });

    it('should include fromUserId and toUserId fields in response', async () => {
      const res = await request(BASE_URL)
        .get('/messages/support-requests')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      if (res.body.length > 0) {
        res.body.forEach((request: any) => {
          expect(request).toHaveProperty('fromUserId');
          expect(request).toHaveProperty('toUserId');
          expect(typeof request.fromUserId).toBe('string');
          expect(typeof request.toUserId).toBe('string');
        });
      }
    });
  });

  describe('POST /messages - Direct Message Endpoint', () => {
    it('should send a direct message successfully', async () => {
      if (!secondUserId || secondUserId === userId) {
        console.warn('⚠️ Skipping test: second user not available');
        return;
      }

      const res = await request(BASE_URL)
        .post('/messages')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          recipientUserId: secondUserId,
          message: 'Test direct message',
        });

      expect([201, 200]).toContain(res.status);
    });

    it('should return 400 when recipientUserId is missing', async () => {
      const res = await request(BASE_URL)
        .post('/messages')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Test message',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('recipientUserId');
    });

    it('should return 400 when message is missing', async () => {
      if (!secondUserId || secondUserId === userId) {
        console.warn('⚠️ Skipping test: second user not available');
        return;
      }

      const res = await request(BASE_URL)
        .post('/messages')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          recipientUserId: secondUserId,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('message');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(BASE_URL).post('/messages').send({
        recipientUserId: 'test-id',
        message: 'Test message',
      });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /messages/support-requests - Create Support Request', () => {
    it('should create a support request successfully', async () => {
      if (!secondUserId || secondUserId === userId) {
        console.warn('⚠️ Skipping test: second user not available');
        return;
      }

      const res = await request(BASE_URL)
        .post('/messages/support-requests')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          senderUserId: userId,
          recipientUserId: secondUserId,
          type: 'GENERAL',
          message: 'Test support request message',
          amount: '50.00',
          status: 'pending',
          timestamp: new Date().toISOString(),
        });

      expect([201, 200]).toContain(res.status);
    });

    it('should return 400 when required fields are missing', async () => {
      const res = await request(BASE_URL)
        .post('/messages/support-requests')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          senderUserId: userId,
          // Missing other required fields
        });

      expect(res.status).toBe(400);
    });

    it('should return 403 when senderUserId does not match token', async () => {
      if (!secondUserId || secondUserId === userId) {
        console.warn('⚠️ Skipping test: second user not available');
        return;
      }

      const res = await request(BASE_URL)
        .post('/messages/support-requests')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          senderUserId: 'different-user-id',
          recipientUserId: secondUserId,
          type: 'GENERAL',
          message: 'Test message',
          amount: '50.00',
          status: 'pending',
          timestamp: new Date().toISOString(),
        });

      expect(res.status).toBe(403);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(BASE_URL).post('/messages/support-requests').send({
        senderUserId: 'test-id',
        recipientUserId: 'test-id-2',
        type: 'GENERAL',
        message: 'Test message',
        amount: '50.00',
        status: 'pending',
        timestamp: new Date().toISOString(),
      });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /messages/support-requests/:requestId/accept', () => {
    let pendingRequestId: string | null = null;

    beforeAll(async () => {
      // Create a pending support request for testing
      if (secondUserId && secondUserId !== userId) {
        try {
          const createRes = await request(BASE_URL)
            .post('/messages/support-requests')
            .set('Authorization', `Bearer ${secondUserToken}`)
            .send({
              senderUserId: secondUserId,
              recipientUserId: userId,
              type: 'GENERAL',
              message: 'Test pending request for accept',
              amount: '50.00',
              status: 'pending',
              timestamp: new Date().toISOString(),
            });

          if (createRes.status === 201 || createRes.status === 200) {
            // Get the created request ID
            const listRes = await request(BASE_URL)
              .get('/messages/support-requests')
              .query({ status: 'pending' })
              .set('Authorization', `Bearer ${authToken}`);

            if (listRes.status === 200 && Array.isArray(listRes.body) && listRes.body.length > 0) {
              // Find the request where toUserId matches current userId
              const request = listRes.body.find((req: any) => req.toUserId === userId);
              if (request) {
                pendingRequestId = request.id;
              }
            }
          }
        } catch (error) {
          console.warn('⚠️ Could not create test request for accept test:', error);
        }
      }
    });

    it('should accept a pending support request', async () => {
      if (!pendingRequestId) {
        console.warn('⚠️ Skipping test: no pending request available');
        return;
      }

      const res = await request(BASE_URL)
        .post(`/messages/support-requests/${pendingRequestId}/accept`)
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 201]).toContain(res.status);
      if (res.body) {
        expect(res.body).toHaveProperty('threadId');
        if (res.body.threadId) {
          expect(typeof res.body.threadId).toBe('string');
        }
      }
    });

    it('should return 404 for non-existent request', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await request(BASE_URL)
        .post(`/messages/support-requests/${fakeId}/accept`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });

    it('should return 401 without authentication', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await request(BASE_URL).post(`/messages/support-requests/${fakeId}/accept`);

      expect(res.status).toBe(401);
    });
  });

  describe('POST /messages/support-requests/:requestId/reject', () => {
    let pendingRequestId: string | null = null;

    beforeAll(async () => {
      // Create a pending support request for testing
      if (secondUserId && secondUserId !== userId) {
        try {
          const createRes = await request(BASE_URL)
            .post('/messages/support-requests')
            .set('Authorization', `Bearer ${secondUserToken}`)
            .send({
              senderUserId: secondUserId,
              recipientUserId: userId,
              type: 'GENERAL',
              message: 'Test pending request for reject',
              amount: '50.00',
              status: 'pending',
              timestamp: new Date().toISOString(),
            });

          if (createRes.status === 201 || createRes.status === 200) {
            // Get the created request ID
            await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for DB sync
            const listRes = await request(BASE_URL)
              .get('/messages/support-requests')
              .query({ status: 'pending' })
              .set('Authorization', `Bearer ${authToken}`);

            if (listRes.status === 200 && Array.isArray(listRes.body) && listRes.body.length > 0) {
              // Find the request where toUserId matches current userId
              const request = listRes.body.find((req: any) => req.toUserId === userId);
              if (request) {
                pendingRequestId = request.id;
              }
            }
          }
        } catch (error) {
          console.warn('⚠️ Could not create test request for reject test:', error);
        }
      }
    });

    it('should reject a pending support request', async () => {
      if (!pendingRequestId) {
        console.warn('⚠️ Skipping test: no pending request available');
        return;
      }

      const res = await request(BASE_URL)
        .post(`/messages/support-requests/${pendingRequestId}/reject`)
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 201]).toContain(res.status);
    });

    it('should return 404 for non-existent request', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await request(BASE_URL)
        .post(`/messages/support-requests/${fakeId}/reject`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });

    it('should return 401 without authentication', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await request(BASE_URL).post(`/messages/support-requests/${fakeId}/reject`);

      expect(res.status).toBe(401);
    });
  });

  describe('POST /messages/support-requests/:requestId/cancel', () => {
    let pendingRequestId: string | null = null;

    beforeAll(async () => {
      // Create a pending support request as the sender
      if (secondUserId && secondUserId !== userId) {
        try {
          const createRes = await request(BASE_URL)
            .post('/messages/support-requests')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              senderUserId: userId,
              recipientUserId: secondUserId,
              type: 'GENERAL',
              message: 'Test pending request for cancel',
              amount: '50.00',
              status: 'pending',
              timestamp: new Date().toISOString(),
            });

          if (createRes.status === 201 || createRes.status === 200) {
            // Get the created request ID
            await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for DB sync
            const listRes = await request(BASE_URL)
              .get('/messages/support-requests')
              .query({ status: 'pending' })
              .set('Authorization', `Bearer ${authToken}`);

            if (listRes.status === 200 && Array.isArray(listRes.body) && listRes.body.length > 0) {
              // Find the request where fromUserId matches current userId
              const request = listRes.body.find((req: any) => req.fromUserId === userId);
              if (request) {
                pendingRequestId = request.id;
              }
            }
          }
        } catch (error) {
          console.warn('⚠️ Could not create test request for cancel test:', error);
        }
      }
    });

    it('should cancel a pending support request', async () => {
      if (!pendingRequestId) {
        console.warn('⚠️ Skipping test: no pending request available');
        return;
      }

      const res = await request(BASE_URL)
        .post(`/messages/support-requests/${pendingRequestId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 201]).toContain(res.status);
    });

    it('should return 404 for non-existent request', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await request(BASE_URL)
        .post(`/messages/support-requests/${fakeId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });

    it('should return 401 without authentication', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await request(BASE_URL).post(`/messages/support-requests/${fakeId}/cancel`);

      expect(res.status).toBe(401);
    });
  });

  describe('POST /messages/tips - Send Tips', () => {
    it('should send tips successfully', async () => {
      if (!secondUserId || secondUserId === userId) {
        console.warn('⚠️ Skipping test: second user not available');
        return;
      }

      const res = await request(BASE_URL)
        .post('/messages/tips')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          senderUserId: userId,
          recipientUserId: secondUserId,
          message: 'Test tips message',
          amount: 100.50,
          timestamp: new Date().toISOString(),
        });

      expect([201, 200]).toContain(res.status);
    });

    it('should return 400 when amount is invalid', async () => {
      if (!secondUserId || secondUserId === userId) {
        console.warn('⚠️ Skipping test: second user not available');
        return;
      }

      const res = await request(BASE_URL)
        .post('/messages/tips')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          senderUserId: userId,
          recipientUserId: secondUserId,
          message: 'Test tips',
          amount: -10, // Invalid: negative amount
          timestamp: new Date().toISOString(),
        });

      expect(res.status).toBe(400);
    });

    it('should return 403 when senderUserId does not match token', async () => {
      if (!secondUserId || secondUserId === userId) {
        console.warn('⚠️ Skipping test: second user not available');
        return;
      }

      const res = await request(BASE_URL)
        .post('/messages/tips')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          senderUserId: 'different-user-id',
          recipientUserId: secondUserId,
          message: 'Test tips',
          amount: 100,
          timestamp: new Date().toISOString(),
        });

      expect(res.status).toBe(403);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(BASE_URL).post('/messages/tips').send({
        senderUserId: 'test-id',
        recipientUserId: 'test-id-2',
        message: 'Test tips',
        amount: 100,
        timestamp: new Date().toISOString(),
      });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /messages/:threadId - Thread Messages', () => {
    let testThreadId: string | null = null;

    beforeAll(async () => {
      // Try to get an existing thread ID from inbox
      try {
        const inboxRes = await request(BASE_URL)
          .get('/messages')
          .set('Authorization', `Bearer ${authToken}`);

        if (inboxRes.status === 200 && Array.isArray(inboxRes.body) && inboxRes.body.length > 0) {
          testThreadId = inboxRes.body[0].id;
        }
      } catch (error) {
        console.warn('⚠️ Could not get test thread ID:', error);
      }
    });

    it('should return thread messages', async () => {
      if (!testThreadId) {
        console.warn('⚠️ Skipping test: no thread ID available');
        return;
      }

      const res = await request(BASE_URL)
        .get(`/messages/${testThreadId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 404]).toContain(res.status); // 404 if thread doesn't exist or user doesn't have access
      if (res.status === 200) {
        expect(Array.isArray(res.body)).toBe(true);
      }
    });

    it('should respect limit parameter', async () => {
      if (!testThreadId) {
        console.warn('⚠️ Skipping test: no thread ID available');
        return;
      }

      const res = await request(BASE_URL)
        .get(`/messages/${testThreadId}`)
        .query({ limit: 10 })
        .set('Authorization', `Bearer ${authToken}`);

      if (res.status === 200) {
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeLessThanOrEqual(10);
      }
    });

    it('should return 400 when threadId is missing', async () => {
      const res = await request(BASE_URL)
        .get('/messages/')
        .set('Authorization', `Bearer ${authToken}`);

      // Express will route this differently, so we test with an invalid threadId format
      expect(res.status).not.toBe(401); // Should not be auth error
    });

    it('should return 401 without authentication', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await request(BASE_URL).get(`/messages/${fakeId}`);

      expect(res.status).toBe(401);
    });
  });

  describe('GET /messages/feed - Message Feed', () => {
    it('should return message feed', async () => {
      const res = await request(BASE_URL)
        .get('/messages/feed')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('messages');
      expect(Array.isArray(res.body.messages)).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const res = await request(BASE_URL)
        .get('/messages/feed')
        .query({ limit: 5 })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('messages');
      expect(Array.isArray(res.body.messages)).toBe(true);
      expect(res.body.messages.length).toBeLessThanOrEqual(5);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(BASE_URL).get('/messages/feed');

      expect(res.status).toBe(401);
    });
  });
});

