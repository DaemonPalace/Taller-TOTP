// Run: npm test (Node 22.18+ strips TypeScript types natively)
import test from 'node:test';
import assert from 'node:assert';
import { base32Decode, generate, hotp, parseUri, toUri, fromManual } from './totp.ts';

const bytes = (s) => new TextEncoder().encode(s);

test('base32 decode', () => {
  assert.deepStrictEqual(base32Decode('JBSWY3DPEHPK3PXP'), Uint8Array.from([72, 101, 108, 108, 111, 33, 0xde, 0xad, 0xbe, 0xef]));
  assert.deepStrictEqual(base32Decode('mzxw 6ytb-oi======'), bytes('foobar'));
  assert.throws(() => base32Decode('ABC1'), /Invalid Base32/);
});

test('RFC 4226 Appendix D (HOTP)', () => {
  const expected = ['755224', '287082', '359152', '969429', '338314', '254676', '287922', '162583', '399871', '520489'];
  expected.forEach((code, i) => assert.strictEqual(hotp(bytes('12345678901234567890'), i), code));
});

test('RFC 6238 Appendix B (TOTP, SHA1/256/512)', () => {
  const keys = {
    SHA1: bytes('12345678901234567890'),
    SHA256: bytes('12345678901234567890123456789012'),
    SHA512: bytes('1234567890123456789012345678901234567890123456789012345678901234'),
  };
  const vectors = [
    [59, '94287082', '46119246', '90693936'],
    [1111111109, '07081804', '68084774', '25091201'],
    [1111111111, '14050471', '67062674', '99943326'],
    [1234567890, '89005924', '91819424', '93441116'],
    [2000000000, '69279037', '90698825', '38618901'],
    [20000000000, '65353130', '77737706', '47863826'],
  ];
  for (const [t, ...codes] of vectors) {
    ['SHA1', 'SHA256', 'SHA512'].forEach((alg, i) => assert.strictEqual(hotp(keys[alg], Math.floor(t / 30), 8, alg), codes[i]));
  }
});

test('parseUri / toUri', () => {
  const t = parseUri('otpauth://totp/ACME%20Co:john@example.com?secret=JBSWY3DPEHPK3PXP&issuer=ACME%20Co&digits=8&period=60&algorithm=sha256');
  assert.deepStrictEqual(t, { issuer: 'ACME Co', label: 'john@example.com', secret: 'JBSWY3DPEHPK3PXP', algorithm: 'SHA256', digits: 8, period: 60 });
  assert.deepStrictEqual(parseUri(toUri(t)), t);
  assert.strictEqual(parseUri('otpauth://totp/alice?secret=JBSWY3DPEHPK3PXP').issuer, '');
  assert.throws(() => parseUri('otpauth://hotp/x?secret=JBSWY3DPEHPK3PXP&counter=0'), /Not an otpauth/);
  assert.throws(() => parseUri('otpauth://totp/x?secret=JBSW'), /too short/);
  assert.throws(() => parseUri('otpauth://totp/x?secret=JBSWY3DPEHPK3PXP&algorithm=MD5'), /Unsupported/);
  assert.throws(() => parseUri('https://example.com'), /Not an otpauth/);
});

test('generate matches period and digits', () => {
  const t = fromManual('Test', 'alice', 'GEZD GNBV GY3T QOJQ GEZD GNBV GY3T QOJQ'); // "12345678901234567890"
  assert.strictEqual(generate(t, 59_000), '287082');
  assert.strictEqual(generate(t, 1111111109_000), '081804');
});
