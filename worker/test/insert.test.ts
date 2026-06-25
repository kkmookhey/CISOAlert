import { describe, it, expect } from "vitest";
import { insertItems } from "../src/seed";
import type { Item } from "../src/types";

// Minimal D1 mock that records batches and fails loudly if per-statement .run() is used
// (the bug we fixed). prepare().bind() returns an opaque statement token.
function mockDB() {
  const batches: any[][] = [];
  const db: any = {
    prepare(sql: string) {
      return {
        bind: (...args: any[]) => ({ sql, args }),
        run: () => { throw new Error("insertItems must batch, not run() per statement"); }
      };
    },
    async batch(stmts: any[]) { batches.push(stmts); return stmts.map(() => ({ success: true })); }
  };
  return { env: { DB: db } as any, batches };
}

const item = (id: string, techKeys: string[]): Item => ({
  id, source: "nvd", title: id, severity: "high", cvss: 7, kev: false, published: "2026-06-11",
  techKeys, summary: "s", impact: "i", action: "a", sourceURL: null, product: "chrome"
});

describe("insertItems (batched writes)", () => {
  it("batches all statements instead of running them one-by-one", async () => {
    const { env, batches } = mockDB();
    // 2 items, 2 tech keys each => per item: 1 INSERT + 1 DELETE + 2 item_tech = 4 stmts => 8 total.
    await insertItems(env, [item("CVE-1", ["a", "b"]), item("CVE-2", ["c", "d"])]);
    const total = batches.reduce((n, b) => n + b.length, 0);
    expect(total).toBe(8);
    expect(batches.length).toBeGreaterThanOrEqual(1); // batched, not 8 individual run() calls
  });

  it("chunks large inputs into multiple batches under the size cap", async () => {
    const { env, batches } = mockDB();
    // 40 items x (INSERT+DELETE+1 techKey)=3 stmts => 120 stmts => ceil(120/50)=3 batches.
    const many = Array.from({ length: 40 }, (_, i) => item(`CVE-${i}`, ["x"]));
    await insertItems(env, many);
    expect(batches.reduce((n, b) => n + b.length, 0)).toBe(120);
    expect(batches.length).toBe(3);
    expect(Math.max(...batches.map(b => b.length))).toBeLessThanOrEqual(50);
  });
});
