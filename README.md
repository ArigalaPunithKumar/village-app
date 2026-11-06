# Palle Nestham (పల్లె నేస్తం)

Palle Nestham is a mobile and web portal for Thandlam residents to report village issues, follow progress, and contact verified local officials. The app uses React, TypeScript, Capacitor, and Supabase.

## Roles and permissions

- **Citizen:** create a report, view public report summaries and timelines, support a report once, and view their own contact details on their reports.
- **Official:** review public report details and publish status updates. Officials do not have access to residents' private contact details or evidence photos.
- **Administrator:** view private report details and evidence, manage user roles and account details, create or remove users, and add, edit, or remove village directory entries. Database policies and a protected Edge Function enforce these permissions.

The first administrator must be assigned by the Supabase project owner after they create an account and verify their mobile number with OTP. Find the Auth user ID by the verified phone number, then set that profile to `admin` in the Supabase SQL Editor:

```sql
SELECT id, phone FROM auth.users WHERE phone = '+91XXXXXXXXXX';

UPDATE public.profiles
SET role = 'admin'
WHERE id = 'AUTH-USER-UUID-FROM-THE-SELECT';
```

The admin signs in with that same mobile number and a fresh SMS OTP. There is no static admin password. Never use a browser-side role switch to grant access.

Admin login reference:

- **Login ID:** the admin's verified mobile number, entered in the app as a 10-digit Indian number.
- **Password:** none; the app uses passwordless OTP.
- **OTP:** delivered to that mobile number each time they sign in. It is temporary and is not stored in GitHub.
- **Account ID:** Supabase Auth's generated UUID. It is useful for database administration but is not entered on the login screen.

## Where data is stored

All persistent application data is in the Supabase project configured by `VITE_SUPABASE_URL` in `.env`.

| Data | Supabase location | Access |
| --- | --- | --- |
| Verified mobile sign-in identity | Supabase Auth `auth.users` | OTP sign-in through Supabase Auth; no app password is used |
| User name, age, gender, phone, role, and account creation time | Postgres `public.profiles` | Users can read/edit their own profile; admins can read and manage profiles |
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

2. Apply the SQL migrations in `supabase/migrations` to the configured Supabase project, in timestamp order. They upgrade the existing application schema created by the project's original database setup; they are not a standalone baseline schema for a brand-new empty project. Confirm the base `profiles`, `complaints`, `status_updates`, and `officials` tables exist first. The migrations create the redacted public view, private image bucket, role checks, admin request workflow, protected report updates, and resident age/gender fields.

3. Deploy the protected account-management function:

   ```bash
   supabase functions deploy admin-manage-user
   ```

   Supabase injects its project URL and service-role key into Edge Functions. Never copy the service-role key into the web or Android client.

4. Configure Supabase Auth providers:

   - Enable phone sign-in and configure an SMS provider and message template. This app sends OTPs to Indian `+91` numbers; SMS cannot be delivered until the provider and any required regional sender/template approvals are complete.

5. Assign the initial administrator with the SQL above. Then add verified officials and contact details in **Administrator workspace → Officials**.

6. Start the app or build Android assets:

   ```bash
   npm run dev
   npm run cap:build
   ```

Sign-up asks for a name, age, gender, and mobile number. Login asks only for the mobile number. Both flows verify the number by SMS OTP; admin accounts use the same login screen.

## Current production risks to resolve

- **SMS setup is external:** this repository cannot verify that phone sign-in, the SMS provider/template, or Edge Function deployment is configured in the live Supabase project.
- **Official contacts must be verified:** the earlier seed used placeholder names, numbers, and a different village name. Replace those with confirmed Thandlam contacts before publishing the directory.
- **Complaint moderation and anti-spam:** residents can create authenticated reports and public visitors can read the public report view. Add abuse controls, CAPTCHA or rate limits, and a moderation workflow before opening registration broadly.
- **Existing email-only accounts:** phone-only login requires a verified phone identity in Supabase Auth. Do not automatically trust old profile phone values; those residents need a verified account migration or must sign up with OTP again.
- **Legacy reports:** complaints created before `reporter_user_id` was added remain visible in the redacted public view, but their owner cannot be identified for self-service access or account-deletion cleanup. Admins should review old contact data and evidence.
- **Administrator actions need audit history:** account or directory changes are permission-checked, but a durable audit log of every admin edit/removal should be added before use by a larger organization.

## Android build artifact

The GitHub Actions workflow builds an APK. Download the latest `Palle-Nestham-debug-apk` artifact from the repository's **Actions** tab.
