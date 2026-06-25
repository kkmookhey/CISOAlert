/** Split an array into consecutive groups of at most `size`. Used to keep dynamic
 *  SQL `IN (?, …)` clauses under D1's bound-parameter limit (~100). */
export function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return arr.length ? [arr] : [];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
