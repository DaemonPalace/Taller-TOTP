// TOTP (RFC 6238) on top of HOTP (RFC 4226). Only the hash primitives come from a library.
import { hmac } from '@noble/hashes/hmac.js';
import { sha1 } from '@noble/hashes/legacy.js';
import { sha256, sha512 } from '@noble/hashes/sha2.js';

const HASHES = { SHA1: sha1, SHA256: sha256, SHA512: sha512 };
export type Algorithm = keyof typeof HASHES;

export type Totp = {
  issuer: string;
  label: string;
  secret: string; // Base32, normalized (uppercase, no padding/spaces)
  algorithm: Algorithm;
  digits: number;
  period: number; // seconds
};

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Decode(input: string): Uint8Array {
  const clean = input.replace(/[\s-]/g, '').replace(/=+$/, '').toUpperCase();
  const out: number[] = [];
  let bits = 0;
  let value = 0;
  for (const c of clean) {
    const i = B32.indexOf(c);
    if (i < 0) throw new Error(`Invalid Base32 character "${c}"`);
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
      value &= (1 << bits) - 1; // keep only unread bits so value never overflows
    }
  }
  return Uint8Array.from(out);
}

export function hotp(key: Uint8Array, counter: number, digits = 6, algorithm: Algorithm = 'SHA1'): string {
  // 8-byte big-endian counter; split in two 32-bit halves to avoid BigInt.
  const msg = new Uint8Array(8);
  const view = new DataView(msg.buffer);
  view.setUint32(0, Math.floor(counter / 2 ** 32));
  view.setUint32(4, counter >>> 0);

  const h = hmac(HASHES[algorithm], key, msg);
  // Dynamic truncation (RFC 4226 section 5.3)
  const o = h[h.length - 1] & 0x0f;
  const bin = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return (bin % 10 ** digits).toString().padStart(digits, '0');
}

export function generate(t: Totp, now = Date.now()): string {
  return hotp(base32Decode(t.secret), Math.floor(now / 1000 / t.period), t.digits, t.algorithm);
}

export function secondsLeft(period: number, now = Date.now()): number {
  return period - (Math.floor(now / 1000) % period);
}

function validate(t: Totp): Totp {
  if (base32Decode(t.secret).length < 10) throw new Error('Secret too short (min 80 bits)');
  if (!(t.algorithm in HASHES)) throw new Error(`Unsupported algorithm ${t.algorithm}`);
  if (![6, 7, 8].includes(t.digits)) throw new Error('Digits must be 6, 7 or 8');
  if (!Number.isInteger(t.period) || t.period < 1) throw new Error('Invalid period');
  return t;
}

// Parses otpauth://totp/Issuer:account?secret=...&issuer=...&algorithm=...&digits=...&period=...
// Manual parsing: React Native's URL implementation lacks reliable searchParams support.
export function parseUri(uri: string): Totp {
  const m = /^otpauth:\/\/totp\/([^?]*)\?(.*)$/i.exec(uri.trim());
  if (!m) throw new Error('Not an otpauth://totp URI');

  const params: Record<string, string> = {};
  for (const pair of m[2].split('&')) {
    const eq = pair.indexOf('=');
    if (eq > 0) params[pair.slice(0, eq).toLowerCase()] = decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, ' '));
  }

  const path = decodeURIComponent(m[1]);
  const colon = path.indexOf(':');
  const label = (colon >= 0 ? path.slice(colon + 1) : path).trim();
  const issuer = params.issuer ?? (colon >= 0 ? path.slice(0, colon).trim() : '');
  if (!params.secret) throw new Error('Missing secret');

  return validate({
    issuer,
    label,
    secret: params.secret.replace(/[\s=-]/g, '').toUpperCase(),
    algorithm: (params.algorithm ?? 'SHA1').toUpperCase() as Algorithm,
    digits: Number(params.digits ?? 6),
    period: Number(params.period ?? 30),
  });
}

export function toUri(t: Totp): string {
  const enc = encodeURIComponent;
  const path = t.issuer ? `${enc(t.issuer)}:${enc(t.label)}` : enc(t.label);
  const issuer = t.issuer ? `&issuer=${enc(t.issuer)}` : '';
  return `otpauth://totp/${path}?secret=${t.secret}${issuer}&algorithm=${t.algorithm}&digits=${t.digits}&period=${t.period}`;
}

// Account from a manually typed setup key, with the defaults every major service uses.
export function fromManual(issuer: string, label: string, key: string): Totp {
  const secret = key.replace(/[\s=-]/g, '').toUpperCase();
  return validate({ issuer, label: label || 'account', secret, algorithm: 'SHA1', digits: 6, period: 30 });
}
