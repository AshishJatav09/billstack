# GST and Business Settings verification

Commit: `519050c28fbf1856ce437758fa89c42e2b836eba`, pushed to `origin/main`.

## Requested verification report

1. **Root cause:** GSTIN and business state were independently editable/validated. Missing location information fell through to interstate GST. Tax Inclusive was selectable but the existing totals engine ignored it. Settings updates also replaced existing business-profile metadata.
2. **Mismatch:** The reported `23…` GSTIN with state `27 / Maharashtra` is contradictory. This was supplied in the request, not independently verified against a production database. [Official GST state codes](https://docs.ewaybillgst.gov.in/apidocs/state-code.html) identify 23 as Madhya Pradesh and 27 as Maharashtra.
3. **Normalization:** One shared state catalogue and backend policy validate GSTIN structure, derive its state, canonicalize state names/codes and reject conflicting selections. Settings synchronizes state/code when a valid GSTIN is entered; code is read-only.
4. **Determination:** Shared GST document calculation produces CGST/SGST for same-state and IGST for interstate supplies. Unknown required locations block finalization instead of becoming IGST. Component rounding preserves the line tax sum, including odd paise.
5. **Place of Supply:** Invoice creation exposes a state dropdown, defaults from customer state where available, supports explicit override and preserves an existing invoice's snapshot POS during editing. Quotations and recurring profiles also support POS. The preview endpoint is read-only and tenant/RBAC protected.
6. **Settings:** Compact Business Profile, GST & Tax, Invoice & Payment, Branding and Communications tabs replace the oversized hero/giant form. Form values survive tab changes. Save locks prevent duplicate submissions; validation and success feedback are shown.
7. **SELF_HOSTED Real Estate:** Duplicate GST/Tax ID, owner role, inventory/negative-stock controls, developer integrations, Google account panel and SaaS commercial controls are absent/hidden. Licensed industry is read-only and backend protected. SaaS commercial controls remain; inventory preferences appear only for an active, visible inventory module.
8. **Bank validation:** IFSC requires 11-character structural format; supplied UPI IDs require basic structure. Account numbers remain strings, including leading zeros; numeric API values are rejected.
9. **GST validation:** Registered businesses require valid GSTIN/state; contradictions are rejected server-side. GST disabled retains existing non-GST calculations. Settings offers standard rates and preserves an already-configured custom rate. Only supported Tax Exclusive is exposed; registered legacy inclusive configurations must be corrected before finalization.
10. **E-invoice UI:** Internal GST/e-invoice technical panel and government-submission copy were removed. No unconfigured provider is presented as connected or as having generated an IRN.
11. **E-invoice backend:** Existing metadata, lifecycle and preparation foundation remains. Readiness checks use historical supplier/POS snapshots and reject GSTIN-prefix contradictions rather than filling missing historical locations from today's business/customer.
12. **Invoice/PDF:** Persisted invoice calculations use the shared helper. PDF uses historical supplier GSTIN, POS, taxable value and nonzero CGST/SGST or IGST components, with persisted totals. Zero taxable values no longer fall through to other amounts.
13. **Quotation:** Creation/update persist GST/POS and shipping/round-off; conversion uses the shared document helper and retains those fields. Preview calls the same backend helper. Product HSN/classification are retained. Existing conversion idempotency remains.
14. **Monthly Billing:** Profile totals and generated invoices use the shared helper. Explicit POS is persisted and forwarded during generation. Existing occurrence-based duplicate prevention remains.
15. **Reports/GST:** Aggregation prefers invoice-time GST snapshots rather than current addresses. Existing tenant/date/cancellation rules remain. Previous requested numeric header/value alignment changes are included. The new engine's UTGST is zero, so its total equals CGST + SGST + IGST; existing legacy UTGST reporting is preserved.
16. **Legacy audit:** A read-only `backend/src/scripts/audit-gst-snapshots.js --dry-run` script reports invoice number, taxable value, old/expected components and reason. Historical supplier-state contradiction fixture correctly reports expected CGST/SGST; missing historical evidence is indeterminate. Production audit was not executed. There is deliberately no mutation/apply mode.
17. **Exact files:** Listed below; 30 intended source/test files were committed. This generated verification report is not part of that source commit. Existing workflow-guide files were preserved and excluded.
18. **Tests:** Added GST-policy regressions for state contradictions, 18%/5% same/interstate supplies, missing locations, B2C explicit POS, disabled GST, unsupported inclusive mode, mixed rates, historical audit, PDF and settings validation. Browser fixture tests now traverse Settings tabs at five widths in both deployment modes. Existing quotation/workflow/accounting regressions were retained.
19. **Results:** Full backend suite: 262 tests, 247 pass, 15 skipped, 0 fail, plus smoke checks. Latest targeted GST-policy suite: 12/12 pass. Local intercepted browser fixtures passed SELF_HOSTED and SAAS, including Settings at 1920x1080, 1440x900, 1366x768, 768x1024 and 390x844. These are fixture checks, not authenticated production audits or replacement for transaction integration tests. `git diff --check` passed.
20. **Build:** Final frontend production build passed in 7.99 seconds. Generated bundles were not committed.
21. **Remaining blockers/limits:** Fifteen transaction integration tests require an available replica-set test database. Production legacy audit remains deliberately unrun; any corrections require historical review and separately authorized work. No production e-invoice provider connection was added. VPS, production DB/env, nginx and systemd were untouched. Settings preserves custom rate values but has no new arbitrary-custom-rate creation control. Existing report server reads still load financial collections before response pagination; that scalability architecture was not rewritten here.

## Exact committed files

```text
backend/package.json
backend/src/controllers/business.controller.js
backend/src/controllers/gst.controller.js
backend/src/controllers/invoice.controller.js
backend/src/models/Quote.js
backend/src/models/RecurringBillingProfile.js
backend/src/routes/invoice.routes.js
backend/src/scripts/audit-gst-snapshots.js
backend/src/services/einvoice.service.js
backend/src/services/quote.service.js
backend/src/services/workflow.service.js
backend/src/utils/audit-gst-snapshot.js
backend/src/utils/gst.js
backend/src/utils/pdfInvoice.js
backend/src/utils/report-date-range.js
backend/src/utils/tax-document.js
backend/src/validators/auth.validation.js
backend/tests/gst-policy-regression.test.js
frontend/src/features/auth/api.js
frontend/src/features/dashboard/GstLocationPreview.jsx
frontend/src/features/dashboard/pages/BusinessSettingsPage.jsx
frontend/src/features/dashboard/pages/InvoicesPage.jsx
frontend/src/features/dashboard/pages/ReportsPage.jsx
frontend/src/features/dashboard/pages/SalesLifecyclePage.jsx
frontend/src/features/dashboard/pages/WorkflowPage.jsx
frontend/src/features/dashboard/pages/reports.css
frontend/src/features/workspace/workspaceVisibility.js
frontend/tests/action-workflows.cjs
shared/gst-policy.cjs
shared/indian-gst-states.json
```
