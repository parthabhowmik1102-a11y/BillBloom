import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { useAppContext } from './AppContext.jsx';

const BUSINESS = { name: 'BillBloom Studio', owner: 'Aarav Mehta', gstin: '27AAEPM1234C1Z8', address: '204, Lotus Business Park, Pune, Maharashtra 411001', phone: '+91 98765 10020', email: 'hello@billbloom.in', state: 'Maharashtra', upi: 'billbloom.demo@upi' };
const GST = [0, 5, 12, 18, 28];
const money = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(n) || 0);
const niceDate = (v) => v ? new Date(`${v}T12:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const futureDate = (date, days) => { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
export const makeInvoice = () => {
  const date = new Date().toISOString().slice(0, 10);
  const uid = () => crypto.randomUUID();
  return { id: uid(), number: `BB-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`, customerId: 'cus-sharma', date, dueDate: futureDate(date, 14), status: 'Draft', discountRate: 0, isInterstate: false, notes: 'Thank you for your business.', items: [
    { id: uid(), productId: 'prd-1', name: 'Laptop repair', description: 'Laptop diagnostics and repair service', hsn: '998713', unit: 'service', quantity: 1, price: 1200, gst: 18 },
    { id: uid(), productId: 'prd-2', name: 'HDMI cable', description: '2 metre high-speed HDMI cable', hsn: '854442', unit: 'pcs', quantity: 2, price: 450, gst: 18 },
    { id: uid(), productId: 'prd-3', name: 'SSD 512 GB', description: 'NVMe solid-state drive, 512 GB', hsn: '852351', unit: 'pcs', quantity: 1, price: 3200, gst: 18 },
  ] };
};
export const invoiceTotals = (invoice) => {
  const subtotal = invoice.items.reduce((s, i) => s + Math.max(0, Number(i.quantity) || 0) * Math.max(0, Number(i.price) || 0), 0);
  const discount = subtotal * Math.min(100, Math.max(0, Number(invoice.discountRate) || 0)) / 100;
  const taxable = Math.max(0, subtotal - discount);
  const tax = invoice.items.reduce((s, i) => { const line = (Number(i.quantity) || 0) * (Number(i.price) || 0); return s + (subtotal ? line * taxable / subtotal : 0) * (Number(i.gst) || 0) / 100; }, 0);
  return { subtotal, discount, taxable, tax, total: Math.round((taxable + tax) * 100) / 100 };
};

export default function InvoiceEditor({ invoice, setInvoice, editingSaved = false, onSave, onAddCustomer, notice }) {
  const { data } = useAppContext();
  const preview = useRef(null);
  const [format, setFormat] = useState('A4');
  const [qr, setQr] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const [exportMessage, setExportMessage] = useState('');
  const totals = useMemo(() => invoiceTotals(invoice), [invoice]);
  const profile = invoice.businessSnapshot || data.business || BUSINESS;
  const customer = data.customers.find((c) => c.id === invoice.customerId);
  const edit = (key, value) => setInvoice((old) => ({ ...old, [key]: value }));
  const editLine = (id, key, value) => setInvoice((old) => ({ ...old, items: old.items.map((i) => i.id === id ? { ...i, [key]: value } : i) }));
  const moveLine = (id, by) => setInvoice((old) => { const from = old.items.findIndex((i) => i.id === id); const to = Math.max(0, Math.min(old.items.length - 1, from + by)); const items = [...old.items]; [items[from], items[to]] = [items[to], items[from]]; return { ...old, items }; });
  const addLine = () => setInvoice((old) => ({ ...old, items: [...old.items, { id: crypto.randomUUID(), name: '', description: '', hsn: '', unit: 'pcs', quantity: 1, price: 0, gst: 18 }] }));
  const pickProduct = (rowId, productId) => {
    const p = data.products.find((x) => x.id === productId); if (!p) return;
    const values = { productId: p.id, name: p.name, description: p.description, hsn: p.hsn, unit: p.unit, price: Number(p.price), gst: Number(p.gst) };
    setInvoice((old) => ({ ...old, items: rowId ? old.items.map((i) => i.id === rowId ? { ...i, ...values } : i) : [...old.items, { ...values, id: crypto.randomUUID(), quantity: 1 }] }));
  };
  useEffect(() => {
    const content = `upi://pay?pa=${encodeURIComponent(profile.upi)}&pn=${encodeURIComponent(profile.name)}&am=${totals.total.toFixed(2)}&cu=INR&tn=${encodeURIComponent(invoice.number)}`;
    QRCode.toDataURL(content, { width: 112, margin: 1, color: { dark: '#183a32', light: '#ffffff' } }).then(setQr).catch(() => setQr(''));
  }, [totals.total, invoice.number, profile.upi, profile.name]);
  useEffect(() => {
    let style = document.getElementById('billbloom-print-page-size');
    if (!style) { style = document.createElement('style'); style.id = 'billbloom-print-page-size'; document.head.appendChild(style); }
    style.textContent = format === 'A4'
      ? '@media print { @page { size: A4 portrait; margin: 10mm; } }'
      : '@media print { @page { size: 80mm 220mm; margin: 3mm; } }';
  }, [format]);
  const buildAndSignPdf = async () => {
    const { default: html2pdf } = await import('html2pdf.js');
    const rawPdf = await html2pdf().set({ margin: format === 'A4' ? 8 : 3, filename: `${invoice.number || 'invoice'}.pdf`, image: { type: 'jpeg', quality: .98 }, html2canvas: { scale: 2, backgroundColor: '#fff' }, jsPDF: { unit: 'mm', format: format === 'A4' ? 'a4' : [80, 220], orientation: 'portrait' }, pagebreak: { mode: ['css', 'legacy'] } }).from(preview.current).outputPdf('blob');
    const response = await fetch('/api/sign-pdf', { method: 'POST', headers: { 'Content-Type': 'application/pdf', 'X-Invoice-Number': String(invoice.number || '').replace(/[\r\n]/g, '').slice(0, 80) }, body: rawPdf });
    if (!response.ok) { const error = await response.json().catch(() => ({})); throw new Error(error.error || 'Could not sign the invoice PDF.'); }
    return response.blob();
  };
  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  };
  const exportPdf = async () => {
    setBusyAction('pdf'); setExportMessage('Preparing and digitally signing your invoice…');
    try { const pdf = await buildAndSignPdf(); downloadBlob(pdf, `${invoice.number || 'invoice'}.pdf`); setExportMessage('Signed invoice PDF downloaded. Its local signing certificate is included.'); }
    catch (error) { setExportMessage(error.message); }
    finally { setBusyAction(''); }
  };
  const share = async () => {
    const phone = (customer?.phone || '').replace(/\D/g, '');
    const upiLink = profile.upi ? `upi://pay?pa=${encodeURIComponent(profile.upi)}&pn=${encodeURIComponent(profile.name)}&am=${totals.total.toFixed(2)}&cu=INR&tn=${encodeURIComponent(invoice.number)}` : '';
    const text = `Hello ${customer?.name || 'there'}, invoice ${invoice.number} for ${money(totals.total)} is due on ${niceDate(invoice.dueDate)}. The signed invoice PDF will download now; please attach it to this WhatsApp message.${upiLink ? ` Pay by UPI: ${profile.upi} (${upiLink})` : ''} Thank you — ${profile.name}.`;
    const tab = window.open('about:blank', '_blank');
    setBusyAction('whatsapp'); setExportMessage('Preparing your signed invoice PDF and WhatsApp message…');
    try {
      const pdf = await buildAndSignPdf();
      downloadBlob(pdf, `${invoice.number || 'invoice'}.pdf`);
      if (tab) tab.location.href = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
      setExportMessage('Signed PDF downloaded and WhatsApp message opened. Attach the downloaded PDF in the chat before sending.');
    } catch (error) { if (tab) tab.close(); setExportMessage(error.message); }
    finally { setBusyAction(''); }
  };
  const shareEmail = async () => {
    const subject = `Invoice ${invoice.number} from ${profile.name}`;
    const upiLink = profile.upi ? `upi://pay?pa=${encodeURIComponent(profile.upi)}&pn=${encodeURIComponent(profile.name)}&am=${totals.total.toFixed(2)}&cu=INR&tn=${encodeURIComponent(invoice.number)}` : '';
    const body = `Hello ${customer?.name || 'there'},\n\nPlease find the attached signed invoice.\nInvoice: ${invoice.number}\nAmount due: ${money(totals.total)}\nDue date: ${niceDate(invoice.dueDate)}\n${profile.upi ? `UPI ID: ${profile.upi}\n` : ''}${upiLink ? `Payment link: ${upiLink}\n` : ''}\nThank you,\n${profile.name}`;
    setBusyAction('email'); setExportMessage('Preparing a signed invoice email draft with attachment…');
    try {
      const pdf = await buildAndSignPdf();
      const bytes = new Uint8Array(await pdf.arrayBuffer()); let binary = '';
      for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      const base64Pdf = btoa(binary).replace(/.{1,76}/g, '$&\r\n');
      const bodyBase64 = btoa(unescape(encodeURIComponent(body))).replace(/.{1,76}/g, '$&\r\n');
      const encodedSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
      const safeFilename = `${invoice.number || 'invoice'}.pdf`.replace(/[\\/:*?"<>|\r\n]/g, '_');
      const boundary = `BillBloom_${crypto.randomUUID().replaceAll('-', '')}`;
      const recipient = String(customer?.email || '').replace(/[\r\n]/g, '');
      const eml = [
        `To: ${recipient}`, `Subject: ${encodedSubject}`, 'MIME-Version: 1.0',
        `Content-Type: multipart/mixed; boundary="${boundary}"`, '',
        `--${boundary}`, 'Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '', bodyBase64,
        `--${boundary}`, `Content-Type: application/pdf; name="${safeFilename}"`, `Content-Disposition: attachment; filename="${safeFilename}"`, 'Content-Transfer-Encoding: base64', '', base64Pdf,
        `--${boundary}--`, '',
      ].join('\r\n');
      downloadBlob(new Blob([eml], { type: 'message/rfc822' }), `${invoice.number || 'invoice'}-email-draft.eml`);
      setExportMessage('Email draft downloaded with the signed PDF attached. Open the .eml file in your email app to send it.');
    } catch (error) { setExportMessage(error.message); }
    finally { setBusyAction(''); }
  };

  return <section className="page-content"><div className="page-heading"><div><span className="eyebrow">BILLING WORKSPACE</span><h1>{editingSaved ? 'Edit invoice' : 'Create an invoice'}</h1><p>{editingSaved ? 'Update billing details and save the changes to this invoice.' : 'Fill in the details and BillBloom will take care of the math.'}</p></div><div className="heading-buttons"><button className="button button-primary" onClick={onSave}>{editingSaved ? 'Save changes' : 'Save invoice'} <span>↗</span></button></div></div>
    {notice && <div className="notice" role="status"><span>✓</span>{notice}</div>}
    <div className="invoice-layout"><div className="editor-column">
      <section className="panel editor-panel"><div className="panel-heading"><div className="step-badge">01</div><div><h2>Invoice details</h2><p>Who are you billing today?</p></div><span className={`status status-${invoice.status.toLowerCase()}`}>{invoice.status}</span></div>
        <div className="form-grid">
          <label className="field field-wide"><span>Customer</span><div className="customer-select"><select value={invoice.customerId} onChange={(e) => { const c = data.customers.find((x) => x.id === e.target.value); setInvoice((old) => ({ ...old, customerId: e.target.value, isInterstate: c ? c.state !== profile.state : false })); }}><option value="">Choose a customer…</option>{data.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><button type="button" title="Add customer" onClick={onAddCustomer}>＋</button></div></label>
          <label className="field"><span>Invoice number</span><input value={invoice.number} onChange={(e) => edit('number', e.target.value)} /></label>
          <label className="field"><span>Issue date</span><input type="date" value={invoice.date} onChange={(e) => edit('date', e.target.value)} /></label>
          <label className="field"><span>Due date</span><input type="date" value={invoice.dueDate} onChange={(e) => edit('dueDate', e.target.value)} /></label>
          <label className="field"><span>Discount</span><div className="input-suffix"><input type="number" min="0" max="100" value={invoice.discountRate} onChange={(e) => edit('discountRate', e.target.value)} /><b>%</b></div></label>
        </div>
        <label className="toggle-row"><input type="checkbox" checked={invoice.isInterstate} onChange={(e) => edit('isInterstate', e.target.checked)} /><span className="toggle-ui" /><span><strong>Interstate supply</strong><small>{invoice.isInterstate ? 'IGST will be applied' : 'CGST + SGST will be applied'}</small></span><span className="tax-mode-pill">{invoice.isInterstate ? 'IGST' : 'CGST + SGST'}</span></label>
      </section>
      <section className="panel items-panel"><div className="panel-heading items-heading"><div className="step-badge">02</div><div><h2>Items & services</h2><p>Add everything included in this bill.</p></div><button className="text-button" onClick={addLine}>＋ Add a line</button></div><datalist id="billbloom-product-suggestions">{data.products.map((p) => <option key={p.id} value={p.name}>{`${p.hsn} · ${p.gst}% GST · ${money(p.price)}`}</option>)}</datalist>
        <div className="items-table-wrap"><table className="items-table"><thead><tr><th>ITEM / DESCRIPTION</th><th>QTY</th><th>RATE</th><th>GST</th><th className="right">AMOUNT</th><th /></tr></thead><tbody>{invoice.items.map((item) => <tr key={item.id}>
          <td className="item-name-cell"><div className="item-title-row"><input className="item-name" list="billbloom-product-suggestions" value={item.name} placeholder="Type or choose a catalog item" onChange={(e) => { const value = e.target.value; editLine(item.id, 'name', value); const product = data.products.find((p) => p.name.toLowerCase() === value.trim().toLowerCase()); if (product) pickProduct(item.id, product.id); }} /></div><input className="item-desc" value={item.description || ''} placeholder={item.hsn ? `Description · HSN ${item.hsn}` : 'Add a short description'} onChange={(e) => editLine(item.id, 'description', e.target.value)} /></td>
          <td><input className="cell-input qty-input" type="number" min="0" value={item.quantity} onChange={(e) => editLine(item.id, 'quantity', e.target.value)} /></td>
          <td><div className="cell-currency"><span>₹</span><input className="cell-input rate-input" type="number" min="0" step="0.01" value={item.price} onChange={(e) => editLine(item.id, 'price', e.target.value)} /></div></td>
          <td><select className="gst-select" value={item.gst} onChange={(e) => editLine(item.id, 'gst', e.target.value)}>{GST.map((r) => <option key={r} value={r}>{r}%</option>)}</select></td>
          <td className="amount-cell">{money((Number(item.quantity) || 0) * (Number(item.price) || 0))}</td><td className="line-actions"><button className="move-line" aria-label="Move item up" title="Move up" onClick={() => moveLine(item.id, -1)}>↑</button><button className="move-line" aria-label="Move item down" title="Move down" onClick={() => moveLine(item.id, 1)}>↓</button><button className="remove-line" aria-label="Remove item" title="Remove item" onClick={() => setInvoice((old) => ({ ...old, items: old.items.filter((x) => x.id !== item.id) }))}>×</button></td>
        </tr>)}</tbody></table></div>
        <button className="add-line-dashed" onClick={addLine}>＋ Add another line item</button><div className="catalog-note"><span>✦</span> Start typing or choose a saved item from the product catalog.</div>
      </section>
      <section className="panel notes-panel"><div className="panel-heading compact-heading"><div className="step-badge">03</div><div><h2>Notes & terms</h2><p>A little note goes a long way.</p></div></div><textarea value={invoice.notes || ''} onChange={(e) => edit('notes', e.target.value)} rows="3" placeholder="Add a thank-you note or payment terms…" /></section>
    </div>
    <div className="preview-column"><div className="preview-toolbar"><div><strong>Live preview</strong><span className="live-dot" /><small>Updates automatically</small></div><select value={format} onChange={(e) => setFormat(e.target.value)} aria-label="Invoice print size"><option>A4</option><option>Receipt</option></select></div>
      <div className="preview-paper-wrap"><article ref={preview} className={`invoice-paper ${format === 'Receipt' ? 'receipt-mode' : ''}`}>
        <div className="paper-top-line"/><div className="paper-brand-row"><div className="paper-brand">{profile.logoData ? <img className="paper-logo" src={profile.logoData} alt="Business logo"/> : <span className="paper-mark">{profile.logoText || profile.name.slice(0, 1)}</span>}<div><strong>{profile.name}</strong><small>Thoughtful billing, beautifully done.</small></div></div><div className="invoice-label"><span>INVOICE</span><strong>{invoice.number}</strong></div></div><div className="paper-rule"/>
        <div className="paper-parties"><div><span className="paper-overline">BILLED TO</span><strong>{customer?.name || 'Customer name'}</strong><p>{customer?.address || 'Customer address'}</p>{customer?.gstin && <small>GSTIN: {customer.gstin}</small>}</div><div className="paper-from"><span className="paper-overline">FROM</span><strong>{profile.owner}</strong><p>{profile.address}</p><small>GSTIN: {profile.gstin}</small></div></div>
        <div className="paper-dates"><div><span>ISSUED</span><strong>{niceDate(invoice.date)}</strong></div><div><span>DUE DATE</span><strong>{niceDate(invoice.dueDate)}</strong></div><div><span>STATUS</span><strong>{invoice.status}</strong></div></div>
        <table className="paper-items"><thead><tr><th>DESCRIPTION</th><th>QTY</th><th>RATE</th><th>AMOUNT</th></tr></thead><tbody>{invoice.items.map((item) => <tr key={item.id}><td><strong>{item.name || 'Item name'}</strong><small>{item.description || (item.hsn ? `HSN ${item.hsn}` : '—')}</small></td><td>{item.quantity || 0}</td><td>{money(item.price)}</td><td>{money((Number(item.quantity) || 0) * (Number(item.price) || 0))}</td></tr>)}</tbody></table>
        <div className="paper-bottom"><div className="paper-note"><strong>A note from us</strong><p>{invoice.notes || 'Thank you for your business.'}</p>{profile.upi && <div className="pay-qr">{qr && <img src={qr} alt="UPI payment QR code"/>}<span>Scan to pay<br/><b>{profile.upi}</b></span></div>}</div><div className="paper-totals"><div><span>Subtotal</span><b>{money(totals.subtotal)}</b></div>{totals.discount > 0 && <div><span>Discount ({invoice.discountRate}%)</span><b>−{money(totals.discount)}</b></div>}<div><span>Taxable amount</span><b>{money(totals.taxable)}</b></div>{invoice.isInterstate ? <div><span>IGST</span><b>{money(totals.tax)}</b></div> : <><div><span>CGST</span><b>{money(totals.tax / 2)}</b></div><div><span>SGST</span><b>{money(totals.tax / 2)}</b></div></>}<div className="paper-grand"><span>Total due</span><b>{money(totals.total)}</b></div></div></div>
        <div className="paper-signature-note">A cryptographic PDF signature is embedded when this invoice is exported.</div><div className="paper-footer"><span>{profile.email} · {profile.phone}</span><span>Made with care by BillBloom</span></div>
      </article></div>
      <div className="preview-actions"><button className="button button-outline" disabled={Boolean(busyAction)} onClick={() => window.print()}>⎙ Print</button><button className="button button-outline" disabled={Boolean(busyAction)} onClick={share}>↗ WhatsApp</button><button className="button button-outline" disabled={Boolean(busyAction)} onClick={shareEmail}>{busyAction === 'email' ? 'Preparing…' : '✉ Email PDF'}</button><button className="button button-primary" disabled={Boolean(busyAction)} onClick={exportPdf}>{busyAction === 'pdf' ? 'Signing…' : '↓ Export signed PDF'}</button></div>{exportMessage && <p className="export-message" role="status">{exportMessage}</p>}<p className="preview-hint">PDFs are signed with a local certificate. <a href="/api/signing-certificate" download>Download signing certificate</a>. Email creates an .eml draft with the signed PDF attached.</p>
    </div></div>
  </section>;
}
