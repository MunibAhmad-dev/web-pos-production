import { useEffect, useMemo, useState } from 'react';
import { Inbox, ChevronUp, ChevronDown, ChevronsUpDown, ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Table as ShadTable,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

const PAGE_SIZES = [5, 10, 25, 50];

export default function DataTable({ columns, data, emptyMessage = 'No records found', pageSize: initialPageSize = 10 }) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  useEffect(() => {
    setPage(1);
  }, [data, pageSize]);

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    const col = columns.find((c) => c.key === sortKey);
    const getValue = col?.sortValue ? col.sortValue : (row) => row[sortKey];
    return [...data].sort((a, b) => {
      const av = getValue(a);
      const bv = getValue(b);
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [data, sortKey, sortDir, columns]);

  const totalPages = Math.max(Math.ceil(sortedData.length / pageSize), 1);
  const safePage = Math.min(page, totalPages);
  const start = sortedData.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, sortedData.length);
  const pageData = sortedData.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = (col) => {
    if (col.sortable === false) return;
    if (sortKey === col.key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(col.key);
      setSortDir('asc');
    }
  };

  return (
    <div className="flex flex-col">
      <ShadTable>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((col) => {
              const sortable = col.sortable !== false && col.key !== 'actions' && col.header;
              const active = sortKey === col.key;
              return (
                <TableHead key={col.key} className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col)}
                      className="flex items-center gap-1 hover:text-foreground"
                    >
                      {col.header}
                      {active ? (
                        sortDir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />
                      ) : (
                        <ChevronsUpDown size={13} className="opacity-40" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageData.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="whitespace-normal py-14 text-center">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <Inbox size={18} />
                  </div>
                  <p className="text-sm">{emptyMessage}</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            pageData.map((row, idx) => (
              <TableRow key={row._id || row.id || idx}>
                {columns.map((col) => (
                  <TableCell key={col.key} className="text-foreground">
                    {col.render ? col.render(row) : row[col.key]}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </ShadTable>

      {sortedData.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Rows per page</span>
            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
              <SelectTrigger className="h-8 w-16">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {start} to {end} of {sortedData.length}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" disabled={safePage === 1} onClick={() => setPage(1)}>
                <ChevronsLeft size={15} />
              </Button>
              <Button variant="outline" size="icon" disabled={safePage === 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft size={15} />
              </Button>
              <span className="w-8 text-center text-sm font-medium">{safePage}</span>
              <Button variant="outline" size="icon" disabled={safePage === totalPages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight size={15} />
              </Button>
              <Button variant="outline" size="icon" disabled={safePage === totalPages} onClick={() => setPage(totalPages)}>
                <ChevronsRight size={15} />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
