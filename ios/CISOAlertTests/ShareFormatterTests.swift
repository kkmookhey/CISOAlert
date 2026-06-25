import XCTest
@testable import CISOAlert

final class ShareFormatterTests: XCTestCase {
    func testBuildsShareText() {
        let item = BriefingItem(id: "CVE-2026-1", title: "RCE in Acme", severity: .critical, cvss: 9.8,
                                kev: true, techKeys: ["cloud:aws"], summary: "Bad bug.", impact: "Very bad.",
                                action: "• Patch now.", published: "2026-06-10", sourceURL: "https://example.com",
                                category: nil, sourceName: nil)
        let text = ShareFormatter.text(for: item)
        XCTAssertTrue(text.contains("CVE-2026-1"))
        XCTAssertTrue(text.contains("RCE in Acme"))
        XCTAssertTrue(text.contains("CRITICAL"))
        XCTAssertTrue(text.contains("CVSS 9.8"))
        XCTAssertTrue(text.contains("CISA KEV"))
        XCTAssertTrue(text.contains("https://example.com"))
        XCTAssertTrue(text.contains("CISO Alert"))
    }
}
