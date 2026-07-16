plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("com.google.gms.google-services") apply false
}

// The Firebase configuration file is intentionally not committed. Keeping the
// plugin conditional lets contributors build the open project before the
// production Firebase app is created; it activates automatically after the
// owner adds the official file at app/google-services.json.
if (file("google-services.json").isFile) {
    apply(plugin = "com.google.gms.google-services")
}

// Debug builds deliberately remain usable for catalogue/UI work without a
// Firebase project. A release build must never ship an auth screen that cannot
// initialise, so fail before producing an AAB when its official client config
// has not been supplied by the release owner.
tasks.matching { it.name == "preReleaseBuild" }.configureEach {
    doFirst {
        check(file("google-services.json").isFile) {
            "Missing app/google-services.json. Download the Android config for com.sakhatube.app from Firebase before building a release."
        }
    }
}

fun String.asBuildConfigString(): String = "\"${replace("\\", "\\\\").replace("\"", "\\\"")}\""

val catalogBaseUrl = providers.gradleProperty("SAKHATUBE_CATALOG_BASE_URL")
    .orElse("https://sakhatube-production.up.railway.app")
val privacyPolicyUrl = providers.gradleProperty("SAKHATUBE_PRIVACY_URL").orElse("https://sakhatube-production.up.railway.app/privacy")
val termsUrl = providers.gradleProperty("SAKHATUBE_TERMS_URL").orElse("https://sakhatube-production.up.railway.app/terms")
val communityRulesUrl = providers.gradleProperty("SAKHATUBE_COMMUNITY_RULES_URL").orElse("https://sakhatube-production.up.railway.app/community-rules")
val accountDeletionUrl = providers.gradleProperty("SAKHATUBE_ACCOUNT_DELETION_URL").orElse("https://sakhatube-production.up.railway.app/delete-account")
val authBaseUrl = providers.gradleProperty("SAKHATUBE_AUTH_BASE_URL").orElse(catalogBaseUrl)
// Billing is deliberately disabled by default. A release may enable it only
// after the backend verifies Play purchase tokens and grants access itself.
val playSubscriptionProductId = providers.gradleProperty("SAKHATUBE_PLAY_SUBSCRIPTION_PRODUCT_ID").orElse("")
val playSubscriptionProductKey = providers.gradleProperty("SAKHATUBE_PLAY_SUBSCRIPTION_PRODUCT_KEY").orElse("")
val playBillingEnabled = providers.gradleProperty("SAKHATUBE_PLAY_BILLING_ENABLED").orElse("false")
val playBillingServerVerificationEnabled = providers.gradleProperty("SAKHATUBE_PLAY_BILLING_SERVER_VERIFICATION_ENABLED").orElse("false")

android {
    namespace = "com.sakhatube.android"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.sakhatube.app"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        buildConfigField("String", "CATALOG_BASE_URL", catalogBaseUrl.get().asBuildConfigString())
        buildConfigField("String", "PRIVACY_POLICY_URL", privacyPolicyUrl.get().asBuildConfigString())
        buildConfigField("String", "TERMS_URL", termsUrl.get().asBuildConfigString())
        buildConfigField("String", "COMMUNITY_RULES_URL", communityRulesUrl.get().asBuildConfigString())
        buildConfigField("String", "ACCOUNT_DELETION_URL", accountDeletionUrl.get().asBuildConfigString())
        buildConfigField("String", "AUTH_BASE_URL", authBaseUrl.get().asBuildConfigString())
        buildConfigField("String", "PLAY_SUBSCRIPTION_PRODUCT_ID", playSubscriptionProductId.get().asBuildConfigString())
        buildConfigField("String", "PLAY_SUBSCRIPTION_PRODUCT_KEY", playSubscriptionProductKey.get().asBuildConfigString())
        buildConfigField("boolean", "PLAY_BILLING_ENABLED", playBillingEnabled.get())
        buildConfigField("boolean", "PLAY_BILLING_SERVER_VERIFICATION_ENABLED", playBillingServerVerificationEnabled.get())
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    // Keep all Media3 modules on the exact same reviewed release.
    val media3Version = "1.10.1"
    val composeBom = platform("androidx.compose:compose-bom:2025.06.01")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.9.1")
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.9.1")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.9.1")
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.media3:media3-exoplayer:$media3Version")
    implementation("androidx.media3:media3-exoplayer-hls:$media3Version")
    implementation("androidx.media3:media3-ui:$media3Version")
    // Access tokens are held in an Android Keystore-backed encrypted preferences
    // file. The file is excluded from backup and device transfer by the manifest
    // rules, so a restored device cannot receive another device's session.
    implementation("androidx.security:security-crypto:1.1.0-alpha06")

    // Firebase Auth verifies the e-mail/password credential. SakhaTube still
    // owns the viewer profile, public ST-ID and its own API session.
    implementation(platform("com.google.firebase:firebase-bom:34.15.0"))
    implementation("com.google.firebase:firebase-auth")

    // Used only as a fail-closed purchase/restore client. It never grants an
    // entitlement locally: the SakhaTube backend must verify every token.
    implementation("com.android.billingclient:billing-ktx:8.1.0")

    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.espresso:espresso-core:3.6.1")
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    testImplementation("junit:junit:4.13.2")
}
