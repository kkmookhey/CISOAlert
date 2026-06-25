import SwiftUI

@MainActor
final class BriefingHistoryViewModel: ObservableObject {
    @Published var dates: [BriefingDate] = []
    @Published var loading = false
    let category: BriefingCategory
    init(category: BriefingCategory) { self.category = category }
    func load() async {
        loading = true
        defer { loading = false }
        let result = await APIClient.shared.fetchBriefingDates(deviceID: Settings.shared.deviceID, category: category)
        guard !Task.isCancelled else { return }
        dates = result
    }
}

struct BriefingHistoryView: View {
    let category: BriefingCategory
    @StateObject private var vm: BriefingHistoryViewModel
    init(category: BriefingCategory) { self.category = category; _vm = StateObject(wrappedValue: BriefingHistoryViewModel(category: category)) }
    var body: some View {
        Group {
            if vm.dates.isEmpty && !vm.loading {
                ContentUnavailableView("No history yet", systemImage: "clock", description: Text("Past briefings from the last 14 days will appear here."))
            } else {
                List(vm.dates) { d in
                    NavigationLink(value: d) {
                        HStack {
                            Text(d.date).font(.body)
                            Spacer()
                            Text(d.maxSeverity.label.uppercased())
                                .font(.caption2).bold().padding(.horizontal, 6).padding(.vertical, 2)
                                .background(d.maxSeverity.color.opacity(0.2))
                                .foregroundStyle(d.maxSeverity.color).clipShape(Capsule())
                            Text("\(d.count)").font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
        .navigationTitle("History")
        .navigationDestination(for: BriefingDate.self) { d in
            BriefingView(category: category, date: d.date, navTitle: d.date)
        }
        .task { await vm.load() }
    }
}
