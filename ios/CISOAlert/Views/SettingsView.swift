import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var settings: Settings
    @ObservedObject var stack = StackStore.shared
    private let catalog = TechCatalog.bundled

    var body: some View {
        Form {
            Section("Your stack") {
                ForEach(catalog.categories) { cat in
                    NavigationLink(cat.title) {
                        CategoryStepView(category: cat, stack: stack).navigationTitle(cat.title)
                    }
                }
            }
            Section("Privacy") {
                Text("CISO Alert collects no personal data. Your stack is stored on this device. Only anonymous technology tags, your device's time zone (to schedule the briefing), and a push token are sent to our server to deliver briefings.")
                    .font(.footnote).foregroundStyle(.secondary)
            }
            Section {
                Button("Delete my data", role: .destructive) {
                    let id = settings.deviceID
                    Task { await APIClient.shared.delete(deviceID: id) }
                    stack.setAll([])
                    Keychain.delete()
                    settings.onboardingComplete = false
                }
            }
            Section {
                Link(destination: Brand.url) {
                    VStack(alignment: .leading, spacing: 8) {
                        TransilienceWordmark(height: 20)
                        HStack(spacing: 4) {
                            Text("CISO Alert — by Transilience AI")
                                .font(.footnote).foregroundStyle(.secondary)
                            Image(systemName: "arrow.up.right").font(.caption2).foregroundStyle(.secondary)
                        }
                        Text("Version \(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "—")")
                            .font(.caption).foregroundStyle(.secondary)
                    }.padding(.vertical, 4)
                }
                .buttonStyle(.plain)
            }
        }
        .navigationTitle("Settings")
    }
}
