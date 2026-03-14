

## Plan: Add Quick Setup shortcut to Dashboard

**Single file change:** `src/pages/Dashboard.tsx`

Add a prominent Quick Setup card between the usage warnings and the stat cards grid. It will be a visually distinct CTA card with a Zap icon, a brief description, and a Link button to `/dashboard/events/quick-setup`.

**Implementation:**
- Import `Zap` from lucide-react and add a new `Card` after the warnings block (line ~117) and before the stat cards grid (line ~119)
- The card will have a gradient/accent background, a title ("Quick Event Setup"), a short description ("Create an event in minutes with our guided wizard"), and a CTA button linking to the wizard route
- Compact, single-row layout using flexbox so it doesn't dominate the page

