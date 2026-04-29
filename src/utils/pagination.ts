export const PAGE_SIZES = [5, 10, 20, 100] as const;

export function getPageWindow(current: number, total: number): Array<number | "..."> {
  if (total <= 1) return [1];
  const parts = new Set([1, total, current, current - 1, current + 1]);
  if (current <= 3) parts.add(2).add(3);
  if (current >= total - 2) parts.add(total - 1).add(total - 2);
  const pages = [...parts].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);
  const result: Array<number | "..."> = [];
  let previous = 0;
  for (const page of pages) {
    if (previous && page - previous > 1) result.push("...");
    result.push(page);
    previous = page;
  }
  return result;
}

export function clampPage(page: number, totalItems: number, pageSize: number): number {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  return Math.min(Math.max(1, page), totalPages);
}
