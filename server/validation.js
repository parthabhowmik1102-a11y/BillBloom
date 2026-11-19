const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value, field, { required = false, max = 500 } = {}) => {
  if (value == null) value = '';
  if (typeof value !== 'string') return `${field} must be text.`;
  const clean = value.trim();
  if (required && !clean) return `${field} is required.`;
  if (clean.length > max) return `${field} must be ${max} characters or fewer.`;
  return null;
};
const numeric = (value, field, { required = false, min = 0, max = Number.MAX_SAFE_INTEGER } = {}) => {
  if (value == null && !required) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return `${field} must be a valid number.`;
  if (number < min || number > max) return `${field} must be between ${min} and ${max}.`;
  return null;
};
const date = (value, field) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${field} must be a valid date in YYYY-MM-DD format.`;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? null : `${field} must be a valid date in YYYY-MM-DD format.`;
};

function result(value, errors) { return errors.length ? { ok: false, errors } : { ok: true, value }; }
function shape(input, label) { return isRecord(input) ? null : `${label} must be an object.`; }

export function validateCustomer(input) {
  const errors = []; const shapeError = shape(input, 'Customer'); if (shapeError) return result(null, [shapeError]);
  const fields = { name: 120, email: 254, phone: 40, gstin: 20, address: 300, state: 80 };
  for (const [field, max] of Object.entries(fields)) { const error = text(input[field], field, { required: field === 'name', max }); if (error) errors.push(error); }
  const email = String(input.email || '').trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('email must be a valid email address.');
  return result(Object.fromEntries(Object.keys(fields).map((field) => [field, String(input[field] ?? '').trim()])), errors);
}

export function validateProduct(input) {
  const errors = []; const shapeError = shape(input, 'Product'); if (shapeError) return result(null, [shapeError]);
  const fields = { name: 120, description: 300, hsn: 30, unit: 30 };
  for (const [field, max] of Object.entries(fields)) { const error = text(input[field], field, { required: field === 'name', max }); if (error) errors.push(error); }
  const priceError = numeric(input.price ?? 0, 'price'); if (priceError) errors.push(priceError);
  const gst = Number(input.gst ?? 18);
  if (![0, 5, 12, 18, 28].includes(gst)) errors.push('gst must be one of 0, 5, 12, 18, or 28.');
  return result({ ...Object.fromEntries(Object.keys(fields).map((field) => [field, String(input[field] ?? '').trim()])), price: Number(input.price ?? 0), gst }, errors);
}

export function validateInvoice(input) {
  const errors = []; const shapeError = shape(input, 'Invoice'); if (shapeError) return result(null, [shapeError]);
  for (const field of ['id', 'number', 'customerId']) { const error = text(input[field], field, { required: true, max: 120 }); if (error) errors.push(error); }
  for (const field of ['date', 'dueDate']) { const error = date(input[field], field); if (error) errors.push(error); }
  if (typeof input.date === 'string' && typeof input.dueDate === 'string' && input.dueDate < input.date) errors.push('dueDate cannot be before the invoice date.');
  const discountRate = Number(input.discountRate ?? 0);
  if (!Number.isFinite(discountRate) || discountRate < 0 || discountRate > 100) errors.push('discountRate must be between 0 and 100.');
  if (input.status != null && !['Draft', 'Sent', 'Paid', 'Overdue'].includes(input.status)) errors.push('status must be Draft, Sent, Paid, or Overdue.');
  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 100) errors.push('items must contain between 1 and 100 line items.');
  else input.items.forEach((item, index) => {
    const label = `items[${index}]`;
    if (!isRecord(item)) { errors.push(`${label} must be an object.`); return; }
    const nameError = text(item.name, `${label}.name`, { required: true, max: 200 }); if (nameError) errors.push(nameError);
    for (const field of ['quantity', 'price']) { const error = numeric(item[field], `${label}.${field}`, { required: true, min: field === 'quantity' ? 0.01 : 0, max: 1_000_000_000 }); if (error) errors.push(error); }
    const gstError = numeric(item.gst, `${label}.gst`, { required: true, max: 100 }); if (gstError) errors.push(gstError);
    if (item.gst != null && ![0, 5, 12, 18, 28].includes(Number(item.gst))) errors.push(`${label}.gst must use a supported GST slab.`);
  });
  for (const field of ['total', 'subtotal', 'tax', 'discount']) if (input[field] != null) { const error = numeric(input[field], field, { max: 1_000_000_000 }); if (error) errors.push(error); }
  const safeItems = (Array.isArray(input.items) ? input.items : []).filter(isRecord);
  const totals = invoiceTotals({ items: safeItems, discountRate: Number.isFinite(discountRate) ? discountRate : 0 });
  return result({ ...input, ...totals }, errors);
}

export function validateStatus(input) {
  if (!isRecord(input) || !['Draft', 'Sent', 'Paid', 'Overdue'].includes(input.status)) return result(null, ['status must be Draft, Sent, Paid, or Overdue.']);
  return result({ status: input.status }, []);
}

export function validateProfile(input, kind) {
  const errors = []; const shapeError = shape(input, kind); if (shapeError) return result(null, [shapeError]);
  const fields = kind === 'account'
    ? { name: 120, email: 254, phone: 40 }
    : { name: 160, owner: 120, gstin: 20, address: 300, phone: 40, email: 254, state: 80, upi: 120, logoData: 4_000_000 };
  for (const [field, max] of Object.entries(fields)) { const error = text(input[field], field, { required: field === 'name', max }); if (error) errors.push(error); }
  const email = String(input.email || '').trim(); if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('email must be a valid email address.');
  return result(input, errors);
}

export function sendValidationError(res, validation) {
  return res.status(400).json({ error: validation.errors[0], details: validation.errors });
}
import { invoiceTotals } from '../src/invoice-calculations.js';

