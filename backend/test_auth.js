const http = require('http');
const path = require('path');
const fs = require('fs');

// Set test env
process.env.PORT = '3099';
process.env.DB_PATH = path.join(__dirname, 'test_database.db');
process.env.JWT_SECRET = 'test-secret-key-123456';
// Clean test db if exists
if (fs.existsSync(process.env.DB_PATH)) {
  fs.unlinkSync(process.env.DB_PATH);
}

// Start backend
require('./server');

function request(method, urlPath, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3099,
      path: urlPath,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...headers
      }
    }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(raw);
          resolve({ status: res.statusCode, headers: res.headers, body: json, raw });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: null, raw });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log('⏳ Waiting for server startup...');
  await new Promise(r => setTimeout(r, 1000));

  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${name}`);
      failed++;
    }
  }

  try {
    // 1. Health check
    console.log('\n--- 1. Health Check ---');
    const health = await request('GET', '/api/health');
    assert(health.status === 200 && health.body.ok === true && health.body.db === 'sqlite', 'GET /api/health returns ok:true, db:sqlite');

    // 2. Signup new user
    console.log('\n--- 2. Signup New User ---');
    const signup1 = await request('POST', '/api/auth/signup', {
      name: 'Test Student',
      email: 'student1@example.com',
      password: 'password123',
      confirmPassword: 'password123'
    });
    assert(signup1.status === 200, 'Signup status 200');
    assert(signup1.body.success === true, 'Signup returns success: true');
    assert(signup1.body.requiresOtp === true, 'Signup returns requiresOtp: true');
    assert(signup1.body.email === 'student1@example.com', 'Signup returns correct email');
    assert(typeof signup1.body.devOtp === 'string' && signup1.body.devOtp.length === 6, 'Signup returns 6-digit devOtp in dev mode');
    const student1Otp = signup1.body.devOtp;

    // 3. Signup duplicate unverified email (should not block, should refresh OTP)
    console.log('\n--- 3. Signup Duplicate Unverified Email ---');
    const signupUnverified = await request('POST', '/api/auth/signup', {
      name: 'Test Student Updated',
      email: 'student1@example.com',
      password: 'newpassword123',
      confirmPassword: 'newpassword123'
    });
    assert(signupUnverified.status === 200, 'Duplicate unverified signup status 200');
    assert(signupUnverified.body.success === true, 'Duplicate unverified returns success: true');
    assert(signupUnverified.body.requiresOtp === true, 'Duplicate unverified returns requiresOtp: true');
    assert(typeof signupUnverified.body.devOtp === 'string', 'Fresh devOtp generated');
    const student1FreshOtp = signupUnverified.body.devOtp;

    // 4. Verify OTP with stale OTP (should fail)
    console.log('\n--- 4. Verify Stale OTP ---');
    const verifyStale = await request('POST', '/api/auth/verify-otp', {
      email: 'student1@example.com',
      otp: student1Otp,
      purpose: 'signup'
    });
    assert(verifyStale.status === 400 && verifyStale.body.success === false, 'Stale OTP rejected');

    // 5. Verify OTP with valid fresh OTP (should succeed)
    console.log('\n--- 5. Verify Fresh OTP ---');
    const verifyFresh = await request('POST', '/api/auth/verify-otp', {
      email: 'student1@example.com',
      otp: student1FreshOtp,
      purpose: 'signup'
    });
    assert(verifyFresh.status === 200 && verifyFresh.body.success === true, 'Verify OTP succeeds');
    assert(typeof verifyFresh.body.token === 'string' && verifyFresh.body.token.length > 10, 'JWT token returned on verify');
    assert(verifyFresh.body.user.email === 'student1@example.com', 'User object returned on verify');
    const token1 = verifyFresh.body.token;

    // 6. Signup duplicate verified email (must return 409 error)
    console.log('\n--- 6. Signup Duplicate Verified Email ---');
    const signupVerified = await request('POST', '/api/auth/signup', {
      name: 'Another Name',
      email: 'student1@example.com',
      password: 'somepassword123',
      confirmPassword: 'somepassword123'
    });
    assert(signupVerified.status === 409 && signupVerified.body.success === false, 'Duplicate verified email returns 409 Conflict');
    assert(signupVerified.body.error.includes('already exists'), 'Error message says email already exists');

    // 7. Login with correct password
    console.log('\n--- 7. Login Correct Credentials ---');
    const loginOk = await request('POST', '/api/auth/login', {
      email: 'student1@example.com',
      password: 'newpassword123'
    });
    assert(loginOk.status === 200 && loginOk.body.success === true, 'Login succeeds');
    assert(typeof loginOk.body.token === 'string', 'Login returns JWT');
    assert(loginOk.body.user.email === 'student1@example.com', 'Login returns user profile');

    // 8. Login with wrong password
    console.log('\n--- 8. Login Incorrect Password ---');
    const loginWrong = await request('POST', '/api/auth/login', {
      email: 'student1@example.com',
      password: 'wrongpassword'
    });
    assert(loginWrong.status === 401 && loginWrong.body.success === false, 'Wrong password returns 401');

    // 9. Login unverified user flow
    console.log('\n--- 9. Login Unverified User Flow ---');
    // Create unverified user
    const signup2 = await request('POST', '/api/auth/signup', {
      name: 'Unverified Student',
      email: 'unverified@example.com',
      password: 'password999',
      confirmPassword: 'password999'
    });
    assert(signup2.status === 200, 'Unverified user created');

    const loginUnverified = await request('POST', '/api/auth/login', {
      email: 'unverified@example.com',
      password: 'password999'
    });
    assert(loginUnverified.status === 200, 'Unverified login returns 200');
    assert(loginUnverified.body.success === true, 'Unverified login returns success: true');
    assert(loginUnverified.body.requiresOtp === true, 'Unverified login returns requiresOtp: true');
    assert(typeof loginUnverified.body.devOtp === 'string', 'Unverified login sends fresh OTP');

    // 10. Resend OTP
    console.log('\n--- 10. Resend OTP ---');
    const resend = await request('POST', '/api/auth/resend-otp', {
      email: 'unverified@example.com',
      purpose: 'signup'
    });
    assert(resend.status === 200 && resend.body.success === true, 'Resend OTP succeeds');
    assert(typeof resend.body.devOtp === 'string', 'Resend OTP returns new devOtp');

    // 11. Forgot password flow
    console.log('\n--- 11. Forgot Password Flow ---');
    const forgot = await request('POST', '/api/auth/forgot-password', {
      email: 'student1@example.com'
    });
    assert(forgot.status === 200 && forgot.body.success === true, 'Forgot password returns 200 success');
    assert(typeof forgot.body.devOtp === 'string', 'Forgot password generates OTP');
    const forgotOtp = forgot.body.devOtp;

    // 12. Reset password flow
    console.log('\n--- 12. Reset Password Flow ---');
    const reset = await request('POST', '/api/auth/reset-password', {
      email: 'student1@example.com',
      otp: forgotOtp,
      newPassword: 'resetpassword123',
      confirmPassword: 'resetpassword123'
    });
    assert(reset.status === 200 && reset.body.success === true, 'Reset password succeeds');

    // 13. Login with reset password
    console.log('\n--- 13. Login with Reset Password ---');
    const loginAfterReset = await request('POST', '/api/auth/login', {
      email: 'student1@example.com',
      password: 'resetpassword123'
    });
    assert(loginAfterReset.status === 200 && loginAfterReset.body.success === true, 'Login with new password succeeds');

    // 14. GET /api/auth/me (Protected route with token)
    console.log('\n--- 14. GET /api/auth/me ---');
    const me = await request('GET', '/api/auth/me', null, {
      Authorization: `Bearer ${loginAfterReset.body.token}`
    });
    assert(me.status === 200 && me.body.success === true && me.body.user.email === 'student1@example.com', 'GET /api/auth/me returns authenticated user');

    // Cleanup
    if (fs.existsSync(process.env.DB_PATH)) {
      fs.unlinkSync(process.env.DB_PATH);
    }

    console.log(`\n========================================`);
    console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
    console.log(`========================================\n`);

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runTests();
