import request from 'supertest';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

describe('Health API', () => {
  it('should respond 200 on /health or /api/health', async () => {
    const candidates = ['/health', '/api/health'];
    let passed = false;
    for (const path of candidates) {
      try {
        const res = await request(BASE_URL).get(path);
        if (res.status === 200) {
          passed = true;
          break;
        }
      } catch (_) {
        // ignore
      }
    }
    expect(passed).toBe(true);
  });
});


