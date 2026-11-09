# Subsidiaries and extensions

A subsidiary is a navigation entry. It can open a trusted bundled React panel
or display a descriptive card linking to an external service. It does not
create database tables or grant permissions in an external tool.

## Add an entry

Add an object to `src/extensions/manifest.json`:

```json
{
  "slug": "my-studio",
  "name": "My Studio",
  "description": "Our internal tools",
  "detail": "A short explanation of the work this subsidiary does.",
  "url": "https://example.com",
  "icon": "building"
}
```

Slugs must be unique lowercase letters/numbers separated by hyphens. Use HTTP(S)
links only. Icon names come from `SPACE_ICONS` in
`src/components/workspace/SpaceIcon.tsx`. No entry is special-cased in the core.

Run `npm test`, `npm run build`, then replace the frontend build on your host.
With Docker use `docker compose up --build -d web`. Removing an entry from the
manifest removes its navigation entry; it does not delete tasks or other data.

## Add a React panel

Create `src/extensions/MyStudio.tsx`:

```tsx
export default function MyStudio() {
  return <section className="panel-2 flex-1 rounded-2xl p-6">
    <h1>My Studio</h1>
    <p>Your own module goes here.</p>
  </section>;
}
```

Import it in `src/extensions/index.ts` and register its manifest slug:

```tsx
import MyStudio from "./MyStudio";
export const extensionPanels = { "my-studio": MyStudio };
```

The sidebar's existing edit action controls logo, color and visibility per slug.
The registry contains trusted application code: it is not a sandbox. Do not
bundle untrusted panels or put API secrets in frontend code. Custom backend
endpoints must enforce authentication, role checks, and object access themselves;
hiding a sidebar entry is not an authorization boundary for a custom API.
