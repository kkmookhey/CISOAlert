import { describe, it, expect } from "vitest";
import { chunk } from "../src/util/chunk";

describe("chunk", () => {
  it("splits into max-size groups", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
  it("returns an empty array for empty input", () => {
    expect(chunk([], 50)).toEqual([]);
  });
  it("keeps a short array as a single group", () => {
    expect(chunk([1, 2, 3], 50)).toEqual([[1, 2, 3]]);
  });
});
