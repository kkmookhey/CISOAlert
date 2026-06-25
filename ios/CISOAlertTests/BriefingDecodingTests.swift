import XCTest
@testable import CISOAlert

final class BriefingDecodingTests: XCTestCase {
    func testDecodesItemAndGroupEntries() throws {
        let json = """
        {"date":"2026-06-10","headline":"4 issues match your stack",
         "entries":[
           {"kind":"item","item":{"id":"CVE-2026-0001","title":"RCE","severity":"critical","cvss":9.8,"kev":true,"techKeys":["cloud:aws"],"summary":"s","impact":"i","action":"• a\\n• b","published":"2026-06-09","sourceURL":"https://x"}},
           {"kind":"group","title":"Multiple Chrome Security Issues","product":"chrome","count":3,"maxSeverity":"high","items":[
              {"id":"CVE-2026-1","title":"c1","severity":"high","cvss":7.5,"kev":false,"techKeys":["software:google"],"summary":"s","impact":"i","action":"a","published":"2026-06-09","sourceURL":null}
           ]}
         ]}
        """.data(using: .utf8)!
        let b = try JSONDecoder().decode(Briefing.self, from: json)
        XCTAssertEqual(b.entries.count, 2)
        guard case .item(let i) = b.entries[0] else { return XCTFail("entry 0 should be item") }
        XCTAssertEqual(i.id, "CVE-2026-0001")
        guard case .group(let g) = b.entries[1] else { return XCTFail("entry 1 should be group") }
        XCTAssertEqual(g.product, "chrome")
        XCTAssertEqual(g.count, 3)
        XCTAssertEqual(g.items.count, 1)
    }

    func testDecodesBriefingDates() throws {
        let json = """
        [{"date":"2026-06-10","count":5,"maxSeverity":"critical"},
         {"date":"2026-06-09","count":2,"maxSeverity":"high"}]
        """.data(using: .utf8)!
        let dates = try JSONDecoder().decode([BriefingDate].self, from: json)
        XCTAssertEqual(dates.count, 2)
        XCTAssertEqual(dates[0].maxSeverity, .critical)
    }

    func testDecodesArticleItemFields() throws {
        let json = """
        {"id":"art-abc","title":"Breach at Acme","severity":"unknown","cvss":null,"kev":false,
         "techKeys":["idp:okta"],"summary":"s","impact":"i","action":"","published":"2026-06-11",
         "sourceURL":"https://x","category":"threat","sourceName":"Krebs on Security"}
        """.data(using: .utf8)!
        let it = try JSONDecoder().decode(BriefingItem.self, from: json)
        XCTAssertEqual(it.category, "threat")
        XCTAssertEqual(it.sourceName, "Krebs on Security")
        XCTAssertNil(it.cvss)
    }
}
