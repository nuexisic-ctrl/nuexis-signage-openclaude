# Proguard rules for NuExis Player

# Keep attributes for serialization & reflections
-keepattributes Signature, *Annotation*, InnerClasses, EnclosingMethod

# Keep Gson serialization models and inner classes inside SupabaseClient
-keep class com.nuexis.player.data.SupabaseClient$* { *; }
-keep class com.nuexis.player.data.SupabaseClient { *; }

# Keep all packages containing serialization models or reflective methods
-keep class com.nuexis.player.data.** { *; }
-keep class com.nuexis.player.realtime.** { *; }
-keep class com.nuexis.player.playback.** { *; }
-keep class com.nuexis.player.diagnostics.** { *; }
-keep class com.nuexis.player.receivers.** { *; }
