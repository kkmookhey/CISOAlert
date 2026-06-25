function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const byte of b) s += String.fromCharCode(byte);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
}

export function decodeJwtParts(token: string): { header: any; claims: any } {
  const [h, c] = token.split(".");
  return { header: JSON.parse(b64urlDecode(h)), claims: JSON.parse(b64urlDecode(c)) };
}

/** Import a PKCS#8 .p8 private key (the text between the PEM markers). */
async function importP8(p8: string): Promise<CryptoKey> {
  const body = p8.replace(/-----BEGIN PRIVATE KEY-----/, "")
                 .replace(/-----END PRIVATE KEY-----/, "")
                 .replace(/\s+/g, "");
  const raw = Uint8Array.from(atob(body), c => c.charCodeAt(0));
  return crypto.subtle.importKey("pkcs8", raw, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

/** Build a signed APNs provider JWT (ES256). iat in seconds. */
export async function buildApnsJwt(p8: string, keyId: string, teamId: string, iat: number): Promise<string> {
  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: "ES256", kid: keyId })));
  const claims = b64url(new TextEncoder().encode(JSON.stringify({ iss: teamId, iat })));
  const signingInput = `${header}.${claims}`;
  const key = await importP8(p8);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${b64url(sig)}`;
}
