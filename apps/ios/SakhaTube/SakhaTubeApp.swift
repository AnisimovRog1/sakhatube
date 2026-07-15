import SwiftUI

@main
struct SakhaTubeApp: App {
    @StateObject private var session = AppSession()
    @StateObject private var catalog: CatalogStore

    init() {
        _catalog = StateObject(wrappedValue: CatalogStore())
    }

    var body: some Scene {
        WindowGroup {
            AppRootView()
                .environmentObject(session)
                .environmentObject(catalog)
                .preferredColorScheme(.dark)
        }
    }
}
