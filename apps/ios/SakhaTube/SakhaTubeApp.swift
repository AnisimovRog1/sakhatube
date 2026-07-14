import SwiftUI

@main
struct SakhaTubeApp: App {
    @StateObject private var session = AppSession()

    var body: some Scene {
        WindowGroup {
            AppRootView()
                .environmentObject(session)
                .preferredColorScheme(.dark)
        }
    }
}
