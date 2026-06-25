import { describe, it, expect } from "vitest";
import { breakingCandidates } from "../src/apns/push";
import type { Item } from "../src/types";

const it_ = (id: string, sev: Item["severity"], cvss: number | null, kev: boolean): Item => ({
  id, source: "nvd", title: id, severity: sev, cvss, kev, published: "2026-06-10",
  techKeys: ["cloud:aws"], summary: "", impact: "", action: "", sourceURL: null, product: null
});

describe("breakingCandidates", () => {
  it("keeps KEV items and CVSS>=9 items, drops the rest", () => {
    const items = [
      it_("kev-low", "low", 2, true),     // KEV -> keep
      it_("crit", "critical", 9.8, false),// >=9 -> keep
      it_("high", "high", 8.5, false),    // <9, not KEV -> drop
      it_("med", "medium", 5, false)      // drop
    ];
    const out = breakingCandidates(items).map(i => i.id);
    expect(out.sort()).toEqual(["crit", "kev-low"]);
  });
  it("treats null cvss as not-critical unless KEV", () => {
    expect(breakingCandidates([it_("x", "critical", null, false)])).toHaveLength(0);
  });
});
