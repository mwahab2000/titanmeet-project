import { Building2, Palette, Mail, ClipboardList, Bus, CreditCard, Bot, BarChart3, ScanLine, Store, Zap, Clock, Users, Image } from "lucide-react";

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

### Scheduled Invitations
You can schedule invitations to be sent automatically at a specific date and time:
- Navigate to the **Communications** section of your event workspace.
- Choose **Schedule Send** when composing an invitation batch.
- Select the date, time, and channel (email or WhatsApp).
- Scheduled messages appear in the **Scheduled Queue** where you can edit or cancel them before they send.
- This is ideal for sending invitations at optimal times (e.g., Tuesday morning) or staggering sends across days.

### Tracking Invitation Performance
TitanMeet provides detailed analytics for invitation campaigns:
- **Delivery rate** — percentage of invitations successfully delivered.
- **Open rate** — percentage of email invitations opened by recipients.
- **RSVP conversion** — how many recipients confirmed attendance after receiving the invitation.
- **Channel comparison** — see which channel (email, WhatsApp, link) drives the highest RSVP rate.
- Access these metrics from the **Analytics** section of your event workspace.
- Export invitation performance data to Excel for stakeholder reporting.

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
| Clients | 5 | 15 | Unlimited |
| Active Events | 20 | 50 | Unlimited |
| Attendees / event | 100 | 300 | Unlimited |
| AI Event Builder | 10 queries/month | Unlimited | Unlimited |
| Analytics History | 30 days | 1 year | Unlimited |
| Template Marketplace | Use only | Use + Publish | Use + Publish |
| Support | Community | Priority | Dedicated |

### Hard Limits vs Soft Limits
- **Clients & Events** are **hard limits** — you cannot create more than your plan allows.
- **Attendees & AI queries** are **soft limits** — you'll see warnings but existing data is preserved.

### AI Usage Limits
AI Event Builder queries are counted per workspace per calendar month:
- **Starter** plans receive **10 AI queries per month**. Each conversation turn that triggers a tool (venue search, event generation, recommendations) counts as one query.
- **Professional** and **Enterprise** plans have **unlimited AI queries**.
- When you approach your limit, a warning banner appears in the AI Builder.
- Once the limit is reached, you can still view your existing sessions and drafts, but new AI-powered actions are paused until the next billing cycle or an upgrade.
- AI query counts **reset on the 1st of each month**.

### Grandfathering
If you downgrade and already exceed the new plan's limits:
- Your existing data is **never deleted**.
- You simply can't create new items until you're within limits.
- The dashboard shows an orange "grandfathered" indicator.

