import SwiftUI

@main
struct SakhaTubeApp: App {
    @UIApplicationDelegateAdaptor(FirebaseAppDelegate.self) private var firebaseAppDelegate
    @StateObject private var session = AppSession()
    @StateObject private var viewerSession = ViewerSessionStore()
    @StateObject private var storefront = Storefront()
    @StateObject private var catalog: CatalogStore

    init() {
        _catalog = StateObject(wrappedValue: CatalogStore())
    }

    var body: some Scene {
        WindowGroup {
            AppRootView()
                .environmentObject(session)
                .environmentObject(viewerSession)
                .environmentObject(storefront)
                .environmentObject(catalog)
                .preferredColorScheme(.dark)
                .task { await viewerSession.restoreSession() }
        }
    }
}
