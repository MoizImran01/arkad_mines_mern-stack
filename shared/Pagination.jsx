import React from 'react';

/** Page controls with numeric window and prev/next. */
const Pagination = ({ currentPage, setCurrentPage, totalItems, itemsPerPage, label = "items" }) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const pageStart = (currentPage - 1) * itemsPerPage;
  const pageEnd = pageStart + itemsPerPage;

  return (
    <div className="universal-pagination">
      <div className="pagination-info">
        <span>
          Showing {totalItems === 0 ? 0 : pageStart + 1} - {Math.min(pageEnd, totalItems)} of {totalItems} {label}
        </span>
      </div>
      <div className="pagination-controls">
        <button className="pagination-btn" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
          Previous
        </button>
        <div className="pagination-numbers">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum;
            if (totalPages <= 5) pageNum = i + 1;
            else if (currentPage <= 3) pageNum = i + 1;
            else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
            else pageNum = currentPage - 2 + i;
            return (
              <button
                key={pageNum}
                className={`pagination-number ${currentPage === pageNum ? "active" : ""}`}
                onClick={() => setCurrentPage(pageNum)}
              >
                {pageNum}
              </button>
            );
          })}
        </div>
        <button className="pagination-btn" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
          Next
        </button>
      </div>
    </div>
  );
};

export default Pagination;
