import SwiftUI

struct RootView: View {
    @EnvironmentObject var settings: Settings
    @Environment(\.scenePhase) private var scenePhase
    var body: some View {
        Group {
            if settings.onboardingComplete {
                TabView {
                    NavigationStack { BriefingView(category: .vuln) }
                        .tabItem { Label("Vulns", systemImage: "exclamationmark.shield") }
                    NavigationStack { BriefingView(category: .threat) }
                        .tabItem { Label("Threats", systemImage: "bolt.shield") }
                    NavigationStack { BriefingView(category: .news) }
                        .tabItem { Label("News", systemImage: "newspaper") }
                    NavigationStack { SettingsView() }
                        .tabItem { Label("Settings", systemImage: "gearshape") }
                }
            } else {
                OnboardingView()
            }
        }
        // Re-sync stack + token whenever the app becomes active. This picks up
        // stack edits made in Settings without per-toggle network spam.
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active, settings.onboardingComplete else { return }
            Task { try? await APIClient.shared.register(deviceID: settings.deviceID,
                                                        apnsToken: PushManager.shared.lastToken,
                                                        techKeys: StackStore.shared.sortedKeys) }
        }
    }
}
