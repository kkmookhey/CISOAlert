import Foundation
import UIKit
import UserNotifications

@MainActor
final class PushManager {
    static let shared = PushManager()
    private(set) var lastToken: String?
    private(set) var lastError: String?

    func requestAuthorizationAndRegister() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
            if let error { Task { @MainActor in self.lastError = error.localizedDescription }; return }
            guard granted else { return }
            DispatchQueue.main.async { UIApplication.shared.registerForRemoteNotifications() }
        }
    }

    func didRegister(token: Data) {
        let hex = token.map { String(format: "%02x", $0) }.joined()
        lastToken = hex
        let deviceID = Settings.shared.deviceID
        let keys = StackStore.shared.sortedKeys
        Task {
            do { try await APIClient.shared.register(deviceID: deviceID, apnsToken: hex, techKeys: keys) }
            catch { self.lastError = "register failed: \(error.localizedDescription)" }
        }
    }

    func didFailRegistration(error: Error) { lastError = error.localizedDescription }
}
