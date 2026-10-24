// HTML for the demo bank's screens. Plain template strings, no client-side script.

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Grid: the wide column is 1088px of content (1136 minus 24px gutters). Top row is 2fr 1fr with a 12px gap:
// 717.33 + 12 + 358.67 = 1088, so both cards land on the column edges.
const CSS = `
:root{--ground:#f2f4f7;--surface:#fff;--raised:#eee;--border:#e6e6e6;--rule:#f0f0f0;--control:#d4d4d4;
--text:#0a0a0a;--muted:#6b6b6b;--primary:#141414;--secondary:#e5e5e5;--hue:#1d5fbf;--grid:#e5e5e5;
--positive:#2e7d32;--pill-positive-bg:#dcfae5;--pill-positive-ink:#04250e;--pill-negative-bg:#ffedea;--pill-negative-ink:#831c1e;
--r-card:8px;--r-control:6px;--gap:12px;--pad:24px}
*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--text);font:14px/20px Geist,Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
h1,h2,p,figure,dl,dd,ol{margin:0}
h1{font-size:24px;line-height:32px;font-weight:500;letter-spacing:-.01em}
h2{font-size:16px;line-height:24px;font-weight:500}
a{color:inherit;text-underline-offset:3px}
:focus-visible{outline:2px solid var(--text);outline-offset:2px}
.num{font-variant-numeric:tabular-nums}
.muted,.sub{color:var(--muted)}
.sub{margin-top:4px;font-size:15px;line-height:22px}

.frame{margin:0 auto;padding:0 24px 64px}
.frame.narrow{max-width:448px}.frame.mid{max-width:808px}.frame.wide{max-width:1136px}
.frame.narrow,.frame.mid{min-height:100vh;display:flex;flex-direction:column}
.frame.narrow main,.frame.mid main{margin:auto 0}
.top{height:56px;flex:none;display:flex;align-items:center;justify-content:space-between;gap:12px}
.brand{display:flex;align-items:center;gap:8px;font-size:16px;font-weight:500;text-decoration:none}
.brand span{color:var(--muted);font-weight:400}
.mark{width:20px;height:20px}
.right{display:flex;align-items:center;gap:12px;min-width:0}
.who{color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.right form{margin:0}

.btn{display:inline-flex;white-space:nowrap;align-items:center;justify-content:center;height:40px;padding:0 16px;border:0;border-radius:var(--r-control);
background:var(--primary);color:#fff;font:inherit;font-weight:500;text-decoration:none;cursor:pointer;transition:background-color .15s,transform .1s}
.btn:hover{background:#333}.btn:active{transform:translateY(1px)}
.btn.secondary{height:32px;padding:0 12px;background:var(--secondary);color:var(--text)}
.btn.secondary:hover{background:#d9d9d9}
.btn.block{width:100%;margin-top:24px}

.panel{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-card);padding:var(--pad)}
.alt{margin-top:16px;text-align:center;color:var(--muted)}

label{display:block;font-weight:500;margin:16px 0 8px}
form label:first-of-type{margin-top:24px}
input{width:100%;height:40px;padding:0 12px;border:1px solid var(--control);border-radius:var(--r-control);background:#fff;color:var(--text);font:inherit;font-size:16px}
input:hover{border-color:#b5b5b5}
input.code{height:48px;font-size:24px;letter-spacing:.3em;font-variant-numeric:tabular-nums}
.hint{margin-top:8px;font-size:12px;line-height:16px;color:var(--muted)}
.err{margin-top:16px;padding:8px 12px;border-radius:var(--r-control);background:var(--pill-negative-bg);color:var(--pill-negative-ink)}

.setup{display:grid;grid-template-columns:200px 1fr;gap:32px;margin-top:24px}
.qr img{display:block;width:200px;height:200px;image-rendering:pixelated}
.qr figcaption{margin-top:16px;font-size:12px;line-height:16px;color:var(--muted)}
.key{display:block;margin-top:4px;font:500 14px/20px "Geist Mono",ui-monospace,monospace;word-spacing:.2em}
.steps{padding-left:20px}.steps li+li{margin-top:8px}.steps strong{font-weight:500}

.title{padding:24px var(--pad) 24px}
.row{display:grid;grid-template-columns:2fr 1fr;gap:var(--gap);margin-bottom:var(--gap)}
.kpi{margin-top:8px;font-size:30px;line-height:36px;font-weight:700;letter-spacing:-.01em}
.delta{margin-top:4px;color:var(--muted)}.pos{color:var(--positive)}

.chart{display:grid;grid-template-columns:auto 1fr;grid-template-rows:168px 20px;column-gap:12px;margin-top:24px}
.chart svg{width:100%;height:100%;overflow:visible}
.yl,.xl{position:relative;font-size:12px;line-height:16px;color:var(--muted)}
.yl span{position:absolute;right:0;transform:translateY(50%)}
.yl i{visibility:hidden;font-style:normal}
.xl{grid-column:2;margin-top:4px}
.xl span{position:absolute;top:0;transform:translateX(-50%);white-space:nowrap}
.xl span:first-child{transform:none}.xl span:last-child{transform:translateX(-100%)}

.kv{margin-top:8px}
.kv div{display:flex;justify-content:space-between;align-items:center;gap:16px;min-height:40px;border-bottom:1px solid var(--rule)}
.kv div:last-child{border-bottom:0}
.kv dt{color:var(--muted)}.kv dd{text-align:right}
.pill{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;line-height:16px;font-weight:500;background:var(--pill-positive-bg);color:var(--pill-positive-ink)}

.head{display:flex;justify-content:space-between;align-items:baseline;gap:16px;margin-bottom:8px}
table{width:100%;border-collapse:collapse}
th{font-size:12px;line-height:16px;font-weight:400;color:var(--muted);text-align:left;padding:8px 0;border-bottom:1px solid var(--border)}
td{padding:10px 0;border-bottom:1px solid var(--rule);vertical-align:top}
tr:last-child td{border-bottom:0}
th+th,td+td{padding-left:24px}
.r{text-align:right}
td.date{white-space:nowrap;color:var(--muted);width:120px}
.cat{display:block;font-size:12px;line-height:16px;color:var(--muted);margin-top:2px}
td.bal{color:var(--muted)}

@media (max-width:760px){
  .row{grid-template-columns:1fr}
  .setup{grid-template-columns:1fr;gap:24px}
  .title{padding:16px 0}
}
@media (max-width:640px){
  .frame{padding-left:16px;padding-right:16px}
  .brand span{display:none}
  .panel{padding:16px}
  thead{display:none}
  table,tbody{display:block}
  tr{display:grid;grid-template-columns:1fr auto;grid-template-areas:"desc amt" "date bal";column-gap:16px;padding:10px 0;border-bottom:1px solid var(--rule)}
  tr:last-child{border-bottom:0}
  td{display:block;padding:0!important;border:0!important;width:auto!important}
  td.desc{grid-area:desc}td.amt{grid-area:amt}td.date{grid-area:date;margin-top:2px;font-size:12px}td.bal{grid-area:bal;margin-top:2px;font-size:12px;text-align:right}
}
@media (prefers-reduced-motion:reduce){.btn{transition:none}.btn:active{transform:none}}
`;

