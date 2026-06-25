import { describe, it, expect } from "vitest";
import { parseClassification } from "../src/synth/classify";

describe("parseClassification", () => {
  it("parses a strict JSON array (with code fences)", () => {
    const txt = "```json\n[{\"idx\":0,\"category\":\"threat\",\"summary\":\"s\",\"impact\":\"i\",\"score\":4}]\n```";
    const out = parseClassification(txt, 1);
    expect(out[0]).toMatchObject({ category: "threat", summary: "s", score: 4 });
  });
  it("falls back to news/score2 for each item when JSON is unusable", () => {
    const out = parseClassification("not json", 2);
    expect(out.length).toBe(2);
    expect(out.every(r => r.category === "news" && r.score === 2)).toBe(true);
  });
  it("parses the evidence excerpt and leaves grounded=false until verified", () => {
    const txt = '[{"idx":0,"category":"threat","summary":"s","impact":"i","score":4,"evidence":"a verbatim quote copied from the article"}]';
    const out = parseClassification(txt, 1);
    expect(out[0].evidence).toBe("a verbatim quote copied from the article");
    expect(out[0].grounded).toBe(false);
  });
});
