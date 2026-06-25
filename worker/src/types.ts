export interface Env {
  DB: D1Database;
  APNS_TOPIC: string;
  APNS_KEY_ID: string;
  APNS_TEAM_ID: string;
  CLAUDE_MODEL: string;
  ANTHROPIC_API_KEY?: string;
  NVD_API_KEY?: string;
  APNS_KEY_P8?: string;
  ADMIN_TOKEN?: string;
  GROUNDING_MODE?: string;   // "observe" (default) | "enforce" — claim-binding drop policy
}

export type Severity = "critical" | "high" | "medium" | "low" | "unknown";

export type Category = "vuln" | "threat" | "news";

export interface Item {
  id: string;            // CVE id
  source: string;        // "kev" | "nvd"
  title: string;
  severity: Severity;
  cvss: number | null;
  kev: boolean;
  published: string;     // ISO date
  techKeys: string[];
  summary: string;
  impact: string;
  action: string;
  sourceURL: string | null;
  product: string | null;
  category?: Category;       // defaults to 'vuln' when absent
  sourceName?: string | null;
  score?: number | null;     // article significance 1-5; null for vulns
  evidence?: string | null;  // verbatim source quote backing the summary (threat/news)
  grounded?: boolean;        // evidence verified against source; absent = authoritative (vuln)
}

export type BriefingItemOut = Omit<Item, "source">;

export type BriefingEntry =
  | { kind: "item"; item: BriefingItemOut }
  | { kind: "group"; title: string; product: string; count: number; maxSeverity: Severity; items: BriefingItemOut[] };

export interface Briefing {
  date: string;
  headline: string;
  entries: BriefingEntry[];
}

export interface EditionDate {
  date: string;
  count: number;
  maxSeverity: Severity;
}
