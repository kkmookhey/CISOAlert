import { describe, it, expect } from "vitest";
import { mapTechKeys } from "../src/intel/techmap";

describe("mapTechKeys", () => {
  it("matches vendor hints case-insensitively in text", () => {
    const keys = mapTechKeys("Fortinet FortiOS SSL-VPN heap overflow", ["fortinet"]);
    expect(keys).toContain("hardware:fortinet");
  });
  it("matches against CPE-style vendor tokens", () => {
    const keys = mapTechKeys("", ["cisco", "duo"]);
    expect(keys).toContain("hardware:cisco");
    expect(keys).toContain("idp:duo");
  });
  it("returns empty when nothing matches", () => {
    expect(mapTechKeys("some unrelated product", [])).toEqual([]);
  });
  it("a bare 'google' product maps only to software:google, not gcp/idp", () => {
    const keys = mapTechKeys("Google Chrome heap overflow", ["google", "chrome"]);
    expect(keys).toContain("software:google");
    expect(keys).not.toContain("cloud:gcp");
    expect(keys).not.toContain("idp:google");
  });
  it("still maps gcp- and workspace-specific tokens", () => {
    expect(mapTechKeys("vulnerability in google_cloud run", ["google_cloud"])).toContain("cloud:gcp");
    expect(mapTechKeys("Google Workspace admin flaw", ["google_workspace"])).toContain("idp:google");
  });
  it("matches space-separated vendor name: 'Check Point' -> security:checkpoint", () => {
    const keys = mapTechKeys("Critical Check Point VPN Flaw exploited", []);
    expect(keys).toContain("security:checkpoint");
  });

  // --- Check Point precision: the brand is "Check Point" (two words). The single
  // word "checkpoint" is a common ML/infra term (model checkpoints, LangGraph
  // Checkpoint, PoS checkpoints) and must NOT map to the security vendor. ---

  it("the common word 'checkpoint' does NOT map to security:checkpoint (text)", () => {
    expect(mapTechKeys("stable-diffusion.cpp loads a model checkpoint file", []))
      .not.toContain("security:checkpoint");
    expect(mapTechKeys("LangGraph SQLite Checkpoint saver race condition", []))
      .not.toContain("security:checkpoint");
    expect(mapTechKeys("Nimiq Proof-of-Stake checkpoint sync flaw", []))
      .not.toContain("security:checkpoint");
  });

  it("real Check Point still maps via the CPE vendor slug 'checkpoint'", () => {
    expect(mapTechKeys("Improper authentication in the gateway", ["checkpoint"]))
      .toContain("security:checkpoint");
  });

  it("regression: Palo Alto maps via the concatenated CPE vendor 'paloaltonetworks'", () => {
    expect(mapTechKeys("", ["paloaltonetworks"])).toContain("hardware:paloalto");
  });

  // --- Cloud-native expansion: word-boundary matching (no substring false-positives) ---

  it("maps Kubernetes via both 'kubernetes' and 'k8s'", () => {
    expect(mapTechKeys("Kubernetes API server flaw", [])).toContain("software:kubernetes");
    expect(mapTechKeys("privilege escalation in k8s kubelet", [])).toContain("software:kubernetes");
  });

  it("maps Grafana (the CVE-2026-11769 case)", () => {
    expect(mapTechKeys("Path traversal in the Grafana Operator", ["grafana_operator"]))
      .toContain("software:grafana");
  });

  it("'redis' matches the product but NOT the word 'redistributable'", () => {
    expect(mapTechKeys("Redis 7.2 use-after-free", [])).toContain("software:redis");
    expect(mapTechKeys("vendor ships a redistributable package", [])).not.toContain("software:redis");
  });

  it("HashiCorp maps via 'hashicorp', but Azure Key Vault does not", () => {
    expect(mapTechKeys("HashiCorp Vault auth bypass", [])).toContain("software:hashicorp");
    expect(mapTechKeys("SSRF in Azure Key Vault", [])).not.toContain("software:hashicorp");
  });

  it("'argocd' matches 'Argo CD' but NOT 'cargo'", () => {
    expect(mapTechKeys("Argo CD path traversal", [])).toContain("software:argocd");
    expect(mapTechKeys("RCE via cargo build script", [])).not.toContain("software:argocd");
  });

  it("'elasticsearch' matches Elastic but NOT AWS ElastiCache", () => {
    expect(mapTechKeys("Elasticsearch unauthenticated RCE", [])).toContain("software:elastic");
    expect(mapTechKeys("Amazon ElastiCache misconfig", [])).not.toContain("software:elastic");
  });

  it("'helm' matches the product but NOT 'Wilhelm'", () => {
    expect(mapTechKeys("Helm chart template injection", [])).toContain("software:helm");
    expect(mapTechKeys("plugin by Wilhelm released", [])).not.toContain("software:helm");
  });

  it("regression: existing brand hints still match", () => {
    expect(mapTechKeys("Fortinet FortiOS heap overflow", [])).toContain("hardware:fortinet");
    expect(mapTechKeys("Palo Alto PAN-OS auth bypass", [])).toContain("hardware:paloalto");
  });

  // --- CPE is authoritative: a description that merely *mentions* other vendors (SSO
  // providers, bundled datastores, integrations) must not attribute the vuln to them. ---

  it("integration vendors named only in the description do NOT match when CPE is present", () => {
    // Real case: Rocket.Chat CVE (vuln is in Rocket.Chat, not in our catalog) whose
    // description lists Okta/Entra/MongoDB integrations. None of those should match.
    const text = "Rocket.Chat is a chat platform that integrates with Okta and Microsoft Entra ID and stores data in MongoDB";
    expect(mapTechKeys(text, ["rocketchat"])).toEqual([]);
  });

  it("with CPE present, only the affected product matches — not vendors named in prose", () => {
    const text = "FortiOS flaw; affects Microsoft Windows VPN clients connecting through the gateway";
    expect(mapTechKeys(text, ["fortinet"])).toEqual(["hardware:fortinet"]);
  });

  it("with NO CPE, description matching still applies (fresh/unenriched CVEs)", () => {
    expect(mapTechKeys("Check Point Security Gateway auth bypass", [])).toContain("security:checkpoint");
  });
});
