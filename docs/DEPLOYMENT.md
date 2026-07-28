# Deployment

## Supabase

1. Create a Supabase project.
2. Open the SQL editor.
3. Run the SQL from `docs/SUPABASE_SCHEMA.sql`.
4. Copy:
   - Project URL
   - Anon key

## Vercel

1. Create a new Vercel project from the `remote-control-supabase` folder.
2. Deploy with no build command.
3. In Vercel project settings, add environment variables:
   - `ONESIGNAL_APP_ID`
   - `ONESIGNAL_API_KEY`
4. Redeploy after adding the variables.
5. Open the deployed URL.
6. Enter the Supabase URL, anon key, and your session ID.

## OneSignal

1. Create a OneSignal app for iOS.
2. Add your Apple push credentials in OneSignal.
3. Copy the OneSignal App ID into:
   - `MobTIPrototypeApp/OneSignalConfig.swift`
4. Add the OneSignal iOS SDK package in Xcode:
   - package URL: `https://github.com/OneSignal/OneSignal-iOS-SDK`
5. Build the iPhone app and allow notifications.
6. Use the same session ID in the app hidden menu. The app logs in to OneSignal with that session ID as its external ID.

After this, pressing `Trigger Arrival Cue` on the website will:
- enqueue the in-app arrival cue for the phone when the app is active
- send a real lock-screen push notification through OneSignal when the phone is locked

## iPhone app

In the app hidden menu, choose the Supabase backend and enter:

- Supabase URL
- Supabase anon key
- Session ID
