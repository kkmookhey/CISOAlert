import Foundation

enum ShareFormatter {
    static func text(for item: BriefingItem) -> String {
        var s = "\(item.id): \(item.title)\n"
        s += "Severity: \(item.severity.label.uppercased())"
        if let c = item.cvss { s += String(format: " (CVSS %.1f)", c) }
        if item.kev { s += " — CISA KEV (exploited in the wild)" }
        s += "\n\nSummary\n\(item.summary)"
        s += "\n\nWhy it matters\n\(item.impact)"
        s += "\n\nRecommended action\n\(item.action)"
        if let u = item.sourceURL, !u.isEmpty { s += "\n\nSource: \(u)" }
        s += "\n\n— shared via CISO Alert"
        return s
    }
}
