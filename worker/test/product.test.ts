import { describe, it, expect } from "vitest";
import { extractProductFromCpe, displayProduct } from "../src/intel/product";

describe("extractProductFromCpe", () => {
  it("pulls the product token from a CPE criteria string", () => {
    expect(extractProductFromCpe(["cpe:2.3:a:google:chrome:120.0:*:*:*:*:*:*:*"])).toBe("chrome");
  });
  it("prefers a non-empty product across multiple CPEs", () => {
    expect(extractProductFromCpe(["cpe:2.3:o:fortinet:fortios:7.0:*:*:*:*:*:*:*"])).toBe("fortios");
  });
  it("returns null when no usable product token exists", () => {
    expect(extractProductFromCpe([])).toBeNull();
    expect(extractProductFromCpe(["not-a-cpe"])).toBeNull();
  });
});

describe("displayProduct", () => {
  it("humanizes a product slug", () => {
    expect(displayProduct("google_chrome")).toBe("Google Chrome");
    expect(displayProduct("fortios")).toBe("FortiOS");
  });
});

describe("displayProduct (aliases + cleanup)", () => {
  it("maps known messy slugs to clean names", () => {
    expect(displayProduct("chromium_v8")).toBe("Chromium V8");
    expect(displayProduct("windows_10_1607")).toBe("Windows 10");
    expect(displayProduct("catalyst_sd-wan_manager")).toBe("Cisco Catalyst SD-WAN Manager");
    expect(displayProduct("indesign")).toBe("Adobe InDesign");
    expect(displayProduct("incopy")).toBe("Adobe InCopy");
    expect(displayProduct("fortios")).toBe("FortiOS");
  });
  it("strips trailing build/version tokens for unknown products", () => {
    expect(displayProduct("acme_widget_2019")).toBe("Acme Widget");
    expect(displayProduct("foo_7.0")).toBe("Foo");
  });
  it("keeps short numerals that are part of the product name", () => {
    expect(displayProduct("windows_10")).toBe("Windows 10");
    expect(displayProduct("windows_11")).toBe("Windows 11");
  });
  it("preserves known initialisms", () => {
    expect(displayProduct("super_sdk")).toBe("Super SDK");
    expect(displayProduct("api_gateway")).toBe("API Gateway");
  });
  it("falls back to plain title-case", () => {
    expect(displayProduct("google_chrome")).toBe("Google Chrome");
  });
});
