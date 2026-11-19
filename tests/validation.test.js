import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCustomer, validateProduct, validateInvoice, validateStatus, validateProfile } from '../server/validation.js';
import { invoiceTotals } from '../src/invoice-calculations.js';

test('customer validation trims fields and rejects malformed email', () => {
  assert.equal(validateCustomer({ name: '  Asha Traders  ', email: 'asha@example.in' }).value.name, 'Asha Traders');
  assert.equal(validateCustomer({ name: 'Asha Traders', email: 'bad-address' }).ok, false);
  assert.equal(validateCustomer({ name: '  ' }).ok, false);
});

test('product validation accepts GST slabs and rejects invalid rate or price', () => {
  assert.equal(validateProduct({ name: 'Paper', price: '12.5', gst: '5' }).value.price, 12.5);
  assert.equal(validateProduct({ name: 'Paper', price: -1, gst: 7 }).ok, false);
});

test('invoice validation requires valid dates and line items', () => {
  const valid = { id: 'inv-1', number: 'BB-1', customerId: 'cus-1', date: '2026-11-19', dueDate: '2026-11-30', status: 'Draft', items: [{ name: 'Service', quantity: 1, price: 500, gst: 18 }], total: 590 };
  assert.equal(validateInvoice(valid).ok, true);
  assert.equal(validateInvoice({ ...valid, total: 0 }).value.total, 590);
  assert.equal(validateInvoice({ ...valid, date: 'tomorrow' }).ok, false);
  assert.equal(validateInvoice({ ...valid, items: [] }).ok, false);
  assert.equal(validateInvoice({ ...valid, items: [{ ...valid.items[0], quantity: 'NaN' }] }).ok, false);
});

test('status and profile validation reject malformed requests', () => {
  assert.equal(validateStatus({ status: 'Paid' }).ok, true);
  assert.equal(validateStatus({ status: 'Unknown' }).ok, false);
  assert.equal(validateProfile({ name: 'Owner', email: 'nope' }, 'account').ok, false);
});

test('invoice totals calculate GST, discount, and rounding correctly', () => {
  const standard = invoiceTotals({ discountRate: 0, items: [{ quantity: 1, price: 1200, gst: 18 }, { quantity: 2, price: 450, gst: 18 }, { quantity: 1, price: 3200, gst: 18 }] });
  assert.deepEqual(standard, { subtotal: 5300, discount: 0, taxable: 5300, tax: 954, total: 6254 });
  const discounted = invoiceTotals({ discountRate: 10, items: [{ quantity: 3, price: 10, gst: 5 }] });
  assert.deepEqual(discounted, { subtotal: 30, discount: 3, taxable: 27, tax: 1.35, total: 28.35 });
  assert.equal(invoiceTotals({ discountRate: 0, items: [{ quantity: 1, price: 1.01, gst: 5 }] }).total, 1.06);
});
