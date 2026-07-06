# Student Filter Portal

Private staff-facing Next.js app for browsing students by school, designation, year group, milepost, level, and class.

## What it does

- Requires staff authentication through Supabase Auth
- Reads live data from Supabase
- Uses cascading filters from the `Class List` table
- Shows matching students from `Term 3 Data`
- Lets full-access admins send email from configured Google Workspace mailboxes
- Deploys cleanly to Render

## Supabase setup

1. Run the SQL in `supabase_staff_portal.sql`.
2. Run `supabase_student_roster_academic_years.sql` to enable archived academic years, class-by-class roster imports, and the live academic-year switcher in Setup.
3. In Supabase Auth, enable Email OTP / magic links for staff sign-in.
4. Create staff users in Supabase Auth.
5. Set the site URL and redirect URL:
   - local: `http://localhost:3000/auth/callback`
   - production: `https://your-render-domain.onrender.com/auth/callback`

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000/login`.

If every route suddenly returns `500`, check that these env vars are still present in the runtime:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Google Workspace email setup

Full-access admins can send email from the homepage once Google OAuth is configured for the sender mailbox.

Add these Render environment variables:

- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REFRESH_TOKEN`
- `GOOGLE_OAUTH_SENDER_EMAIL`
- `GOOGLE_OAUTH_SENDER_NAME`

Recommended sender values:

- `GOOGLE_OAUTH_SENDER_EMAIL=admin@teachingmrallen.com`
- `GOOGLE_OAUTH_SENDER_NAME=HELP International School`

The sender mailbox must have a valid Gmail API refresh token with `gmail.send` access.

## Desktop notifications

The app can send browser desktop notifications to subscribed staff users.

Run this SQL first:

- `supabase_web_push_subscriptions.sql`

Add these Render environment variables:

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

Each staff user must open the workspace and click `Enable Notifications` once in their browser before they can receive desktop alerts.

## Render deployment

1. Push this folder to GitHub.
2. Create a new Render Web Service from that repo.
3. Set the root directory to `student-filter-portal` if Render does not pick it up from `render.yaml`.
4. Add these environment variables:
   - `NEXT_PUBLIC_SITE_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - the Google Workspace email variables listed above if you want in-app email sending
   - the VAPID variables listed above if you want desktop notifications
5. Deploy.

## Data contract

- Filter source: `Class List`
- Student source: `student_class_roster` view
- Join key: `Term 3 Data.Form = Class List.Class Name`
