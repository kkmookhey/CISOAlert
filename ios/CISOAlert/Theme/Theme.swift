import SwiftUI

extension Severity {
    var color: Color {
        switch self {
        case .critical: .red
        case .high: .orange
        case .medium: .yellow
        case .low: .blue
        case .unknown: .gray
        }
    }
    var label: String { rawValue.capitalized }
}

enum Brand {
    static let purple = Color(red: 0.369, green: 0.165, blue: 0.522) // #5E2A85
    static let magenta = Color(red: 0.631, green: 0.125, blue: 0.318) // #A12051
    static let gradient = LinearGradient(
        colors: [purple, magenta],
        startPoint: .topLeading, endPoint: .bottomTrailing)
    static let url = URL(string: "https://www.transilience.ai")!
}
