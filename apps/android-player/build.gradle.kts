// Top-level build file where you can add configuration options common to all sub-projects/modules.
buildscript {
    val hilt_version = "2.51"
    dependencies {
        classpath("com.google.dagger:hilt-android-gradle-plugin:$hilt_version")
    }
}

plugins {
    id("com.android.application") version "8.3.0" apply false
    id("com.android.library") version "8.3.0" apply false
    id("org.jetbrains.kotlin.android") version "2.0.21" apply false
    id("org.jetbrains.kotlin.plugin.serialization") version "2.0.21" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.0.21" apply false
    id("com.google.devtools.ksp") version "2.0.21-1.0.28" apply false
}
val sharedBuildRoot: java.io.File = run {
    val base = System.getenv("LOCALAPPDATA") ?: System.getProperty("java.io.tmpdir")
    file("$base/NuExisPlayerGradleBuild")
}

layout.buildDirectory.set(sharedBuildRoot.resolve("root"))

fun java.io.File.deleteRecursivelyWithRetry(
    maxAttempts: Int = 8,
    delayMs: Long = 300,
): Boolean {
    repeat(maxAttempts) {
        if (!exists()) return true
        if (deleteRecursively()) return true
        Thread.sleep(delayMs)
    }
    return !exists()
}

subprojects {
    val moduleBuildPath = project.path.removePrefix(":").replace(':', '/')
    layout.buildDirectory.set(sharedBuildRoot.resolve(moduleBuildPath))
    tasks.matching { it.name.startsWith("dexBuilder") }.configureEach {
        doFirst {
            val variant = name.removePrefix("dexBuilder").replaceFirstChar { it.lowercaseChar() }
            val dexOutputDirectory = layout.buildDirectory
                .dir("intermediates/project_dex_archive/$variant/$name/out")
                .get()
                .asFile

            if (dexOutputDirectory.exists() && !dexOutputDirectory.deleteRecursivelyWithRetry()) {
                logger.warn(
                    "Could not pre-clean locked dex output directory: ${dexOutputDirectory.absolutePath}. " +
                        "Close file handles on build/intermediates and rerun the build."
                )
            }
        }
    }

    tasks.matching { it.name.startsWith("ksp") && it.name.endsWith("Kotlin") }.configureEach {
        doFirst {
            val variant = name.removePrefix("ksp").removeSuffix("Kotlin")
                .replaceFirstChar { it.lowercaseChar() }
            val generatedKspDirectory = layout.buildDirectory.dir("generated/ksp/$variant").get().asFile
            val kspCacheDirectory = layout.buildDirectory.dir("kspCaches/$variant").get().asFile

            if (generatedKspDirectory.exists() && !generatedKspDirectory.deleteRecursivelyWithRetry()) {
                logger.warn(
                    "Could not pre-clean locked KSP generated directory: ${generatedKspDirectory.absolutePath}. " +
                        "Close file handles on build/generated and rerun the build."
                )
            }
            if (kspCacheDirectory.exists() && !kspCacheDirectory.deleteRecursivelyWithRetry()) {
                logger.warn(
                    "Could not pre-clean locked KSP cache directory: ${kspCacheDirectory.absolutePath}. " +
                        "Close file handles on build/kspCaches and rerun the build."
                )
            }
        }
    }
}

tasks.register("clean", Delete::class) {
    delete(sharedBuildRoot)
}
