# NuExis Native Android Player

This module is a native Android digital signage player. It does not load the Next.js `/player` route as its runtime.

## Required Gradle Properties

Set these in `apps/android-player/local.properties`, user-level Gradle properties, or CI:

```properties
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_or_anon_key
PLAYER_API_BASE_URL=https://your-dashboard-domain.com
```

Do not put `SUPABASE_SERVICE_ROLE_KEY` or storage secrets in Android Gradle properties. Media signing is handled by the dashboard API at `/api/player/media-url`.

## Runtime Shape

- First launch registers a device and displays a native pairing code.
- Paired devices exchange their stored device secret for a rotatable session token.
- Playback uses Media3 for videos, native `ImageView` rendering for images, and a sandboxed per-item `WebView` only for YouTube/remote URL content fallback.
- WorkManager and a foreground service keep health reporting and recovery alive across restarts.
- Cached media is stored in app-private storage and reused for offline playback.
