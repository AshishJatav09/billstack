# CRM to BillStack integration — Phase 1

Phase 1 reuses BillStack integration credentials and the `X-Billstack-Api-Key` header. The credential determines the business; external payloads cannot select a BillStack tenant.

## Customer sync

`POST /api/integrations/customers/upsert`

The body accepts `externalId`, `source`, `name`, `phone`, `email`, `billingAddress`, `gstNumber`, `stateCode`, and `placeOfSupplyCode`. The response contains an `outcome` of `created`, `linked`, `updated`, or `already_synced`, the BillStack customer, and its external reference.

Identity is stored in `IntegrationCustomerMapping` with a unique `(businessId, source, externalId)` index. An unmapped request conservatively checks same-tenant GSTIN, normalized phone, then normalized email. Conflicting identifiers return HTTP 409. Creation and mapping run in one MongoDB transaction; the unique index resolves concurrent retries.

## Invoice handoff

The CRM backend calls `POST /api/integrations/handoffs/invoice` with a BillStack `customerId` and optional allow-listed `returnUrl`. BillStack verifies that the customer belongs to the API key's business and returns a three-minute handoff URL.

The URL contains only a random 256-bit one-time token. BillStack stores its SHA-256 hash, purpose, tenant, customer and expiry. The browser must still complete normal BillStack authentication. After login, `GET /api/integrations/handoffs/invoice/:token` atomically consumes the token for a user in the same business, then opens the existing invoice editor with the customer selected. The handoff grants no session and does not create an invoice.

Set `CRM_RETURN_URLS` to a comma-separated list of allowed CRM origins if the optional return URL is used.

## Review fixes and local verification

The browser shares one handoff-consume promise per business/user/token across
Strict Mode effect replay, component remounts and access-token refresh. Logout
clears that in-memory cache. Server consumption remains one-time, tenant-scoped
and limited to three minutes; a failed/expired handoff needs a fresh CRM link.
Logged-out users retain the token in session storage through normal login.
Request logging redacts both handoff path tokens and token query parameters.

Mapped customer updates accept explicit blank phone/email/address/GST fields to
clear old values. Omitted fields and initial customer linking retain their prior
behavior. No invoice or payment creation is added to customer synchronization.

For separate local ports, use backend `PORT=5001`,
`CLIENT_URL=http://127.0.0.1:5174`, `FRONTEND_ORIGINS=http://127.0.0.1:5174`, and
frontend `VITE_API_BASE_URL=http://127.0.0.1:5001/api`, port 5174. CRM must set
`BILLSTACK_BASE_URL=http://127.0.0.1:5001`,
`BILLSTACK_FRONTEND_URL=http://127.0.0.1:5174`, an explicit CRM company ID and the
generated integration credential. Use local test databases; customer upsert
requires MongoDB transactions. No same-origin proxy workaround is needed.

Verification: backend `npm run test:crm` and `npm test`; frontend
`node --test test/handoff.test.cjs` and `npm run build`. Tests simulate repositories
and browser hooks; real logged-in/logged-out browser E2E remains a separate check.
