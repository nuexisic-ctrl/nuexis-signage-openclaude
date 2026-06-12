import java.util.Properties

plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.serialization")
    id("com.google.devtools.ksp")
    id("dagger.hilt.android.plugin")
}

val localProperties = Properties().apply {
    val file = rootProject.file("local.properties")
    if (file.exists()) {
        file.inputStream().use { load(it) }
    }
}

// Publishable anon key (same role as NEXT_PUBLIC_SUPABASE_ANON_KEY in the web app).
// Override via local.properties: SUPABASE_ANON_KEY=...
val supabaseAnonKey: String = localProperties.getProperty("SUPABASE_ANON_KEY")
    ?: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwZGFiZGJxaGprbXh2d251a2V2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzMzMxMTIsImV4cCI6MjA5MzkwOTExMn0.VR0ZMijdHRokIFiXiIZ6rQsKoGtokp8GZh5C-vSvcpI"

android {
    namespace = "com.nuexis.player.core.network"
    compileSdk = 34
    buildFeatures {
        buildConfig = true
    }
    defaultConfig {
        minSdk = 24
        buildConfigField("String", "SUPABASE_URL", "\"https://dpdabdbqhjkmxvwnukev.supabase.co/\"")
        buildConfigField("String", "SUPABASE_ANON_KEY", "\"$supabaseAnonKey\"")
        val playerUrl = localProperties.getProperty("PLAYER_URL", "https://nuexis-signage-openclaude.vercel.app/player")
        buildConfigField("String", "PLAYER_URL", "\"$playerUrl\"")
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
    implementation(project(":core:domain"))

    implementation("androidx.core:core-ktx:1.12.0")
    implementation("com.google.dagger:hilt-android:2.51")
    ksp("com.google.dagger:hilt-compiler:2.51")

    implementation(platform("io.github.jan-tennert.supabase:bom:2.6.0"))
    implementation("io.github.jan-tennert.supabase:realtime-kt")
    implementation("io.github.jan-tennert.supabase:postgrest-kt")

    implementation("io.ktor:ktor-client-okhttp:2.3.12")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")

    implementation("androidx.security:security-crypto:1.1.0-alpha06")

    implementation("com.squareup.retrofit2:retrofit:2.9.0")
    implementation("com.squareup.retrofit2:converter-gson:2.9.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
}
