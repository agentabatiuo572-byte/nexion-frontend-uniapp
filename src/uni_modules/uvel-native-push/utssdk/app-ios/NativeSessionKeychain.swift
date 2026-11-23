import Foundation
import Security

public final class NativeSessionKeychain {
    private static let service = "ai.uvel.app.test.refresh-session.v1"

    public static func supported() -> Bool {
        Bundle.main.bundleIdentifier == "ai.uvel.app.test"
    }

    private static func query(_ scope: String) -> [String: Any]? {
        guard supported(),
              scope.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil else { return nil }
        return [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: scope,
            kSecAttrSynchronizable as String: false
        ]
    }

    public static func read(_ scope: String) -> String? {
        guard var attributes = query(scope) else { return nil }
        if UserDefaults.standard.bool(forKey: service + ".revoked." + scope) { return "" }
        attributes[kSecReturnData as String] = true
        attributes[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(attributes as CFDictionary, &result)
        if status == errSecItemNotFound { return "" }
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    public static func write(_ scope: String, _ value: String) -> Bool {
        guard var attributes = query(scope) else { return false }
        let tombstone = service + ".revoked." + scope
        if value.isEmpty {
            // A failed Keychain removal must not resurrect a locally signed-out session.
            UserDefaults.standard.set(true, forKey: tombstone)
            let status = SecItemDelete(attributes as CFDictionary)
            return status == errSecSuccess || status == errSecItemNotFound
        }

        let data = Data(value.utf8)
        var status = SecItemUpdate(attributes as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        if status == errSecItemNotFound {
            attributes[kSecValueData as String] = data
            attributes[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
            status = SecItemAdd(attributes as CFDictionary, nil)
        }
        guard status == errSecSuccess else { return false }
        UserDefaults.standard.removeObject(forKey: tombstone)
        return true
    }
}
