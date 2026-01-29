/**
 * Payment & Subscription API endpoint test script.
 * Runs against running backend (e.g. Docker: localhost:3000).
 * Usage: npx ts-node scripts/test-payment-endpoints.ts
 *        or: docker-compose exec backend npx ts-node scripts/test-payment-endpoints.ts
 * API_BASE_URL=http://localhost:3000 npx ts-node scripts/test-payment-endpoints.ts
 *
 * Uses tuna@tipbox.co by default. omer@tipbox.co is reserved for app-side integration;
 * this script does NOT delete or modify omer@tipbox.co data.
 */
import axios, { AxiosInstance } from 'axios';

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

// Test user (must exist in DB). omer@tipbox.co reserved for app integration - not used here.
const TEST_EMAIL = process.env.TEST_EMAIL || 'tuna@tipbox.co';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'password123';

function log(message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') {
  const colors = { info: '\x1b[36m', success: '\x1b[32m', error: '\x1b[31m', warn: '\x1b[33m', reset: '\x1b[0m' };
  const icons = { info: 'ℹ', success: '✓', error: '✗', warn: '!' };
  console.log(`${colors[type]}[${icons[type]}] ${message}${colors.reset}`);
}

async function login(): Promise<string | null> {
  try {
    log(`Login: ${TEST_EMAIL}`, 'info');
    const res = await axios.post(`${BASE_URL}/auth/login`, { email: TEST_EMAIL, password: TEST_PASSWORD });
    if (res.data?.token) {
      log('Login OK', 'success');
      return res.data.token;
    }
    log('Login: no token in response', 'error');
    return null;
  } catch (e: any) {
    log(`Login failed: ${e.response?.data?.message || e.message}`, 'error');
    if (e.response?.data) console.log(JSON.stringify(e.response.data, null, 2));
    return null;
  }
}

function api(token: string): AxiosInstance {
  return axios.create({
    baseURL: BASE_URL,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
}

async function runTests() {
  log('Payment & Subscription API tests', 'info');
  log(`BASE_URL=${BASE_URL}`, 'info');

  const token = await login();
  if (!token) {
    log('Cannot continue without token. Ensure backend is up and user exists.', 'error');
    process.exit(1);
  }

  const client = api(token);
  let createdCardId: string | null = null;
  let passed = 0;
  let failed = 0;

  // --- GET /users/settings/payment-dashboard ---
  try {
    const r = await client.get('/users/settings/payment-dashboard');
    if (r.status !== 200) throw new Error(`status ${r.status}`);
    if (!('saved_cards' in r.data && 'active_subscription' in r.data && 'recent_invoices' in r.data)) {
      throw new Error('missing keys: saved_cards, active_subscription, recent_invoices');
    }
    log('GET /users/settings/payment-dashboard: 200, shape OK', 'success');
    passed++;
  } catch (e: any) {
    log(`GET /users/settings/payment-dashboard: ${e.response?.data?.message || e.message}`, 'error');
    failed++;
  }

  // --- POST /users/settings/payment-methods ---
  try {
    const r = await client.post('/users/settings/payment-methods', {
      payment_token: 'test-token-' + Date.now(),
      card_alias: 'Test Card',
    });
    if (r.status !== 201) throw new Error(`status ${r.status}`);
    const d = r.data;
    if (!d?.id || !('card_alias' in d) || !('last4' in d) || !('brand' in d)) {
      throw new Error('response missing id, card_alias, last4 or brand');
    }
    createdCardId = d.id;
    log('POST /users/settings/payment-methods: 201, card created', 'success');
    passed++;
  } catch (e: any) {
    log(`POST /users/settings/payment-methods: ${e.response?.data?.message || e.message}`, 'error');
    failed++;
  }

  // --- PATCH /users/settings/payment-methods/:id ---
  if (createdCardId) {
    try {
      const r = await client.patch(`/users/settings/payment-methods/${createdCardId}`, {
        card_alias: 'Updated Card Name',
      });
      if (r.status !== 200) throw new Error(`status ${r.status}`);
      if (r.data?.card_alias !== 'Updated Card Name') throw new Error('card_alias not updated');
      log('PATCH /users/settings/payment-methods/:id: 200, alias updated', 'success');
      passed++;
    } catch (e: any) {
      log(`PATCH /users/settings/payment-methods/:id: ${e.response?.data?.message || e.message}`, 'error');
      failed++;
    }
  } else {
    log('PATCH skipped (no card id)', 'warn');
  }

  // --- GET /users/settings/invoices ---
  try {
    const r = await client.get('/users/settings/invoices', {
      params: { sort_by: 'date_desc', limit: 5, offset: 0 },
    });
    if (r.status !== 200) throw new Error(`status ${r.status}`);
    if (!Array.isArray(r.data)) throw new Error('response is not array');
    log('GET /users/settings/invoices: 200, array OK', 'success');
    passed++;
  } catch (e: any) {
    log(`GET /users/settings/invoices: ${e.response?.data?.message || e.message}`, 'error');
    failed++;
  }

  // --- GET /subscription/plans ---
  try {
    const r = await client.get('/subscription/plans');
    if (r.status !== 200) throw new Error(`status ${r.status}`);
    if (!Array.isArray(r.data)) throw new Error('response is not array');
    log('GET /subscription/plans: 200, array OK', 'success');
    passed++;
  } catch (e: any) {
    log(`GET /subscription/plans: ${e.response?.data?.message || e.message}`, 'error');
    failed++;
  }

  // --- DELETE /users/settings/payment-methods/:id ---
  if (createdCardId) {
    try {
      const r = await client.delete(`/users/settings/payment-methods/${createdCardId}`);
      if (r.status !== 204) throw new Error(`status ${r.status}`);
      log('DELETE /users/settings/payment-methods/:id: 204', 'success');
      passed++;
    } catch (e: any) {
      log(`DELETE /users/settings/payment-methods/:id: ${e.response?.data?.message || e.message}`, 'error');
      failed++;
    }
  }

  // --- 404 for unknown card ---
  try {
    await client.delete('/users/settings/payment-methods/00000000-0000-0000-0000-000000000000');
    log('DELETE unknown card: expected 404, got 2xx', 'error');
    failed++;
  } catch (e: any) {
    if (e.response?.status === 404) {
      log('DELETE unknown card: 404 as expected', 'success');
      passed++;
    } else {
      log(`DELETE unknown card: ${e.response?.status || e.message}`, 'error');
      failed++;
    }
  }

  log(`\nResult: ${passed} passed, ${failed} failed`, failed ? 'warn' : 'success');
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
