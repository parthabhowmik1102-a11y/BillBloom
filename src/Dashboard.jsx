import { useAppContext } from './AppContext.jsx';

const greetingForHour = (hour) => hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : hour < 21 ? 'Good evening' : 'Good night';
const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const money = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(n) || 0);
const dateText = (v) => v ? new Date(`${v}T12:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const status = (s) => `status status-${String(s || 'draft').toLowerCase()}`;

export default function Dashboard({ onNew, onOpen, onStatus }) {
  const { data, accountName = 'Aarav Mehta', now } = useAppContext();
  const month = monthKey(now);
  const monthInvoices = data.invoices.filter((i) => i.date?.slice(0, 7) === month);
  const paid = data.invoices.filter((i) => i.status === 'Paid').reduce((s, i) => s + Number(i.total || 0), 0);
  const due = data.invoices.filter((i) => !['Paid', 'Draft'].includes(i.status)).reduce((s, i) => s + Number(i.total || 0), 0);
  const tax = monthInvoices.filter((i) => i.status !== 'Draft').reduce((s, i) => s + Number(i.tax || 0), 0);
  const series = Array.from({ length: 6 }, (_, offset) => {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (5 - offset)); const key = monthKey(d);
    return { label: d.toLocaleDateString('en-IN', { month: 'short' }), value: data.invoices.filter((i) => i.date?.slice(0, 7) === key && i.status === 'Paid').reduce((s, i) => s + Number(i.total || 0), 0) };
  });
  const max = Math.max(1, ...series.map((x) => x.value));
  const recent = [...data.invoices].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 6);
  return <section className="page-content dashboard-content">
    <div className="welcome-banner"><div><span className="eyebrow">{now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()}</span><h1>{greetingForHour(now.getHours())}, {accountName.split(/\s+/)[0]} <span>✦</span></h1><p>Ready to make business bloom? Here’s your workspace at a glance.</p></div><button className="button button-white" onClick={onNew}>＋ Create an invoice</button><div className="banner-flower flower-one">✿</div><div className="banner-flower flower-two">✳</div></div>
    <div className="metric-grid"><Metric label="Paid revenue" value={money(paid)} note="From paid invoices" icon="↗" tone="mint" /><Metric label="Outstanding" value={money(due)} note="Sent invoices waiting" icon="◷" tone="peach" /><Metric label="Invoices this month" value={String(monthInvoices.length).padStart(2, '0')} note={`${data.customers.length} customers in your book`} icon="▤" tone="lavender" /><Metric label="GST this month" value={money(tax)} note="Estimated tax calculated" icon="◎" tone="yellow" /></div>
    <div className="dashboard-grid">
      <section className="panel chart-panel"><div className="section-title"><div><h2>Revenue overview</h2><p>Paid invoice revenue over the last six months</p></div><span className="chart-legend"><i /> Paid revenue</span></div><div className="chart"><div className="chart-y"><span>{money(max)}</span><span>{money(max / 2)}</span><span>₹0</span></div><div className="chart-bars">{series.map((bar, i) => <div className="chart-col" key={`${bar.label}-${i}`}><div className={`bar ${bar.value ? '' : 'bar-empty'}`} style={{ height: `${bar.value ? Math.max(9, bar.value / max * 100) : 4}%` }} title={money(bar.value)} /><span>{bar.label}</span></div>)}</div></div></section>
      <section className="panel quick-panel"><div className="section-title"><div><h2>Quick actions</h2><p>Pick up where you left off.</p></div></div><button onClick={onNew}><span className="quick-icon quick-mint">＋</span><span><strong>New invoice</strong><small>Create a bill for a customer</small></span><b>↗</b></button><button onClick={() => window.dispatchEvent(new CustomEvent('billbloom:navigate', { detail: 'customers' }))}><span className="quick-icon quick-lilac">♧</span><span><strong>Add a customer</strong><small>Grow your customer list</small></span><b>↗</b></button><button onClick={() => window.dispatchEvent(new CustomEvent('billbloom:navigate', { detail: 'products' }))}><span className="quick-icon quick-peach">▦</span><span><strong>Browse catalog</strong><small>Choose a saved item or service</small></span><b>↗</b></button></section>
    </div>
    <section className="panel recent-panel"><div className="section-title"><div><h2>Recent invoices</h2><p>Select an invoice to edit its billing details.</p></div><button className="text-button" onClick={onNew}>＋ New invoice</button></div>{recent.length ? <div className="recent-table-wrap"><table className="recent-table"><thead><tr><th>INVOICE</th><th>CUSTOMER</th><th>ISSUED</th><th>AMOUNT</th><th>STATUS</th><th /></tr></thead><tbody>{recent.map((i) => <tr key={i.id}><td><button className="link-button" onClick={() => onOpen(i)}>{i.number}</button></td><td><div className="table-customer"><span className="mini-avatar">{(i.customerName || 'C').slice(0, 1)}</span>{i.customerName || 'Customer'}</div></td><td>{dateText(i.date)}</td><td className="table-amount">{money(i.total)}</td><td><select className={status(i.status)} value={i.status} onChange={(e) => onStatus(i.id, e.target.value)} aria-label={`Status for ${i.number}`}>{['Draft', 'Sent', 'Paid', 'Overdue'].map((s) => <option key={s}>{s}</option>)}</select></td><td><button className="row-open" onClick={() => onOpen(i)} aria-label="Edit invoice">Edit</button></td></tr>)}</tbody></table></div> : <EmptyState title="Your first invoice is waiting" text="Create an invoice and it’ll show up here with its payment status." action="Create an invoice" onAction={onNew} />}</section>
    <div className="dashboard-footer"><span>✦</span> A little progress adds up. You’re doing great.</div>
  </section>;
}
function Metric({ label, value, note, icon, tone }) { return <div className="metric-card"><div className={`metric-icon ${tone}`}>{icon}</div><span className="metric-label">{label}</span><strong className="metric-value">{value}</strong><small>{note}</small><span className="metric-spark">✦</span></div>; }
function EmptyState({ title, text, action, onAction }) { return <div className="empty-state"><span className="empty-art">✿</span><strong>{title}</strong><p>{text}</p>{action && <button className="button button-primary" onClick={onAction}>{action}</button>}</div>; }
