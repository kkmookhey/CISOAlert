import SwiftUI

struct BriefingGroupView: View {
    let group: BriefingGroup
    var body: some View {
        List {
            ForEach(group.items) { item in
                NavigationLink(value: item) { BriefingItemRow(item: item) }
            }
        }
        .navigationTitle(group.title)
        .navigationBarTitleDisplayMode(.inline)
    }
}
