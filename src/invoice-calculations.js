export function invoiceTotals(invoice) {
  const subtotal = invoice.items.reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0) * Math.max(0, Number(item.price) || 0), 0);
  const discount = subtotal * Math.min(100, Math.max(0, Number(invoice.discountRate) || 0)) / 100;
  const taxable = Math.max(0, subtotal - discount);
  const tax = invoice.items.reduce((sum, item) => {
    const line = (Number(item.quantity) || 0) * (Number(item.price) || 0);
    return sum + (subtotal ? line * taxable / subtotal : 0) * (Number(item.gst) || 0) / 100;
  }, 0);
  return { subtotal, discount, taxable, tax, total: Math.round((taxable + tax) * 100) / 100 };
}
