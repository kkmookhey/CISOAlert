import { describe, it, expect } from "vitest";
import { severityFromCvss, normalizeNvd, mergeNvd } from "../src/intel/normalize";

function nvdRaw(id: string, published: string, vendor = "fortinet") {
  return {
    cve: {
      id,
      descriptions: [{ lang: "en", value: `${vendor} product flaw` }],
      metrics: { cvssMetricV31: [{ cvssData: { baseScore: 9.8 } }] },
      configurations: [{ nodes: [{ cpeMatch: [{ criteria: `cpe:2.3:o:${vendor}:thing:1:*:*:*:*:*:*:*` }] }] }],
      published
    }
  };
}

describe("mergeNvd", () => {
  const cutoff = "2026-03-01";

  it("drops items published before the recency cutoff (bulk-re-touch guard)", () => {
    const out = mergeNvd([[nvdRaw("CVE-1999-0001", "1999-01-01T00:00:00.000")]], cutoff);
    expect(out).toHaveLength(0);
  });

  it("keeps items published on/after the cutoff", () => {
    const out = mergeNvd([[nvdRaw("CVE-2026-0001", "2026-04-11T00:00:00.000")]], cutoff);
    expect(out.map(i => i.id)).toEqual(["CVE-2026-0001"]);
  });

  it("dedups the same CVE appearing across both fetch lists", () => {
    const a = [nvdRaw("CVE-2026-0009", "2026-06-17T00:00:00.000")];
    const b = [nvdRaw("CVE-2026-0009", "2026-06-17T00:00:00.000")];
    const out = mergeNvd([a, b], cutoff);
    expect(out).toHaveLength(1);
  });
});

describe("severityFromCvss", () => {
  it("buckets scores", () => {
    expect(severityFromCvss(9.8)).toBe("critical");
    expect(severityFromCvss(7.5)).toBe("high");
    expect(severityFromCvss(5.0)).toBe("medium");
    expect(severityFromCvss(2.0)).toBe("low");
    expect(severityFromCvss(null)).toBe("unknown");
  });
});

describe("normalizeNvd", () => {
  it("extracts id, cvss, severity, cpe vendor tokens", () => {
    const raw = {
      cve: {
        id: "CVE-2026-1",
        descriptions: [{ lang: "en", value: "Fortinet FortiOS flaw" }],
        metrics: { cvssMetricV31: [{ cvssData: { baseScore: 9.8 } }] },
        configurations: [{ nodes: [{ cpeMatch: [{ criteria: "cpe:2.3:o:fortinet:fortios:7.0:*:*:*:*:*:*:*" }] }] }],
        published: "2026-06-04T00:00:00.000"
      }
    };
    const item = normalizeNvd(raw);
    expect(item.id).toBe("CVE-2026-1");
    expect(item.severity).toBe("critical");
    expect(item.techKeys).toContain("hardware:fortinet");
  });

  it("scores CVEs that carry only a CVSS v4.0 metric", () => {
    // NVD shape for CVE-2026-11769 (Grafana Operator): v4.0-only, no v3.1/v3.0.
    const raw = {
      cve: {
        id: "CVE-2026-11769",
        descriptions: [{ lang: "en", value: "Path traversal in the Grafana Operator" }],
        metrics: { cvssMetricV40: [{ cvssData: { baseScore: 6.4 } }] },
        published: "2026-06-13T06:16:14.380"
      }
    };
    const item = normalizeNvd(raw);
    expect(item.cvss).toBe(6.4);
    expect(item.severity).toBe("medium");
    // With the cloud-native catalog entries, this now maps and survives the keep-filter.
    expect(item.techKeys).toContain("software:grafana");
  });
});
