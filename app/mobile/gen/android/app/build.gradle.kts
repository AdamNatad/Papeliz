import java.util.Properties
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("rust")
}

val tauriProperties = Properties().apply {
    val propFile = file("tauri.properties")
    if (propFile.exists()) {
        propFile.inputStream().use { load(it) }
    }
}

// The release key's file, alias and passwords: app/mobile/papeliz-mobile-android-release-signing.properties
// (Git-ignored, from the template beside it), or the file PAPELIZ_MOBILE_ANDROID_RELEASE_SIGNING_PROPERTIES_FILE
// names, so a build from a clean copy of the repository can use the one kept here. Without either, the
// release build stays unsigned. The passwords are never printed.
val papelizAndroidReleaseSigningPropertiesFile: File =
    System.getenv("PAPELIZ_MOBILE_ANDROID_RELEASE_SIGNING_PROPERTIES_FILE")?.trim()?.takeIf { it.isNotEmpty() }?.let { file(it) }
        ?: rootProject.file("../../papeliz-mobile-android-release-signing.properties")
val papelizAndroidReleaseSigningProperties: Properties? =
    if (papelizAndroidReleaseSigningPropertiesFile.exists()) {
        Properties().apply { papelizAndroidReleaseSigningPropertiesFile.inputStream().use { load(it) } }
    } else {
        null
    }

fun readPapelizAndroidReleaseSigningProperty(signingPropertyName: String): String {
    val signingPropertyValue = papelizAndroidReleaseSigningProperties?.getProperty(signingPropertyName)?.trim().orEmpty()
    if (signingPropertyValue.isEmpty()) {
        throw GradleException("$signingPropertyName is empty in $papelizAndroidReleaseSigningPropertiesFile")
    }
    return signingPropertyValue
}

// A keystore path may start with ~/ for the home folder.
fun readPapelizAndroidReleaseKeystoreFile(): File {
    val releaseKeystoreFilePath = readPapelizAndroidReleaseSigningProperty("papelizAndroidReleaseKeystoreFile")
    val releaseKeystoreFile =
        if (releaseKeystoreFilePath.startsWith("~/")) File(System.getProperty("user.home"), releaseKeystoreFilePath.substring(2))
        else file(releaseKeystoreFilePath)
    if (!releaseKeystoreFile.isFile) {
        throw GradleException("No keystore at $releaseKeystoreFile (papelizAndroidReleaseKeystoreFile in $papelizAndroidReleaseSigningPropertiesFile)")
    }
    return releaseKeystoreFile
}

android {
    compileSdk = 37
    namespace = "com.papeliz.mobile"
    defaultConfig {
        manifestPlaceholders["usesCleartextTraffic"] = "false"
        applicationId = "com.papeliz.mobile"
        minSdk = 24
        targetSdk = 37
        versionCode = tauriProperties.getProperty("tauri.android.versionCode", "1").toInt()
        versionName = tauriProperties.getProperty("tauri.android.versionName", "1.0")
    }
    signingConfigs {
        if (papelizAndroidReleaseSigningProperties != null) {
            create("papelizRelease") {
                storeFile = readPapelizAndroidReleaseKeystoreFile()
                storePassword = readPapelizAndroidReleaseSigningProperty("papelizAndroidReleaseKeystorePassword")
                keyAlias = readPapelizAndroidReleaseSigningProperty("papelizAndroidReleaseKeyAlias")
                keyPassword = readPapelizAndroidReleaseSigningProperty("papelizAndroidReleaseKeyPassword")
            }
        }
    }
    buildTypes {
        getByName("debug") {
            manifestPlaceholders["usesCleartextTraffic"] = "true"
            isDebuggable = true
            isJniDebuggable = true
            isMinifyEnabled = false
            packaging {
                jniLibs.keepDebugSymbols.add("*/arm64-v8a/*.so")
                jniLibs.keepDebugSymbols.add("*/armeabi-v7a/*.so")
                jniLibs.keepDebugSymbols.add("*/x86/*.so")
                jniLibs.keepDebugSymbols.add("*/x86_64/*.so")
            }
        }
        getByName("release") {
            if (papelizAndroidReleaseSigningProperties != null) {
                signingConfig = signingConfigs.getByName("papelizRelease")
            }
            optimization {
               enable = true
            }
            proguardFiles(
                *fileTree(".") {
                  include("**/*.pro")
                  exclude("build/**")
                }.files.toTypedArray()
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
    buildFeatures {
        buildConfig = true
    }
}

kotlin {
    compilerOptions {
        jvmTarget = JvmTarget.JVM_1_8
    }
}

rust {
    rootDirRel = "../../../"
}

dependencies {
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.lifecycle:lifecycle-process:2.10.0")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.4")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.0")
}

apply(from = file("tauri.build.gradle.kts"))
