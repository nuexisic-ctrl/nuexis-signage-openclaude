## 2025-05-29 - [IDOR in Content Assignment]
**Vulnerability:** Authenticated users could assign any `asset_id` or `playlist_id` to their devices, even if the content belonged to another team, by guessing or obtaining UUIDs.
**Learning:** The server actions only validated that the `device` being updated belonged to the user's team, but implicitly trusted that the content IDs provided in the request were also authorized for that team.
**Prevention:** Always perform explicit ownership checks (e.g., `.eq('team_id', authenticatedTeamId)`) for every foreign ID passed in a request before committing mutations to the database.
