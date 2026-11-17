import { useEffect, useState } from 'react';

const money = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(n) || 0);
const dateText = (v) => v ? new Date(`${v}T12:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const badge = (s) => `status status-${String(s || 'draft').toLowerCase()}`;
const rates = [0, 5, 12, 18, 28];
const localDateKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
const paidDateKey = (invoice) => {
  if (!invoice.paidAt) return invoice.date || '';
  const paidDate = new Date(invoice.paidAt);
  return Number.isNaN(paidDate.getTime()) ? invoice.date || '' : localDateKey(paidDate);
};

export function Customers({ data, selectedId, onSelect, onAdd, onEdit, onOpen }) {
  const [query, setQuery] = useState('');
  const people = data.customers.filter((c) => `${c.name} ${c.email} ${c.gstin}`.toLowerCase().includes(query.toLowerCase()));
  const selected = data.customers.find((c) => c.id === selectedId) || people[0];
  const history = data.invoices.filter((i) => i.customerId === selected?.id).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return <section className="page-content"><div className="page-heading"><div><span className="eyebrow">YOUR PEOPLE</span><h1>Customers</h1><p>Keep customer details and every purchase in one place.</p></div><button className="button button-primary" onClick={onAdd}>＋ Add customer</button></div>
    <div className="customer-layout"><section className="panel customer-list"><div className="search-row"><div className="search-box"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search customers…"/></div><span className="count-pill">{people.length} total</span></div>{people.map((c, index) => { const count = data.invoices.filter((i) => i.customerId === c.id).length; return <button key={c.id} className={`customer-row ${selected?.id === c.id ? 'selected' : ''}`} onClick={() => onSelect(c.id)}><span className={`customer-avatar ca-${index % 4}`}>{c.name.slice(0, 1).toUpperCase()}</span><span className="customer-row-copy"><strong>{c.name}</strong><small>{c.email || c.phone || c.state}</small></span><span className="customer-count">{count} {count === 1 ? 'invoice' : 'invoices'}</span></button>; })}{!people.length && <Empty title="No customers found" text="Try another search or add a customer." action="Add customer" onAction={onAdd}/>}</section>
      <section className="panel history-panel">{selected ? <><div className="history-head"><span className="customer-avatar ca-0">{selected.name.slice(0, 1).toUpperCase()}</span><div><span className="eyebrow">CUSTOMER PROFILE</span><h2>{selected.name}</h2><p>{selected.email || 'No email added'} · {selected.phone || 'No phone added'}</p></div><span className="history-count">{history.length} invoices</span><button className="button button-outline small-action" onClick={() => onEdit(selected)}>Edit customer</button></div><div className="profile-details"><div><span>GSTIN</span><strong>{selected.gstin || 'Not provided'}</strong></div><div><span>STATE</span><strong>{selected.state || '—'}</strong></div><div className="address-detail"><span>BILLING ADDRESS</span><strong>{selected.address || 'No address saved'}</strong></div></div><div className="history-subhead"><h3>Purchase history</h3><span>Open an invoice to edit its billing details.</span></div>{history.length ? <div className="history-list">{history.map((i) => <button key={i.id} className="history-item" onClick={() => onOpen(i)}><span className="history-doc">▤</span><span className="history-item-main"><strong>{i.number}</strong><small>{dateText(i.date)} · Due {dateText(i.dueDate)}{i.paidAt ? ` · Paid ${new Date(i.paidAt).toLocaleDateString('en-IN')}` : ''}</small></span><span className="history-total">{money(i.total)}</span><span className={badge(i.status)}>{i.status}</span><span className="history-chevron">Edit ›</span></button>)}</div> : <div className="history-empty">No invoices yet. Saved invoices for this customer will appear here.</div>}</> : <Empty title="Your customers live here" text="Choose a customer to see their profile and purchase history." action="Add customer" onAction={onAdd}/>}</section></div>
  </section>;
}

export function CustomerForm({ customer, onClose, onSave }) {
  const [error, setError] = useState('');
  async function submit(event) { event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget).entries()); try { await onSave(values); } catch (e) { setError(e.message); } }
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><form className="modal-card" onSubmit={submit}>
    <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button><span className="eyebrow">CUSTOMER DIRECTORY</span><h2>{customer ? 'Edit customer' : 'Add a customer'}</h2><p>Update their saved billing details.</p>
    <label className="field"><span>Business or customer name *</span><input name="name" required defaultValue={customer?.name || ''} placeholder="e.g. Acme Retail"/></label><div className="modal-grid"><label className="field"><span>Email</span><input name="email" type="email" defaultValue={customer?.email || ''} placeholder="billing@example.com"/></label><label className="field"><span>Phone</span><input name="phone" defaultValue={customer?.phone || ''} placeholder="+91 …"/></label></div><label className="field"><span>Billing address</span><input name="address" defaultValue={customer?.address || ''} placeholder="Street, city, PIN code"/></label><div className="modal-grid"><label className="field"><span>GSTIN</span><input name="gstin" defaultValue={customer?.gstin || ''} placeholder="Optional"/></label><label className="field"><span>State</span><input name="state" defaultValue={customer?.state || 'Maharashtra'}/></label></div>{error && <div className="form-error">{error}</div>}
    <div className="modal-actions"><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button className="button button-primary">{customer ? 'Save changes' : 'Save customer'}</button></div>
  </form></div>;
}

export function BusinessProfile({ data, onSave, notice }) {
  const [profile, setProfile] = useState(data.business || {});
  const [error, setError] = useState('');
  const change = (key, value) => setProfile((old) => ({ ...old, [key]: value }));
  function chooseLogo(event) {
    const file = event.target.files?.[0]; if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Choose an image file for your logo.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, 480 / image.width, 220 / image.height);
        const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        change('logoData', canvas.toDataURL('image/png')); setError('');
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }
  async function submit(event) { event.preventDefault(); setError(''); try { await onSave(profile); } catch (e) { setError(e.message); } }
  return <section className="page-content"><div className="page-heading"><div><span className="eyebrow">YOUR BUSINESS DETAILS</span><h1>Business profile</h1><p>These details appear on your invoices and payment QR code.</p></div></div>{notice && <div className="notice"><span>✓</span>{notice}</div>}
    <form className="panel business-form" onSubmit={submit}><div className="business-form-head"><div><h2>Invoice identity</h2><p>Update your business name, contact details, tax registration, and UPI ID.</p></div>{data.sampleBusinesses?.length > 0 && <label className="sample-business-picker"><span>Load an example</span><select defaultValue="" onChange={(e) => { const example = data.sampleBusinesses.find((b) => b.name === e.target.value); if (example) { setProfile({ ...example, logoData: example.logoData || '' }); setError(''); } }}><option value="">Choose a sample business</option>{data.sampleBusinesses.map((b) => <option key={b.name} value={b.name}>{b.name}</option>)}</select></label>}<div className="logo-preview">{profile.logoData ? <img src={profile.logoData} alt="Business logo preview"/> : <span>{profile.logoText || profile.name?.slice(0, 1) || 'B'}</span>}</div></div>
      <div className="business-fields"><label className="field"><span>Business name *</span><input value={profile.name || ''} required onChange={(e) => change('name', e.target.value)}/></label><label className="field"><span>Owner / contact name</span><input value={profile.owner || ''} onChange={(e) => change('owner', e.target.value)}/></label><label className="field field-wide"><span>Business address</span><input value={profile.address || ''} onChange={(e) => change('address', e.target.value)}/></label><label className="field"><span>GSTIN</span><input value={profile.gstin || ''} onChange={(e) => change('gstin', e.target.value)}/></label><label className="field"><span>State</span><input value={profile.state || ''} onChange={(e) => change('state', e.target.value)}/></label><label className="field"><span>Phone</span><input value={profile.phone || ''} onChange={(e) => change('phone', e.target.value)}/></label><label className="field"><span>Email</span><input type="email" value={profile.email || ''} onChange={(e) => change('email', e.target.value)}/></label><label className="field"><span>UPI ID</span><input value={profile.upi || ''} onChange={(e) => change('upi', e.target.value)} placeholder="name@bank"/></label><label className="field"><span>Logo monogram</span><input maxLength="3" value={profile.logoText || ''} onChange={(e) => change('logoText', e.target.value)} placeholder="B"/></label></div>
      <div className="logo-control"><label className="field"><span>Upload a logo image (optional)</span><input type="file" accept="image/*" onChange={chooseLogo}/></label>{profile.logoData && <button type="button" className="text-button" onClick={() => change('logoData', '')}>Remove image</button>}<small>Image is resized and kept in your local SQLite database.</small></div>
      {error && <div className="form-error">{error}</div>}<div className="business-form-footer"><span>Changes apply to new invoice previews.</span><button className="button button-primary">Save business profile</button></div>
    </form></section>;
}

export function AccountProfile({ data, onSave, notice }) {
  const [account, setAccount] = useState(data.account || { name: '', email: '', phone: '' });
  const [error, setError] = useState('');
  const initials = (account.name || 'Me').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  async function submit(event) { event.preventDefault(); setError(''); try { await onSave(account); } catch (e) { setError(e.message); } }
  return <section className="page-content"><div className="page-heading"><div><span className="eyebrow">YOUR ACCOUNT</span><h1>My profile</h1><p>Update the personal details shown in your BillBloom workspace.</p></div></div>{notice && <div className="notice"><span>✓</span>{notice}</div>}
    <form className="panel account-form" onSubmit={submit}><div className="account-form-head"><div className="account-avatar-large">{initials || 'ME'}</div><div><h2>Personal information</h2><p>This profile is stored locally with this BillBloom installation.</p></div></div><div className="account-fields"><label className="field"><span>Full name *</span><input required value={account.name || ''} onChange={(e) => setAccount((old) => ({ ...old, name: e.target.value }))} placeholder="Your name"/></label><label className="field"><span>Email address</span><input type="email" value={account.email || ''} onChange={(e) => setAccount((old) => ({ ...old, email: e.target.value }))} placeholder="you@example.com"/></label><label className="field"><span>Phone number</span><input value={account.phone || ''} onChange={(e) => setAccount((old) => ({ ...old, phone: e.target.value }))} placeholder="+91 …"/></label></div>{error && <div className="form-error">{error}</div>}<div className="business-form-footer"><span>These details do not change your business invoice information.</span><button className="button button-primary">Save personal profile</button></div></form>
  </section>;
}

export function Products({ data, onSaved }) {
  const [query, setQuery] = useState(''); const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(null);
  const products = data.products.filter((p) => `${p.name} ${p.hsn} ${p.description}`.toLowerCase().includes(query.toLowerCase()));
  async function submit(event) { event.preventDefault(); const form = event.currentTarget; const values = Object.fromEntries(new FormData(form).entries()); try { const r = await fetch(editing ? `/api/products/${editing.id}` : '/api/products', { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) }); const result = await r.json(); if (!r.ok) throw new Error(result.error); form.reset(); setNotice(`${result.name} ${editing ? 'updated' : 'added'} in the catalog.`); setEditing(null); onSaved(); } catch (e) { setNotice(e.message); } }
  return <section className="page-content"><div className="page-heading"><div><span className="eyebrow">REUSE YOUR REGULARS</span><h1>Product catalog</h1><p>Pick a saved item when creating an invoice, or add your own.</p></div></div>{notice && <div className="notice"><span>✓</span>{notice}</div>}<div className="products-layout">
    <section className="panel product-add"><div className="section-title"><div><h2>{editing ? 'Edit catalog item' : 'Add to catalog'}</h2><p>{editing ? 'Update its description, rate, or tax.' : 'Save a product or service for next time.'}</p></div></div><form key={editing?.id || 'new'} onSubmit={submit} className="product-form"><label className="field"><span>Name *</span><input name="name" required defaultValue={editing?.name || ''} placeholder="e.g. Consultation"/></label><label className="field"><span>Description</span><input name="description" defaultValue={editing?.description || ''} placeholder="Short item description"/></label><div className="modal-grid"><label className="field"><span>HSN / SAC</span><input name="hsn" defaultValue={editing?.hsn || ''} placeholder="Optional"/></label><label className="field"><span>Unit</span><input name="unit" defaultValue={editing?.unit || 'pcs'}/></label></div><div className="modal-grid"><label className="field"><span>Price (₹)</span><input name="price" type="number" min="0" step="0.01" defaultValue={editing?.price ?? 0}/></label><label className="field"><span>GST rate</span><select name="gst" defaultValue={editing?.gst ?? 18}>{rates.map((r) => <option key={r} value={r}>{r}%</option>)}</select></label></div><div className="form-button-row"><button className="button button-primary">{editing ? 'Save changes' : 'Save product'}</button>{editing && <button type="button" className="button button-quiet" onClick={() => setEditing(null)}>Cancel</button>}</div></form></section>
    <section className="panel product-list"><div className="search-row"><div className="search-box"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search product or HSN…"/></div><span className="count-pill">{products.length} items</span></div>{products.map((p) => <div className="product-row" key={p.id}><span className="product-icon">▦</span><span className="product-copy"><strong>{p.name}</strong><small>{p.description || `HSN ${p.hsn}`} · {p.unit}</small></span><span className="gst-chip">{p.gst}% GST</span><strong className="product-price">{money(p.price)}</strong><button className="button button-outline small-action" onClick={() => { setEditing(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</button></div>)}</section>
  </div></section>;
}

export function Analytics({ data }) {
  const [today, setToday] = useState(() => localDateKey(new Date()));
  const [reportDate, setReportDate] = useState(() => localDateKey(new Date()));
  useEffect(() => {
    const timer = window.setInterval(() => setToday(localDateKey(new Date())), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => setReportDate(today), [today]);
  const paid = data.invoices.filter((i) => i.status === 'Paid');
  const revenue = paid.reduce((s, i) => s + Number(i.total || 0), 0);
  const gst = data.invoices.filter((i) => i.status !== 'Draft').reduce((s, i) => s + Number(i.tax || 0), 0);
  const selected = new Date(`${reportDate}T12:00:00`);
  const months = Array.from({ length: 6 }, (_, offset) => { const d = new Date(`${today}T12:00:00`); d.setDate(1); d.setMonth(d.getMonth() - (5 - offset)); const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; const list = data.invoices.filter((i) => i.date?.slice(0, 7) === key && i.status !== 'Draft'); return { name: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }), count: list.length, amount: list.reduce((s, i) => s + Number(i.total || 0), 0), paid: list.filter((i) => i.status === 'Paid').reduce((s, i) => s + Number(i.total || 0), 0), tax: list.reduce((s, i) => s + Number(i.tax || 0), 0) }; });
  const dailyRows = Array.from({ length: 14 }, (_, offset) => {
    const day = new Date(selected);
    day.setDate(day.getDate() - (13 - offset));
    const key = localDateKey(day);
    const issued = data.invoices.filter((i) => i.date === key && i.status !== 'Draft');
    const collected = data.invoices.filter((i) => i.status === 'Paid' && paidDateKey(i) === key);
    return {
      key,
      label: day.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }),
      count: issued.length,
      amount: issued.reduce((sum, i) => sum + Number(i.total || 0), 0),
      paid: collected.reduce((sum, i) => sum + Number(i.total || 0), 0),
      tax: issued.reduce((sum, i) => sum + Number(i.tax || 0), 0),
    };
  });
  const selectedRow = dailyRows.find((day) => day.key === reportDate);
  return <section className="page-content"><div className="page-heading"><div><span className="eyebrow">THE BIG PICTURE</span><h1>Revenue & tax</h1><p>A quick view of billed amounts, paid revenue, and estimated GST liability.</p></div></div><div className="metric-grid analytics-metrics"><Metric label="Paid revenue · all time" value={money(revenue)} note={`${paid.length} paid invoices`} icon="↗" tone="mint"/><Metric label="GST liability · all time" value={money(gst)} note="Excludes draft invoices" icon="◎" tone="yellow"/><Metric label="Customers" value={data.customers.length} note="Saved in your directory" icon="♧" tone="lavender"/><Metric label="Invoices" value={data.invoices.length} note="Across all payment stages" icon="▤" tone="peach"/></div><section className="panel reports-panel"><div className="section-title report-toolbar"><div><h2>Daily activity</h2><p>Invoice totals use issue date; payments use the day they were marked paid.</p></div><label className="report-date-field"><span>Report through</span><input type="date" max={today} value={reportDate} onChange={(event) => setReportDate(event.target.value)}/></label></div><div className="daily-summary-grid"><div><span>Invoices issued</span><strong>{selectedRow?.count || 0}</strong><small>{selectedRow?.label || reportDate}</small></div><div><span>Amount invoiced</span><strong>{money(selectedRow?.amount || 0)}</strong><small>Excludes drafts</small></div><div><span>Payments collected</span><strong>{money(selectedRow?.paid || 0)}</strong><small>Marked paid on this day</small></div><div><span>GST on invoices</span><strong>{money(selectedRow?.tax || 0)}</strong><small>Estimate for this day</small></div></div><div className="report-table-wrap"><table className="recent-table"><thead><tr><th>DAY</th><th>INVOICES ISSUED</th><th>INVOICED</th><th>PAID REVENUE</th><th>GST LIABILITY</th></tr></thead><tbody>{dailyRows.slice().reverse().map((day) => <tr key={day.key}><td className="table-amount">{day.label}{day.key === today ? ' · Today' : ''}</td><td>{day.count}</td><td>{money(day.amount)}</td><td>{money(day.paid)}</td><td>{money(day.tax)}</td></tr>)}</tbody></table></div></section><section className="panel reports-panel"><div className="section-title"><div><h2>Monthly summary</h2><p>Issued invoices by month; drafts are excluded.</p></div></div><div className="report-table-wrap"><table className="recent-table"><thead><tr><th>MONTH</th><th>INVOICES</th><th>INVOICED</th><th>PAID REVENUE</th><th>GST LIABILITY</th></tr></thead><tbody>{months.map((m) => <tr key={m.name}><td className="table-amount">{m.name}</td><td>{m.count}</td><td>{money(m.amount)}</td><td>{money(m.paid)}</td><td>{money(m.tax)}</td></tr>)}</tbody></table></div></section><div className="info-strip"><span>ⓘ</span><p>GST figures are estimates from issued invoices and entered tax rates. Review them with your tax professional before filing.</p></div></section>;
}
function Metric({ label, value, note, icon, tone }) { return <div className="metric-card"><div className={`metric-icon ${tone}`}>{icon}</div><span className="metric-label">{label}</span><strong className="metric-value">{value}</strong><small>{note}</small></div>; }
function Empty({ title, text, action, onAction }) { return <div className="empty-state"><span className="empty-art">✿</span><strong>{title}</strong><p>{text}</p><button className="button button-primary" onClick={onAction}>{action}</button></div>; }
