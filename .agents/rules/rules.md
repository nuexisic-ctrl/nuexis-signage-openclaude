---
trigger: always_on
---

Architecture
Keep files under 600 lines.
Prefer creating new reusable components over adding complexity to existing components.
Do not duplicate logic. Extract shared functionality into hooks, utilities, services, or components.
Follow existing project architecture and naming conventions.
Before creating a new file, check whether similar functionality already exists.
Do not introduce new dependencies unless explicitly required.
Do not create multiple competing patterns for solving the same problem.
UI & Frontend
Always follow .agents/design.md.
Match existing design patterns before introducing new UI patterns.
Maintain consistency in spacing, typography, colors, animations, and component behavior.
New features must work correctly on desktop, tablet, and mobile.
Avoid unnecessary animations and visual effects.
Accessibility must not be degraded.
Database & Supabase
You have access to Supabase via MCP.
Never assume database schemas, relationships, or policies.
Always inspect the actual schema before implementing database-related functionality.
Reuse existing tables and relationships whenever possible.
Do not create redundant tables or columns.
Verify all migrations against existing data structures.
Never disable RLS policies.
Follow the principle of least privilege.
Security
Security is mandatory, not optional.
Assume all client-side input is untrusted.
Validate all inputs on the server.
Never expose service-role keys.
Never bypass authorization checks.
Never trust frontend permissions.
Verify ownership before reading, updating, or deleting data.
Review all changes for potential privilege escalation.
Do not introduce secrets into source code.
Performance
Avoid N+1 database queries.
Avoid unnecessary API requests.
Prefer pagination for large datasets.
Use efficient indexes when needed.
Prevent unnecessary React re-renders.
Optimize expensive computations.
Consider scalability for datasets exceeding 100,000 records.

Hallucination Prevention
Never assume how a feature works.
Read the relevant files before making changes.
Inspect all affected code paths before implementing changes.
If information is unavailable, investigate the codebase instead of guessing.
Do not invent database columns, tables, APIs, environment variables, routes, hooks, or components.
Verify every referenced file exists before using it.
Verify every API endpoint exists before calling it.
Verify every database field exists before querying it.

Change Management

Before making changes:

Understand the existing implementation.
Identify all affected files.
Identify potential side effects.
Implement the smallest correct solution.
Verify the solution does not break existing functionality.
Final Output Requirements

Every completed task must include:

Summary of changes made.
Files modified.
Security concerns identified (if any).
Performance concerns identified (if any).
Validation steps performed.
Remaining risks or technical debt.