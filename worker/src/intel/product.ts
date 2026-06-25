/** Extract a normalized product slug from CPE 2.3 criteria strings (position 4). */
export function extractProductFromCpe(criteria: string[]): string | null {
  for (const c of criteria) {
    const parts = String(c).split(":"); // cpe:2.3:part:vendor:product:version:...
    const product = parts[4];
    if (parts[0] === "cpe" && product && product !== "*" && product !== "-") {
      return product.toLowerCase();
    }
  }
  return null;
}

/** Normalize an arbitrary product label to a lowercase clustering key. */
export function normalizeProduct(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const slug = raw.trim().toLowerCase().replace(/\s+/g, "_");
  return slug.length ? slug : null;
}

const PRODUCT_ALIASES: Record<string, string> = {
  chrome: "Chrome",
  chromium: "Chromium",
  chromium_v8: "Chromium V8",
  google_chrome: "Google Chrome",
  indesign: "Adobe InDesign",
  incopy: "Adobe InCopy",
  acrobat: "Adobe Acrobat",
  acrobat_reader: "Adobe Acrobat Reader",
  fortios: "FortiOS",
  fortimanager: "FortiManager",
  "catalyst_sd-wan_manager": "Cisco Catalyst SD-WAN Manager",
  ios_xe: "Cisco IOS XE",
  spring_framework: "Spring Framework",
  sharepoint_server: "SharePoint Server",
  exchange_server: "Exchange Server",
  // Cloud-native / DevOps slugs that title-casing would mangle.
  argo_cd: "Argo CD",
  rabbitmq: "RabbitMQ",
  postgresql: "PostgreSQL",
  mongodb: "MongoDB",
  nginx: "nginx",
  elasticsearch: "Elasticsearch",
  k8s: "Kubernetes"
};

// Tokens that should keep a non-title-case form when humanizing unknown slugs.
const INITIALISMS: Record<string, string> = {
  sdk: "SDK", api: "API", os: "OS", v8: "V8", rce: "RCE", xss: "XSS",
  sql: "SQL", ssl: "SSL", vpn: "VPN", ai: "AI", "sd-wan": "SD-WAN", xe: "XE", ssh: "SSH"
};

/** Humanize a product slug for display. Uses a curated alias map first, else strips a
 *  trailing build/version token and title-cases, preserving known initialisms. */
export function displayProduct(slug: string): string {
  const key = slug.trim().toLowerCase();
  if (PRODUCT_ALIASES[key]) return PRODUCT_ALIASES[key];

  let tokens = key.split(/[_\s]+/).filter(Boolean);
  // Drop a single trailing build/version token: a 4+ digit build/year ("1607", "2019")
  // or a dotted version ("7.0"). Short numerals like the "10" in "windows_10" are part
  // of the product name and are kept.
  const last = tokens[tokens.length - 1];
  if (tokens.length > 1 && (/^[0-9]{4,}$/.test(last) || /^[0-9]+\.[0-9]/.test(last))) {
    tokens = tokens.slice(0, -1);
  }
  return tokens
    .map(t => INITIALISMS[t] ?? (t.charAt(0).toUpperCase() + t.slice(1)))
    .join(" ");
}
