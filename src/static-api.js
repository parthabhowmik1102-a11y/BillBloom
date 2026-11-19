import seedData from '../server/sample-data.json';

const STORAGE_KEY = 'billbloom-static-workspace-v1';
export const STATIC_HOSTING = import.meta.env.VITE_STATIC_HOSTING === 'true';
const defaults = () => ({
  account: { name: 'Aarav Mehta', email: 'aarav@example.com', phone: '+91 98765 10020' },
  business: { name: 'BillBloom Studio', owner: 'Aarav Mehta', gstin: '27AAEPM1234C1Z8', address: '204, Lotus Business Park, Pune, Maharashtra 411001', phone: '+91 98765 10020', email: 'hello@billbloom.in', state: 'Maharashtra', upi: 'billbloom.demo@upi', logoData: '' },
  sampleBusinesses: seedData.businesses,
  customers: seedData.customers.map((customer) => ({ ...customer, created_at: new Date().toISOString() })),
  products: seedData.products.map((product, index) => ({ ...product, id: `prd-${index + 1}` })),
  invoices: [],
});

function readStore() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return defaults();
    const parsed = JSON.parse(saved);
    const initial = defaults();
    return { ...initial, ...parsed, customers: Array.isArray(parsed.customers) ? parsed.customers : initial.customers, products: Array.isArray(parsed.products) ? parsed.products : initial.products, invoices: Array.isArray(parsed.invoices) ? parsed.invoices : [] };
  } catch {
    return defaults();
  }
}

function writeStore(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function response(status, body = null) {
  return { ok: status >= 200 && status < 300, status, async json() { return body; }, async blob() { return body; } };
}

const failure = (message, status = 400) => response(status, { error: message });

export async function apiFetch(url, options = {}) {
  if (!STATIC_HOSTING) return fetch(url, options);
  const pathname = new URL(url, window.location.href).pathname.replace(/^\/BillBloom(?=\/)/, '');
  const method = String(options.method || 'GET').toUpperCase();
  let body = {};
  if (options.body) {
    try { body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body; }
    catch { return failure('The request body must contain valid JSON.'); }
  }
  const state = readStore();

  if (pathname === '/api/bootstrap' && method === 'GET') return response(200, state);
  if (pathname === '/api/business' && method === 'PUT') { state.business = { ...state.business, ...body }; writeStore(state); return response(200, state.business); }
  if (pathname === '/api/account' && method === 'PUT') { state.account = { ...state.account, ...body }; writeStore(state); return response(200, state.account); }
  if (pathname === '/api/customers' && method === 'POST') {
    if (!String(body.name || '').trim()) return failure('Customer name is required.');
    const customer = { id: `cus-${crypto.randomUUID()}`, name: String(body.name).trim(), email: body.email || '', phone: body.phone || '', gstin: body.gstin || '', address: body.address || '', state: body.state || 'Maharashtra', created_at: new Date().toISOString() };
    state.customers.push(customer); writeStore(state); return response(201, customer);
  }
  const customerMatch = pathname.match(/^\/api\/customers\/([^/]+)$/);
  if (customerMatch && method === 'PUT') {
    const index = state.customers.findIndex((customer) => customer.id === decodeURIComponent(customerMatch[1]));
    if (index < 0) return failure('Customer not found.', 404);
    if (!String(body.name || '').trim()) return failure('Customer name is required.');
    state.customers[index] = { ...state.customers[index], ...body, name: String(body.name).trim() }; writeStore(state); return response(200, state.customers[index]);
  }
  if (pathname === '/api/customers' && method === 'GET') return response(200, state.customers);
  if (customerMatch && method === 'DELETE') {
    const id = decodeURIComponent(customerMatch[1]);
    if (state.invoices.some((invoice) => invoice.customerId === id)) return failure('This customer has invoices and cannot be removed.', 409);
    state.customers = state.customers.filter((customer) => customer.id !== id); writeStore(state); return response(204);
  }
  if (pathname === '/api/products' && method === 'POST') {
    if (!String(body.name || '').trim()) return failure('Product name is required.');
    const product = { ...body, id: `prd-${crypto.randomUUID()}`, name: String(body.name).trim(), price: Number(body.price) || 0, gst: Number(body.gst ?? 18) };
    state.products.push(product); writeStore(state); return response(201, product);
  }
  const productMatch = pathname.match(/^\/api\/products\/([^/]+)$/);
  if (productMatch && method === 'PUT') {
    const index = state.products.findIndex((product) => product.id === decodeURIComponent(productMatch[1]));
    if (index < 0) return failure('Catalog item not found.', 404);
    state.products[index] = { ...state.products[index], ...body, name: String(body.name || '').trim(), price: Number(body.price) || 0, gst: Number(body.gst ?? 18) }; writeStore(state); return response(200, state.products[index]);
  }
  if (pathname === '/api/invoices' && method === 'POST') {
    if (!body.id || !body.number || !body.customerId || !Array.isArray(body.items)) return failure('Invoice, number, customer, and line items are required.');
    if (!state.customers.some((customer) => customer.id === body.customerId)) return failure('Choose a saved customer before saving an invoice.');
    const index = state.invoices.findIndex((invoice) => invoice.id === body.id);
    if (index < 0) state.invoices.push(body); else state.invoices[index] = body;
    writeStore(state); return response(201, body);
  }
  const statusMatch = pathname.match(/^\/api\/invoices\/([^/]+)\/status$/);
  if (statusMatch && method === 'PATCH') {
    const invoice = state.invoices.find((item) => item.id === decodeURIComponent(statusMatch[1]));
    if (!invoice) return failure('Invoice not found.', 404);
    if (!['Draft', 'Sent', 'Paid', 'Overdue'].includes(body.status)) return failure('Invalid invoice status.');
    invoice.status = body.status; invoice.paidAt = body.status === 'Paid' ? (invoice.paidAt || new Date().toISOString()) : null;
    writeStore(state); return response(200, invoice);
  }
  if (pathname === '/api/health' && method === 'GET') return response(200, { ok: true, static: true });
  return failure('This feature is not available in the static GitHub Pages version.', 404);
}
