import SwiftUI

struct CategoryStepView: View {
    let category: TechCategory
    @ObservedObject var stack: StackStore
    private let cols = [GridItem(.adaptive(minimum: 150), spacing: 12)]

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Label(category.title, systemImage: category.icon).font(.title2).bold()
            Text("Select everything you use. You can change this later.").font(.subheadline).foregroundStyle(.secondary)
            ScrollView {
                LazyVGrid(columns: cols, spacing: 12) {
                    ForEach(category.options) { opt in
                        Button { stack.toggle(opt.key) } label: {
                            HStack {
                                Image(systemName: stack.isSelected(opt.key) ? "checkmark.circle.fill" : "circle")
                                Text(opt.name).lineLimit(2).multilineTextAlignment(.leading)
                                Spacer()
                            }
                            .padding(12)
                            .background(stack.isSelected(opt.key) ? Color.accentColor.opacity(0.15) : Color(.secondarySystemBackground))
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }.padding()
    }
}
