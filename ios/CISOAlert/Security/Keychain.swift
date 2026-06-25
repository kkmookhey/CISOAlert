import Foundation
import Security

enum Keychain {
    private static let service = "ai.transilience.cisoalert"
    private static let account = "anon_device_id"

    /// Returns a stable anonymous UUID, generating and storing one on first call.
    static func deviceID() -> String {
        if let existing = read() { return existing }
        let id = UUID().uuidString
        write(id)
        return id
    }

    private static func read() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data, let s = String(data: data, encoding: .utf8) else { return nil }
        return s
    }

    @discardableResult
    private static func write(_ value: String) -> Bool {
        let data = value.data(using: .utf8)!
        let attributes: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock
        ]
        SecItemDelete([
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ] as CFDictionary)
        let status = SecItemAdd(attributes as CFDictionary, nil)
        if status != errSecSuccess { print("[Keychain] write failed: \(status)") }
        return status == errSecSuccess
    }

    static func delete() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        SecItemDelete(query as CFDictionary)
    }
}
