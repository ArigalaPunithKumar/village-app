# 🌾 Palle Nestham (పల్లె నేస్తం)
### మన ఊరు, మన బాధ్యత · తండ్లం పంచాయతీ, తిరుపతి జిల్లా

[![Build Android APK](https://github.com/ArigalaPunithKumar/village-app/actions/workflows/build-apk.yml/badge.svg)](https://github.com/ArigalaPunithKumar/village-app/actions/workflows/build-apk.yml)

A modern, mobile-first Gram Panchayat citizen grievance redressal and public services system. Built with React, TypeScript, Tailwind CSS, Supabase, and Capacitor Android.

---

## 📱 Features

- **📱 Real SMS / WhatsApp OTP Sign-In**: Instant phone login with verification code delivery via SMS or WhatsApp.
- **📍 Auto GPS Location Detection**: Pinpoints problem location automatically with reverse-geocoded village street & landmark information.
- **📸 Direct Photo Capture & Upload**: Citizens capture live camera proof or upload photos directly from their device.
- **👮 Distinct Citizen, Sarpanch & Admin access**:
  - Citizens manage only their own complaints, view village notices, vote in polls, and send suggestions.
  - Sarpanch accounts review every complaint, publish announcements, create polls/events, and view village analytics.
  - Admin accounts invite users, assign roles, manage account access, and review audit history.
  - One-click **Call Citizen** link to follow up directly with the resident.
  - Roles are read from protected database profiles; signup and browser storage cannot grant elevated roles.
- **👤 Resident Profile**: View and update full name, mandatory mobile number, view submitted grievance count, and change security password anytime.
- **📊 Real-time Community Transparency**: Public dashboard displaying overall resolution rate, category breakdowns (Roads, Water, Electricity, Sanitation), and live village announcement tickers.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide Icons, Vite
- **Backend & Database**: Supabase (PostgreSQL, Row Level Security, Realtime, Auth)
- **Mobile Native**: Capacitor 8 (Android Native Container & APK)
- **CI/CD**: GitHub Actions for automated Android `.apk` builds

---

## 📦 Download the Android APK

This repository uses automated GitHub Actions:
1. Go to the [**Actions** tab](https://github.com/ArigalaPunithKumar/village-app/actions).
2. Click on the latest workflow run under **Build Android APK**.
3. Under **Artifacts**, download `Palle-Nestham-debug-apk`.

---

## 💻 Local Development

```bash
# 1. Install dependencies
npm install

# 2. Run local development server
npm run dev

# 3. Build web assets & sync to Android
npm run cap:build

# 4. Open Android project in Android Studio (optional)
npm run cap:open
```

## Supabase security setup

Apply the migrations before deploying the updated client. This migration locks complaint records to their citizen owner, protects staff actions with row-level policies, and creates the village communication tables and notification triggers.

```bash
supabase db push
supabase functions deploy admin-user-management
```

New signups are always Citizens. To let a new Citizen use the app immediately with the same email and password, turn off **Confirm email** for the Email provider in Supabase Dashboard → Authentication → Sign In / Providers. With confirmation enabled, Supabase intentionally returns no session until the address is verified, so the app cannot sign the new account in automatically.

Turning off confirmation also means Supabase treats any supplied email as verified. Use this only if that tradeoff is acceptable for your village. To bootstrap the first Admin, register the intended email as a Citizen, then run this once in the Supabase SQL editor:

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'admin@example.com';
```

After that, Admins can invite Citizen, Sarpanch, and Admin accounts from Account Management. Invitations and password-reset links use Supabase Auth email delivery, so configure the project's email provider and allowed redirect URLs first.

### Android password recovery links

The Android app handles reset links with the `com.pallenestam.app://auth/reset-password` deep link. In Supabase Dashboard → Authentication → URL Configuration, set **Site URL** to that URI and add the same URI under **Redirect URLs**. Keep the local development URLs in `supabase/config.toml` only if you also use the Supabase CLI locally. Install the updated APK before requesting another reset link; links already sent with a `localhost` destination will continue to fail.
