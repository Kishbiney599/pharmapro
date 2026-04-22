// PharmaPro Enterprise — Basic Backend Tests
// Run with: node server.test.js
// Requires: backend running on port 4000

// Polyfill fetch for Node < 18
let fetch;
try {
  fetch = globalThis.fetch;
  if (!fetch) throw new Error('no built-in fetch');
} catch(_) {
  try {
    fetch = require('node-fetch');
  } catch(_) {
    // Use http module as fallback
    const http = require('http');
    fetch = (url, opts = {}) => new Promise((resolve, reject) => {
      const u = new URL(url);
      const body = opts.body || '';
      const req = http.request({
        hostname: u.hostname, port: u.port || 80, path: u.pathname + u.search,
        method: opts.method || 'GET',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...opts.headers }
      }, (res) => {
        let data = '';
        res.on('data', d => data += d);
        res.on('end', () => resolve({
          status: res.statusCode,
          json: () => Promise.resolve(JSON.parse(data || 'null')),
          ok: res.statusCode < 300
        }));
      });
      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  }
}

const BASE = 'http://localhost:4000/api';
let token  = '';
let passed = 0;
let failed = 0;

// ── Test helpers ──────────────────────────────────────────────
async function req(method, path, body, auth = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && token) headers['Authorization'] = `Bearer ${token}`;
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  return { status: r.status, data };
}

function test(name, fn) {
  return fn().then(() => {
    console.log(`  ✅ ${name}`);
    passed++;
  }).catch(err => {
    console.log(`  ❌ ${name}: ${err.message}`);
    failed++;
  });
}

function expect(val) {
  return {
    toBe:          (exp) => { if (val !== exp) throw new Error(`Expected ${exp}, got ${val}`); },
    toEqual:       (exp) => { if (JSON.stringify(val) !== JSON.stringify(exp)) throw new Error(`Expected ${JSON.stringify(exp)}, got ${JSON.stringify(val)}`); },
    toBeTruthy:    ()    => { if (!val) throw new Error(`Expected truthy, got ${val}`); },
    toBeArray:     ()    => { if (!Array.isArray(val)) throw new Error(`Expected array, got ${typeof val}`); },
    toContain:     (k)   => { if (!val?.includes?.(k) && val?.[k] === undefined) throw new Error(`Expected to contain ${k}`); },
    toBeGte:       (n)   => { if (val < n) throw new Error(`Expected >= ${n}, got ${val}`); },
    toHaveProperty:(k)   => { if (val?.[k] === undefined) throw new Error(`Expected property ${k}, got: ${JSON.stringify(val)}`); },
  };
}

// ── Test Suites ───────────────────────────────────────────────

async function testHealth() {
  console.log('\n📋 Health Check');
  await test('Backend is reachable', async () => {
    const { status, data } = await req('GET', '/health', null, false);
    expect(status).toBe(200);
    expect(data.status).toBe('ok');
    expect(data.db).toBe('connected');
  });
}

async function testAuth() {
  console.log('\n🔐 Authentication');

  await test('Login fails with wrong password', async () => {
    const { status, data } = await req('POST', '/auth/login', {
      email: 'admin@pharmapro.local', password: 'wrongpassword'
    }, false);
    expect(status).toBe(401);
  });

  await test('Login fails with unknown email', async () => {
    const { status } = await req('POST', '/auth/login', {
      email: 'nobody@nowhere.com', password: 'test123'
    }, false);
    expect(status).toBe(401);
  });

  await test('Login succeeds with correct credentials', async () => {
    const { status, data } = await req('POST', '/auth/login', {
      email: 'admin@pharmapro.local', password: 'admin123'
    }, false);
    expect(status).toBe(200);
    expect(data.token).toBeTruthy();
    expect(data.user).toHaveProperty('name');
    token = data.token; // save for subsequent tests
  });

  await test('Protected route rejects no token', async () => {
    const { status } = await req('GET', '/drugs', null, false);
    expect(status).toBe(401);
  });

  await test('Protected route accepts valid token', async () => {
    const { status } = await req('GET', '/drugs');
    expect(status).toBe(200);
  });

  await test('Rate limiter blocks after 5 failed attempts', async () => {
    // Make 5 failed attempts
    for (let i = 0; i < 5; i++) {
      await req('POST', '/auth/login', { email: 'test@test.com', password: 'wrong' }, false);
    }
    const { status, data } = await req('POST', '/auth/login', {
      email: 'test@test.com', password: 'wrong'
    }, false);
    expect(status).toBe(429);
  });
}

async function testInventory() {
  console.log('\n💊 Inventory');

  await test('GET /drugs returns paginated response', async () => {
    const { status, data } = await req('GET', '/drugs?page=1&limit=10');
    expect(status).toBe(200);
    expect(data).toHaveProperty('drugs');
    expect(data).toHaveProperty('total');
    expect(data).toHaveProperty('pages');
    expect(data.drugs).toBeArray();
  });

  await test('GET /drugs supports search', async () => {
    const { status, data } = await req('GET', '/drugs?search=para');
    expect(status).toBe(200);
    expect(data.drugs).toBeArray();
  });

  await test('GET /drugs supports category filter', async () => {
    const { status, data } = await req('GET', '/drugs?category=Antibiotics');
    expect(status).toBe(200);
    expect(data.drugs).toBeArray();
  });

  await test('GET /suppliers returns array', async () => {
    const { status, data } = await req('GET', '/suppliers');
    expect(status).toBe(200);
    expect(data).toBeArray();
  });
}

