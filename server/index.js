import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLocalInvoiceSigner } from './signing.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, 'data');
const sampleData = JSON.parse(fs.readFileSync(path.join(__dirname, 'sample-data.json'), 'utf8'));
fs.mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(path.join(dataDir, 'billbloom.sqlite'));
const invoiceSigner = createLocalInvoiceSigner(dataDir);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT DEFAULT '', phone TEXT DEFAULT '',
    gstin TEXT DEFAULT '', address TEXT DEFAULT '', state TEXT DEFAULT 'Maharashtra',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT DEFAULT '',
    hsn TEXT DEFAULT '', unit TEXT DEFAULT 'pcs', price REAL NOT NULL DEFAULT 0, gst REAL NOT NULL DEFAULT 18
  );
  CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY, number TEXT NOT NULL UNIQUE, customer_id TEXT NOT NULL,
    date TEXT NOT NULL, due_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Draft',
    total REAL NOT NULL DEFAULT 0, payload TEXT NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );
  CREATE TABLE IF NOT EXISTS business_profile (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS account_profile (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
`);
const defaultBusiness = {
  name: 'BillBloom Studio', owner: 'Aarav Mehta', gstin: '27AAEPM1234C1Z8',
  address: '204, Lotus Business Park, Pune, Maharashtra 411001', phone: '+91 98765 10020',
  email: 'hello@billbloom.in', state: 'Maharashtra', upi: 'billbloom.demo@upi', logoData: '',
};
if (!db.prepare('SELECT id FROM business_profile WHERE id=?').get('default')) {
  db.prepare('INSERT INTO business_profile (id,payload) VALUES (?,?)').run('default', JSON.stringify(defaultBusiness));
}
const defaultAccount = { name: 'Aarav Mehta', email: 'aarav@example.com', phone: '+91 98765 10020' };
if (!db.prepare('SELECT id FROM account_profile WHERE id=?').get('default')) {
  db.prepare('INSERT INTO account_profile (id,payload) VALUES (?,?)').run('default', JSON.stringify(defaultAccount));
}

const insertCustomer = db.prepare(`INSERT OR IGNORE INTO customers (id,name,email,phone,gstin,address,state,created_at)
  VALUES (?,?,?,?,?,?,?,?)`);
for (const customer of sampleData.customers) {
  insertCustomer.run(customer.id, customer.name, customer.email, customer.phone, customer.gstin, customer.address, customer.state, new Date().toISOString());
}
const insertProduct = db.prepare('INSERT OR IGNORE INTO products (id,name,description,hsn,unit,price,gst) VALUES (?,?,?,?,?,?,?)');
sampleData.products.forEach((product, index) => insertProduct.run(`prd-${index + 1}`, product.name, product.description, product.hsn, product.unit, product.price, product.gst));

const app = express();
app.use(express.json({ limit: '5mb' }));
const getBusiness = () => JSON.parse(db.prepare('SELECT payload FROM business_profile WHERE id=?').get('default').payload);
const getAccount = () => JSON.parse(db.prepare('SELECT payload FROM account_profile WHERE id=?').get('default').payload);
const allCustomers = () => db.prepare('SELECT * FROM customers ORDER BY name').all();
const allProducts = () => db.prepare('SELECT * FROM products ORDER BY name').all();
const allInvoices = () => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const rows = db.prepare('SELECT id,payload FROM invoices ORDER BY date DESC, number DESC').all();
  return rows.map((row) => {
    const invoice = JSON.parse(row.payload);
    if (invoice.status === 'Sent' && invoice.dueDate && invoice.dueDate < today) {
      invoice.status = 'Overdue';
      db.prepare('UPDATE invoices SET status=?,payload=? WHERE id=?').run('Overdue', JSON.stringify(invoice), row.id);
    }
    return invoice;
  });
};

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/bootstrap', (_req, res) => res.json({ account: getAccount(), business: getBusiness(), sampleBusinesses: sampleData.businesses, customers: allCustomers(), products: allProducts(), invoices: allInvoices() }));
app.get('/api/signing-certificate', (_req, res) => {
  res.type('application/x-pem-file').set('Content-Disposition', 'attachment; filename="billbloom-signing-certificate.pem"')
    .sendFile(invoiceSigner.certificatePath);
});
app.post('/api/sign-pdf', express.raw({ type: 'application/pdf', limit: '15mb' }), async (req, res) => {
  try {
    const safeNumber = String(req.get('x-invoice-number') || 'BillBloom invoice').replace(/[\r\n]/g, '').slice(0, 80);
    const signedPdf = await invoiceSigner.sign(req.body, safeNumber);
    res.type('application/pdf').set('Content-Disposition', `attachment; filename="${safeNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf"`).send(signedPdf);
  } catch (error) {
    console.error('PDF signing failed:', error.message);
    res.status(500).json({ error: 'BillBloom could not sign this PDF. Please try exporting again.' });
  }
});
app.put('/api/account', (req, res) => {
  const account = { ...defaultAccount, ...(req.body || {}) };
  if (!account.name?.trim()) return res.status(400).json({ error: 'Your name is required.' });
  account.name = account.name.trim();
  db.prepare('INSERT INTO account_profile (id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload')
    .run('default', JSON.stringify(account));
  res.json(account);
});
app.put('/api/business', (req, res) => {
  const profile = { ...defaultBusiness, ...(req.body || {}) };
  if (!profile.name?.trim()) return res.status(400).json({ error: 'Business name is required.' });
  profile.name = profile.name.trim();
  db.prepare('INSERT INTO business_profile (id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload')
    .run('default', JSON.stringify(profile));
  res.json(profile);
});
app.get('/api/customers', (_req, res) => res.json(allCustomers()));
app.post('/api/customers', (req, res) => {
  const { id, name, email = '', phone = '', gstin = '', address = '', state = '' } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'Customer name is required.' });
  const customerId = id || `cus-${randomUUID()}`;
  try {
    db.prepare(`INSERT INTO customers (id,name,email,phone,gstin,address,state,created_at) VALUES (?,?,?,?,?,?,?,?)`)
      .run(customerId, name.trim(), email.trim(), phone.trim(), gstin.trim(), address.trim(), state.trim() || 'Maharashtra', new Date().toISOString());
    res.status(201).json(db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId));
  } catch (error) { res.status(400).json({ error: error.message }); }
});
app.put('/api/customers/:id', (req, res) => {
  const { name, email = '', phone = '', gstin = '', address = '', state = '' } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'Customer name is required.' });
  const result = db.prepare('UPDATE customers SET name=?,email=?,phone=?,gstin=?,address=?,state=? WHERE id=?')
    .run(name.trim(), email.trim(), phone.trim(), gstin.trim(), address.trim(), state.trim(), req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Customer not found.' });
  res.json(db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id));
});
app.delete('/api/customers/:id', (req, res) => {
  const count = db.prepare('SELECT COUNT(*) AS n FROM invoices WHERE customer_id=?').get(req.params.id).n;
  if (count) return res.status(409).json({ error: 'This customer has invoices and cannot be removed.' });
  db.prepare('DELETE FROM customers WHERE id=?').run(req.params.id);
  res.status(204).end();
});
app.post('/api/products', (req, res) => {
  const { name, description = '', hsn = '', unit = 'pcs', price = 0, gst = 18 } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'Product name is required.' });
  const id = `prd-${randomUUID()}`;
  db.prepare('INSERT INTO products (id,name,description,hsn,unit,price,gst) VALUES (?,?,?,?,?,?,?)')
    .run(id, name.trim(), description.trim(), hsn.trim(), unit, Number(price) || 0, Number(gst) || 0);
  res.status(201).json(db.prepare('SELECT * FROM products WHERE id=?').get(id));
});
app.put('/api/products/:id', (req, res) => {
  const { name, description = '', hsn = '', unit = 'pcs', price = 0, gst = 18 } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'Product name is required.' });
  const result = db.prepare('UPDATE products SET name=?,description=?,hsn=?,unit=?,price=?,gst=? WHERE id=?')
    .run(name.trim(), description.trim(), hsn.trim(), unit.trim() || 'pcs', Number(price) || 0, Number(gst) || 0, req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Catalog item not found.' });
  res.json(db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id));
});
app.post('/api/invoices', (req, res) => {
  const invoice = req.body || {};
  if (!invoice.id || !invoice.number || !invoice.customerId) return res.status(400).json({ error: 'Invoice, number, and customer are required.' });
  const customer = db.prepare('SELECT id FROM customers WHERE id=?').get(invoice.customerId);
  if (!customer) return res.status(400).json({ error: 'Choose a saved customer before saving this invoice.' });
  const payload = JSON.stringify(invoice);
  try {
    db.prepare(`INSERT INTO invoices (id,number,customer_id,date,due_date,status,total,payload) VALUES (?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET number=excluded.number, customer_id=excluded.customer_id, date=excluded.date,
      due_date=excluded.due_date, status=excluded.status, total=excluded.total, payload=excluded.payload`)
      .run(invoice.id, invoice.number, invoice.customerId, invoice.date, invoice.dueDate, invoice.status || 'Draft', Number(invoice.total) || 0, payload);
    res.status(201).json(invoice);
  } catch (error) { res.status(400).json({ error: error.message }); }
});
app.patch('/api/invoices/:id/status', (req, res) => {
  const valid = ['Draft', 'Sent', 'Paid', 'Overdue'];
  if (!valid.includes(req.body?.status)) return res.status(400).json({ error: 'Invalid invoice status.' });
  const row = db.prepare('SELECT payload FROM invoices WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Invoice not found.' });
  const invoice = JSON.parse(row.payload);
  invoice.status = req.body.status;
  invoice.paidAt = invoice.status === 'Paid' ? (invoice.paidAt || new Date().toISOString()) : null;
  db.prepare('UPDATE invoices SET status=?,payload=? WHERE id=?').run(invoice.status, JSON.stringify(invoice), invoice.id);
  res.json(invoice);
});
app.delete('/api/invoices/:id', (req, res) => {
  db.prepare('DELETE FROM invoices WHERE id=?').run(req.params.id);
  res.status(204).end();
});

const dist = path.resolve(__dirname, '../dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}
const port = Number(process.env.PORT) || 3001;
app.listen(port, '127.0.0.1', () => console.log(`BillBloom API ready at http://localhost:${port}`));
