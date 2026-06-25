import Foundation

@MainActor
final class Settings: ObservableObject {
    static let shared = Settings()

    @Published var apiBaseURL: String {
        didSet { UserDefaults.standard.set(apiBaseURL, forKey: "cisoalert.apiBaseURL") }
    }
    @Published var onboardingComplete: Bool {
        didSet { UserDefaults.standard.set(onboardingComplete, forKey: "cisoalert.onboardingComplete") }
    }

    /// Anonymous, stable device identity. Never linked to PII.
    let deviceID: String

    private init() {
        let d = UserDefaults.standard
        // LIVE default: the deployed Worker URL (set after `wrangler deploy`, Slice 2 Task 2.1).
        // Replace <subdomain> with the real value, keep the trailing slash so relative paths resolve.
        self.apiBaseURL = d.string(forKey: "cisoalert.apiBaseURL") ?? "https://cisoalert.kkmookhey.workers.dev/"
        self.onboardingComplete = d.bool(forKey: "cisoalert.onboardingComplete")
        self.deviceID = Keychain.deviceID()
    }

    var isBackendConfigured: Bool { !apiBaseURL.isEmpty && URL(string: apiBaseURL) != nil }
}
