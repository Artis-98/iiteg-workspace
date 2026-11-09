# Contributing

Use Node.js 22.12+, PHP 8.4+ and MariaDB 11.4+ (or Docker Compose).
Start from a dedicated local database; never use production data for tests.

1. Install dependencies with `npm ci`.
2. Create private configuration with `npm run setup` and edit the account/DB values.
3. Initialize an empty local database using `php backend/bin/setup.php --demo`.
4. Run PHP locally on port 8081 and `npm run dev` on port 8080.
5. Run `npm run build`, `npm run typecheck`, `npm test`, and PHP syntax checks.
   Set API_BASE, ADMIN_EMAIL and ADMIN_PASSWORD to run the API integration suite.

Tests mutate the configured API: use only a disposable installation. CI creates
its own database and fictional records. Never point API_BASE at a live workspace.

Keep private hosts, environment files, user records, commercial font binaries,
and business-specific integrations out of contributions. New subsidiaries belong
in the extension registry; use backend authorization for any new endpoint.
