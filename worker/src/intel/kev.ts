const KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";

export interface KevEntry { cveID: string; vendorProject: string; product: string; vulnerabilityName: string; dateAdded: string; shortDescription: string; }

export async function fetchKev(): Promise<KevEntry[]> {
  const res = await fetch(KEV_URL, { headers: { "user-agent": "CISOAlert/0.1" } });
  if (!res.ok) throw new Error(`KEV fetch ${res.status}`);
  const data = await res.json<{ vulnerabilities: KevEntry[] }>();
  return data.vulnerabilities ?? [];
}
