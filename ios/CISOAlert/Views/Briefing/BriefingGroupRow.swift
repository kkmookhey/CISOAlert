import SwiftUI

struct BriefingGroupRow: View {
    let group: BriefingGroup
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Text(group.maxSeverity.label.uppercased())
                    .font(.caption2).bold().padding(.horizontal, 6).padding(.vertical, 2)
                    .background(group.maxSeverity.color.opacity(0.2))
                    .foregroundStyle(group.maxSeverity.color).clipShape(Capsule())
                Image(systemName: "square.stack.3d.up").foregroundStyle(.secondary)
                Spacer()
                Text("\(group.count) issues").font(.caption2).foregroundStyle(.secondary)
            }
            Text(group.title).font(.headline).lineLimit(2)
            Text("Tap to see all \(group.count) issues").font(.subheadline).foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
    }
}
