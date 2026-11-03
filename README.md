# 🌾 Palle Nestham (పల్లె నేస్తం)
### మన ఊరు, మన బాధ్యత · తండ్లం పంచాయతీ, తిరుపతి జిల్లా

[![Build Android APK](https://github.com/ArigalaPunithKumar/village-app/actions/workflows/build-apk.yml/badge.svg)](https://github.com/ArigalaPunithKumar/village-app/actions/workflows/build-apk.yml)

A modern, mobile-first Gram Panchayat citizen grievance redressal and public services system. Built with React, TypeScript, Tailwind CSS, Supabase, and Capacitor Android.

---

## 📱 Features

- **📱 Real SMS / WhatsApp OTP Sign-In**: Instant phone login with verification code delivery via SMS or WhatsApp.
- **📍 Auto GPS Location Detection**: Pinpoints problem location automatically with reverse-geocoded village street & landmark information.
- **📸 Direct Photo Capture & Upload**: Citizens capture live camera proof or upload photos directly from their device.
- **👮 Distinct Official & Admin Console**:
  - Village authorities can inspect complaints, change statuses (*Under Review*, *In Progress*, *Resolved*), and add official remarks.
  - One-click **Call Citizen** link to follow up directly with the resident.
  - Role governance: Admin registrations require approval by active administrators.
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
