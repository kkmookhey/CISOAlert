import SwiftUI

struct OnboardingView: View {
    @EnvironmentObject var settings: Settings
    @ObservedObject var stack = StackStore.shared
    @State private var step = 0
    private let catalog = TechCatalog.bundled

    var body: some View {
        VStack(spacing: 0) {
            TabView(selection: $step) {
                welcome.tag(0)
                ForEach(Array(catalog.categories.enumerated()), id: \.element.id) { idx, cat in
                    CategoryStepView(category: cat, stack: stack).tag(idx + 1)
                }
                review.tag(catalog.categories.count + 1)
            }
            .tabViewStyle(.page(indexDisplayMode: .always))
            .indexViewStyle(.page(backgroundDisplayMode: .always))

            HStack {
                if step > 0 { Button("Back") { withAnimation { step -= 1 } } }
                Spacer()
                Button(step == catalog.categories.count + 1 ? "Finish" : "Next") {
                    if step == catalog.categories.count + 1 { finish() }
                    else { withAnimation { step += 1 } }
                }.buttonStyle(.borderedProminent)
            }.padding()
        }
    }

    private var welcome: some View {
        VStack(spacing: 16) {
            Image(systemName: "shield.lefthalf.filled").font(.system(size: 64)).foregroundStyle(.tint)
            Text("CISO Alert").font(.largeTitle).bold()
            Link(destination: Brand.url) { TransilienceWordmark(height: 20) }
                .padding(.bottom, 4)
            Text("Tell us your stack. Get a daily threat briefing tuned to exactly what you run — collated from CISA KEV and NVD, written for busy security leaders.")
                .multilineTextAlignment(.center).foregroundStyle(.secondary)
            Text("No account. No personal data. Your stack stays on your device.")
                .font(.footnote).multilineTextAlignment(.center).foregroundStyle(.secondary)
        }.padding()
    }

    private var review: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Your stack").font(.title2).bold()
            if stack.selected.isEmpty {
                Text("Nothing selected yet — go back and pick what you use.").foregroundStyle(.secondary)
            } else {
                Text("\(stack.selected.count) technologies selected. We'll match new threats against these every day.")
                    .foregroundStyle(.secondary)
            }
        }.padding()
    }

    private func finish() {
        settings.onboardingComplete = true
        // Register the stack NOW (token may be nil) so the briefing works even if
        // the user declines push. The APNs token, if granted, syncs on the next
        // register call (didRegister / scenePhase active).
        Task { try? await APIClient.shared.register(deviceID: settings.deviceID,
                                                    apnsToken: PushManager.shared.lastToken,
                                                    techKeys: stack.sortedKeys) }
        PushManager.shared.requestAuthorizationAndRegister()
    }
}
