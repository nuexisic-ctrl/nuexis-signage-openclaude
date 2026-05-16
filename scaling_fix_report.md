# Advanced Scaling Optimization Report

Following a deep dive into the Supabase database and authentication logs, several major scaling bottlenecks and background noise issues were identified and successfully resolved. These issues were causing redundant API calls, continuous database polling, and unnecessary error generation.

## 1. Auth API Overload (Next.js Middleware)

### The Issue
The player app (`/player`) uses a `device_secret` rather than a standard user session. However, the root `middleware.ts` was executing `supabase.auth.getUser()` on **every single request**, including server actions triggered by the player (like the 60-second playtime increments).

This meant that thousands of connected screens were constantly pinging the `/auth/v1/user` endpoint unnecessarily, flooding the Supabase Auth service with requests that always failed or returned null.

### The Fix
I added an explicit bypass in `middleware.ts` for any requests starting with `/player`. This completely skips the session check for player-originated requests, instantly slashing the Auth API load.

```typescript
if (pathname.startsWith('/player')) {
  return NextResponse.next() // Skips supabase.auth.getUser()
}
```

## 2. Broken Postgres Cron Job

### The Issue
Analysis of the `postgres` logs revealed that a `pg_cron` job named `update-device-statuses` was scheduled to run every single minute (`* * * * *`). It attempted to execute `SELECT update_device_statuses()`, but this function did not exist in the database. This caused Postgres to log a severity `ERROR` every 60 seconds, wasting database compute and bloating logs.

### The Fix
Using Supabase SQL execution, I unscheduled the broken cron job to stop the error looping.

```sql
SELECT cron.unschedule('update-device-statuses');
```

## 3. Inactive Tab DB Polling in Dashboard

### The Issue
The `ScreensClient.tsx` (Dashboard view) utilized a `setInterval` function running every 120 seconds to do a fallback polling check on the `devices` table. If an enterprise user left multiple dashboard tabs open in the background, these tabs would continuously poll the database forever, compounding the database load unnecessarily.

### The Fix
I completely removed the 120-second `setInterval` loop from `ScreensClient.tsx`. Instead, I replaced it with a `visibilitychange` event listener. 

Now, the dashboard only performs a fallback fetch when the user explicitly brings the tab back into focus. When the tab is hidden, it relies safely on the low-overhead WebSocket subscription without generating any HTTP polling load.

```typescript
// Replaced setInterval with:
const handleVisibilityChange = async () => {
  if (document.visibilityState === 'visible') {
    // Fetch data only when tab becomes active
  }
}
document.addEventListener('visibilitychange', handleVisibilityChange)
```

## Summary
With these changes implemented, the infrastructure is now significantly hardened against "zombie" load:
* Unpaired screens no longer aggressively poll the database.
* The Next.js middleware no longer spams the Supabase Auth API for device connections.
* The database is free from missing-function cron errors.
* Inactive dashboard tabs no longer generate continuous background queries.