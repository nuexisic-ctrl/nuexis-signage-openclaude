pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        maven { url = uri("https://jitpack.io") }
    }
}

rootProject.name = "NuExisPlayer"

include(":app")
include(":core:network")
include(":core:database")
include(":core:domain")
include(":core:media")
include(":feature:player")
include(":feature:pairing")
include(":feature:sync")
