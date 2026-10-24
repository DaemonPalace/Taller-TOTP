const test = require('node:test');
const assert = require('node:assert');
const { base32Encode, hotp, timeStep, otpauthUri, newSecret } = require('./totp');
const crypto = require('node:crypto');
const { hashPassword, checkPassword, encryptSecret, decryptSecret, checkCode, rateLimited } = require('./auth');

test('base32 encode (RFC 4648 vectors)', () => {
  const vectors = { '': '', f: 'MY', fo: 'MZXQ', foo: 'MZXW6', foob: 'MZXW6YQ', fooba: 'MZXW6YTB', foobar: 'MZXW6YTBOI' };
  for (const [plain, b32] of Object.entries(vectors)) assert.strictEqual(base32Encode(Buffer.from(plain)), b32);
  assert.strictEqual(base32Encode(Buffer.from('12345678901234567890')), 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
});

test('RFC 4226 Appendix D (HOTP)', () => {
  const expected = ['755224', '287082', '359152', '969429', '338314', '254676', '287922', '162583', '399871', '520489'];
  expected.forEach((code, i) => assert.strictEqual(hotp(Buffer.from('12345678901234567890'), i), code));
});

test('RFC 6238 Appendix B (TOTP, SHA1, 8 digits)', () => {
  const key = Buffer.from('12345678901234567890');
  const vectors = { 59: '94287082', 1111111109: '07081804', 1111111111: '14050471', 1234567890: '89005924', 2000000000: '69279037', 20000000000: '65353130' };
  for (const [t, code] of Object.entries(vectors)) assert.strictEqual(hotp(key, timeStep(t * 1000), 8), code);
});

test('otpauth URI', () => {
  assert.strictEqual(
    otpauthUri('Taller MFA', 'alice@x.com', Buffer.from('12345678901234567890')),
    'otpauth://totp/Taller%20MFA:alice%40x.com?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=Taller%20MFA&algorithm=SHA1&digits=6&period=30',
  );
});

test('checkCode: drift window, replay, wrong code, brute force', () => {
  const secret = newSecret();
  const prev = hotp(secret, timeStep() - 1);
  const code = hotp(secret, timeStep());
  const wrong = [code, prev].includes('000000') ? '111111' : '000000';

  const ok = checkCode('u1', secret, -1, prev); // previous step accepted (clock drift)
  assert.ok(ok.step);
  assert.strictEqual(checkCode('u1', secret, ok.step, prev).error, 'Code already used');
  assert.strictEqual(checkCode('u1', secret, ok.step, code).step, ok.step + 1);
  assert.strictEqual(checkCode('u1', secret, -1, 'abc').error, 'Code must be 6 digits');
  for (let i = 0; i < 5; i++) assert.strictEqual(checkCode('u1', secret, -1, wrong).error, 'Invalid code');
  assert.strictEqual(checkCode('u1', secret, -1, code).error, 'Too many attempts, wait a minute');
});

test('passwords', () => {
  const h = hashPassword('correct horse');
  assert.notStrictEqual(h, hashPassword('correct horse')); // random salt
  assert.strictEqual(checkPassword('correct horse', h), true);
  assert.strictEqual(checkPassword('wrong horse', h), false);
  assert.strictEqual(checkPassword('anything'), false); // unknown user path
});

test('secret encryption', () => {
  const key = crypto.randomBytes(32);
  const secret = newSecret();
  const blob = encryptSecret(secret, key, 'user-a');
  assert.deepStrictEqual(decryptSecret(blob, key, 'user-a'), secret);
  assert.throws(() => decryptSecret(blob, key, 'user-b')); // blob moved to another user's row
  blob[blob.length - 1] ^= 1;
  assert.throws(() => decryptSecret(blob, key, 'user-a')); // tampering detected by GCM tag
});

test('rate limit window', () => {
  for (let i = 0; i < 5; i++) assert.strictEqual(rateLimited('k', 1000), false);
  assert.strictEqual(rateLimited('k', 1000), true);
  assert.strictEqual(rateLimited('k', 62_000), false); // old attempts expired
});

test('server codes match the app implementation', async () => {
  const { parseUri, generate } = await import('../app/totp.ts');
  for (let i = 0; i < 100; i++) {
    const key = newSecret();
    const now = Date.now() + i * 30_000;
    assert.strictEqual(generate(parseUri(otpauthUri('S', 'u', key)), now), hotp(key, timeStep(now)));
  }
});