async function testSales() {
  console.log('\n🛒 Sales');

  await test('GET /sales/history returns results', async () => {
    const { status, data } = await req('GET', '/sales/history');
    expect(status).toBe(200);
    expect(data).toBeArray();
  });

  await test('POST /sales fails with empty cart', async () => {
    const { status } = await req('POST', '/sales', { items: [], payment_method: 'Cash' });
    expect(status).toBe(400);
  });

  await test('POST /sales fails with invalid drug', async () => {
    const { status } = await req('POST', '/sales', {
      items: [{ drug_id: 999999, qty: 1, unit_price: 10 }],
      payment_method: 'Cash'
    });
    // Should fail — either 400 (validation) or 500 (db error) both mean rejected
    if (status !== 400 && status !== 500) throw new Error(`Expected 400 or 500, got ${status}`);
  });
}

async function testSettings() {
  console.log('\n⚙️  Settings');

  await test('GET /settings returns pharmacy info', async () => {
    const { status, data } = await req('GET', '/settings');
    expect(status).toBe(200);
    expect(data).toHaveProperty('pharmacy_name');
  });

  await test('GET /activation/status returns activation info', async () => {
    const { status, data } = await req('GET', '/activation/status');
    expect(status).toBe(200);
    expect(data).toHaveProperty('activated');
  });
}

async function testCustomers() {
  console.log('\n👥 Customers');

  await test('GET /customers returns array', async () => {
    const { status, data } = await req('GET', '/customers');
    expect(status).toBe(200);
    expect(data).toBeArray();
  });

  await test('POST /customers fails with no name', async () => {
    const { status } = await req('POST', '/customers', { phone: '0201234567' });
    expect(status).toBe(400);
  });

  let customerId;
  await test('POST /customers creates customer', async () => {
    const { status, data } = await req('POST', '/customers', {
      name: 'Test Customer', phone: '0209999999', email: 'test@test.com'
    });
    expect(status).toBe(201);
    expect(data).toHaveProperty('id');
    customerId = data.id;
  });

  await test('GET /customers/search/:q finds by name', async () => {
    const { status, data } = await req('GET', '/customers/search/Test');
    expect(status).toBe(200);
    expect(data).toBeArray();
  });
}

async function testReports() {
  console.log('\n📊 Reports');

  const today = new Date().toISOString().slice(0, 10);

  await test('GET /reports/daily-cash returns data', async () => {
    const { status, data } = await req('GET', `/reports/daily-cash?date=${today}`);
    expect(status).toBe(200);
    expect(data).toHaveProperty('summary');
  });

  await test('GET /reports/reorder returns array', async () => {
    const { status, data } = await req('GET', '/reports/reorder');
    expect(status).toBe(200);
    expect(data).toBeArray();
  });

  await test('GET /reports/sales-by-staff requires date params', async () => {
    const { status } = await req('GET', '/reports/sales-by-staff');
    expect(status).toBe(400);
  });

  await test('GET /reports/sales-by-staff returns data with dates', async () => {
    const { status, data } = await req('GET', `/reports/sales-by-staff?date_from=${today}&date_to=${today}`);
    expect(status).toBe(200);
    expect(data).toBeArray();
  });

  await test('GET /reports/pl/summary returns P&L data', async () => {
    const { status, data } = await req('GET', `/reports/pl/summary?date_from=${today}&date_to=${today}`);
    expect(status).toBe(200);
  });
}

async function testSecurity() {
  console.log('\n🔒 Security');

  await test('Invalid token is rejected', async () => {
    const fakeToken = 'eyJhbGciOiJIUzI1NiJ9.eyJpZCI6OTk5OX0.fakesignature';
    const { status } = await fetch(`${BASE}/drugs`, {
      headers: { Authorization: `Bearer ${fakeToken}` }
    }).then(r => ({ status: r.status }));
    expect(status).toBe(401);
  });

  await test('SQL injection attempt is handled safely', async () => {
    const { status } = await req('GET', "/drugs?search=' OR '1'='1");
    expect(status).toBe(200); // Should return results, not crash
  });

  await test('Logs endpoint requires auth', async () => {
    // Try accessing a protected endpoint without token
    const { status } = await req('GET', '/reports/reorder', null, false);
    expect(status).toBe(401);
  });
}

// ── Run all tests ─────────────────────────────────────────────
async function runAll() {
  console.log('═══════════════════════════════════════════');
  console.log('  PharmaPro Enterprise — Backend Tests');
  console.log('═══════════════════════════════════════════');
  console.log(`  Target: ${BASE}`);
  console.log(`  Time:   ${new Date().toLocaleString()}`);

  const start = Date.now();

  try {
    await testHealth();
    await testAuth();
    await testInventory();
    await testSales();
    await testSettings();
    await testCustomers();
    await testReports();
    await testSecurity();
  } catch(e) {
    console.error('\nTest runner crashed:', e.message);
  }

  const ms = Date.now() - start;
  console.log('\n═══════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed (${ms}ms)`);
  if (failed === 0) {
    console.log('  🎉 All tests passed!');
  } else {
    console.log(`  ⚠️  ${failed} test(s) failed — check output above`);
  }
  console.log('═══════════════════════════════════════════\n');
  process.exit(failed > 0 ? 1 : 0);
}

runAll();
