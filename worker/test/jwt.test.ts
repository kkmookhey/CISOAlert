import { describe, it, expect } from "vitest";
import { decodeJwtParts, buildApnsJwt } from "../src/apns/jwt";

describe("decodeJwtParts", () => {
  it("decodes header and claims of a compact JWT", () => {
    // header {"alg":"ES256","kid":"K"} . claims {"iss":"T","iat":1} . sig
    const token = "eyJhbGciOiJFUzI1NiIsImtpZCI6IksifQ.eyJpc3MiOiJUIiwiaWF0IjoxfQ.AAAA";
    const { header, claims } = decodeJwtParts(token);
    expect(header.alg).toBe("ES256");
    expect(header.kid).toBe("K");
    expect(claims.iss).toBe("T");
  });
});

describe("buildApnsJwt", () => {
  it("produces a valid ES256 JWT with correct header and claims", async () => {
    // Generate a P-256 key pair using the WebCrypto API available in Node.js
    const subtle = (crypto as any).subtle as SubtleCrypto;
    const keyPair = await subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign"]
    ) as CryptoKeyPair;
    // Export the private key as PKCS#8
    const pkcs8 = await subtle.exportKey("pkcs8", keyPair.privateKey);
    // Wrap in PEM format (use btoa for base64, works in both Node and Workers)
    const bytes = new Uint8Array(pkcs8 as ArrayBuffer);
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    const b64 = btoa(bin);
    const pem = `-----BEGIN PRIVATE KEY-----\n${b64}\n-----END PRIVATE KEY-----`;

    const token = await buildApnsJwt(pem, "KID123", "TEAM456", 1700000000);

    // Must have 3 dot-separated parts
    const parts = token.split(".");
    expect(parts.length).toBe(3);

    const { header, claims } = decodeJwtParts(token);
    expect(header.alg).toBe("ES256");
    expect(header.kid).toBe("KID123");
    expect(claims.iss).toBe("TEAM456");
    expect(claims.iat).toBe(1700000000);
  });
});
