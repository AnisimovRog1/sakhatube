import SwiftUI

struct AppRootView: View {
    @EnvironmentObject private var session: AppSession

    var body: some View {
        TabView(selection: $session.selectedTab) {
            HomeView()
                .tabItem { Label(AppTab.home.title, systemImage: AppTab.home.systemImage) }
                .tag(AppTab.home)
            CatalogView()
                .tabItem { Label(AppTab.catalog.title, systemImage: AppTab.catalog.systemImage) }
                .tag(AppTab.catalog)
            ForYouView()
                .tabItem { Label(AppTab.forYou.title, systemImage: AppTab.forYou.systemImage) }
                .tag(AppTab.forYou)
            LibraryView()
                .tabItem { Label(AppTab.library.title, systemImage: AppTab.library.systemImage) }
                .tag(AppTab.library)
            ProfileView()
                .tabItem { Label(AppTab.profile.title, systemImage: AppTab.profile.systemImage) }
                .tag(AppTab.profile)
        }
        .tint(AppTheme.primary)
        .sheet(isPresented: $session.isShowingPlayer) {
            if let item = session.selectedTitle {
                PlayerView(item: item)
            }
        }
    }
}
