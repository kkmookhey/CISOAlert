import Foundation

enum APIError: LocalizedError {
    case notConfigured, badStatus(Int, String), decoding(Error), network(Error)
    var errorDescription: String? {
        switch self {
        case .notConfigured: "Backend not configured."
        case .badStatus(let s, let b): "HTTP \(s): \(b)"
        case .decoding(let e): "Decoding failed: \(e.localizedDescription)"
        case .network(let e): "Network error: \(e.localizedDescription)"
        }
    }
}

actor APIClient {
    static let shared = APIClient()

    private func baseURL() async -> URL? {
        let s = await MainActor.run { Settings.shared.apiBaseURL }
        return s.isEmpty ? nil : URL(string: s)
    }

    private func request(_ path: String, method: String = "GET", body: Data? = nil,
                         headers: [String: String] = [:]) async throws -> Data {
        guard let base = await baseURL(), let url = URL(string: path, relativeTo: base) else {
            throw APIError.notConfigured
        }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        for (k, v) in headers { req.setValue(v, forHTTPHeaderField: k) }
        if let body { req.httpBody = body }
        let (data, resp): (Data, URLResponse)
        do { (data, resp) = try await URLSession.shared.data(for: req) }
        catch { throw APIError.network(error) }
        guard let http = resp as? HTTPURLResponse else { throw APIError.badStatus(0, "no response") }
        guard (200..<300).contains(http.statusCode) else {
            throw APIError.badStatus(http.statusCode, String(data: data, encoding: .utf8) ?? "")
        }
        return data
    }

    func fetchBriefing(deviceID: String, category: BriefingCategory = .vuln, date: String? = nil) async -> Briefing {
        guard await baseURL() != nil else { return SampleBriefing.value(for: category) }
        do {
            var path = "v1/briefing?category=\(category.rawValue)"
            if let date { path += "&date=\(date)" }
            let data = try await request(path, headers: ["X-Device-Id": deviceID])
            return try JSONDecoder().decode(Briefing.self, from: data)
        } catch {
            return SampleBriefing.value(for: category)
        }
    }

    func fetchBriefingDates(deviceID: String, category: BriefingCategory = .vuln) async -> [BriefingDate] {
        guard await baseURL() != nil else { return [] }
        do {
            let data = try await request("v1/briefing/dates?category=\(category.rawValue)", headers: ["X-Device-Id": deviceID])
            return try JSONDecoder().decode([BriefingDate].self, from: data)
        } catch { return [] }
    }

    func delete(deviceID: String) async {
        guard await baseURL() != nil else { return }
        let payload = ["deviceId": deviceID]
        if let body = try? JSONSerialization.data(withJSONObject: payload) {
            _ = try? await request("v1/delete", method: "POST", body: body)
        }
    }

    func register(deviceID: String, apnsToken: String?, techKeys: [String]) async throws {
        guard await baseURL() != nil else { return } // defensive; baseURL is set in production
        let payload: [String: Any] = [
            "deviceId": deviceID,
            "apnsToken": apnsToken as Any,
            "techKeys": techKeys,
            "tz": TimeZone.current.identifier
        ]
        let body = try JSONSerialization.data(withJSONObject: payload)
        _ = try await request("v1/register", method: "POST", body: body)
    }
}
