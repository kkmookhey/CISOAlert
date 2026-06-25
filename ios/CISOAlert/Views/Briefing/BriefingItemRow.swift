import SwiftUI

struct BriefingItemRow: View {
    let item: BriefingItem
    private var isArticle: Bool { item.category == "threat" || item.category == "news" }
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                if !isArticle {
                    Text(item.severity.label.uppercased())
                        .font(.caption2).bold().padding(.horizontal, 6).padding(.vertical, 2)
                        .background(item.severity.color.opacity(0.2))
                        .foregroundStyle(item.severity.color).clipShape(Capsule())
                    if item.kev { Label("KEV", systemImage: "flame.fill").font(.caption2).bold().foregroundStyle(.red) }
                }
                Spacer()
                Text(isArticle ? (item.sourceName ?? "") : item.id).font(.caption2).foregroundStyle(.secondary)
            }
            Text(item.title).font(.headline).lineLimit(2)
            Text(item.summary).font(.subheadline).foregroundStyle(.secondary).lineLimit(2)
        }
        .padding(.vertical, 4)
    }
}
