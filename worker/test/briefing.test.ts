import { describe, it, expect } from "vitest";
import { composeBriefing } from "../src/briefing";
import type { Item } from "../src/types";

const vuln = (id: string, sev: Item["severity"], techKeys: string[], product: string | null = null, kev = false): Item => ({
  id, source: "nvd", title: `t-${id}`, severity: sev, cvss: 7, kev, published: "2026-06-10",
  techKeys, summary: "s", impact: "i", action: "a", sourceURL: null, product, category: "vuln"
});
const article = (id: string, cat: "threat" | "news", techKeys: string[], score: number): Item => ({
  id, source: "rss", title: `a-${id}`, severity: "unknown", cvss: null, kev: false, published: "2026-06-10",
  techKeys, summary: "s", impact: "", action: "", sourceURL: "https://x", product: null,
  category: cat, sourceName: "Feed", score
});

describe("composeBriefing — vuln", () => {
  it("filters to stack and groups 3+ same product", () => {
    const items = [vuln("A","high",["software:google"],"chrome"), vuln("B","high",["software:google"],"chrome"),
                   vuln("C","medium",["software:google"],"chrome"), vuln("D","high",["cloud:aws"],"ec2")];
    const b = composeBriefing(items, { date:"2026-06-11", category:"vuln", stack:["software:google","cloud:aws"] });
    expect(b.entries.find(e => e.kind === "group")).toBeTruthy();
    expect(b.entries.filter(e => e.kind === "item").length).toBe(1);
  });
});

describe("composeBriefing — news (global, top 5 by score)", () => {
  it("ignores stack, sorts by score desc, caps at 5", () => {
    const items = Array.from({length:7},(_,i)=>article(`N${i}`,"news",[], i)); // scores 0..6
    const b = composeBriefing(items, { date:"2026-06-11", category:"news", stack:[] });
    expect(b.entries.length).toBe(5);
    expect((b.entries[0] as any).item.id).toBe("N6"); // highest score first
    expect(b.entries.every(e => e.kind === "item")).toBe(true);
  });
});

describe("composeBriefing — threat (global, top 8 by score)", () => {
  it("shows all threats regardless of stack, capped at 8", () => {
    const items = [
      article("T1","threat",["idp:okta"],5),
      article("T2","threat",["hardware:dell"],4),
      article("T3","threat",["cloud:aws"],3),
    ];
    // stack has only okta, but all 3 threats should appear (global)
    const b = composeBriefing(items, { date:"2026-06-11", category:"threat", stack:["idp:okta"] });
    expect(b.entries.length).toBe(3);
    const ids = b.entries.map(e => (e as any).item.id);
    expect(ids).toContain("T1");
    expect(ids).toContain("T2"); // not in stack but global → visible
    expect(ids).toContain("T3");
  });
  it("caps at 15 and orders by score desc", () => {
    const items = Array.from({length:20},(_,i)=>article(`T${i}`,"threat",[], i));
    const b = composeBriefing(items, { date:"2026-06-11", category:"threat", stack:[] });
    expect(b.entries.length).toBe(15);
    expect((b.entries[0] as any).item.id).toBe("T19"); // highest score first
  });
});

describe("composeBriefing — vuln fallback (KEV not in stack)", () => {
  it("includes KEV items supplied via fallback even when they don't match the stack", () => {
    const stackItem = vuln("A","high",["idp:okta"],"okta");
    const kevItem: Item = {
      id: "CVE-2026-KEV", source: "kev", title: "KEV not in stack", severity: "critical",
      cvss: 9.8, kev: true, published: "2026-06-10", techKeys: ["hardware:arista"],
      summary: "s", impact: "i", action: "a", sourceURL: null, product: "arista", category: "vuln"
    };
    const b = composeBriefing([stackItem], {
      date: "2026-06-11", category: "vuln", stack: ["idp:okta"], fallback: [kevItem]
    });
    const ids = b.entries.flatMap(e => e.kind === "group" ? e.items.map(i => i.id) : [e.item.id]);
    expect(ids).toContain("CVE-2026-KEV"); // fallback KEV surfaces even though arista not in stack
    expect(ids).toContain("A");
  });
});
