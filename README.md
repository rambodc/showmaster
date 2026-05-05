# Showmaster

Showmaster is an operations platform for festivals, concerts, and large live shows. It is built for internal teams that manage shows, staff, artists, modules, scheduling, inventory, and show-specific 3D planning assets.

## Project Shape

- Frontend: React app created with `react-scripts`, using Firebase Auth, Firestore, Storage, Functions, and App Check.
- Backend: Firebase Cloud Functions v2 in `functions/`, currently exported from `functions/index.js`.
- Firebase project: `showmaster1-f1a9f`.
- Active deployment branch: `dev`.
- Current deployment target: dev only. There is no production Firebase project wired to this repo.

## Main App Areas

- Auth and profile management for signed-in users.
- Show list and show workspace routes.
- Show member and module access management.
- Scheduling, inventory, artists, and AI 3D model modules.
- Firebase Storage uploads for user profile photos, show icons, and AI 3D assets.

## Firebase Deployments

GitHub Actions is the deployment source for the dev Firebase project.

- Every push to `dev` deploys Hosting, Firestore rules, and Storage rules.
- Cloud Functions deploy only when files under `functions/` change.
- Cloud Functions can also be forced from the manual GitHub workflow input `deploy_functions=true`.
- Pull requests run validation and deploy a Hosting preview only. Pull requests must not deploy shared Cloud Functions.

## Local Checks

Run these before asking to push:

```bash
npm --prefix functions ci
CI=true DISABLE_ESLINT_PLUGIN=true npm test -- --watchAll=false
CI=false DISABLE_ESLINT_PLUGIN=true npm run build
git ls-files 'functions/**/*.js' functions/index.js | xargs -n 1 node --check
firebase deploy --only firestore:rules,storage --project showmaster1-f1a9f --non-interactive --dry-run
```

## Deployment Safety Rule

Do not push to GitHub or trigger a Firebase deployment without explicit confirmation from Rambod in the current conversation.

This is especially important because pushing to `dev` starts the GitHub workflow and may deploy Hosting, rules, and Cloud Functions depending on the changed files. Prepare and verify local changes first, then ask for confirmation before any `git push`.

## Production

Production is intentionally not configured in this repo yet. Do not add production branches, Firebase aliases, service accounts, secrets, or workflows until Rambod explicitly asks for a production setup.
