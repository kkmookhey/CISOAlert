import { describe, it, expect } from "vitest";
import { fnv1a } from "../src/util/hash";
describe("fnv1a", () => {
  it("is deterministic and hex", () => {
    const a = fnv1a("https://example.com/x");
    expect(a).toBe(fnv1a("https://example.com/x"));
    expect(a).toMatch(/^[0-9a-f]+$/);
  });
  it("differs for different inputs", () => {
    expect(fnv1a("a")).not.toBe(fnv1a("b"));
  });
});
