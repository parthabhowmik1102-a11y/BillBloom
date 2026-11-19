export default function Pagination({ page, pageCount, onPageChange, itemCount, pageSize, label }) {
  if (pageCount <= 1) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, itemCount);
  return <nav className="pagination" aria-label={`${label} pagination`}>
    <span>Showing {start}–{end} of {itemCount}</span>
    <div><button className="button button-outline" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Previous</button>
      <span aria-live="polite">Page {page} of {pageCount}</span>
      <button className="button button-outline" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>Next</button></div>
  </nav>;
}
