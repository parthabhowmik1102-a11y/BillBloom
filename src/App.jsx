import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router';
import Dashboard from './Dashboard.jsx';
import InvoiceEditor, { makeInvoice, invoiceTotals } from './InvoiceEditor.jsx';
import { Analytics, Customers, Products, CustomerForm, BusinessProfile, AccountProfile } from './Directory.jsx';
import { AppContext } from './AppContext.jsx';
import './styles.css';

const navigation = [
  ['dashboard', '◫', 'Overview'], ['invoice', '▤', 'Create invoice'],
  ['customers', '♧', 'Customers'], ['analytics', '▥', 'Reports'], ['products', '▦', 'Catalog'], ['business', '⚙', 'Business profile'], ['account', '◎', 'My profile'],
];

export default function App() {
  const [data, setData] = useState({ customers: [], products: [], invoices: [] });
  const [now, setNow] = useState(() => new Date());
  const location = useLocation();
  const navigate = useNavigate();
  const view = location.pathname.split('/').filter(Boolean)[0] || 'dashboard';
  const setView = (next) => navigate(next === 'dashboard' ? '/' : `/${next}`);
  const [invoice, setInvoice] = useState(makeInvoice);
  const [editingSavedInvoice, setEditingSavedInvoice] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState('');

  async function refresh() {
    const response = await fetch('/api/bootstrap');
    if (!response.ok) throw new Error('The local API did not respond. Check the VS Code terminal.');
    setData(await response.json());
  }
  useEffect(() => { refresh().catch((e) => setError(e.message)).finally(() => setLoading(false)); }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const nav = (event) => setView(event.detail);
    const cust = (event) => setSelectedCustomer(event.detail);
    window.addEventListener('billbloom:navigate', nav);
    window.addEventListener('billbloom:customer', cust);
    return () => { window.removeEventListener('billbloom:navigate', nav); window.removeEventListener('billbloom:customer', cust); };
  }, [navigate]);

  const customer = data.customers.find((c) => c.id === invoice.customerId);
  const totals = invoiceTotals(invoice);
  const goNew = () => { setInvoice(makeInvoice()); setEditingSavedInvoice(false); setNotice(''); setView('invoice'); };
  const openInvoice = (saved) => { setInvoice({ ...makeInvoice(), ...saved }); setEditingSavedInvoice(true); setNotice(''); setView('invoice'); };
  const saveInvoice = async () => {
    if (!invoice.customerId) { setNotice('Choose a customer before saving.'); return; }
    if (!invoice.items.length || invoice.items.some((item) => !item.name.trim())) { setNotice('Add at least one named line item.'); return; }
    const payload = { ...invoice, ...totals, customerName: customer?.name || '', customerSnapshot: customer, businessSnapshot: invoice.businessSnapshot || data.business, updatedAt: new Date().toISOString() };
    try {
      const res = await fetch('/api/invoices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Could not save invoice.');
      await refresh(); setNotice(`Invoice ${invoice.number} saved in customer history.`);
    } catch (e) { setNotice(e.message); }
  };
  const setStatus = async (id, status) => {
    try { await fetch(`/api/invoices/${id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }); await refresh(); }
    catch (e) { setError(e.message); }
  };
  const saveCustomer = async (payload, id = null) => {
    const response = await fetch(id ? `/api/customers/${id}` : '/api/customers', { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not save customer.');
    if (id) { await refresh(); setSelectedCustomer(id); setCustomerToEdit(null); setShowCustomerForm(false); setView('customers'); return; }
    await refresh(); setInvoice((current) => ({ ...current, customerId: result.id, isInterstate: result.state !== (data.business?.state || 'Maharashtra') }));
    setSelectedCustomer(result.id); setShowCustomerForm(false); setView('invoice');
  };
  const saveBusiness = async (payload) => {
    const response = await fetch('/api/business', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not save the business profile.');
    await refresh(); setNotice('Business profile saved. New invoices will use these details.');
  };
  const saveAccount = async (payload) => {
    const response = await fetch('/api/account', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not save your profile.');
    await refresh(); setNotice('Your personal profile has been saved.');
  };
  const accountName = data.account?.name || 'Aarav Mehta';
  const initials = accountName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

  return <AppContext.Provider value={{ data, accountName, refresh, now }}><div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">b</span><span>bill<span className="brand-light">bloom</span></span></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="side-nav" aria-label="Main navigation">{navigation.map(([id, icon, label]) => <button key={id} className={`nav-link ${view === id ? 'active' : ''}`} onClick={() => id === 'invoice' ? goNew() : setView(id)}><span className="nav-icon">{icon}</span>{label}{id === 'invoice' && <span className="nav-plus">+</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="trial-card"><span className="trial-icon">✦</span><strong>Small business, blooming.</strong><p>Keep every invoice and customer in one tidy place.</p><button onClick={() => setView('analytics')}>View reports <span>↗</span></button></div><button className="profile profile-button" onClick={() => setView('account')}><div className="avatar">{initials || 'ME'}</div><div><strong>{accountName}</strong><small>{data.business?.name || 'BillBloom Studio'}</small></div><span className="profile-dots">Edit</span></button></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="breadcrumbs"><span>Workspace</span><b>/</b><strong>{navigation.find((n) => n[0] === view)?.[2] || 'Workspace'}</strong></div><div className="top-actions"><span className="today-chip">{now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span><span className="top-avatar">{initials || 'ME'}</span></div></header>
      {error && <div className="api-error" role="alert">{error}<button onClick={() => refresh().catch((e) => setError(e.message))}>Try again</button></div>}
      {loading ? <div className="loading-card"><span className="spinner" /> Connecting to your local workspace…</div> : <Routes>
        <Route path="/" element={<Dashboard onNew={goNew} onOpen={openInvoice} onStatus={setStatus} />} />
        <Route path="/invoice" element={<InvoiceEditor invoice={invoice} setInvoice={setInvoice} editingSaved={editingSavedInvoice} onSave={saveInvoice} onAddCustomer={() => setShowCustomerForm(true)} notice={notice} />} />
        <Route path="/customers" element={<Customers data={data} selectedId={selectedCustomer} onSelect={setSelectedCustomer} onAdd={() => { setCustomerToEdit(null); setShowCustomerForm(true); }} onEdit={(c) => { setCustomerToEdit(c); setShowCustomerForm(true); }} onOpen={openInvoice} />} />
        <Route path="/analytics" element={<Analytics data={data} />} />
        <Route path="/products" element={<Products data={data} onSaved={() => refresh().catch((e) => setError(e.message))} />} />
        <Route path="/business" element={<BusinessProfile data={data} onSave={saveBusiness} notice={notice} />} />
        <Route path="/account" element={<AccountProfile data={data} onSave={saveAccount} notice={notice} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>}
    </main>
    {showCustomerForm && <CustomerForm customer={customerToEdit} onClose={() => { setShowCustomerForm(false); setCustomerToEdit(null); }} onSave={(payload) => saveCustomer(payload, customerToEdit?.id)} />}
  </div></AppContext.Provider>;
}
