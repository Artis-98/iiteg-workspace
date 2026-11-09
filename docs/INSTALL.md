# Installation and deployment

## Docker (recommended)

Follow the README. Named volumes hold MariaDB data and uploads. Back up both
volumes and `.env`. Restoring an upload volume requires the same APP_KEY to keep
existing signed file links valid. Never use `docker compose down -v` unless you
intend to permanently erase the installation.

The default web port binds only to loopback. To publish, put an HTTPS reverse
proxy in front of port 8080 and set `PUBLIC_API_URL=https://your-host.example/api`.
Do not publish database ports. Use a current patched PHP image, rebuild regularly,
and run behind HTTPS outside local development.

## Manual PHP/Apache hosting

1. Create a new empty MariaDB/MySQL database and a database-specific user.
   The installer and schema helpers need CREATE and ALTER as well as normal
   application CRUD privileges. Do not point installation at an unrelated database.
2. Place the repository outside the web root. Run `npm run setup`, edit `.env`,
   set DB_HOST/DB_NAME/DB_USER/DB_PASSWORD, and set PUBLIC_API_URL to the API URL.
3. Run `php backend/bin/setup.php`. Optionally run it again with `--demo`.
4. Build with `npm ci && npm run build`. Upload the **contents** of `dist/client/`,
   including `.htaccess`, to the frontend web root.
5. Serve `backend/` as the API root and provide configuration via environment
   variables. Preserve the bundled `.htaccess` files. Deny HTTP access to `bin/`,
   `lib/`, `storage/`, `schema.sql` and `config.php`.
6. The frontend defaults to `/api`. Proxy that path to PHP (see `deploy/nginx.conf`),
   or create a build-only `.env.local` with `VITE_API_URL=https://your-api.example`.
   A separate origin also requires FRONTEND_ORIGIN=https://your-frontend.example
   on the API. Public VITE_ values are not a place for credentials.
7. Set UPLOAD_DIR to a writable directory outside the web root (10 MB upload limit).
   Ensure PHP's post_max_size is at least 12M and upload_max_filesize is at least 10M.
8. Verify sign-in, spaces, docs, attachments and a direct refresh of `/home`.

For `php -S 127.0.0.1:8081 -t backend` in development, keep it loopback-only:
PHP's development server does not enforce Apache `.htaccess` rules.

## Update

Back up first. Replace frontend build contents and API source together, keeping
your environment and upload storage. Run `php backend/bin/setup.php` to ensure
schema changes exist, then verify. Hashed frontend assets can be cached;
index.html must revalidate. Keep old hashed assets until existing tabs are refreshed.

## Release ZIP

The GitHub release ZIP includes source, PHP API and prebuilt `dist/client/`, with
no `.env`, node_modules, proprietary fonts, database dumps or real user records.
Verify its hash against SHA256SUMS. Docker still needs an operator-generated `.env`.
