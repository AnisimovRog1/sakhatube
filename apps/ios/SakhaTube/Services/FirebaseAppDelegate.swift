import FirebaseCore
import UIKit

/// Firebase is configured only from the owner-provided app configuration. The
/// SDK verifies e-mail/password identities; SakhaTube retains the profile,
/// public ST-ID and the server session.
final class FirebaseAppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        guard Bundle.main.url(forResource: "GoogleService-Info", withExtension: "plist") != nil else {
            return true
        }
        FirebaseApp.configure()
        return true
    }
}
