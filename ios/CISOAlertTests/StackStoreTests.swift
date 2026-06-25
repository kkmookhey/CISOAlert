import XCTest
@testable import CISOAlert

@MainActor
final class StackStoreTests: XCTestCase {
    func testToggleAndPersist() {
        let defaults = UserDefaults(suiteName: "test.\(UUID().uuidString)")!
        let store = StackStore(defaults: defaults)
        XCTAssertFalse(store.isSelected("cloud:aws"))
        store.toggle("cloud:aws")
        XCTAssertTrue(store.isSelected("cloud:aws"))

        // New instance backed by same defaults reloads the selection.
        let reload = StackStore(defaults: defaults)
        XCTAssertTrue(reload.isSelected("cloud:aws"))

        store.toggle("cloud:aws")
        XCTAssertFalse(store.isSelected("cloud:aws"))
    }
}
