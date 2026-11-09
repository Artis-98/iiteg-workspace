# Security and operational limits

Version 0.1.0 is an initial self-hosted release. It is not a claim of an external
security audit. Report a vulnerability privately through the repository's
Security advisory reporting if enabled; do not put live credentials or private
records in public issues.

- Use HTTPS, unique generated secrets, a dedicated database, and patched images.
  The default Docker web port is bound to loopback and the database has no host port.
- Login is rate limited by account/IP bucket. Configure further edge limits for
  an Internet-facing installation. No MFA, SSO or email password recovery ships.
- Bearer tokens are held in localStorage, expire after 12 hours, and are invalidated
  on password change/account deletion. Protect the site against injected scripts;
  extensions are trusted application code with the same privileges as the core.
- Roles and private-space/channel checks are enforced server-side. New custom
  endpoints must enforce their own equivalent authorization.
- Attachments are stored outside the web root and served with unguessable signed
  capability links. **Anyone with a file's complete URL can retrieve that file.**
  This supports browser image embeds but is not per-viewer file authorization.
  Changing APP_KEY invalidates all file links and sessions. Do not upload sensitive
  material requiring per-viewer revocation in this release. File types are MIME
  checked; HTML, SVG, executables and PHP are rejected. Uploads are limited to 10 MB.
- GIF search is opt-in and uses an operator-provided public GIPHY key. External
  image URLs in messages may cause a browser to contact that image's host.
- Docker/Apache deny HTTP access to install scripts, helpers, configuration, and
  stored uploads. The PHP development server is loopback-only and is not production.
- Back up the database, upload volume, and private environment. No data is sent to
  IITEG, and no live company hostname, account, credential or dataset is bundled.
