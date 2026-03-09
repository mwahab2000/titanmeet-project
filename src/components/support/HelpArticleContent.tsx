import { Building2, Palette, Mail, ClipboardList, Bus, CreditCard } from "lucide-react";

export interface HelpArticle {
  icon: React.ElementType;
  title: string;
  description: string;
  readTime: string;
  slug: string;
  content: string;
}

export const helpArticles: HelpArticle[] = [
  {
    icon: Building2,
    title: "Client & Event Hierarchy",
    description:
      "Understand how Clients and Events are structured in TitanMeet — the foundation of every event you create.",
    readTime: "3 min",
    slug: "client-event-hierarchy",
    content: `## How TitanMeet Organizes Your Work

TitanMeet uses a **two-level hierarchy**: **Clients → Events**.

### Clients
A Client represents a company, department, or individual you manage events for. Each client has:
- A unique **name** and **slug** (used in public URLs)
- An optional **logo** displayed on public event pages
- One or more **events** nested under it

Think of Clients as folders that group related events together.

### Events
Every event belongs to exactly one Client. An event contains all the data for a single occasion:
- **Basic info** — title, dates, location, description
- **Attendees** — the guest list with RSVP tracking
- **Speakers & Agenda** — session schedule
- **Venue, Gallery, Dress Code** — visual and logistical details
- **Invitations, Surveys, Announcements** — communication tools

### Why This Matters
- Your **plan limits** count Clients and active Events separately.
- When you archive or delete a Client, all its events go with it.
- Public event pages use the path \`/client-slug/event-slug\`, so choosing clear slugs is important.

### Quick Start
1. Go to **Clients** → **Create Client** and set a name + slug.
2. Inside the client, click **Create Event**.
3. Fill in the event workspace sections one by one.
4. When ready, set the event status to **Published**.`,
  },
  {
    icon: Palette,
    title: "Understanding Themes",
    description:
      "Learn about the event themes — Corporate Clean, Elegant Premium, and Modern Conference — and how to choose the right one.",
    readTime: "4 min",
    slug: "understanding-themes",
    content: `## Choosing the Right Theme

TitanMeet ships with several professionally designed themes for your public event page. Each theme controls layout, typography, colors, and animations.

### Available Themes

| Theme | Best For |
|-------|----------|
| **Corporate Clean** | Business conferences, board meetings, product launches |
| **Corporate MUI** | A Material-UI styled corporate look with structured sections |
| **Elegant Premium** | Galas, award ceremonies, formal dinners |
| **Modern Conference** | Tech summits, developer meetups, innovation days |
| **Midnight Gala** | Evening events, VIP gatherings, luxury launches |
| **Creative Festival** | Music festivals, art shows, creative showcases |
| **Nature & Wellness** | Retreats, wellness days, outdoor gatherings |
| **Tech Summit** | Hackathons, technical conferences, startup events |

### How to Change Your Theme
1. Open an event and go to the **Website** section.
2. Select a theme from the dropdown.
3. Preview the page to confirm the look and feel.
4. Publish when satisfied.

### Tips
- All themes are **responsive** and work on desktop, tablet, and mobile.
- Theme choice does **not** affect your data — you can switch themes at any time without losing content.
- Each theme styles the same set of sections (Hero, Agenda, Speakers, Venue, etc.) differently, so try a few before deciding.`,
  },
  {
    icon: Mail,
    title: "Invitations: Email vs WhatsApp vs Link",
    description:
      "Compare the three invitation channels, learn when to use each, and understand delivery tracking and RSVP flows.",
    readTime: "5 min",
    slug: "invitations-channels",
    content: `## Three Ways to Invite Attendees

TitanMeet supports three invitation channels. You can mix and match for each attendee.

### 1. Email Invitations
- **How it works**: TitanMeet sends a branded email with a unique RSVP link.
- **Tracking**: You see when the email was sent, opened, and whether the attendee confirmed.
- **Best for**: Professional events, large guest lists, formal tone.
- **Requires**: A valid email address for each attendee.
- **Limit**: Counted against your plan's monthly email quota.

### 2. WhatsApp Invitations
- **How it works**: A pre-formatted message with the RSVP link is generated. You share it via WhatsApp (opens the WhatsApp app or web).
- **Tracking**: TitanMeet records that the WhatsApp message was triggered. Delivery depends on WhatsApp itself.
- **Best for**: Informal events, local audiences, higher open rates.
- **Requires**: A mobile number for each attendee.
- **Limit**: Not counted against email quota.

### 3. Shareable Link
- **How it works**: Copy a unique RSVP link and share it however you like — Slack, SMS, printed QR code, etc.
- **Tracking**: Opens and RSVPs are tracked when the recipient visits the link.
- **Best for**: Internal teams, social media promotion, flexible distribution.
- **Requires**: Nothing — link works for anyone.

### RSVP Flow
Regardless of the channel:
1. Attendee receives the link.
2. They land on a branded invitation page showing event details.
3. They click **Confirm Attendance**.
4. Their status updates in your dashboard in real time.

### Tips
- You can **resend** invitations to attendees who haven't responded.
- Bulk-send emails to all attendees who haven't been invited yet with one click.
- Check the **Invitations** tab in your event workspace for delivery status.`,
  },
  {
    icon: ClipboardList,
    title: "Surveys: Create, Send & Results",
    description:
      "Build pre or post-event surveys, send them to attendees, and read the collected results with visual charts.",
    readTime: "4 min",
    slug: "surveys-guide",
    content: `## Surveys in TitanMeet

Collect feedback before or after your event with built-in surveys.

### Creating a Survey
1. Open your event workspace and go to the **Survey** section.
2. Click **Create Survey** and give it a title.
3. Add questions using the drag-and-drop editor.

### Question Types
- **Short Text** — open-ended one-liner
- **Long Text** — paragraph responses
- **Single Choice** — radio buttons, pick one
- **Multiple Choice** — checkboxes, pick many
- **Rating** — 1–5 or 1–10 star/number scale
- **Date** — date picker
- **Yes / No** — simple boolean

Each question can be marked as **required** or optional.

### Sending the Survey
- Go to the **Send Survey** tab.
- Select attendees individually or in bulk.
- Choose **Email** or **WhatsApp** as the delivery channel.
- Each attendee receives a unique link that pre-identifies them.

### Viewing Results
- The **Results** tab shows aggregated charts for each question.
- Single/multiple choice → pie or bar charts.
- Ratings → average score and distribution.
- Text answers → listed individually.
- Export results to **Excel** for further analysis.

### Tips
- Surveys can be sent to attendees who haven't RSVP'd yet — useful for gauging interest.
- You can create multiple surveys per event (e.g., pre-event + post-event).
- Survey links expire when you close or archive the event.`,
  },
  {
    icon: Bus,
    title: "Transportation: Routes & Stops",
    description:
      "Set up bus routes and pickup stops for coordinated attendee transport. Routes and stops appear on the public event page.",
    readTime: "3 min",
    slug: "transportation-routes",
    content: `## Managing Event Transportation

If your event requires coordinated transport (shuttle buses, vans, etc.), TitanMeet lets you define routes and pickup points.

### Setting Up Routes
1. Go to the **Transportation** section in your event workspace.
2. Click **Add Route** to create a new bus/shuttle route.
3. Give the route a name (e.g., "Hotel → Venue Morning Shuttle").
4. Set departure time and any notes.

### Adding Pickup Stops
Each route has an ordered list of stops:
- **Stop name** — e.g., "Hilton Hotel Lobby"
- **Pickup time** — when the bus arrives at that stop
- **Address** — optional, for attendee reference
- Drag to **reorder** stops along the route.

### Assigning Attendees
- In the Transportation section, assign attendees to a route and pickup point.
- Optionally add **seat numbers** or **special needs** notes.
- Attendees see their assignment on the public event page.

### Public Page Display
When transportation is enabled:
- The public event page shows a **Transportation** section.
- Attendees see all routes, stops, and times.
- If assigned, they see their specific route highlighted.

### Tips
- You can have multiple routes per event (different directions, times, etc.).
- Enable or disable the transportation section from the **Website** settings.
- Transport info updates in real time — changes reflect immediately on the public page.`,
  },
  {
    icon: CreditCard,
    title: "Billing & Plan Limits",
    description:
      "Understand plan tiers, usage limits on clients, events, attendees and emails, and how overage and upgrades work.",
    readTime: "4 min",
    slug: "billing-plan-limits",
    content: `## Plans & Billing

TitanMeet offers tiered plans to fit different event management needs.

### Plan Comparison

| Resource | Starter | Professional | Enterprise |
|----------|---------|-------------|------------|
| Clients | 3 | 15 | Unlimited |
| Active Events | 5 | 30 | Unlimited |
| Attendees / month | 500 | 5,000 | Unlimited |
| Emails / month | 2,000 | 15,000 | Unlimited |
| Storage | 5 GB | 25 GB | 100 GB |
| Support | Community | Priority | Dedicated |

### Hard Limits vs Soft Limits
- **Clients & Events** are **hard limits** — you cannot create more than your plan allows.
- **Attendees, Emails & Storage** are **soft limits** — you'll see warnings but existing data is preserved.

### Grandfathering
If you downgrade and already exceed the new plan's limits:
- Your existing data is **never deleted**.
- You simply can't create new items until you're within limits.
- The dashboard shows an orange "grandfathered" indicator.

### Billing Cycle
- Attendee and email counts **reset monthly** on your billing anniversary.
- Client and event counts reflect your current totals (no reset).
- Storage is cumulative — it only decreases when you delete files.

### Upgrading
- Click **Upgrade** from the Billing page or any limit warning.
- You'll be credited for unused days on your current plan (proration).
- New limits take effect immediately.

### Downgrading
- You can downgrade at any time.
- If your current usage exceeds the target plan, you'll be told what to reduce first.
- No data is ever automatically deleted.

### Tips
- Check the **Usage** section on your dashboard for real-time limit tracking.
- Set up the event early — it only counts as "active" when published.
- Draft events do not count toward your active event limit.`,
  },
];
