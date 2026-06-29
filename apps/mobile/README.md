# Ensemble Mobile

Expo SDK 54 · React Native · Expo Router. The native client for [Ensemble](https://ensemblelanguage.com/), sharing one tRPC backend with the web app. See the [root README](../../README.md) for the full architecture overview.

## Local development

Point Expo at the LAN IP of your dev machine and scan the QR code with Expo Go:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.42:3000 \
  npm --workspace=@ensemble/mobile run start
```

The mobile app shares the same backend at `EXPO_PUBLIC_API_URL`, so authenticating once on the phone hits the same Postgres rows that the web client writes to.

## Shipping a new iOS release

The mobile app is built and submitted through [EAS](https://docs.expo.dev/eas/) (Expo Application Services). The whole flow is two npm scripts, but here is the full sequence end to end.

**1. Bump the version.** Open `app.json` and raise the marketing `version` (e.g. `1.0.0` → `1.0.1`). You do **not** touch the iOS build number — the `production` profile in `eas.json` has `autoIncrement: true`, so EAS bumps the build number for you on every build. Commit the version bump:

```bash
git add apps/mobile/app.json
git commit -m "Release iOS 1.0.1"
```

**2. Build the production binary in the cloud.** From the repo root:

```bash
npm run mobile:build
# → eas build --platform ios --profile production
```

EAS provisions credentials, compiles the app against `EXPO_PUBLIC_API_URL=https://ensemblelanguage.com`, and produces a signed `.ipa`. The first run will offer to manage signing credentials for you — let it. Builds take a few minutes; you can watch progress in the terminal or on the EAS dashboard.

**3. Submit the build to App Store Connect.** Once the build finishes:

```bash
npm run mobile:submit
# → eas submit --platform ios --profile production
```

This uploads the finished `.ipa` straight to App Store Connect using the `submit.production.ios` config in `eas.json`. (You can also chain build + submit in one shot with `eas build --auto-submit`.)

**4. Release in App Store Connect.** The uploaded build needs a few minutes to finish processing, then:

- Open [App Store Connect](https://appstoreconnect.apple.com/) → **Ensemble Language** → **+ Version** and enter the new version number.
- Attach the processed build under **Build**.
- Fill in **What's New in This Version**, plus any screenshot or metadata changes.
- Click **Add for Review** → **Submit for Review**.

Apple review typically takes a day or so. If you set the release to "Automatically release," it goes live as soon as it's approved; otherwise you press **Release** yourself.

> **TestFlight first (optional).** Builds submitted via `eas submit` show up in TestFlight automatically. To smoke-test before a public release, add yourself as an internal tester and install from the TestFlight app before doing the App Store Connect release.
