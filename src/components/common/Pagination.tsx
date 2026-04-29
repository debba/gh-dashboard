import { PAGE_SIZES, getPageWindow } from "../../utils/pagination";

interface PaginationProps {
  totalItems: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  showPageSize?: boolean;
}

export function Pagination({ totalItems, page, pageSize, onPageChange, onPageSizeChange, showPageSize = true }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalItems <= pageSize && pageSize === PAGE_SIZES[2]) return null;
  const from = totalItems ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(page * pageSize, totalItems);

  return (
    <div className="pagination">
      <span className="info">{from}-{to} of {totalItems}</span>
      <div className="controls">
        <button className="page-btn" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>‹</button>
        {getPageWindow(page, totalPages).map((item, index) => item === "..."
          ? <span className="ellipsis" key={`ellipsis-${index}`}>…</span>
          : <button className={`page-btn ${item === page ? "active" : ""}`} key={item} onClick={() => onPageChange(item)}>{item}</button>)}
        <button className="page-btn" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>›</button>
      </div>
      {showPageSize ? (
        <label className="pagesize">
          Page size
          <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
            {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
      ) : null}
    </div>
  );
}
