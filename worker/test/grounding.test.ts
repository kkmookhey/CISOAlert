import { describe, it, expect } from "vitest";
import { verifyExcerpt, normalizeForMatch, groundingVerdict, parseGroundingMode } from "../src/synth/grounding";

const source =
  "Qilin ransomware exploited a Check Point VPN zero-day (CVE-2026-50751) to breach several NHS trusts this week.";

describe("verifyExcerpt", () => {
  it("accepts a verbatim excerpt", () => {
    expect(verifyExcerpt("exploited a Check Point VPN zero-day", source)).toBe(true);
  });
  it("is case- and whitespace-insensitive", () => {
    expect(verifyExcerpt("EXPLOITED   a check point  vpn zero-day", source)).toBe(true);
  });
  it("is robust to punctuation differences (one normalizer on both sides)", () => {
    expect(verifyExcerpt("Qilin ransomware, exploited a Check-Point VPN zero day", source)).toBe(true);
  });
  it("rejects a fabricated excerpt that is not in the source", () => {
    expect(verifyExcerpt("stole 4 million customer credit card numbers", source)).toBe(false);
  });
  it("rejects an excerpt shorter than the minimum anchor length", () => {
    expect(verifyExcerpt("Qilin", source)).toBe(false); // real word, but too short to anchor
    expect(verifyExcerpt("", source)).toBe(false);
  });
});

describe("normalizeForMatch", () => {
  it("folds case, punctuation, and whitespace to single spaces", () => {
    expect(normalizeForMatch("Check-Point  VPN, zero-day!")).toBe("check point vpn zero day");
  });
});

describe("groundingVerdict", () => {
  it("keeps grounded items in any category and mode", () => {
    expect(groundingVerdict("threat", true, "enforce")).toBe("keep");
    expect(groundingVerdict("news", true, "observe")).toBe("keep");
  });
  it("enforce mode drops an ungrounded threat (retracts the claim)", () => {
    expect(groundingVerdict("threat", false, "enforce")).toBe("drop");
  });
  it("observe mode keeps-but-demotes an ungrounded threat (measure before retracting)", () => {
    expect(groundingVerdict("threat", false, "observe")).toBe("demote");
  });
  it("never drops news, only demotes, in either mode", () => {
    expect(groundingVerdict("news", false, "enforce")).toBe("demote");
    expect(groundingVerdict("news", false, "observe")).toBe("demote");
  });
});

describe("parseGroundingMode", () => {
  it("defaults to observe-first; only the literal 'enforce' enables dropping", () => {
    expect(parseGroundingMode(undefined)).toBe("observe");
    expect(parseGroundingMode("")).toBe("observe");
    expect(parseGroundingMode("nonsense")).toBe("observe");
    expect(parseGroundingMode("enforce")).toBe("enforce");
  });
});