// The countdown ring from the app: three quarters of a TOTP period left.
const MARK = `<svg class="mark" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.5" fill="none" stroke="#d4d4d4" stroke-width="3"/><path d="M10 2.5a7.5 7.5 0 1 1-7.5 7.5" fill="none" stroke="currentColor" stroke-width="3"/></svg>`;

const page = (title, width, main, right = '') => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)} · Taller</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;700&family=Geist+Mono:wght@500&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body><div class="frame ${width}">
<header class="top"><a class="brand" href="/">${MARK}Taller <span>demo bank</span></a><div class="right">${right}</div></header>
${main}</div></body></html>`;

const notice = (msg) => (msg ? `<p class="err" role="alert">${esc(msg)}</p>` : '');

const credentials = (action, button, msg, email) => `${notice(msg)}
<form method="post" action="${action}">
<label for="email">Email</label><input id="email" name="email" type="email" value="${esc(email)}" autocomplete="email" required>
<label for="password">Password</label><input id="password" name="password" type="password" minlength="8" maxlength="128"
 autocomplete="${action === '/signup' ? 'new-password' : 'current-password'}" required${action === '/signup' ? ' aria-describedby="pw-hint"' : ''}>
${action === '/signup' ? '<p class="hint" id="pw-hint">8 to 128 characters.</p>' : ''}
<button class="btn block">${button}</button></form>`;

const codeForm = (action, msg) => `${notice(msg)}
<form method="post" action="${action}"><label for="token">6-digit code</label>
<input class="code" id="token" name="token" inputmode="numeric" pattern="\\d{6}" maxlength="6" autocomplete="one-time-code" autofocus required>
<button class="btn block">Verify</button></form>`;

const signup = (msg = '', email = '') => page('Create account', 'narrow', `<main><section class="panel">
<h1>Create an account</h1><p class="sub">Next you link the Taller MFA app. Every login after that asks for its code.</p>
${credentials('/signup', 'Create account', msg, email)}</section>
<p class="alt">Already have an account? <a href="/login">Log in</a></p></main>`);

const login = (msg = '', email = '') => page('Log in', 'narrow', `<main><section class="panel">
<h1>Log in</h1><p class="sub">Your password first, then the code from Taller MFA.</p>
${credentials('/login', 'Continue', msg, email)}</section>
<p class="alt">No account yet? <a href="/signup">Create one</a></p></main>`);

const otp = (email, msg = '') => page('Enter code', 'narrow', `<main><section class="panel">
<h1>Enter your code</h1><p class="sub">Open Taller MFA and type the code shown for TallerMFA · ${esc(email)}.</p>
${codeForm('/2fa', msg)}</section>
<p class="alt"><a href="/login">Use another account</a></p></main>`);

const setup = (email, qr, key, msg = '') => page('Set up two-factor', 'mid', `<main><section class="panel">
<h1>Set up two-factor authentication</h1><p class="sub">Link the Taller MFA app to ${esc(email)}.</p>
<div class="setup">
<figure class="qr"><img src="${qr}" alt="QR code that adds ${esc(email)} to Taller MFA" width="200" height="200">
<figcaption>Can't scan? Tap Enter key in the app and type:</figcaption><code class="key">${key.match(/.{1,4}/g).join(' ')}</code></figure>
<div><ol class="steps"><li>Open Taller MFA and tap <strong>Scan QR</strong>.</li><li>Point the camera at this QR code.</li>
<li>Type the 6-digit code the app shows.</li></ol>${codeForm('/2fa/setup', msg)}</div>
</div></section></main>`);

const error = () => page('Error', 'narrow', `<main><section class="panel">
<h1>Something went wrong</h1><p class="sub">The server couldn't finish that request.</p>
<a class="btn block" href="/">Back to start</a></section></main>`);

// --- Dashboard. Mock ledger: amounts in cents, `ago` in days before today. Balances are computed from the rows.
const OPENING = 1_100_000;
const TX = [
  [29, 'Salary', 'Income', 245_000],
  [27, 'Rent', 'Housing', -120_000],
  [22, 'Electricity', 'Bills', -6_120],
  [18, 'Supermarket', 'Groceries', -8_437],
  [11, 'Bookstore', 'Shopping', -2_399],
  [7, 'Transfer from savings', 'Transfers', 50_000],
  [4, 'Phone plan', 'Bills', -3_500],
  [2, 'Supermarket', 'Groceries', -5_218],
  [0, 'Coffee shop', 'Eating out', -450],
];
const DAYS = 30;

const money = (cents, sign = false) =>
  (sign && cents > 0 ? '+' : '') + (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' }).replace('-', '−');
const dayAgo = (n) => new Date(Date.now() - n * 86_400_000);
const shortDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const isoDate = (d) => d.toISOString().slice(0, 10);
const clock = (d) => (d ? `${new Date(d).toISOString().slice(11, 19)} UTC` : '—');

function ledger() {
  let balance = OPENING;
  const rows = TX.map(([ago, name, cat, cents]) => ({ ago, name, cat, cents, balance: (balance += cents) }));
  // Balance at the end of each day, oldest first; day DAYS is the opening balance.
  const daily = [];
  for (let ago = DAYS; ago >= 0; ago--) daily.push(OPENING + TX.filter(([d]) => d >= ago && d < DAYS).reduce((s, t) => s + t[3], 0));
  console.assert(daily.at(-1) === balance, 'daily series must end at the closing balance');
  return { rows: rows.reverse(), daily, closing: balance };
}

const niceStep = (x) => [1, 2, 5, 10].map((m) => m * 10 ** Math.floor(Math.log10(x))).find((s) => s >= x);

// Line chart drawn as a stretched SVG (non-scaling strokes) with HTML tick labels, so text never scales.
function chart(daily) {
  const step = niceStep((Math.max(...daily) - Math.min(...daily)) / 3);
  let lo = Math.floor(Math.min(...daily) / step) * step;
  let hi = Math.ceil(Math.max(...daily) / step) * step;
  if (lo === Math.min(...daily)) lo -= step;
  if (hi === Math.max(...daily)) hi += step;
  const y = (v) => 100 - ((v - lo) / (hi - lo)) * 100;
  const ticks = [];
  for (let v = lo; v <= hi; v += step) ticks.push(v);
  const n = daily.length - 1;
  const label = (v) => `$${(v / 100).toLocaleString('en-US')}`;
  const widest = label(hi);
  const xs = [DAYS, 20, 10, 0];
  return `<figure class="chart" aria-label="Balance over the last ${DAYS} days, from ${money(daily[0])} to ${money(daily[n])}">
