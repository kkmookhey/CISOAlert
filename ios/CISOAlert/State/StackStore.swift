import Foundation

@MainActor
final class StackStore: ObservableObject {
    static let shared = StackStore()

    @Published private(set) var selected: Set<String>
    private let defaults: UserDefaults
    private let key = "cisoalert.selectedTechKeys"

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        let arr = defaults.stringArray(forKey: key) ?? []
        self.selected = Set(arr)
    }

    func isSelected(_ techKey: String) -> Bool { selected.contains(techKey) }

    func toggle(_ techKey: String) {
        if selected.contains(techKey) { selected.remove(techKey) } else { selected.insert(techKey) }
        persist()
    }

    func setAll(_ keys: Set<String>) { selected = keys; persist() }

    var sortedKeys: [String] { selected.sorted() }

    private func persist() { defaults.set(Array(selected), forKey: key) }
}
