

## Problem

The logo in all email templates points to the **old Lovable Cloud Supabase instance** (`agfsnvywlltiiigkatar.supabase.co`), which is no longer accessible after migration. This is why the logo doesn't appear and the email renders without it. The "Confirm" button is present in the template code, so it should be rendering — but if the entire custom email hook isn't being used (falling back to Supabase default emails), that would explain both missing logo and missing button.

## Solution

### 1. Upload the TitanMeet logo to current Supabase storage
- Copy the uploaded `TitanMeetLogo.png` to `public/images/TitanMeetLogo.png`
- Create an `email-assets` storage bucket in the current Supabase project (public bucket)
- Upload the logo using the Supabase storage upload tool
- Get the new public URL from the current Supabase project

### 2. Update LOGO_URL in all 12 template files (6 in `project/supabase/functions/` + 6 in `supabase/functions/`)
Replace the dead `agfsnvywlltiiigkatar.supabase.co` URL with the new storage URL from the current Supabase project in:
- `signup.tsx`
- `recovery.tsx`
- `magic-link.tsx`
- `invite.tsx`
- `email-change.tsx`
- `reauthentication.tsx`

### 3. Redeploy the `auth-email-hook` edge function
After updating templates, deploy to make changes live.

### Technical detail
The `LOGO_URL` constant on line ~22-25 in each template file will be changed from:
```
const LOGO_URL = 'https://agfsnvywlltiiigkatar.supabase.co/storage/v1/object/public/event-assets/logo.png'
```
to:
```
const LOGO_URL = 'https://<current-project-id>.supabase.co/storage/v1/object/public/email-assets/TitanMeetLogo.png'
```

