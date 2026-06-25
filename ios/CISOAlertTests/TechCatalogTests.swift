import XCTest
@testable import CISOAlert

final class TechCatalogTests: XCTestCase {
    func testLoadsBundledCatalog() throws {
        let cat = try TechCatalog.loadBundled()
        XCTAssertFalse(cat.categories.isEmpty)
        let keys = cat.categories.flatMap { $0.options.map(\.key) }
        XCTAssertEqual(Set(keys).count, keys.count, "tech_keys must be unique")
    }
}
