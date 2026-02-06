# M-Pesa Daraja – Express + TypeScript

A minimal M-Pesa Daraja API integration using **Express** and **TypeScript**. Use it to add STK Push (Lipa na M-Pesa Online) to your app.

## Setup

This project uses **pnpm** (`packageManager` in `package.json`). Use `pnpm run <script>` for all commands below.

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Environment variables**

   Copy `env.example` to `.env` and set your Daraja credentials:

   - `MPESA_ENVIRONMENT` – `sandbox` or `production`
   - `MPESA_CONSUMER_KEY` / `MPESA_CONSUMER_SECRET` – from Daraja portal
   - `MPESA_PASS_KEY` / `MPESA_SHORT_CODE` – Lipa na M-Pesa Online
   - `MPESA_CALLBACK_URL` – public URL for payment callbacks (e.g. ngrok for local: `https://xxxx.ngrok.io/api/payments/callback`)

3. **Verify env (optional)**

   ```bash
   pnpm run env:check
   ```

   Checks that all required M-Pesa env vars are set without starting the server (useful in CI or before deploy).

4. **Run**

   ```bash
   pnpm run dev
   ```

   Server runs at `http://localhost:3000` (or `PORT` from `.env`). `GET /` returns API info; requests are logged (method, path, status, duration).

## Using ngrok (local callback from Daraja)

Safaricom must reach your callback URL. For local development, expose your app with ngrok:

1. **Start your app** (e.g. `pnpm run dev` on port 3000).

2. **Start ngrok** (in another terminal):

   ```bash
   pnpm run ngrok
   ```

   Or run `ngrok http 3000` (use your `PORT` if different).

3. **Copy the HTTPS URL** ngrok shows (e.g. `https://a1b2c3d4.ngrok-free.app`).

4. **Set in `.env`:**

   ```env
   MPESA_CALLBACK_URL=https://a1b2c3d4.ngrok-free.app/api/payments/callback
   ```

5. **Restart your app** so it picks up the new `MPESA_CALLBACK_URL`.

6. If your Daraja app has a “Callback URL” or “Validation URL” field, use the same ngrok base (e.g. `https://a1b2c3d4.ngrok-free.app`) so Safaricom can send payment results to your machine.

Each time you restart ngrok (free tier), the URL changes—update `.env` and restart the app.

## API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/payments` | Initiate STK Push |
| `POST` | `/api/payments/query` | Query STK Push status |
| `POST` | `/api/payments/callback` | Daraja webhook (Safaricom calls this) |
| `GET` | `/api/payments/validation` | Daraja C2B Validation URL (for URL registration) |
| `GET` | `/api/payments` | List payments (optional `page`, `perPage`, `userId`, `status`) |
| `GET` | `/api/payments/:id` | Get one payment |
| `GET` | `/health` | Liveness check |
| `GET` | `/health/ready` | Readiness check (tests Daraja credentials) |

- **CORS** is enabled for all origins so you can call the API from a browser or another domain.
- **Validation URL**: When registering C2B URLs in Daraja, point the Validation URL to `https://your-domain/api/payments/validation`. The endpoint returns the response Daraja expects.

### Initiate payment (STK Push)

```bash
curl -X POST http://localhost:3000/api/payments \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "254712345678",
    "amount": 10,
    "account_reference": "ORDER-001",
    "transaction_description": "Payment Order"
  }'
```

- `phone_number`: 254XXXXXXXXX (or 07XXXXXXXX, leading 0/254 normalized).
- `amount`: 1–70,000 KES.
- `account_reference`: max 12 chars.
- `transaction_description`: max 13 chars.

### Query status

```bash
curl -X POST http://localhost:3000/api/payments/query \
  -H "Content-Type: application/json" \
  -d '{"checkoutRequestId": "ws_CO_..."}'
```

### Callback

Configure `MPESA_CALLBACK_URL` in Daraja to point to:

`https://your-domain.com/api/payments/callback`

The app parses the callback and updates the payment status (e.g. COMPLETED with M-Pesa receipt).

## Project structure

```
src/
  config.ts             # Env and config
  index.ts              # Express app entry (CORS, health, routes)
  validators/
    payment.validator.ts# Zod schemas for request validation
  services/
    daraja.service.ts   # Daraja OAuth, STK Push, query, callback parsing
    payment.service.ts  # Payment create, query, callback handling
  store/
    payment.store.ts    # In-memory payment store (replace with DB if needed)
  types/
    payment.types.ts    # Payment and DTO types
  routes/
    payment.routes.ts   # REST + callback + validation routes
```

Payments are stored in memory by default. Replace `payment.store.ts` with your database (e.g. TypeORM, Prisma) when integrating into your system.

## Possible next steps

- **Database**: Swap the in-memory store for TypeORM, Prisma, or another DB.
- **Auth**: Add API keys or JWT for `POST /api/payments` and `POST /api/payments/query`.
- **C2B**: Use the Validation URL above and add a C2B confirmation handler if you need Customer to Business payments.
- **Logging**: Add structured logging (e.g. Pino) and request IDs for debugging.
- **Rate limiting**: Protect `/api/payments/callback` (and other routes) with rate limits.
