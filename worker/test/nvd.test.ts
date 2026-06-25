import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchNvdRecent, fetchNvdModified } from "../src/intel/nvd";

afterEach(() => { vi.unstubAllGlobals(); });

function stubFetch(pages: { vulnerabilities: any[]; totalResults: number }[]) {
  const urls: string[] = [];
  let call = 0;
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    urls.push(url);
    const body = pages[Math.min(call, pages.length - 1)];
    call++;
    return { ok: true, json: async () => body } as any;
  }));
  return urls;
}

describe("fetchNvdRecent (new CVEs by publication date)", () => {
  it("queries by publication date over a rolling window", async () => {
    const urls = stubFetch([{ vulnerabilities: [{ cve: { id: "CVE-2026-0001" } }], totalResults: 1 }]);
    await fetchNvdRecent(undefined, 2);
    const u = new URL(urls[0]);
    expect(u.searchParams.has("pubStartDate")).toBe(true);
    expect(u.searchParams.has("pubEndDate")).toBe(true);
    expect(u.searchParams.has("lastModStartDate")).toBe(false);
  });

  it("paginates until all results are collected", async () => {
    const urls = stubFetch([
      { vulnerabilities: Array.from({ length: 2000 }, (_, i) => ({ cve: { id: `A${i}` } })), totalResults: 2200 },
      { vulnerabilities: Array.from({ length: 200 }, (_, i) => ({ cve: { id: `B${i}` } })), totalResults: 2200 }
    ]);
    const out = await fetchNvdRecent(undefined, 2);
    expect(out).toHaveLength(2200);
    expect(new URL(urls[1]).searchParams.get("startIndex")).toBe("2000");
  });
});

describe("fetchNvdModified (late-enriched CVEs)", () => {
  it("queries by BOTH lastMod window AND a publication recency window", async () => {
    // The pub window is the guard against NVD's periodic full-corpus lastModified
    // re-touch: it scopes the query to recently-published CVEs only.
    const urls = stubFetch([{ vulnerabilities: [], totalResults: 0 }]);
    await fetchNvdModified(undefined, 2, 120);
    const u = new URL(urls[0]);
    expect(u.searchParams.has("lastModStartDate")).toBe(true);
    expect(u.searchParams.has("lastModEndDate")).toBe(true);
    expect(u.searchParams.has("pubStartDate")).toBe(true);
    expect(u.searchParams.has("pubEndDate")).toBe(true);
  });

  it("sends the apiKey header when provided", async () => {
    let seenHeaders: any = null;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: any) => {
      seenHeaders = init.headers;
      return { ok: true, json: async () => ({ vulnerabilities: [], totalResults: 0 }) } as any;
    }));
    await fetchNvdModified("secret-key", 2, 120);
    expect(seenHeaders.apiKey).toBe("secret-key");
  });
});
