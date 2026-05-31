## 2025-05-14 - IDOR in Content Assignment
**Vulnerability:** Insecure Direct Object Reference (IDOR) in server actions that assign content (assets or playlists) to devices. The actions verified device ownership but did not verify that the referenced content (asset_id/playlist_id) actually belonged to the same team.
**Learning:** Checking ownership of the primary object (the device) is insufficient if the action also involves referencing other objects (assets/playlists). An attacker could bypass UI restrictions to assign any asset from any tenant to their own devices if they knew the target UUID.
**Prevention:** Always validate all user-supplied IDs against the authenticated user's scope (e.g., team_id) before performing updates or insertions.
