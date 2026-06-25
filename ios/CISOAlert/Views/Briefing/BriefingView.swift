import SwiftUI

@MainActor
final class BriefingViewModel: ObservableObject {
    @Published var briefing: Briefing?
    @Published var loading = false
    let category: BriefingCategory
    let date: String?
    init(category: BriefingCategory, date: String? = nil) { self.category = category; self.date = date }
    func load() async {
        loading = true
        defer { loading = false }
        let result = await APIClient.shared.fetchBriefing(deviceID: Settings.shared.deviceID, category: category, date: date)
        guard !Task.isCancelled else { return }
        briefing = result
    }
}

struct BriefingView: View {
    @StateObject private var vm: BriefingViewModel
    private let category: BriefingCategory
    private let navTitle: String
    private let showsHistoryButton: Bool

    init(category: BriefingCategory = .vuln, date: String? = nil, navTitle: String? = nil) {
        _vm = StateObject(wrappedValue: BriefingViewModel(category: category, date: date))
        self.category = category
        self.navTitle = navTitle ?? category.title
        self.showsHistoryButton = (date == nil)
    }

    var body: some View {
        Group {
            if let b = vm.briefing {
                List {
                    Section { Text(b.headline).font(.title3).bold() } footer: { Text("Briefing for \(b.date)") }
                    ForEach(b.entries) { entry in
                        switch entry {
                        case .item(let item):
                            NavigationLink(value: item) { BriefingItemRow(item: item) }
                        case .group(let group):
                            NavigationLink(value: group) { BriefingGroupRow(group: group) }
                        }
                    }
                }
                .navigationDestination(for: BriefingItem.self) { BriefingDetailView(item: $0) }
                .navigationDestination(for: BriefingGroup.self) { BriefingGroupView(group: $0) }
                .refreshable { await vm.load() }
            } else if vm.loading {
                ProgressView("Loading briefing…")
            } else {
                ContentUnavailableView("No briefing yet", systemImage: "newspaper")
            }
        }
        .navigationTitle(navTitle)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Link(destination: Brand.url) {
                    TransilienceWordmark(height: 18)
                }
            }
            if showsHistoryButton {
                ToolbarItem(placement: .topBarTrailing) {
                    NavigationLink(value: "history") { Image(systemName: "clock.arrow.circlepath") }
                }
            }
        }
        .navigationDestination(for: String.self) { _ in BriefingHistoryView(category: category) }
        .task { await vm.load() }
    }
}
