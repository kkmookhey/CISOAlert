import Foundation

struct TechOption: Codable, Identifiable, Hashable {
    let key: String
    let name: String
    let hints: [String]
    var id: String { key }
}

struct TechCategory: Codable, Identifiable, Hashable {
    let id: String
    let title: String
    let icon: String
    let options: [TechOption]
}

struct TechCatalog: Codable {
    let version: Int
    let categories: [TechCategory]

    static let bundled: TechCatalog = (try? loadBundled()) ?? TechCatalog(version: 0, categories: [])

    static func loadBundled() throws -> TechCatalog {
        guard let url = Bundle.main.url(forResource: "tech_catalog", withExtension: "json") else {
            throw NSError(domain: "TechCatalog", code: 1, userInfo: [NSLocalizedDescriptionKey: "tech_catalog.json missing from bundle"])
        }
        let data = try Data(contentsOf: url)
        return try JSONDecoder().decode(TechCatalog.self, from: data)
    }
}
