# BillBloom

BillBloom is a small-business invoice and customer-management demo built to the attached Software Requirements Specification (SRS).

See [REQUIREMENTS-CHECKLIST.md](./REQUIREMENTS-CHECKLIST.md) for the requirement-by-requirement audit, completion status, and remaining limitations.

## Technology used

- React and JavaScript for the user interface
- Tailwind CSS plus project CSS, including print styles
- Node.js with Express for the local application server and API
- SQLite through Node's built-in `node:sqlite` module for customers, products, business profile, and invoice history
- `html2pdf.js` for downloadable invoices and `qrcode` for UPI payment QR codes; `@signpdf` and a per-installation certificate for cryptographic PDF signing
- Vite for local frontend development

## What is included

- Invoice editor with add, edit, move, and remove controls for multiple line items; quantities, prices, per-item GST rates (0%, 5%, 12%, 18%, 28%), discounts, and live totals
- Intra-state CGST/SGST and interstate IGST display, with a manual interstate toggle
- Business profile with address, GSTIN, UPI ID, contact details, and optional uploaded logo
- Editable local account profile for the person using the app, separate from the business profile
- Customer directory with add/edit controls, customer purchase history, and a seeded Sharma Electronics demo customer
- Existing invoices can be reopened from Recent invoices or customer purchase history, edited, and saved back to the same invoice record
- Invoice status tracking: Draft, Sent, Paid, and Overdue. Sent invoices become Overdue automatically after their due date; Paid status records a confirmation timestamp.
- Product catalog with add/edit controls and 20 sample products, descriptions, HSN/SAC codes, GST rates, and prices
- A4 and 80 mm receipt-size signed PDF export, browser printing, WhatsApp message drafts with a signed PDF download, email `.eml` drafts containing the signed PDF, and an exact-amount UPI QR code
- JSON demo data with 10 sample customers and 3 example business profiles that can be loaded into the editable business profile
- Dashboard and monthly invoice/GST summaries

## Software you need

1. **Node.js 22.13 or newer**. npm is included with Node.js. The built-in SQLite module means you do not need to install a separate database.
2. **Visual Studio Code** to edit and run the project.
3. **Chrome or Edge** to open the app.
4. **Git** and a GitHub account when you are ready to publish the project.
5. An internet connection for the first dependency install (`npm install`).

## Step-by-step: run the app in VS Code

1. Open Visual Studio Code.
2. Select **File → Open Folder…** and open this `srs_project` folder.
3. Select **Terminal → New Terminal** in VS Code.
4. In the terminal, install the JavaScript packages:

   ```powershell
   npm install
   ```

   Wait until npm finishes and returns to the prompt. It creates a `node_modules` folder; that folder is excluded from Git.

5. Start the frontend and local API together:

   ```powershell
   npm run dev
   ```

6. Find the line in the terminal that starts with `Local:`. It should show an address similar to `http://localhost:5173/`.
7. Hold **Ctrl** and click the address in the VS Code terminal. If it is not clickable, copy the complete address, open Chrome or Edge, paste it into the address bar, and press **Enter**.
8. Leave the VS Code terminal running while you use BillBloom. Press **Ctrl+C** in that terminal when you want to stop the app.

If port 5173 is already in use, Vite may print a different port. Open the exact `Local:` address it prints. The Express API runs at `http://localhost:3001` and is called by the frontend automatically.

### Windows PowerShell note

If PowerShell reports that `npm.ps1` cannot be loaded because script execution is disabled, use the Windows command shims instead. Run them separately and wait for each command to finish:

```powershell
npm.cmd install
npm.cmd run dev
```

You can also switch the VS Code terminal profile to **Command Prompt** and use `npm install` / `npm run dev`. You do not need to change PowerShell's execution policy for this project.

## Try the demo

1. Open **Create invoice**. The form starts with the sample Sharma Electronics customer and three sample invoice items.
2. Edit quantities, prices, or GST. Use the up/down arrows to reorder invoice lines. Try the discount field and the **Interstate supply** switch to see tax and totals update.
3. Choose another item from the product catalog or add a customer.
4. Choose **Save invoice**. It will appear in Recent invoices and in the selected customer's purchase history. Choose its invoice number or **Edit** to reopen it and save changes to the same record.
5. Select a customer, then choose **Edit customer** to change their saved details. In **Product catalog**, choose **Edit** beside an item to update its rate, description, HSN/SAC, or GST. Type a catalog item name in an invoice line to see matching autocomplete suggestions.
6. Open **My profile** to edit the user's name, email, and phone. Update invoice identity and UPI details under **Business profile** before using an invoice outside the demo.

## Where app data is stored

The server creates `server/data/billbloom.sqlite` the first time it runs. Customer, product, business-profile, and invoice records stay on this computer. That database folder is ignored by Git, so personal invoice data is not included when you publish the source code. Back it up separately if you need to keep the local records.

The bundled business, customers, products, GSTINs, and UPI IDs are sample values. Replace them with verified business information before issuing real invoices. The calculations are an application demo and should be reviewed for your business's tax requirements. Each installation creates a local self-signed signing certificate and uses it to cryptographically sign exported PDFs. The signature detects changes to the signed PDF, but the certificate is not issued by a public certificate authority; recipients may see an untrusted-signer warning unless they verify and trust the certificate. The private signing key and certificate are stored in the ignored `server/data` folder and must never be committed to Git.

This project has a local user profile, but it does not include login, passwords, or multiple user accounts. Personal profile edits only change the name, email, and phone shown in this local workspace.

## Create a production build (optional)

From the VS Code terminal, stop the development server with **Ctrl+C**, then run:

```powershell
npm run build
npm start
```

Open `http://localhost:3001` in your browser. The Express server serves the built frontend and local API.

## Publish to GitHub (final step)

First create a new, empty repository on GitHub. Do not add a README or `.gitignore` there because this project already has those files. Sign in to GitHub in VS Code if it asks you to.

### Option A: VS Code interface

1. Open the `srs_project` folder in VS Code.
2. Select the **Source Control** icon on the left (the branching icon).
3. Choose **Initialize Repository**.
4. Review the listed files. `node_modules` and `server/data` should not appear because `.gitignore` excludes them.
5. Enter a commit message such as `Build BillBloom invoice app`, then select **Commit**. If asked whether to stage all changes, confirm.
6. Select **Publish to GitHub** or **Publish Branch** and choose the empty repository you created.
7. Refresh the GitHub repository page to see the source files.

### Option B: VS Code terminal

Run these commands from this folder. Replace the example remote with the HTTPS address for your GitHub repository:

```powershell
git init
git add .
git commit -m "Build BillBloom invoice app"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

If Git asks for your identity, set it with your name and email:

```powershell
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

GitHub may open a browser sign-in or ask you to authenticate before the first push. Never commit passwords, access tokens, or the local SQLite database.