### Billing Cycle
- Attendee and AI query counts **reset monthly** on your billing anniversary.
- Client and event counts reflect your current totals (no reset).
- Analytics history retention follows your plan tier.

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
  {
    icon: Bot,
    title: "AI Event Builder: Plan Events with AI",
    description:
      "Use TitanMeet's AI assistant to plan your entire event through natural conversation. Get venue recommendations, photo selections, and automated scheduling.",
    readTime: "6 min",
    slug: "ai-event-builder",
    content: `## AI Event Builder

TitanMeet's AI Event Builder lets you plan and configure events through natural conversation — no forms to fill out manually.

### Getting Started
1. Navigate to **AI Builder** from the dashboard sidebar.
2. Start a new session or continue an existing one.
3. Describe your event in plain language — the AI will guide you through the rest.

### What the AI Can Do
The AI Builder supports a wide range of event planning tasks:

- **Create events** — describe your event and the AI sets up a full draft with title, dates, location, and description.
- **Venue recommendations** — say something like "Find a venue near downtown Cairo" and browse real venue results with photos.
- **Agenda generation** — the AI suggests session structures based on your event type and audience size.
- **Smart suggestions** — get recommendations for themes, communication strategies, and logistics based on your event context.
- **Attendee setup** — add attendees from a text list or let the AI help structure your guest list.
- **Publish readiness** — the AI checks whether your event is ready to go live and flags missing sections.

### Natural Conversation Examples

| You Say | AI Does |
|---------|---------|
| "Create a sales kickoff for 200 people next March" | Creates event draft with basics filled in |
| "Set venue to Hilton Pyramids Golf" | Searches venues, shows options, saves your choice |
| "Add a networking session after lunch" | Updates the agenda with a new session |
| "Is this event ready to publish?" | Runs readiness checks and reports gaps |
| "Use the executive summit template" | Applies a template from the marketplace |

### Review & Edit Workflow
The AI Builder follows a **preview-first model**:
1. The AI generates a structured proposal for your event.
2. You see a draft preview with all sections clearly laid out.
3. Review each section — basics, agenda, venue, communications, branding.
4. Accept all, edit individual sections, or ask the AI to regenerate parts.
5. Only when you confirm does the data save to your event workspace.

### Action Log
Every action the AI takes is recorded in a visible **action log**:
- See exactly what was created, updated, or skipped.
- If a step fails, the log shows the failure clearly.
- Successfully completed steps are preserved — no silent rollbacks.
- You decide whether to retry, skip, or adjust after any failure.

### Session Persistence
- Your AI Builder sessions are saved automatically.
- You can leave and come back to continue where you left off.
- Draft state is preserved even if some steps failed partway through.
- Access previous sessions from the AI Builder sidebar.

### Tips for Best Results
- Be specific about dates, audience size, and event type for better suggestions.
- Use the venue search feature to find real locations with photos.
- Review the draft preview before confirming — it's faster than editing after save.
- Check the action log if something doesn't look right.
- Combine AI Builder with templates for the fastest setup.

### Plan Limitations
- **Starter** plans: 10 AI queries per month.
- **Professional** and **Enterprise**: Unlimited AI queries.
- A usage banner shows your remaining queries for the current billing cycle.`,
  },
  {
    icon: BarChart3,
    title: "Event Analytics & Reporting",
    description:
      "Track RSVPs, check-ins, email opens, and survey responses in real-time. Export reports and visualize trends with interactive charts.",
    readTime: "5 min",
    slug: "analytics-dashboard",
    content: `## Event Analytics & Reporting

TitanMeet provides a comprehensive analytics dashboard to help you measure event performance and make data-driven decisions.

### Accessing Analytics
1. Open your event workspace.
2. Click the **Analytics** section in the sidebar.
3. The dashboard loads with real-time data for the selected event.

### Key Metrics

#### Attendance Overview
- **Total invited** — number of attendees on your guest list.
- **RSVP confirmed** — attendees who confirmed attendance.
- **Checked in** — attendees who actually arrived.
- **No-show rate** — percentage of confirmed attendees who didn't show up.

#### RSVP Conversion
- Track how invitations convert to RSVPs over time.
- See conversion rates broken down by invitation channel (email, WhatsApp, link).
- Identify which channels drive the highest response rates.

#### Communication Stats
- **Emails sent** — total invitation and reminder emails dispatched.
- **Open rate** — percentage of emails opened by recipients.
- **WhatsApp delivered** — messages successfully sent via WhatsApp.
- **Response rate** — how quickly attendees respond after receiving invitations.

#### Survey Completion
- **Surveys sent** — number of survey invitations dispatched.
- **Responses received** — completed survey submissions.
- **Completion rate** — percentage of recipients who finished the survey.
- **Average rating** — aggregated score for rating-type questions.

### Visualizations
The analytics dashboard includes interactive charts:
- **Pie charts** — RSVP status breakdown (confirmed, pending, declined).
- **Timeline charts** — check-in arrivals over time during the event.
- **Bar charts** — channel performance comparison.
- **Trend lines** — RSVP and engagement trends leading up to the event.

### Live Mode
During an active event, the dashboard enters **live mode**:
- Check-in count updates in real time.
- Arrival trend chart shows attendees checking in as it happens.
- Communication activity (new RSVPs, survey responses) appears instantly.
- Ideal for monitoring event day operations from a second screen.

### Export Options
- **Excel** — download a detailed spreadsheet with all metrics and raw data.
- Use exports for stakeholder reports, post-event reviews, or compliance records.

### Tips for Using Analytics Effectively
- Check RSVP conversion rates 48 hours before your event to gauge attendance.
- Use channel comparison data to choose the best invitation method for future events.
- Review no-show rates to improve reminder timing.
- Export post-event reports within 7 days while data is fresh.

### Plan Features

| Feature | Starter | Professional | Enterprise |
|---------|---------|-------------|------------|
| Basic metrics | ✓ | ✓ | ✓ |
| Live mode | ✓ | ✓ | ✓ |
| History retention | 30 days | 1 year | Unlimited |
| Excel export | ✓ | ✓ | ✓ |
| Channel comparison | — | ✓ | ✓ |
| Trend analysis | — | ✓ | ✓ |`,
  },
  {
    icon: ScanLine,
    title: "Attendee Check-In & QR Codes",
    description:
      "Track event arrivals with QR code scanning or manual check-in. Monitor attendance in real-time and prevent duplicate entries.",
    readTime: "4 min",
    slug: "check-in-system",
    content: `## Attendee Check-In System

TitanMeet provides multiple check-in methods to track event arrivals accurately and efficiently.

### Check-In Methods

#### QR Code Scanning
- Each attendee receives a unique QR code with their invitation.
- Staff scan the code using any device with a camera.
- The system instantly verifies the attendee and records the check-in.
- Duplicate scans are blocked — each attendee can only check in once.

#### Manual Check-In
- Search for an attendee by name or email in the check-in panel.
- Tap to mark them as checked in.
- Useful as a fallback when QR codes aren't practical.

#### WhatsApp Check-In
- Attendees receive a secure tokenized link via WhatsApp.
- Tapping the link confirms their arrival.
- The check-in is recorded with the WhatsApp channel noted.

### Setup Instructions
1. Open your event workspace and go to the **Attendees** section.
2. Ensure your guest list is populated with attendee details.
3. Send invitations — QR codes are generated automatically.
4. On event day, open the **Check-In** panel from the event workspace.
5. Use any method above to record arrivals.

### Data Tracked Per Check-In
Each check-in records:
- **Attendee identity** — name, email, group assignment.
- **Timestamp** — exact time of arrival.
- **Method** — QR scan, manual, or WhatsApp.
- **Device/channel info** — where the check-in originated.

### Real-Time Monitoring
The check-in dashboard shows:
- **Total checked in** vs. total confirmed attendees.
- **Arrival timeline** — a live chart of check-ins over time.
- **Recent arrivals** — a feed of the latest check-ins.
- **Outstanding** — attendees who confirmed but haven't arrived yet.

### Post-Event Reports
After the event:
- View the complete attendance report with check-in times.
- Calculate **no-show rate** (confirmed but didn't attend).
- Export the check-in log to Excel for record-keeping.
- Compare check-in data with survey responses for engagement analysis.

### Troubleshooting

| Issue | Solution |
|-------|----------|
| QR code won't scan | Ensure good lighting; try manual check-in as fallback |
| Duplicate check-in blocked | Expected behavior — each attendee checks in once |
| Attendee not found | Verify they're on the guest list; check spelling |
| Check-in not recording | Check internet connection; data syncs when reconnected |

### Tips
- Test the QR scanning flow before event day with a sample attendee.
- Assign dedicated check-in staff for events with 100+ attendees.
- Use the real-time dashboard on a large screen at the registration desk.
- WhatsApp check-in works well for informal or outdoor events.`,
  },
  {
    icon: Store,
    title: "Template Marketplace: Share & Reuse Events",
    description:
      "Browse pre-built event templates, save your own for reuse, and share with the community. Start events in minutes with proven structures.",
    readTime: "5 min",
    slug: "template-marketplace",
    content: `## Template Marketplace

The Template Marketplace helps you start events faster by reusing proven event structures, content, and communication templates.

### Browsing Templates
1. Navigate to **Templates** from the dashboard sidebar.
2. Browse by category, tags, or use the search bar.
3. Featured templates appear at the top — these are curated for quality.
4. Click any template to see a detailed preview.

### Template Categories
- **Corporate** — board meetings, quarterly reviews, product launches.
- **Social** — galas, dinners, networking events.
- **Conference** — multi-day summits, workshops, hackathons.
- **Internal** — team offsites, training days, onboarding sessions.
- **Custom** — your own saved templates.

### Using a Template
1. Click **Use Template** on any template card.
2. Select which client the new event belongs to.
3. The template creates a new event draft with pre-filled content.
4. Review and customize — all fields are editable.
5. Save when ready.

### What Gets Copied

| Included | Not Included |
|----------|-------------|
| Event title & description | Attendee list |
| Agenda structure | RSVP data |
| Theme/design choice | Invitation history |
| Communication templates | Analytics data |
| Section configurations | Venue-specific photos |
| Speaker slot placeholders | Dates (you set new ones) |

### Saving Your Own Templates
1. Open any event workspace.
2. Click **Save as Template** from the event actions menu.
3. Give the template a name, description, and category.
4. Add tags for easier discovery.
5. Choose visibility: **Private** (only your workspace) or **Public** (marketplace).

### Managing Your Templates
- View all your saved templates in the **My Templates** tab.
- Edit template metadata (name, description, tags) at any time.
- Delete templates you no longer need.
- See how many times your public templates have been used.

### AI Builder Integration
The AI Builder can reference templates directly:
- Say "Use the executive summit template" in a conversation.
- The AI loads the template and lets you customize it through chat.
- Combine template structures with AI-generated content for maximum speed.

### Tips
- Save a template after every successful event — build your own library.
- Use tags consistently for easy filtering later.
- Start with a marketplace template, customize it, then save as your own variant.
- Communication templates inside event templates save the most setup time.`,
  },
  {
    icon: Clock,
    title: "Scheduled Messages: Automate Communications",
    description:
      "Set up automatic reminders, thank-you messages, and follow-ups. Schedule emails and WhatsApp messages to send at the perfect time.",
    readTime: "4 min",
    slug: "scheduled-messages",
    content: `## Scheduled Messages

Automate your event communications by scheduling messages to send at the right time — without manual effort.

### Why Schedule Messages?
- **Reminders** — automatically remind attendees 24 hours before the event.
- **Thank-you notes** — send follow-ups the day after the event.
- **Staggered sends** — spread invitation batches across days to avoid spam filters.
- **Timezone optimization** — schedule for when recipients are most likely to read.

### Creating a Scheduled Message
1. Go to the **Communications** section in your event workspace.
2. Click **New Message** or **Schedule Send** on an existing draft.
3. Choose the channel: **Email** or **WhatsApp**.
4. Select recipients: individual attendees, groups, or all attendees.
5. Compose your message using a template or write custom content.
6. Set the **send date and time**.
7. Click **Schedule** to queue the message.

### Timing Options
- **Absolute time** — send at a specific date and time (e.g., March 15 at 9:00 AM).
- **Relative to event** — send X hours/days before or after the event start time.
- Relative timing adjusts automatically if you change the event date.

### Message Queue Management
The **Scheduled Queue** panel shows all pending messages:
- View scheduled date, channel, and recipient count.
- **Edit** message content or timing before it sends.
- **Cancel** a scheduled message to prevent it from sending.
- Messages move to **Sent** status after successful delivery.

### Best Send Times
Based on general communication best practices:
- **Invitations** — Tuesday or Wednesday morning (9–11 AM local time).
- **Reminders** — 24–48 hours before the event.
- **Follow-ups** — within 24 hours after the event ends.
- **Survey requests** — 2–4 hours after the event.

### Delivery Tracking
After a scheduled message sends:
- Track delivery status in the **Communications Log**.
- See open rates for email messages.
- Monitor delivery confirmation for WhatsApp messages.
- Failed deliveries are flagged with retry options.

### Troubleshooting

| Issue | Solution |
|-------|----------|
| Message didn't send at scheduled time | Check that the event is still active and not archived |
| Recipients not receiving | Verify email addresses or phone numbers are correct |
| Want to change timing | Edit the scheduled message before the send time |
| Duplicate messages | Each attendee receives a message only once per scheduled batch |

### Tips
- Use relative timing for reminders — they adjust automatically if the event date changes.
- Schedule all communications when setting up the event, then let automation handle the rest.
- Review the scheduled queue weekly to catch any messages that need updating.
- Combine scheduled messages with the AI Builder for automated communication planning.`,
  },
  {
    icon: Zap,
    title: "Quick Event Wizard: 5-Minute Setup",
    description:
      "Create a basic event in minutes with the streamlined wizard. Perfect for simple events that don't need complex configuration.",
    readTime: "3 min",
    slug: "quick-event-wizard",
    content: `## Quick Event Wizard

The Quick Event Wizard is the fastest way to create a basic event in TitanMeet — ideal for simple gatherings that don't need full configuration.

### When to Use Quick Wizard
- **Simple events** — team lunches, small meetings, informal gatherings.
- **Time-sensitive** — you need the event page live in minutes.
- **Basic needs** — you only need date, venue, and a guest list.

For complex events with agendas, speakers, transportation, and surveys, use the **AI Builder** or the **full event workspace** instead.

### 5-Step Walkthrough

**Step 1: Client Selection**
Choose an existing client or create a new one.

**Step 2: Event Basics**
Enter the event title, date range, and a short description.

**Step 3: Location**
Add a venue name and address. Optionally search for a venue to auto-fill coordinates.

**Step 4: Guest List**
Add attendees by name and email. Paste a list or add one by one.

**Step 5: Review & Create**
Review your event summary and click **Create Event**.

### What's Included
The wizard creates an event with:
- Title, dates, and description.
- Venue information.
- Initial attendee list.
- Default theme applied.
- Event set to **Draft** status (publish when ready).

### Converting to Full Event
After creating with the wizard, you can add any advanced feature:
- Open the event workspace from the dashboard.
- Add speakers, agenda, dress code, gallery, surveys, and more.
- Switch themes, configure communications, and set up transportation.
- Nothing is locked — the wizard is just a faster starting point.

### Comparison

| Feature | Quick Wizard | AI Builder | Full Workspace |
|---------|-------------|-----------|----------------|
| Setup time | ~5 minutes | ~10 minutes | 30+ minutes |
| AI assistance | No | Yes | No |
| Agenda/speakers | Add later | AI-generated | Manual setup |
| Venue search | Basic | AI-powered | Manual |
| Template support | No | Yes | Yes |
| Best for | Simple events | Complex events | Full customization |

### Tips
- Use the Quick Wizard for recurring simple events to save time.
- You can always enhance a wizard-created event later with the full workspace.
- For events with 50+ attendees or multi-day agendas, start with the AI Builder instead.`,
  },
  {
    icon: Users,
    title: "Attendee Groups & Segmentation",
    description:
      "Organize attendees into groups for targeted communications, seating arrangements, and access control. Create VIP, dietary, or department-based segments.",
    readTime: "4 min",
    slug: "attendee-groups",
    content: `## Attendee Groups & Segmentation

Groups let you organize attendees into meaningful segments for targeted communications, logistics, and reporting.

### Creating Groups
1. Open your event workspace and go to the **Groups** section.
2. Click **Add Group** and enter a group name.
3. Optionally set a **capacity limit** for the group.
4. Save the group.

### Common Group Types
- **VIP** — priority seating, special communications.
- **Speakers** — backstage access, different schedule.
- **Dietary** — vegetarian, vegan, gluten-free for catering.
- **Department** — HR, Engineering, Sales for internal events.
- **Transport** — grouped by bus route or pickup point.
- **Day pass** — for multi-day events, track which days each attendee is registered for.

### Assigning Attendees to Groups

#### Manual Assignment
- Open the **Assign Groups** section.
- Search for attendees and drag or select them into groups.

#### Bulk Assignment
- Select multiple attendees from the attendee list.
- Use the **Assign to Group** bulk action.

### Using Groups for Communications
- When composing a message, select a group as the recipient.
- Send targeted invitations, reminders, or announcements to specific segments.
- Different groups can receive different message content.

### Using Groups for Seating & Logistics
- Assign groups to specific rooms or sessions in the agenda.
- Use groups for transportation route assignments.
- Track group-level check-in statistics.

### Group Management
- View group membership counts in the Groups section.
- Edit group names and capacity limits.
- Remove attendees from groups individually or in bulk.
- Delete empty groups when no longer needed.

### Advanced Use Cases

#### Multi-Track Conferences
Create groups for each conference track:
- "Track A: Leadership"
- "Track B: Technical"
- "Track C: Workshop"
- Assign attendees based on registration preferences.

#### Tiered Access
Use groups to manage access levels:
- "General Admission" — standard event access.
- "Premium" — includes networking dinner.
- "All-Access" — full event plus backstage.

### Tips
- Name groups clearly — other team members need to understand them at a glance.
- Use groups for post-event analysis: compare engagement across segments.
- Groups persist if you save the event as a template.
- Keep group count manageable — 3–8 groups per event works best for most use cases.`,
  },
  {
    icon: Image,
    title: "Event Gallery: Photos & Media",
    description:
      "Upload and organize event photos, create galleries for different sessions, and share media with attendees on the public page.",
    readTime: "3 min",
    slug: "gallery-management",
    content: `## Event Gallery

The Gallery section lets you upload, organize, and display event photos on your public event page.

### Upload Methods
- **Drag and drop** — drag image files directly into the gallery area.
- **File picker** — click to browse and select files from your device.
- **Multiple files** — upload several images at once in a single batch.

### Supported Formats
- **Images**: JPEG, PNG, WebP, GIF.
- **Maximum file size**: Depends on your plan's storage allocation.
- Images are automatically optimized for web display.

### Organizing Photos
- Uploaded images appear in the gallery grid.
- **Reorder** photos by dragging them to the desired position.
- **Delete** images you no longer want to display.
- The first image in the gallery is used as the primary display image on some themes.

### Gallery on the Public Page
When gallery images are uploaded:
- The public event page shows a **Gallery** section.
- Attendees can browse photos in a lightbox view.
- Images are lazy-loaded for fast page performance.
- The gallery is responsive — looks great on desktop and mobile.

### Sharing & Download
- Attendees can view the gallery on the public event page.
- The lightbox supports full-screen viewing.
- Gallery visibility follows the event's published status.

### Post-Event Workflow
1. After the event, upload photos from the event.
2. Organize them in the gallery — best shots first.
3. The gallery updates on the public page immediately.
4. Share the event link with attendees so they can revisit and view photos.

### Storage Limits by Plan

| Plan | Storage |
|------|---------|
| Starter | 5 GB |
| Professional | 25 GB |
| Enterprise | 100 GB |

Storage is shared across all events in your workspace. Delete unused images to free up space.

### Tips
- Upload your best 10–20 photos rather than everything — quality over quantity.
- Use WebP format for smaller file sizes without quality loss.
- Add gallery photos before publishing for a polished first impression.
- Check how the gallery looks on mobile before publishing — some themes display differently.
- Venue photos from the AI Builder's venue search are stored separately from the gallery.`,
  },
];
