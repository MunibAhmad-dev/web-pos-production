import { useState, useEffect } from 'react';

/**
 * Slices a pre-filtered array into pages, resetting to page 1 whenever the
 * source list changes (e.g. a new search term produces a different result set).
 *
 * @param {any[]} items  — the full filtered list to paginate
 * @param {number} pageSize — rows per page (default 30)
 * @returns {{ page, pageCount, paged, setPage, pageSize }}
 */
export function usePagination(items, pageSize = 30) {
  const [page, setPage] = useState(1);

  // Reset to first page whenever the underlying list changes length
  useEffect(() => {
    setPage(1);
  }, [items.length]);

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage  = Math.min(page, pageCount);
  const paged     = items.slice((safePage - 1) * pageSize, safePage * pageSize);

  return { page: safePage, pageCount, paged, setPage, pageSize };
}
