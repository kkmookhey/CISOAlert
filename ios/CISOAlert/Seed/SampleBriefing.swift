import Foundation

enum SampleBriefing {
    private static func item(_ id: String, _ title: String, _ sev: Severity, _ cvss: Double?, _ kev: Bool,
                             _ tech: [String], _ summary: String, _ impact: String, _ action: String,
                             _ published: String, _ url: String?, category: String = "vuln", sourceName: String? = nil) -> BriefingItem {
        BriefingItem(id: id, title: title, severity: sev, cvss: cvss, kev: kev, techKeys: tech,
                     summary: summary, impact: impact, action: action, published: published, sourceURL: url,
                     category: category, sourceName: sourceName)
    }

    static func value(for category: BriefingCategory) -> Briefing {
        switch category {
        case .vuln: return vuln
        case .threat: return Briefing(date: "2026-06-11", headline: "Offline preview — connect for live threats", entries: [
            .item(item("art-t1", "Ransomware group claims breach at a major MSP", .unknown, nil, false, ["idp:okta"],
                       "A ransomware crew claims to have exfiltrated customer data from a widely-used managed service provider.",
                       "If you rely on this MSP, assume exposure and rotate shared credentials.", "",
                       "2026-06-11", "https://example.com/breach", category: "threat", sourceName: "BleepingComputer")) ])
        case .news: return Briefing(date: "2026-06-11", headline: "Offline preview — connect for today's news", entries: [
            .item(item("art-n1", "New frontier AI model released with stronger tool use", .unknown, nil, false, [],
                       "A major lab shipped a new model with improved agentic tool use and a larger context window.",
                       "", "", "2026-06-11", "https://example.com/ai", category: "news", sourceName: "TechCrunch")) ])
        }
    }

    static let vuln = Briefing(
        date: "2026-06-10",
        headline: "Offline preview — connect to load your live briefing",
        entries: [
            .item(item("CVE-2026-12345", "Critical RCE in widely-deployed VPN appliance", .critical, 9.8, true,
                       ["hardware:fortinet"],
                       "An unauthenticated remote attacker can execute code on the appliance via a crafted request.",
                       "Full device compromise; foothold into the internal network. On CISA KEV — exploited in the wild.",
                       "• Patch to the fixed firmware now.\n• Restrict management interface exposure.\n• Check logs for exploitation.",
                       "2026-06-09", "https://www.cisa.gov/known-exploited-vulnerabilities-catalog")),
            .group(BriefingGroup(
                title: "Multiple Chrome Security Issues", product: "chrome", count: 3, maxSeverity: .high,
                items: [
                    item("CVE-2026-30001", "Chrome V8 type confusion", .high, 8.8, false, ["software:google"],
                         "A type-confusion bug in V8 can lead to remote code execution in the renderer.",
                         "Drive-by compromise of browsing users.",
                         "• Update Chrome to the latest stable.\n• Enforce auto-update via policy.",
                         "2026-06-09", "https://nvd.nist.gov/vuln/detail/CVE-2026-30001"),
                    item("CVE-2026-30002", "Chrome use-after-free in WebGPU", .high, 8.1, false, ["software:google"],
                         "A use-after-free in WebGPU may allow sandbox escape.",
                         "Potential sandbox escape from a malicious page.",
                         "• Update Chrome.\n• Restrict WebGPU on managed fleets if needed.",
                         "2026-06-09", "https://nvd.nist.gov/vuln/detail/CVE-2026-30002"),
                    item("CVE-2026-30003", "Chrome heap overflow in ANGLE", .medium, 6.5, false, ["software:google"],
                         "A heap overflow in ANGLE can crash the renderer.",
                         "Denial of service for browsing users.",
                         "• Update Chrome.\n• Monitor for crash reports.",
                         "2026-06-09", "https://nvd.nist.gov/vuln/detail/CVE-2026-30003")
                ])),
            .item(item("CVE-2026-23456", "Privilege escalation in identity platform", .high, 8.1, false,
                       ["idp:okta"],
                       "A flaw in session handling allows a low-privilege user to obtain admin scopes.",
                       "Tenant-wide identity compromise if exploited by an authenticated user.",
                       "• Apply the vendor advisory update.\n• Review admin role assignments and recent grants.",
                       "2026-06-08", "https://nvd.nist.gov/vuln/detail/CVE-2026-23456"))
        ])
}
