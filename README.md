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

Full-access admins can send email from the homepage once SMTP is configured for the school mailboxes.

Add these Render environment variables:

- `EMAIL_SMTP_HOST`
- `EMAIL_SMTP_PORT`
- `EMAIL_SMTP_SECURE`
- `HIS_EMAIL_WORKSPACE_NAME`
- `HIS_EMAIL_WORKSPACE_ADDRESS`
- `HIS_EMAIL_WORKSPACE_SMTP_USER`
- `HIS_EMAIL_WORKSPACE_SMTP_PASS`
- `HIS_EMAIL_DUTIES_NAME`
- `HIS_EMAIL_DUTIES_ADDRESS`
- `HIS_EMAIL_DUTIES_SMTP_USER`
- `HIS_EMAIL_DUTIES_SMTP_PASS`

Recommended values for Google Workspace:

- `EMAIL_SMTP_HOST=smtp.gmail.com`
- `EMAIL_SMTP_PORT=465`
- `EMAIL_SMTP_SECURE=true`

For each mailbox:

1. Enable the account for SMTP sending in Google Workspace.
2. Generate an app password if the account uses 2-step verification.
3. Put the mailbox address into the matching `*_ADDRESS` and `*_SMTP_USER` variables.
4. Put the app password into the matching `*_SMTP_PASS` variable.
5. Redeploy the app.

The two configured sender identities are:

- `HIS Staff Workspace` using `benjamin.allen@kl.his.edu.my`
- `HIS Staff Duties` using `duties@kl.his.edu.my`

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
5. Deploy.

## Data contract

- Filter source: `Class List`
- Student source: `student_class_roster` view
- Join key: `Term 3 Data.Form = Class List.Class Name`
