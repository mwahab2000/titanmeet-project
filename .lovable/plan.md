

## Customize Signup Confirmation Email

Three changes needed:

### 1. Change sender address
In `project/supabase/functions/auth-email-hook/index.ts`, line ~203, change `from` field:
```
from: `${SITE_NAME} <events@${FROM_DOMAIN}>`
```
(Currently `noreply@titanmeet.com` → becomes `events@titanmeet.com`)

### 2. Logo already present in templates
The signup template (`signup.tsx`) already includes the TitanMeet logo via `LOGO_URL` pointing to the Supabase storage bucket. The "Get Started" button also exists. No changes needed here — the logo and button are already in the email.

### 3. Rename button text to "Confirm"
In `project/supabase/functions/_shared/email-templates/signup.tsx`, change the button text from "Get Started" to "Confirm" to make it clearer this is a confirmation action.

### Deployment
Redeploy `auth-email-hook` edge function after changes.

