## 2025-05-22 - Insecure Direct Object Reference (IDOR) in Dashboard Actions
**Vulnerability:** Dashboard server actions were trusting a `teamSlug` parameter from the URL to fetch data, without verifying that the authenticated user actually belonged to that team.
**Learning:** In multi-tenant applications using Next.js and Supabase, URL parameters (like slugs or IDs) must always be cross-referenced against secure server-side metadata (like `app_metadata` in the JWT) to prevent users from accessing or modifying data belonging to other tenants.
**Prevention:** Always retrieve the `team_id` or equivalent tenant identifier from the authenticated user's session (`auth.getUser()`) and use it as a mandatory filter in all database queries within server actions.
