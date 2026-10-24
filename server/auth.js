// Password hashing, TOTP secret encryption, rate limiting and code checks. node:crypto only.
const crypto = require('node:crypto');
const { verifyToken } = require('./totp');

// --- Passwords: scrypt with a random per-user salt. Stored as "salt:hash" (hex).
const SCRYPT_LEN = 64;

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  return `${salt.toString('hex')}:${crypto.scryptSync(password, salt, SCRYPT_LEN).toString('hex')}`;
}

// Dummy hash so unknown emails take as long as wrong passwords (no user enumeration via timing).
const DUMMY_HASH = hashPassword('dummy-password');

function checkPassword(password, stored = DUMMY_HASH) {
  const [salt, hash] = stored.split(':');
  const actual = crypto.scryptSync(password, Buffer.from(salt, 'hex'), SCRYPT_LEN);
  return crypto.timingSafeEqual(actual, Buffer.from(hash, 'hex'));
}

// --- TOTP secrets are encrypted at rest with AES-256-GCM. Stored as iv(12) | tag(16) | ciphertext.
// The user id is bound as additional authenticated data: a blob copied to another user's row fails to decrypt.
function loadKey(hex = process.env.TOTP_KEY) {
  const key = Buffer.from(hex || '', 'hex');
  if (key.length !== 32) throw new Error('TOTP_KEY must be 64 hex chars (32 bytes): openssl rand -hex 32');
  return key;
}

function encryptSecret(secret, key, userId) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(userId));
  const data = Buffer.concat([cipher.update(secret), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]);
}

function decryptSecret(blob, key, userId) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, blob.subarray(0, 12));
  decipher.setAAD(Buffer.from(userId));
  decipher.setAuthTag(blob.subarray(12, 28));
  return Buffer.concat([decipher.update(blob.subarray(28)), decipher.final()]);
}

// --- Rate limit: max `limit` attempts per `windowMs` per key.
// ponytail: in-memory, per process; move to the DB or Redis if the server is ever scaled out.
const attempts = new Map();

function rateLimited(key, now = Date.now(), limit = 5, windowMs = 60_000) {
  const recent = (attempts.get(key) || []).filter((t) => now - t < windowMs);
  recent.push(now);
  attempts.set(key, recent);
  return recent.length > limit;
}

const resetLimit = (key) => attempts.delete(key);

// Checks a TOTP code for a user row. Returns { step } on success or { error }.
// The caller must still persist `step` atomically (UPDATE ... WHERE totp_last_step < step) to stop races.
function checkCode(userId, secret, lastStep, token, now = Date.now()) {
  if (!/^\d{6}$/.test(token)) return { error: 'Code must be 6 digits' };
  if (rateLimited(`otp:${userId}`, now)) return { error: 'Too many attempts, wait a minute' };
  const step = verifyToken(secret, token, now);
  if (step === null) return { error: 'Invalid code' };
  if (step <= lastStep) return { error: 'Code already used' };
  resetLimit(`otp:${userId}`);
  return { step };
}

module.exports = { hashPassword, checkPassword, loadKey, encryptSecret, decryptSecret, rateLimited, resetLimit, checkCode };
