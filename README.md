# Showmaster Starter

A clean React and Firebase foundation with public registration, email/password login, a protected dashboard, and a server-managed user profile.

## Local development

Copy `env.example` to `.env.local`, then run:

```bash
npm ci
npm --prefix functions ci
npm start
```

Useful checks:

```bash
CI=true npm test -- --watchAll=false
CI=true npm run build
npm --prefix functions test
npm --prefix functions run check
npm run test:rules # requires Java 21+
```

## Cloud Functions

- `health`: public HTTP health endpoint.
- `getMyProfile`: authenticated callable that creates and returns the caller's profile.

Each Function lives in its own folder under `functions/src/` and is exported by `functions/index.js`.

## Deployment

The repository targets only the Firebase dev project `showmaster1-f1a9f`.

- `deploy-hosting.yml` runs on every push to `dev` and deploys Hosting plus Firestore and Storage rules.
- `deploy-functions.yml` runs when backend files change on `dev` and deploys all Functions.
- Both workflows can be run manually for a full deployment.

Do not push or deploy without explicit confirmation from Rambod in the current conversation.
