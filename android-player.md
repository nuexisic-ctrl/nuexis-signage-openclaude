Build a native Android player for my NuExis platform.

The Android player must be created inside:

```text
/apps/android-player
```

The entire Android codebase should exist inside this folder.

The Android Studio project must sync successfully and generate APK builds without build errors, dependency issues, Gradle issues, runtime crashes, or compilation problems.

The Android player must NOT be a WebView, website wrapper, embedded browser, iframe, or anything based on:

```text
localhost:3000/player
```

Instead, build a proper standalone native Android application.

The Android player should match the web player's UI and functionality as closely as possible. The pairing screen, buttons, layouts, sidebar, interactions, and overall design language should feel consistent with the web player.

### Pairing

The pairing flow should work similarly to the web player, however:

* The Android player's pairing code should remain permanent.
* It should not regenerate every 15 minutes like the web player.
* The pairing code should stay the same after app restarts.
* The pairing code should stay the same after device restarts.
* The pairing code should stay the same after app updates.
* If possible, the pairing code should remain the same even after the application is reinstalled.
* Only regenerate a pairing code when absolutely necessary.

### CMS Integration

When a user pairs the Android player from the Screens page in the CMS, the Android player should behave like a normal screen inside the platform.

The Android player must maintain a realtime connection with the backend.

The Screens page must correctly show:

* Online status
* Last seen
* Last sync
* Pairing status
* Other screen-related information

I specifically want these values to remain accurate because in previous implementations these values were often incorrect or delayed.

### Realtime Updates

When a user performs actions from the CMS, the Android player should update in realtime without requiring manual refreshes.

Examples include:

* Pairing a screen
* Unpairing a screen
* Assigning content
* Updating content
* Pushing content
* Updating playlists
* Removing playlists
* Updating schedules
* Any other related screen actions

### Content Delivery

The Android player should receive content from the CMS exactly as the web player does.

A user should be able to upload content through the CMS and assign it to an Android player in the same way they assign content to the web player.

### Caching

The Android player should cache content locally so playback remains reliable.

The player should not unnecessarily re-download content that already exists locally.

### Sidebar & Controls

The Android player should include the sidebar functionality.

The sidebar should be accessible:

* By swiping from left to right.
* Through the hamburger menu.
* Through the existing interaction methods already present in the web player.

The Android player should also contain the two buttons in the top-right corner, similar to the web player.

### Reliability

The Android player should be professional, scalable, reliable, and production-ready.

Where requirements are not explicitly mentioned in this prompt, analyze the existing web player, CMS, database structure, and backend implementation and make reasonable implementation decisions based on how a professional digital signage platform would handle those scenarios.

Do not ask me to manually define every edge case. Instead, infer missing implementation details from the existing NuExis platform and keep behavior consistent with the web player whenever possible.

Before considering the task complete:

* Ensure the Android Studio project syncs successfully.
* Ensure the project builds successfully.
* Ensure APK generation succeeds.
* Ensure there are no unresolved TODOs.
* Ensure there are no mock implementations.
* Ensure the Android player is fully connected to the existing backend and CMS.
