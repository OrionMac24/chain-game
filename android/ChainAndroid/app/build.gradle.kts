plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.chainwordgame.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.chainwordgame.app"
        minSdk = 23
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
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
    implementation("androidx.core:core-ktx:1.16.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("com.google.android.gms:play-services-ads:25.4.0")
    implementation("com.google.android.ump:user-messaging-platform:4.0.0")
    implementation("com.revenuecat.purchases:purchases:9.23.1")
    implementation("com.revenuecat.purchases:purchases-ui:9.23.1")
}
