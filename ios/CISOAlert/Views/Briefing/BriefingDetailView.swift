import SwiftUI

struct BriefingDetailView: View {
    let item: BriefingItem
    private var isArticle: Bool { item.category == "threat" || item.category == "news" }
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if !isArticle {
                    HStack(spacing: 8) {
                        Text(item.severity.label.uppercased()).font(.caption).bold()
                            .padding(.horizontal, 8).padding(.vertical, 3)
                            .background(item.severity.color.opacity(0.2))
                            .foregroundStyle(item.severity.color).clipShape(Capsule())
                        if let cvss = item.cvss { Text("CVSS \(cvss, specifier: "%.1f")").font(.caption).foregroundStyle(.secondary) }
                        if item.kev { Label("CISA KEV", systemImage: "flame.fill").font(.caption).foregroundStyle(.red) }
                    }
                } else if let s = item.sourceName {
                    Text(s.uppercased()).font(.caption).bold().foregroundStyle(.secondary)
                }
                Text(item.title).font(.title3).bold()
                if !item.summary.isEmpty { section("Summary") { Text(item.summary).font(.body) } }
                if !item.impact.isEmpty { section(isArticle ? "Why it matters" : "Why it matters to you") { Text(item.impact).font(.body) } }
                if !item.action.isEmpty { section("Recommended action") { actionView } }
                if let s = item.sourceURL, let url = URL(string: s) {
                    Link(destination: url) { Label(isArticle ? "Read the full story" : "Source", systemImage: "link") }
                }
            }.padding()
        }
        .navigationTitle(isArticle ? "" : item.id)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ShareLink(item: ShareFormatter.text(for: item)) { Image(systemName: "square.and.arrow.up") }
        }
    }

    /// Renders the action as bullet lines when it contains "•"-prefixed lines, else as a paragraph.
    @ViewBuilder private var actionView: some View {
        let lines = item.action.split(separator: "\n").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        let bullets = lines.filter { $0.hasPrefix("•") }
        if bullets.count >= 1 {
            VStack(alignment: .leading, spacing: 6) {
                ForEach(Array(bullets.enumerated()), id: \.offset) { _, line in
                    Text(line).font(.body)
                }
            }
        } else {
            Text(item.action).font(.body)
        }
    }

    private func section<Content: View>(_ title: String, @ViewBuilder _ content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(.headline)
            content()
        }
    }
}
