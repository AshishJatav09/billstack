# BillStack production readiness notes

## Required processes

- Backend API: `npm start` from `backend/`
- Reminder worker: `npm run worker` from `backend/`
- Frontend: build with `npm run build` from `frontend/` and serve the static `dist/` output behind HTTPS.

## Required environment

- `MONGO_URI`
- `JWT_SECRET`
- `CLIENT_URL`

Run `npm run check:env` in `backend/` before deployment.

## Optional provider credentials

- Google login: `GOOGLE_CLIENT_ID`
- Razorpay: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- Email: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- WhatsApp provider: `WHATSAPP_API_BASE_URL`, `WHATSAPP_API_TOKEN`, `WHATSAPP_ACCOUNT_ID`, `WHATSAPP_WEBHOOK_SECRET`, `WHATSAPP_SEND_ENABLED=true`

WhatsApp sending remains disabled unless all provider values are configured and sending is explicitly enabled.

## Database and backups

- MongoDB must run as a replica set for transaction-dependent flows.
- Enable scheduled MongoDB backups with point-in-time recovery where the hosting provider supports it.
- Back up uploaded files such as business logos together with the database snapshot cadence.
- Restore rehearsal should verify database, uploads, API health, reminder worker, and provider webhooks.

## Integration API

External systems must use a BillStack integration API key. Keys are shown only once on creation, stored as hashes, and can be revoked from Business Settings.

Use `POST /api/integrations/orders` for idempotent external order/payment ingestion. Repeated requests with the same payload are safe; conflicting duplicates are rejected.
