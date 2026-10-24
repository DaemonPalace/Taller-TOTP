const crypto = require('node:crypto');
const express = require('express');
const QRCode = require('qrcode');
const { Pool } = require('pg');
const { base32Encode, newSecret, otpauthUri } = require('./totp');
const { hashPassword, checkPassword, loadKey, encryptSecret, decryptSecret, rateLimited, resetLimit, checkCode } = require('./auth');
const ui = require('./ui');

const ISSUER = 'TallerMFA';
const PORT = process.env.PORT || 3000;
const KEY = loadKey();
const db = new Pool({ connectionString: process.env.DATABASE_URL });

const SCHEMA = `
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  totp_secret bytea not null,
  totp_enabled boolean not null default false,
  totp_last_step bigint not null default -1,
  created_at timestamptz not null default now()
)`;

// --- Sessions. stage: 'setup' (password ok, must enroll TOTP) | 'otp' (password ok, must enter code) | 'full'
// ponytail: in-memory sessions, everyone is logged out on restart; store in a sessions table if that matters.
const sessions = new Map();
const SESSION_MS = 60 * 60 * 1000;

// `extra` carries what the dashboard shows about how this session was verified (passwordAt, codeAt, step).
function startSession(req, res, userId, stage, extra = {}) {
  if (req.sid) sessions.delete(req.sid); // new id on every stage change: prevents session fixation
  const sid = crypto.randomBytes(32).toString('base64url');
  sessions.set(sid, { userId, stage, expires: Date.now() + SESSION_MS, ...extra });
  res.setHeader('Set-Cookie', `sid=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MS / 1000}`);
}

function endSession(req, res) {
  sessions.delete(req.sid);
  res.setHeader('Set-Cookie', 'sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
}

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use((req, res, next) => {
  req.sid = /(?:^|;\s*)sid=([\w-]+)/.exec(req.headers.cookie || '')?.[1];
  const s = sessions.get(req.sid);
  if (s && s.expires > Date.now()) req.session = s;
  else if (s) sessions.delete(req.sid);
  next();
});

const requireStage = (stage) => (req, res, next) => (req.session?.stage === stage ? next() : res.redirect('/login'));

const getUser = async (id) => (await db.query('select * from users where id = $1', [id])).rows[0];

// --- Routes
app.get('/', (req, res) => res.redirect(req.session?.stage === 'full' ? '/dashboard' : '/login'));

app.get('/signup', (req, res) => res.send(ui.signup()));

app.post('/signup', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const fail = (msg) => res.status(400).send(ui.signup(msg, email));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return fail('Enter a valid email');
  if (password.length < 8 || password.length > 128) return fail('Password must be 8 to 128 characters');

  const id = crypto.randomUUID(); // generated here, not by the DB, because the encrypted secret is bound to it
  const { rows } = await db.query(
    'insert into users (id, email, password_hash, totp_secret) values ($1, $2, $3, $4) on conflict (email) do nothing returning id',
    [id, email, hashPassword(password), encryptSecret(newSecret(), KEY, id)],
  );
  if (!rows[0]) return fail('Email already registered');
  startSession(req, res, rows[0].id, 'setup', { passwordAt: new Date() });
  res.redirect('/2fa/setup');
});

app.get('/login', (req, res) => res.send(ui.login()));

app.post('/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const fail = (msg) => res.status(401).send(ui.login(msg, email));
  if (rateLimited(`pw:${email}`)) return fail('Too many attempts, wait a minute');

  const user = (await db.query('select id, password_hash, totp_enabled from users where email = $1', [email])).rows[0];
  if (!checkPassword(password, user?.password_hash) || !user) return fail('Invalid email or password');
  resetLimit(`pw:${email}`);
  startSession(req, res, user.id, user.totp_enabled ? 'otp' : 'setup', { passwordAt: new Date() });
  res.redirect(user.totp_enabled ? '/2fa' : '/2fa/setup');
});

async function setupPage(req, res, msg = '') {
  const user = await getUser(req.session.userId);
  const secret = decryptSecret(user.totp_secret, KEY, user.id);
  const qr = await QRCode.toDataURL(otpauthUri(ISSUER, user.email, secret), { margin: 0, width: 400 });
  res.status(msg ? 401 : 200).send(ui.setup(user.email, qr, base32Encode(secret), msg));
}

async function verifyCode(req, res, onError) {
  const user = await getUser(req.session.userId);
  const result = checkCode(user.id, decryptSecret(user.totp_secret, KEY, user.id), Number(user.totp_last_step), String(req.body.token || '').trim());
  if (result.error) return onError(result.error);
  // Atomic replay guard: only one request can claim this time step.
  const { rowCount } = await db.query(
    'update users set totp_last_step = $2, totp_enabled = true where id = $1 and totp_last_step < $2', [user.id, result.step]);
  if (!rowCount) return onError('Code already used');
  startSession(req, res, user.id, 'full', { passwordAt: req.session.passwordAt, codeAt: new Date(), step: result.step });
  res.redirect('/dashboard');
}

const otpPage = async (req, res, msg = '') =>
  res.status(msg ? 401 : 200).send(ui.otp((await getUser(req.session.userId)).email, msg));

app.get('/2fa/setup', requireStage('setup'), (req, res) => setupPage(req, res));
app.post('/2fa/setup', requireStage('setup'), (req, res) => verifyCode(req, res, (msg) => setupPage(req, res, msg)));

app.get('/2fa', requireStage('otp'), (req, res) => otpPage(req, res));
app.post('/2fa', requireStage('otp'), (req, res) => verifyCode(req, res, (msg) => otpPage(req, res, msg)));

app.get('/dashboard', requireStage('full'), async (req, res) => {
  res.send(ui.dashboard(await getUser(req.session.userId), req.session));
});

app.post('/logout', (req, res) => {
  endSession(req, res);
  res.redirect('/login');
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send(ui.error());
});

db.query(SCHEMA).then(() => app.listen(PORT, () => console.log(`http://localhost:${PORT}`)));