<div class="yl num" aria-hidden="true"><i>${widest}</i>${ticks.map((v) => `<span style="bottom:${100 - y(v)}%">${label(v)}</span>`).join('')}</div>
<svg viewBox="0 0 ${n} 100" preserveAspectRatio="none" aria-hidden="true">
${ticks.map((v) => `<line x1="0" x2="${n}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)" stroke-width="1" vector-effect="non-scaling-stroke"/>`).join('')}
<polyline points="${daily.map((v, i) => `${i},${y(v).toFixed(2)}`).join(' ')}" fill="none" stroke="var(--hue)" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
</svg>
<div class="xl" aria-hidden="true">${xs.map((ago) => `<span style="left:${((DAYS - ago) / n) * 100}%">${ago ? shortDate(dayAgo(ago)) : 'Today'}</span>`).join('')}</div>
</figure>`;
}

function dashboard(user, session) {
  const { rows, daily, closing } = ledger();
  const kv = (k, v) => `<div><dt>${k}</dt><dd>${v}</dd></div>`;
  const right = `<span class="who">${esc(user.email)}</span><form method="post" action="/logout"><button class="btn secondary">Log out</button></form>`;
  return page('Checking', 'wide', `<main>
<div class="title"><h1>Checking ····${esc(user.id.slice(-4))}</h1>
<p class="sub">Signed in at ${clock(session.codeAt)} with your password and a one-time code from Taller MFA.</p></div>
<div class="row">
<section class="panel"><h2>Balance</h2><p class="kpi num">${money(closing)}</p>
<p class="delta"><span class="pos num">${money(closing - OPENING, true)}</span> since ${shortDate(dayAgo(DAYS))}</p>${chart(daily)}</section>
<section class="panel"><h2>This session</h2><dl class="kv num">
${kv('Password checked', clock(session.passwordAt))}
${kv('Code accepted', clock(session.codeAt))}
${kv('Code time step', session.step?.toLocaleString('en-US') ?? '—')}
${kv('Session ends', clock(session.expires))}
${kv('Two-factor', '<span class="pill">On</span>')}
${kv('Codes from', 'Taller MFA app, every 30 s')}
${kv('Account opened', isoDate(user.created_at))}
</dl></section>
</div>
<section class="panel"><div class="head"><h2>Recent activity</h2><span class="muted">Last ${DAYS} days · ${rows.length} transactions</span></div>
<table><thead><tr><th>Date</th><th>Description</th><th class="r">Amount</th><th class="r">Balance</th></tr></thead><tbody>
${rows.map((r) => `<tr><td class="date num">${isoDate(dayAgo(r.ago))}</td><td class="desc">${esc(r.name)}<span class="cat">${esc(r.cat)}</span></td>
<td class="amt r num${r.cents > 0 ? ' pos' : ''}">${money(r.cents, true)}</td><td class="bal r num">${money(r.balance)}</td></tr>`).join('')}
</tbody></table></section>
</main>`, right);
}

module.exports = { signup, login, otp, setup, error, dashboard };
