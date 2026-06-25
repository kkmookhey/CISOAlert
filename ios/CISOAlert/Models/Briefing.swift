import Foundation

enum Severity: String, Codable, CaseIterable {
    case critical, high, medium, low, unknown
    var rank: Int { switch self { case .critical: 4; case .high: 3; case .medium: 2; case .low: 1; case .unknown: 0 } }
}

struct BriefingItem: Codable, Identifiable, Hashable {
    let id: String
    let title: String
    let severity: Severity
    let cvss: Double?
    let kev: Bool
    let techKeys: [String]
    let summary: String
    let impact: String
    let action: String
    let published: String
    let sourceURL: String?
    let category: String?
    let sourceName: String?
}

struct BriefingGroup: Codable, Identifiable, Hashable {
    let title: String
    let product: String
    let count: Int
    let maxSeverity: Severity
    let items: [BriefingItem]
    var id: String { product }
}

enum BriefingEntry: Codable, Hashable, Identifiable {
    case item(BriefingItem)
    case group(BriefingGroup)

    var id: String {
        switch self {
        case .item(let i): "item-\(i.id)"
        case .group(let g): "group-\(g.product)"
        }
    }

    private enum CodingKeys: String, CodingKey { case kind, item, title, product, count, maxSeverity, items }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        switch try c.decode(String.self, forKey: .kind) {
        case "item":
            self = .item(try c.decode(BriefingItem.self, forKey: .item))
        case "group":
            self = .group(BriefingGroup(
                title: try c.decode(String.self, forKey: .title),
                product: try c.decode(String.self, forKey: .product),
                count: try c.decode(Int.self, forKey: .count),
                maxSeverity: try c.decode(Severity.self, forKey: .maxSeverity),
                items: try c.decode([BriefingItem].self, forKey: .items)))
        case let other:
            throw DecodingError.dataCorruptedError(forKey: .kind, in: c, debugDescription: "unknown entry kind \(other)")
        }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .item(let i):
            try c.encode("item", forKey: .kind)
            try c.encode(i, forKey: .item)
        case .group(let g):
            try c.encode("group", forKey: .kind)
            try c.encode(g.title, forKey: .title)
            try c.encode(g.product, forKey: .product)
            try c.encode(g.count, forKey: .count)
            try c.encode(g.maxSeverity, forKey: .maxSeverity)
            try c.encode(g.items, forKey: .items)
        }
    }
}

struct Briefing: Codable, Hashable {
    let date: String
    let headline: String
    let entries: [BriefingEntry]
}

struct BriefingDate: Codable, Identifiable, Hashable {
    let date: String
    let count: Int
    let maxSeverity: Severity
    var id: String { date }
}

enum BriefingCategory: String, CaseIterable {
    case vuln, threat, news
    var title: String { switch self { case .vuln: "Vulns"; case .threat: "Threats"; case .news: "News" } }
    var systemImage: String { switch self { case .vuln: "exclamationmark.shield"; case .threat: "bolt.shield"; case .news: "newspaper" } }
}
