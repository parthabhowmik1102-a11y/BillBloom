# BillBloom SRS Requirements Checklist

Reviewed against the supplied Software Requirements Specification PDF on 14 November 2026.

Legend: ✅ implemented in the project; 🟡 implemented but depends on local hardware or recipient configuration.

## Application requirements

| Requirement | Result | Evidence |
|---|---|---|
| Responsive invoice and customer-management application | ✅ | Dashboard, editor, customer directory, product catalog, analytics, and editable user/business profiles. |
| Invoice line items that can be added, changed, reordered, and removed | ✅ | Invoice editor controls recalculate the preview and totals. |
| GST calculation, discounts, CGST/SGST, IGST, and rounded total | ✅ | 0%, 5%, 12%, 18%, and 28% rates; intra-state split and interstate tax mode; totals rounded to paise. |
| Customer records and purchase history | ✅ | Customer data and invoice history persist in local SQLite; saved customers can be edited. |
| Due-date tracking and invoice status lifecycle | ✅ | Draft, Sent, Paid, and Overdue; Sent invoices past due date become Overdue; Paid records a confirmation timestamp. |
| A4 invoice and thermal receipt output | 🟡 | A4 and 80 mm page layouts plus print CSS are implemented. Physical printer margin/feed calibration depends on the printer and browser used locally. |
| Branded PDF export | ✅ | Business identity and optional logo are rendered into the PDF. |
| Cryptographically signed PDF that detects changes | ✅ | Server signs each exported PDF using a locally generated PKCS#12 key and X.509 certificate. The signing certificate can be downloaded from the app API. The certificate is self-signed, so external recipients must verify/trust it for identity validation; signature integrity still detects post-signing changes. |
| Share invoices via email and WhatsApp | ✅ | Email action downloads an `.eml` draft with the signed PDF attached. WhatsApp opens a prefilled message and downloads the signed PDF, which the user attaches in the chat before sending. |
| Product catalog picker with HSN/SAC and rates | ✅ | Search suggestions populate product description, code, unit, price, and GST; catalog entries can be edited. |
| UPI QR for invoice amount | ✅ | QR payload includes UPI ID, invoice number, INR currency, and current total. |
| Dashboard and monthly revenue/GST reports | ✅ | Dashboard and monthly reports distinguish issued and paid revenue; draft invoices are excluded from GST liability summaries. |
| Required sample dataset | ✅ | Three example businesses, ten customers, and twenty products are supplied in `server/sample-data.json`. |
| Sharma Electronics sample workflow | ✅ | A sample customer and prefilled invoice lines are available for editing, saving, history, and export. |

## Prescribed implementation details

| Requirement | Result | Evidence |
|---|---|---|
| HTML, CSS, and JavaScript-based web application | ✅ | Semantic HTML JSX, CSS, and JavaScript. |
| React state/effect patterns | ✅ | `useState` and `useEffect` are used for live app state and effects. |
| React Context and React Router | ✅ | Shared app data uses `AppContext`; navigation uses React Router routes. |
| Express API and SQLite persistence | ✅ | Express routes read/write customer, product, account, business, and invoice records to SQLite. |

## Verification performed

- `node --check server/index.js` and `node --check server/signing.js` pass.
- `npm run build` succeeds (Vite notes that the lazily loaded PDF-export chunk exceeds its default 500 kB warning threshold).
- `npm audit` reports zero known vulnerabilities after updating the PDF export dependencies.
- Demo JSON provides exactly 3 businesses, 10 customers, and 20 products; initial SQLite seed was checked.
- A signing helper smoke test and POST `/api/sign-pdf` API smoke test both returned a signed PDF containing a PDF signature byte range.
- Physical print output and email/WhatsApp delivery depend on local printer and mail/chat apps; use the in-app print/export/share actions to verify those locally.

## Local signing-certificate note

The app generates a separate self-signed certificate and private key on first server start. These are stored in `server/data`, excluded from Git, and must remain private. The certificate proves PDF integrity under that installation's key; it is not a publicly trusted business identity certificate. A certificate issued by a trusted certificate authority can replace it for production identity assurance.