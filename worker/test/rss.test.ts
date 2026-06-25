import { describe, it, expect } from "vitest";
import { parseFeed } from "../src/intel/rss";

const RSS = `<?xml version="1.0"?><rss><channel>
  <item><title>RSS One</title><link>https://e.com/1</link><description>desc one</description><pubDate>Tue, 10 Jun 2026 10:00:00 GMT</pubDate></item>
</channel></rss>`;
const ATOM = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
  <entry><title>Atom One</title><link href="https://e.com/2"/><summary>sum two</summary><updated>2026-06-10T10:00:00Z</updated></entry>
</feed>`;

describe("parseFeed", () => {
  it("parses RSS <item>", () => {
    const a = parseFeed(RSS, "Src");
    expect(a.length).toBe(1);
    expect(a[0]).toMatchObject({ title: "RSS One", url: "https://e.com/1", source: "Src" });
    expect(a[0].snippet).toContain("desc one");
  });
  it("parses Atom <entry> incl link href", () => {
    const a = parseFeed(ATOM, "Src");
    expect(a[0]).toMatchObject({ title: "Atom One", url: "https://e.com/2" });
  });
});
