# 5-Minute Live Demo Script — Social Working Manager

Use this script to walk through every core workflow of **Social Working Manager** in 5 minutes. No LinkedIn or X API approval is required — the Transfer fallback works out of the box.

---

## Minute 0:00 – 0:45 · Landing Page & Registration

1. Open [http://localhost:3000](http://localhost:3000).
   - Point out the **Navy + Cream + Coral** editorial theme, **Fraunces** serif headings, and **Inter** UI typography.
2. Click **Start writing free** (`/register`).
3. Enter your name, email, and an 8+ character password, then click **Create account**.
   - Behind the scenes, the Supabase signup trigger creates your `profiles` row and seeds 4 starter templates.
   - You land on `/dashboard` with stat cards, the posts-per-platform chart, and the navy sidebar.

---

## Minute 0:45 – 2:00 · Generate a LinkedIn Post & Refine / Edit

1. Click **Create new post** (`/create`).
2. In the left panel:
   - Enter an idea:
     > *"Shipped our team's new onboarding flow this week — cut drop-off by 28%. Biggest lesson was removing the 4th step instead of redesigning it."*
   - Keep **LinkedIn** and **Professional** selected (note the navy chip fill with the coral underline).
3. Click **Generate content**.
   - Observe the coral spinner and shimmer skeleton in the right-hand editor while the server runs the generation pass followed by the editorial refinement pass.
4. Once the post appears:
   - Edit a sentence directly in the editor and point out the live word and character counter.
   - Click **Refine flow** to run an on-demand editorial pass on your edited text.
   - Refresh the browser page (`⌘R` / `Ctrl+R`) to demonstrate that `sessionStorage` preserves your unsaved editor text automatically.

---

## Minute 2:00 – 2:45 · Save Draft & Manage Drafts

1. In the editor toolbar, click **Save Draft**.
2. Confirm or tweak the suggested title in the modal and click **Save draft**.
3. Navigate to **Drafts** (`/drafts`) in the sidebar:
   - Search by keyword, filter by **LinkedIn**, and toggle the updated-date sort order.
   - Click **Open & edit** to view the draft inside `/drafts/[id]`, make a quick edit, and click **Save changes**.

---

## Minute 2:45 – 3:30 · Use a Starter Template (X Thread)

1. Navigate to **Templates** (`/templates`) and show the 4 pre-seeded starter templates (*Project / Achievement Update*, *Internship Learning Post*, *Product Launch*, *Thought Leadership*).
2. Click **Use template** on **Product Launch**.
   - You are taken to `/create?template=…` with the structure text, **X** platform chip, and **Casual** tone chip pre-selected.
3. Replace the `{placeholders}` with a quick product description and click **Generate content**.
   - Point out the per-post live character counter (`≤ 280` chars) and per-post **Copy** buttons.

---

## Minute 3:30 – 4:15 · Transfer to LinkedIn (Zero Credentials Needed)

1. Open your saved LinkedIn draft (or current editor content) and click **Publish / Transfer**.
2. In the modal:
   - Show that the content is still editable for last-second tweaks.
   - Note the **Mode: One-click transfer** badge (or **Direct API publish** if LinkedIn OAuth credentials are connected).
3. Click **Transfer to LinkedIn**:
   - The post is copied to the clipboard, LinkedIn's composer opens in a new tab, a `TRANSFER_REDIRECT` job is recorded in `publish_jobs`, and a step-by-step instruction card is displayed.

---

## Minute 4:15 – 5:00 · History, Calendar & Dashboard

1. Open **History** (`/history`):
   - Every generation is listed chronologically. Click **View** on the latest entry and toggle **Compare initial raw pass** vs. the refined version.
2. Open **Calendar** (`/calendar`):
   - Note the v1.0 planning banner. Click any day in the month grid, select your saved LinkedIn draft from the dropdown, pick a time, and click **Add to calendar**.
   - Point out the navy chip with the coral dot on the scheduled day.
3. Return to **Dashboard** (`/dashboard`):
   - The stat cards (**Total generated**, **Saved drafts**, **Published / transferred**, **Templates**), the **Posts per platform** bar chart, and the **Recent activity** feed all reflect your session.
