import SwiftUI

/// Transilience lockup: the gradient mark (theme-agnostic image) + the wordmark
/// rendered as native text in the primary color (so it adapts to light/dark, unlike
/// the black-text logo PNG). `compact` shows the mark only.
struct TransilienceWordmark: View {
    var height: CGFloat = 22
    var compact: Bool = false

    var body: some View {
        HStack(spacing: 8) {
            Image("TransilienceMark")
                .resizable()
                .scaledToFit()
                .frame(height: height)
            if !compact {
                Text("Transilience AI")
                    .font(.system(size: height * 0.82, weight: .semibold))
                    .foregroundStyle(.primary)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Transilience AI")
    }
}
