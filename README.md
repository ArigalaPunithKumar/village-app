# Palle Nestham (పల్లె నేస్తం)

Palle Nestham is a mobile and web portal for Thandlam residents to report village issues, follow progress, and contact verified local officials. The app uses React, TypeScript, Capacitor, and Supabase.

## Roles and permissions

- **Citizen:** create a report, view public report summaries and timelines, support a report once, and view their own contact details on their reports.
- **Official:** review public report details and publish status updates. Officials do not have access to residents' private contact details or evidence photos.
- **Administrator:** view private report details and evidence, manage user roles and account details, invite or remove users, and add, edit, or remove village directory entries. Database policies and a protected Edge Function enforce these permissions.

The first administrator must be assigned by the Supabase project owner after the account has been created. In the Supabase SQL Editor, run this for the first administrator's verified account:

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'admin@example.com';
```

Replace the example email with the account email. Do not use a browser-side role switch to grant access.

## Where data is stored

All persistent application data is in the Supabase project configured by `VITE_SUPABASE_URL` in `.env`.

| Data | Supabase location | Access |
| --- | --- | --- |
| Sign-in identity, verified email/phone, password hash, and OAuth identities | Supabase Auth `auth.users` | Supabase Auth APIs; passwords are not stored in the app database |
| User name, email copy, phone, role, and account creation time | Postgres `public.profiles` | User can read/edit their own name and phone; admins can read all profiles and manage role/details |
| Grievance descriptions, status, reporter contact, and owner ID | Postgres `public.complaints` | Public fields are served through `public.complaints_public`; the base table is limited to the report owner and admins |
| Status timeline and official remarks | Postgres `public.status_updates` | Publicly readable; new updates are created through a staff-checked database function |
| One-support-per-user records | Postgres `public.complaint_upvotes` | Private to the signed-in user; the public count is on the report |
| Administrator access requests | Postgres `public.admin_access_requests` | Requester and administrators |
| Village directory | Postgres `public.officials` | Publicly readable; only admins can add, edit, or remove entries |
| Report evidence photos | Private Supabase Storage bucket `complaint-evidence` | Only the report owner and admins can read an image; new uploads are compressed JPEGs |

The browser stores the Supabase authentication session so a resident remains signed in. The app no longer stores roles, profiles, or admin approval queues in `localStorage`. Existing legacy browser caches are removed the next time the profile loads. The frontend uses only the Supabase publishable/anon key; keep any service-role or secret key out of `.env` and the Android app.

## Set up and deploy

1. Install packages and configure the local environment:

   ```bash
   npm install
   ```

   Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to a local `.env` file. `.env` is ignored by Git.

2. Apply the SQL migration in `supabase/migrations` to the configured Supabase project. It upgrades the existing application schema created by the project's original database setup; it is not a standalone baseline schema for a brand-new empty project. Confirm the base `profiles`, `complaints`, `status_updates`, and `officials` tables exist first. The migration creates the redacted public view, private image bucket, role checks, admin request workflow, and protected report updates.

3. Deploy the protected account-management function:

   ```bash
   supabase functions deploy admin-manage-user
   ```

   Supabase injects its project URL and service-role key into Edge Functions. Set `APP_SITE_URL` there if invite links should return to a specific production site. Never copy the service-role key into the web or Android client.

4. Configure Supabase Auth providers:

   - Enable Google in **Authentication → Sign In / Providers** and add the Supabase Auth callback URL shown in that provider's settings to the Google OAuth client. Add the production web origin, development origin, and `com.pallenestam.app://auth/callback` to Supabase's allowed redirect URLs.
   - Configure a production SMTP sender and an email template that includes the six-digit `{{ .Token }}` value for email OTP sign-in and password recovery.
   - Configure an SMS provider and message template before enabling SMS OTP. The SMS option sends to Indian `+91` numbers; it cannot deliver messages until the provider is configured.

   Supabase must allow every `redirectTo` URL the app uses. See the [Supabase redirect URL guide](https://supabase.com/docs/guides/auth/redirect-urls) and [native mobile deep-linking guide](https://supabase.com/docs/guides/auth/native-mobile-deep-linking).

5. Assign the initial administrator with the SQL above. Then add verified officials and contact details in **Administrator workspace → Officials**.

6. Start the app or build Android assets:

   ```bash
   npm run dev
   npm run cap:build
   ```

Google sign-in uses the Supabase OAuth provider. Web sign-in returns to the current site; Android sign-in opens a system browser and returns through the registered app link. Provider credentials and redirect allowlists must be set in Supabase and Google before either flow can complete.

## Current production risks to resolve

- **Provider setup is external:** this repository cannot verify that Google OAuth, production SMTP, SMS delivery, allowed redirect URLs, and Edge Function deployment are configured in the live Supabase project.
- **Official contacts must be verified:** the earlier seed used placeholder names, numbers, and a different village name. Replace those with confirmed Thandlam contacts before publishing the directory.
- **Complaint moderation and anti-spam:** residents can create authenticated reports and public visitors can read the public report view. Add abuse controls, CAPTCHA or rate limits, and a moderation workflow before opening registration broadly.
- **Legacy records:** complaints created before `reporter_user_id` was added remain visible in the redacted public view, but their owner cannot be identified for self-service access or account-deletion cleanup. Admins should review old contact data and evidence.
- **Administrator actions need audit history:** account or directory changes are permission-checked, but a durable audit log of every admin edit/removal should be added before use by a larger organization.

## Android build artifact

The GitHub Actions workflow builds an APK. Download the latest `Palle-Nestham-debug-apk` artifact from the repository's **Actions** tab.
