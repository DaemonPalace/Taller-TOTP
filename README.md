# Taller MFA

TOTP (RFC 6238) authenticator app (Expo / React Native) plus a demo web service
with email/password signup, TOTP two-factor login and a mock account dashboard.

| Service  | What                                       | Port  |
|----------|--------------------------------------------|-------|
| `db`     | Supabase Postgres (`supabase/postgres`)    | none (internal network only) |
| `server` | Demo web service (Express)                 | 3000  |
| `expo`   | Expo dev server (Metro) for the mobile app | 8081  |

## Run

    cp .env.example .env      # set TOTP_KEY (openssl rand -hex 32) and EXPO_HOST (your LAN IP)
    docker compose up --build

After changing the app's dependencies, rebuild with `docker compose up --build -V`: `-V` replaces
the container's saved `node_modules` volume, which otherwise hides the new packages.

- Web service: http://localhost:3000
- Mobile app: `docker compose logs expo` shows `exp://<EXPO_HOST>:8081`. Open it in Expo Go
  (or type it in Expo Go's "Enter URL manually"). Phone and computer must be on the same network.
  On campus/office Wi-Fi that blocks device-to-device traffic, set `EXPO_START_ARGS=--tunnel`.

## Flow

1. **Sign up** with email and password (scrypt-hashed in Postgres).
2. **Set up 2FA**: scan the QR code with the app (or type the setup key), then enter the code.
3. **Dashboard** (mock account data).
4. Next **log in**: email + password, then the current code from the app.

Codes can only be used once, so if you log in again within the same 30 seconds, wait for the next code.

## Inspect the database

    docker compose exec db psql -U postgres -c 'select email, totp_enabled, created_at from users'

The database sits on an internal Docker network: only the server can reach it, and it has no
route to the host or the internet.

TOTP secrets are stored encrypted (AES-256-GCM with `TOTP_KEY`), bound to the user id so a
secret copied to another user's row fails to decrypt. Losing `TOTP_KEY` makes every
enrolled account unusable; `docker compose down -v` wipes the database.

## App lock

The app asks for biometrics (or the device PIN) on launch and every time it returns from the
background; secrets are only loaded after unlocking. In Expo Go on iOS, Face ID is not available
and the device passcode is used instead; a development build (`npx expo run:ios`) enables Face ID.

## Tests (host, Node 22.18+)

    cd server && npm install && npm test   # RFC vectors, passwords, encryption, rate limit, app/server agreement
    cd app && npm install && npm test      # RFC vectors, Base32, otpauth URI parsing
