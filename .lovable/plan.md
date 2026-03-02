

## Migration Plan: Set Up New Project with External Supabase

### Step 1 — Create the New Lovable Project

1. Go to **Settings → Connectors** and confirm Lovable Cloud is toggled **off** for new projects
2. Create a **new blank project** in Lovable (e.g. "TitanMeet v2")
3. Once created, go to the new project's **Settings → Connectors → Supabase** and connect your external Supabase project using your project URL and anon key

### Step 2 — Set Up External Supabase

In your external Supabase dashboard:
1. Open **SQL Editor** and paste the contents of `tmp/full-schema-export.sql` — run it to create all 25 tables, enums, functions, triggers, and RLS policies
2. Go to **Authentication → Providers** and enable **Web3** (Ethereum/Solana) plus any other providers you need (Email, Google)
3. Deploy the edge functions from the cloned GitHub repo using the Supabase CLI (`supabase functions deploy`)
4. Set all required secrets: `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `RESEND_API_KEY`
5. Create storage buckets: `event-assets` (public) and `dress-code-images` (public)

### Step 3 — Migrate Frontend Code

Once the new project exists, come back here and tell me the project name. I will use the **cross-project copy tools** to transfer all frontend files:

- All components (`src/components/`)
- All pages (`src/pages/`)
- All contexts, hooks, and lib files
- All styles and assets
- Configuration files (`tailwind.config.ts`, `index.html`, etc.)
- Edge function code (`supabase/functions/`)

I can do this automatically — no manual copy-paste needed.

### Step 4 — Adapt Auth for Web3

After migration, I will update the `AuthContext` to replace the Lovable Cloud OAuth flow with Supabase's native `signInWithWeb3` provider for wallet-based login.

---

**Next action:** Create the new project with Cloud disabled, connect your external Supabase, then come back and share the project name so I can start copying files.

