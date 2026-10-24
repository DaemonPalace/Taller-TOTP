// TOTP (RFC 6238) server side, built on node:crypto only. SHA1 / 6 digits / 30 s like every major service.
const crypto = require('node:crypto');

const PERIOD = 30;
const DIGITS = 6;
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf) {
  let out = '';
  let bits = 0;
  let value = 0;
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += B32[(value >>> bits) & 31];
    }
    value &= (1 << bits) - 1;
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out; // unpadded, as authenticator apps expect
}

function hotp(key, counter, digits = DIGITS) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', key).update(msg).digest();
  const o = h[h.length - 1] & 0x0f;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 10 ** digits).padStart(digits, '0');
}

const timeStep = (now = Date.now()) => Math.floor(now / 1000 / PERIOD);

// Returns the time step the token matched (current ±window), or null.
function verifyToken(key, token, now = Date.now(), window = 1) {
  const step = timeStep(now);
  for (let d = -window; d <= window; d++) {
    const expected = Buffer.from(hotp(key, step + d));
    const given = Buffer.from(token);
    if (given.length === expected.length && crypto.timingSafeEqual(given, expected)) return step + d;
  }
  return null;
}

function otpauthUri(issuer, account, key) {
  const enc = encodeURIComponent;
  return `otpauth://totp/${enc(issuer)}:${enc(account)}?secret=${base32Encode(key)}` +
    `&issuer=${enc(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${PERIOD}`;
}

const newSecret = () => crypto.randomBytes(20); // 160 bits, RFC 4226 recommendation

module.exports = { base32Encode, hotp, timeStep, verifyToken, otpauthUri, newSecret };
