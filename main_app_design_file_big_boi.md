# FRIDAY — Project Context File
**Read this file first. Every session starts here.**
Last updated: **October 7, 2026.** Three agents now live and reality-tested (House Manager, Personal Entertainment Manager, Relationship Manager — brand names, see THE AGENT ROSTER). Two more fully drafted and ready to run next session (Food Manager, Restaurant Manager). Full roster reprioritized and renamed this session — see SESSION LOG below for the complete story.

**Substantive state: August 14, 2026 — PHASE CHANGE.** The screen-building phase (Phase 3) is paused at 41 HTML files; **Phase 4, agent prompts, is now the active workstream** after a holistic review found that zero agent prompts had ever been written or run.

> **Gap note:** Between 2026-08-14 and 2026-09-07 **no work happened** — every file still carried its August timestamp, `databases/` was still empty, and the Home Manager reality test was still unrun. This is normal for a side project competing with a job, a toddler, and a November CFP exam; it is recorded only so a future session knows the docs are trustworthy rather than three weeks stale. **The next action has not changed** — see IMMEDIATE NEXT ACTIONS.

> **CORRECTION — 2026-09-07, second pass:** There is no Notion workspace, no Notion databases, no CSV exports, and never have been. The "16 databases," the population counts ("40 people in Notion," "24 providers in Notion," etc.), and every instruction below to "export from Notion" describe an early planning exercise from `documents/friday_database_schemas.docx` that was never actually built — a thought experiment, not a system. Matthew moved past that phase, works directly with Claude, and now does this work in Claude Code. **There is no external data store of any kind.** Every `DBx` label below is kept only as an internal shorthand for "which agent owns this category of information" — not a pointer to any real, populated database. Anywhere this file previously said to export, sync, or pull from a database, the actual mechanism is: **capture the data live, through direct conversation, in a Claude Code session** — the same way onboarding/INTERVIEW mode was always meant to work. See PHASE 4 and IMMEDIATE NEXT ACTIONS below, both corrected in this pass.

**Cold-start reading order:** this header → **STRATEGIC REVIEW** (why building stopped — read before proposing any build work) → **PHASE 4** (the locked architecture) → **IMMEDIATE NEXT ACTIONS** (start here) → **OPEN DECISIONS** (what's blocked on Matthew) → **SESSION LOG** (what happened last). Then `agent prompts/_STATUS.md` for progress and `agent prompts/_WORKFLOW.md` for the procedure.

**Current state on disk, updated 2026-10-07:** 41 HTML files in `prototypes/`/`mobile/`/`onboarding/` from Phase 3 (unchanged this session) plus `prototypes/friday_vision.html`, a new private vision/roadmap page. `agent prompts/` holds 7 files: `_STATUS.md`, `_WORKFLOW.md`, `_QUESTION_BANK.md` (new), `01_home_manager.md`, `02_relationship_manager.md`, `03_food_manager.md` (new), `08_entertainment.md`, `10_restaurant_manager.md` (new). `databases/` holds a matching JSON + generated status page per live/drafted agent. `team_onboarding/` holds one walkthrough page (`01_home_manager.html`). Still zero real backend — everything above is files, not a server. See **THE AGENT ROSTER** for which agents are live vs. drafted vs. archived, and **THE DATA STORE, FOR REAL THIS TIME** for how the files work.

---

## WHO I AM

**Matthew Gruseke** — 35 years old, financial advisor at Rockefeller & Company, Stamford CT. Live in Darien CT with wife Georgia (31), son Miles (born November 30, 2023), and dog Loki. **Georgia is pregnant with their second child, due December 2026** — learned 2026-09-07 during the Relationship Manager build, not previously recorded anywhere in this file. Household is about to get significantly busier with a toddler plus a newborn. Commute via train — 7am departure, home by 6:30pm. Homeowner since 2025 (see PHASE 4 / `databases/01_home_manager.json` for the house itself). Nanny named Marilyn covers Miles several days a week.

I am building Friday as a side project. I am NOT disclosing this to my employer (Rockefeller) until just before public launch — do not reference or suggest anything that would require early disclosure. No LLC formed yet — deliberately delaying until pre-launch.

I am also studying for the CFP exam in November 2026. I am working on Friday simultaneously during this period.

---

## WHAT FRIDAY IS

**Friday** is an AI-powered personal life operating system — a multi-agent system where specialized sub-agents each manage one domain of a user's life and report structured briefings upward to a master coordinator called Friday. Friday synthesizes everything and surfaces what matters most.

**Domain:** MeetFridayAI.com (registered)
**Pricing:** $19.99/month or $149/year — 7-day free trial, no free tier
**Target user, sharpened 2026-10-07:** Married professional, 32-45, young kids, HHI **$250K+** (raised from $150K+), lives in an affluent area, is a home manager/new homeowner, career-focused, losing the mental load battle to their spouse. The affluence and homeownership framing is now explicit, not implied.
**Comparable:** Monarch Money — same gamification philosophy, same price point
**Closest competitor:** Ohai.ai — 2.5 Trustpilot rating, demand proven, product undelivered

---

## THE CORE INSIGHT — why this works (Matthew's own words, 2026-09-07)

Captured live during the Home Manager build session because it's the clearest statement yet of what Friday is actually for, underneath the taglines:

> "The entire value add of Friday is setting up these frameworks to help people think through the different aspects of their life, and helping them chip away at little questions that you can answer in a piecemeal approach. And then at the end of it, you realize — oh wow, all of this info is in one place, one thing knows it, and one thing can prioritize it. And if I just keep going back here, I'll keep getting better at stuff."

The personal test for whether it's working:

> "My goal is to go back here and check this all the time rather than immediately opening my phone and going to my work email, or going to Instagram. It should be: I need to go into Friday, and I should just look at all of my stuff in one place. What should I be doing? Should I be working out? Should I be fixing something with the house? Should I be thinking about my kids? Should I be checking in with friends? Should I plan a trip? All of those things are what matters in life, and you should want to go into this hub rather than anywhere else to doomscroll."

**Why this is load-bearing, not just a nice quote:** every agent-build and feature decision should be judged against whether it makes Matthew — and later, real users — want to open Friday instead of Instagram or work email, not against whether it's technically complete. That's a sharper, fuller version of "5 minutes to save 5 hours," and it's a real test to hold future work to: does this specific piece make the hub worth returning to, or is it just more schema.

---

## CORE TAGLINES

- "5 minutes to save 5 hours"
- "Your wife is thinking about more things than you are. Friday fixes that."
- "Handle what matters. Then waste time guilt-free."
- "Friday knows you better than you remember yourself."
- "The more you teach Friday, the less you have to think."

---

## THE ARCHITECTURE — MULTI-AGENT SYSTEM

Friday is NOT a single AI prompt. It is an orchestration system.

> **Note, 2026-10-07:** the diagram below still shows the original 9-agent layout (Financial Advisor, Social Coordinator included, no Family Scheduler) and hasn't been redrawn — read it for the coordinator/specialist *mechanism*, not the current roster. **THE AGENT ROSTER** below is authoritative for which agents exist and in what order they're being built.

```
                    ┌─────────────────────────┐
                    │         FRIDAY          │
                    │    Master Coordinator   │
                    │  Synthesizes all agents │
                    │  Prioritizes everything │
                    └────────────┬────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
   ┌────▼─────┐          ┌───────▼──────┐        ┌───────▼──────┐
   │  Home    │          │Relationship  │        │  Personal    │
   │ Manager  │          │  Manager     │        │    Chef      │
   └────┬─────┘          └───────┬──────┘        └───────┬──────┘
        │                        │                        │
   DB4+DB5                   DB2+DB3                 DB7+DB8+DB9
        
   ┌────▼─────┐          ┌───────▼──────┐        ┌───────▼──────┐
   │  Goals   │          │  Personal    │        │   Travel &   │
   │  Agent   │          │  Trainer     │        │ Experiences  │
   └────┬─────┘          └───────┬──────┘        └───────┬──────┘
        │                        │                        │
  DB12+DB13               Health Log DB            DB10+DB11
        
   ┌────▼─────┐          ┌───────▼──────┐        ┌───────▼──────┐
   │Financial │          │Entertainment │        │   Social     │
   │ Advisor  │          │    Agent     │        │ Coordinator  │
   └────┬─────┘          └───────┬──────┘        └───────┬──────┘
        │                        │                        │
  Financial DB               DB15                      DB16
```

**How it works:**
1. Each sub-agent runs independently, reads its own databases
2. Each produces a structured JSON briefing: `{ urgent: [], upcoming_7_days: [], long_term: [], priority_score: 0-10 }`
3. Friday receives all briefings simultaneously
4. Friday resolves cross-domain conflicts and synthesizes into one clean daily output
5. User only ever sees Friday's voice — never the individual agents

---

## THE AGENT ROSTER (reprioritized 2026-10-07 — this replaces THE 9 SUB-AGENTS)

Matthew stepped back, brainstormed ~20 candidate pain points against the sharpened target user (HHI $250K+, 30-45, homeowner, young kids), and cut the list himself. Numbering below is **build priority**, not the original architectural order — several agents already built keep their existing Owns/Does/Escalates content, just renumbered.

**Brand names, decided 2026-10-07 — internal vs. user-facing split.** Internally (this file, `agent prompts/`, `databases/`, file names, "multi-agent system") every name below stays exactly as written — matches the existing `NN_*.md`/`NN_*.json` file-naming convention, nothing renamed on disk. **User-facing** (the vision page, the eventual Your Team screen, any future marketing), use "Manager" branding instead of "agent" — fits the Vault aesthetic's private-staff feel and the "interview them like hiring a professional" principle, where "agent" reads as generic AI-category language. The mapping:

| Internal name (docs, files) | User-facing brand name |
|---|---|
| Home Manager | House Manager |
| Relationship Manager | Relationship Manager (unchanged) |
| Personal Chef | Food Manager |
| Goals Agent | Goals and Tasks Manager |
| Personal Trainer | **Health Manager** — scope decided 2026-10-07: **personal/Matthew-level only for now** (fitness + his own doctor/dentist/etc.), not the whole family. Extending it to cover kids' health/life management is a real, deliberately unresolved question — see OPEN DECISIONS. |
| Travel & Experiences | Travel and Experiences Manager |
| Entertainment | Personal Entertainment Manager |
| Personal Chef (split 2026-10-07) | Food Manager |
| Restaurant Manager (new, 2026-10-07) | Restaurant Manager (unchanged — reads clearly as-is) |
| Family Scheduler / Childcare Coordinator | Not yet branded — revisit when built |

Apply brand names going forward in consumer-facing artifacts (`prototypes/friday_vision.html`, and the eventual Your Team screen and `team_onboarding/` pages when next touched) — not retroactively mass-edited into already-built files just for this.

### 1. Home Manager — **live, tested**
**Owns:** DB4 (Service Providers), DB5 (Household Tasks)
**Does:** Tracks every contract renewal, service provider, seasonal task, home project. Value prop, stated plainly: the house is the single biggest asset most of this target user will ever hold — this agent is "constantly think about maintaining and growing it," whether the plan is to stay forever or sell for maximum value.
**Escalates to Friday at priority 9-10 when:** Contract expires within 14 days, safety task overdue, provider flagged Need to Replace 60+ days

### 2. Entertainment — **live, tested**
**Owns:** DB15 (Media & Watchlist — movies, shows, podcasts, books, masterclasses)
**Does:** Pre-plans what to watch/read/listen to *before* the free hour arrives, not during it — Matthew's own framing: solve the "we just put the baby down, what should we watch" scroll-fatigue moment, where none of Netflix/Amazon/Apple TV's algorithms show what you actually want.
**Escalates:** Low priority — surfaces in Friday briefing as end-of-day suggestion

### 3. Personal Chef — **split into two agents, 2026-10-07, brand name Food Manager — building now**
**Owns:** DB7 (Recipes), DB8 (Kitchen Inventory) — **DB9 (Restaurant List) split off to the new agent 10, below.** Matthew's own reasoning: "Personal Chef" undersells it — this is comprehensive day/week food planning across cooking, meal-prepped leftovers, a freezer pull, delivery, takeout, *and* eating out, not just cooking. Restaurants turned out to be a genuinely different workflow (reservations, occasion/cuisine browsing) deserving its own agent, not a sub-feature.
**Does:** Weekly meal planning across every mode a household actually uses — cook, reheat, order, or go out — plus kid-specific meal logistics (breakfast/snack prepped for a preschool morning). Decides *whether* to cook or eat out; which restaurant and the booking itself belongs to agent 10.
**Escalates at 9-10 when:** No meal plan by Sunday evening, no breakfast/snack prepped for a school morning

### 10. Restaurant Manager — **new, 2026-10-07, building next, right after Food Manager**
**Owns:** DB9 (Restaurant List)
**Does:** Where to eat out, for what occasion, and the actual reservation — cuisine/occasion/service-type browsing (already partially built in `friday_restaurants.html`), plus Matthew's own stated value-add: deliberately building real depth in towns near but outside the home base (his example — he lives in Darien but rarely considers Westport one town over) by spending a session exploring and prioritizing options there, so there are real picks ready next time a date night comes up, not a blank search.
**Escalates at 9-10 when:** Booking window closing on a wanted reservation, date night overdue with no picked restaurant

### 4. Relationship Manager — **live, tested**
**Owns:** DB2 (People Profiles), DB3 (Groups & Communities)
**Does:** Birthday alerts 14 days out, neglect alerts, anniversary flags, group activity nudges. Four templates (Spouse/Partner, Kids, Friends, Family), not one flat schema.
**Escalates at 9-10 when:** Birthday/anniversary within 7 days no plan, close family not contacted 60+ days

### 5. Goals Agent — planned — **brand name Goals and Tasks Manager, scope broadened 2026-10-07**
**Owns:** Goals DB, DB12 (Life Bucket List), DB13 (Annual Calendar)
**Does:** Goal progress tracking, bucket list planning, quarterly reviews, drift alerts — **plus**, as of 2026-10-07, the catch-all for miscellaneous tasks with no natural domain owner: car maintenance/emissions, digital security lockdowns (Matthew's own examples), anything that isn't a home system (House Manager's job), a meal (Food Manager's job), or another agent's domain. Pairs directly with the already-locked but never-built Eisenhower task engine (urgency × importance, four quadrants) — this agent is the natural place for that engine to actually run.
**Escalates at 9-10 when:** Goal deadline within 60 days no progress, big rock unstarted by Q3, an urgent+important miscellaneous task (Eisenhower Q1) sits unresolved

### 6. Travel & Experiences Agent — planned
**Owns:** DB10 (Experience Ideas), DB11 (Travel Bucket List)
**Does:** Trip planning, booking window alerts, group trip coordination, local experience suggestions
**Escalates at 9-10 when:** Booking window closing on priority trip

### 7. Personal Trainer — planned — **brand name Health Manager, scope broadened 2026-10-07**
**Owns:** Health & Fitness Log DB
**Does:** Workout goal tracking, fitness plan suggestions, health check-ins — **plus**, as of 2026-10-07, the rest of personal health admin: doctor, dentist, and other appointments, not just the gym. "Health is holistic" per Matthew. **Personal/Matthew-level only for now** — deliberately not extended to Miles or the baby due in December; see OPEN DECISIONS item 7 for why that's a real open question, not just unscoped.
**Escalates at 9-10 when:** Missed workout goal 3+ consecutive weeks, a routine appointment (dentist, physical) significantly overdue

### 8. Family Scheduler / Childcare Coordinator — **new, added 2026-10-07, not yet started**
**Owns:** DB6 (Weekly Family Planner) — reassigned from Friday directly to this agent
**Does:** Knows where everyone physically is and who's covering what — preschool/school days, pickup and dropoff assignments, nanny coverage, and the conflicts created when work travel or an evening event collides with childcare. Matthew's own framing: "knowing where the bodies are" — he's gone from 6:30am to 6:30pm on a train with his brain fully on work, Georgia's coverage pattern varies by day, Miles is at preschool some days and his grandparents' some days. **Explicitly expected to get exponentially more important, not less, as more kids and more activities enter the picture** — one kid at soccer, another at an after-school program, is a different logistics problem than one toddler.
**Escalates at 9-10 when:** A coverage gap has no assigned person within 48 hours, a work trip or event creates an unresolved childcare conflict

---

### Archived — real pain points, not being built for now, not discarded

Matthew's own call: these stay visible so a future session doesn't waste time rediscovering them, but none of them get built until he says so.

- **Financial Advisor Agent** — blocked since August on the compliance-scope decision (does Friday give financial advice at all). Owns Financial Goals DB + Plaid integration.
- **Social Coordinator Agent** — the network-effect feature (DB16, Social Graph), already future/v3.0 in the original plan, unchanged.
- **Family Health Coordinator** — pediatrician visits, vaccinations, prescriptions, dental/vision, for the whole family, not just fitness.
- **Life-Stage Shopping/Provisioning** — anticipating what a growing kid or a newborn actually needs before it's a scramble (Matthew's own bed/sheets/rug/bottles example).
- **Household Staff/Vendor Management** — managing people on the household's payroll (Marilyn, a cleaner) as an ongoing relationship, distinct from a one-off contractor call.
- **Education/Schooling Coordinator** — scales up from preschool logistics into school research, applications, deadlines over the coming years.
- **Subscription/Bill Management, Home Projects/Renovation Planner, Career/Professional Development, Holidays/Occasions Logistics, Pet Care, Personal Admin/Paperwork** — all real, all judged lower-priority or likely to fold into an existing agent's scope rather than stand alone; revisit if one of them turns out to need its own agent after all.

---

## THE 16 DATA DOMAINS (internal naming reference — not real databases)

**These were never built as Notion databases and no data has ever been populated anywhere — see the correction note at the top of this file.** The table below survives only as a shared vocabulary: when another section says "Home Manager owns DB4," this is what DB4 means. Nothing in the "Status" column below implies data exists — everything is captured live, through conversation, when an agent actually needs it (Tier A/B/C fields per `agent prompts/NN_*.md`), not pre-loaded from anywhere.

| # | Data Domain | Agent Owner |
|---|----------|-------------|
| 1 | Master Profile | Friday |
| 2 | People Profiles | Relationship Manager |
| 3 | Groups & Communities | Relationship Manager |
| 4 | Service Providers | Home Manager |
| 5 | Household Tasks & Projects | Home Manager |
| 6 | Weekly Family Planner | Family Scheduler / Childcare Coordinator — **reassigned 2026-10-07**, was Friday directly |
| 7 | Recipes & Meal Ideas | Personal Chef |
| 8 | Kitchen & Pantry Inventory | Personal Chef |
| 9 | Restaurant List | Restaurant Manager — **reassigned 2026-10-07**, was Personal Chef/Food Manager |
| 10 | Experience Ideas | Travel & XP |
| 11 | Travel Bucket List | Travel & XP |
| 12 | Life Bucket List | Goals Agent |
| 13 | Annual Life Calendar | Goals Agent |
| 14 | Connections & Subscriptions | Friday |
| 15 | Media & Watchlist (movies, shows, podcasts, books, masterclasses) | Entertainment — **resolved 2026-10-07:** the 2026-08-13 scope note asking whether this should cover more than shows/movies is answered — yes. Matthew's own framing: solve "what should we watch/read/listen to tonight" so the decision is made in advance, not during the one free hour of the evening. |
| 16 | Social Graph & Connections | Social Coordinator — Future, v3.0 |

---

## THE DATA STORE, FOR REAL THIS TIME (decided 2026-09-07)

**Every prior version of "where does agent data live" was aspirational — a Notion plan that never got built.** This is the actual mechanism, decided when Matthew asked directly how storage should work mid-interview.

**The rule: one flat JSON file per agent in `databases/`, named to match its `agent prompts/NN_*.md` file** — `databases/01_home_manager.json`, `databases/02_relationship_manager.json`, and so on. An agent only ever reads and writes its own file. **Friday gets no file of its own** — its job is synthesis, so it reads across every agent's file at briefing time rather than owning a separate store. This is Matthew's own tree model, stated back to him during the Home Manager interview: each agent asks only the questions in its own schema and writes only to its own file; Friday has standing read access to all of them and is the only thing that ever needs to look across domains.

Each file carries `tier_a` / `tier_b` / `tier_c` objects matching the field tiers already defined in that agent's prompt file, so a field's home in the JSON always matches its home in the schema doc — no separate mapping to maintain. `databases/01_home_manager.json` is the first one, created live during the 2026-09-07 activation interview (see SESSION LOG) — it's the reference example for every agent file that follows it, the same way `01_home_manager.md` is the reference example for every agent prompt.

**This is explicitly a stand-in for validation, not the production design.** When a developer eventually builds the real backend, this is the shape that becomes actual database tables — one table (or collection) per agent's domain, one coordinator service with read access across all of them. Same tree Matthew described, just flat files until there's a reason to be anything more.

---

## PRODUCT FEATURES

### Life Health Score (0-100)
Five sub-scores: Relationship, Family, Health, Household, Personal
Gamification mechanic — users open the app to watch the number move

### Feed Friday
Proactive micro-prompts sent during idle time to fill database gaps
"Got 5 minutes? Tell me about 3 restaurants Georgia would love."
Core retention mechanic — makes Friday smarter over time

### Friday Briefing
Every Friday morning — 5 personalized items delivered via email or SMS
Most consistently opened feature — drives weekly active usage

### Social Graph — The Network Effect (v3.0)
Users grant other Friday users permission to coordinate
Three tiers: Connection, Calendar Access, Full Coordination
Georgia's Friday + Matthew's Friday = complete household coordination
Friends' Fridays coordinate plans without text chains
Each new user in your network makes your Friday more valuable
Structural virality — you invite friends because YOUR Friday gets better

### Notification Channels
SMS via Twilio — highest open rate, time-sensitive nudges
Email — weekly briefing, longer content
In-app — all proactive alerts visible on dashboard

---

## THE DASHBOARD — WHAT THE USER SEES

Four-panel command center:

**Left panel:** Life Health Score, navigation sidebar with all agent views
**Main panel:** Friday briefing (5-7 items), date night picks, tasks, people, goals, streaks
**Middle panel:** Email triage (Gmail integration), calendar view, shopping list
**Right panel:** Weather + commute, financial snapshot, upcoming dates, news digest, Feed Friday prompt

Design reference: Two working HTML prototypes already built
- `friday_dashboard.html` — mobile version
- `friday_desktop.html` — full 4-panel desktop version

---

## DESIGN DIRECTION

**Priority:** Front end design comes FIRST before backend build
**References:** Dribbble and Pinterest for UI inspiration
**Feel:** Monarch Money meets Calm meets high-end fintech dashboard
**NOT:** Generic productivity app, corporate, cluttered

**LOCKED — "The Vault" aesthetic (decided 2026-08-10):** Private banking / quiet luxury, not sci-fi command center. We explicitly compared two directions — "The Vault" (deep navy + brass, serif numerals, restraint) vs. "The Grid" (neon cyan/magenta HUD, Oasis/gaming feel) — and rejected the Oasis/futuristic direction because it reads as escapism, which fights Friday's actual pitch ("get better at real life," not "check out into a cooler digital one"). The target user (financial advisor, high performer, HHI $150K+) already associates navy-and-brass restraint with competence and money; neon-on-void reads as gaming to that exact audience.

**Locked palette (see `prototypes/friday_home.html` for canonical CSS variables):**
- `--navy: #0F1830` (page ground) · `--navy-surface: #182A4E` (cards) · `--navy-surface-2: #1D3157` (nested/hover)
- `--cream: #F1EBDD` (primary text on navy) · `--mute: #93A2BE` / `--mute-dim: #6D7C9C` (secondary text)
- `--brass: #C4A063` (the one accent — used for numbers, active states, CTAs, urgency-adjacent highlights)
- `--rust: #C97A6B` (the only other color — reserved for true urgency, used sparingly)
- Hairline `--line` dividers instead of heavy borders/shadows. No gradients-as-decoration, no emoji as section markers — restraint is the point.

**Type:** Playfair Display (serif, headlines/numerals — evokes a ledger, not a SaaS app) + Inter (body/UI). Both loaded via Google Fonts `@import` in each prototype file.

When searching for design inspiration use these Dribbble search terms:
- "personal dashboard UI"
- "life management app"  
- "AI assistant interface"
- "health score dashboard"
- "dark navy app design"
- "private banking UI"

---

## INFORMATION ARCHITECTURE — LOCKED DECISIONS (2026-08-10/11)

**Home vs. Dashboard split.** The original single dense "Main Dashboard" felt too busy. Resolved into two screens:
- **Home** — the new front door. Claude/Google-style: centered greeting, one input ("What do you need?"), 3 suggestion chips (Show me today / Help me plan / Teach you something), and a max-4-item "On Your Radar" feed. Each feed item is attributed to its source agent (small brass byline — "Home Manager," "Personal Trainer," etc.) so the multi-agent nature is legible without a separate org-chart page. The master coordinator (Friday) decides what's worth surfacing — no forced one-item-per-agent roll call, 3-5 items max, trust Friday's filtering.
- **Dashboard** — the deeper "life database" browse view (calendar, tasks, people, financial, restaurants, goals, streaks, inbox, reading digest). Density is fine here since browsing-everything is its job. Opens with a **"Friday's Take" summary banner** — a natural-language TL;DR paragraph synthesizing the page (commute, top task, inbox count, financial reminder) so you don't have to read every tile to get the gist. This banner pattern should extend to other dense pages going forward (People, Your Team, etc.), not just Dashboard.

**The Eisenhower task engine.** Every task Friday ingests gets scored on two axes — urgency (deadline proximity) and importance (impact if dropped) — at the moment it's created, not just for display. Four quadrants: Urgent+Important (interrupts you), Important-not-urgent (nudges in the briefing), Urgent-not-important (handled quietly), neither (backlog, doesn't compete for attention). Dashboard shows this as a compact 2x2 with only Q1 items listed by name; the rest collapse to counts.

**Privacy boundary — permanent, not a v1 limitation:** Friday never connects to a work email inbox or work calendar, ever. Only personal/family calendars (Personal, Family, Miles' childcare) and personal email. This isn't just scope discipline — it keeps Friday's data footprint entirely outside anything Rockefeller compliance could ever ask about, reinforcing the existing non-disclosure constraint below.

**Reading Digest, not generic news.** The dashboard's news section pulls specifically from Matthew's actual subscriptions (WSJ, The Economist, Barron's, Substacks) — a personalized Morning-Brew-style synthesis, not invented generic headlines.

**Commute shows a real comparison,** not just a train time — next train departure vs. drive time, so Friday answers "how do I get to work today," not just "here's a schedule."

---

## BUILD PLAN & TIMELINE

> ⚠️ **This section is partly superseded as of 2026-08-14.** The five-item list and timeline below predate the strategic review — see STRATEGIC REVIEW and IMMEDIATE NEXT ACTIONS for the current sequence. Specifically: item 1 is expected to *shrink*, not finish, and is now driven by what the agent prompts actually reference (PHASE 4 Pass 2); item 2 has been promoted to the top of the list and is the current workstream; item 3 is paused at 41 files; item 4 should deliberately **not** happen yet. The Sept-2026 hire date is also stale — the review recommends hiring post-CFP (December) and capping at **$12–18K**, not the $18–45K below. **Cost estimates and launch sequence further down remain useful; the checklist and timeline do not.**

**Current phase (stale — see warning above):** Pre-developer. Designing front end, testing agent prompts, building developer brief.

**What needs to happen before hiring a developer (stale ordering, and item 1 additionally describes a Notion plan that was never built — see correction note at top of file):**
1. ~~Finish all 16 databases in Notion with complete field definitions~~ — no Notion database ever existed; superseded by the agent-derived schema in PHASE 4
2. Test first 3 agent prompts (Home Manager, Relationship Manager, Personal Chef) via live interview, not "real Notion data"
3. Build all 20 UI screens as HTML prototypes
4. Write complete developer brief combining everything
5. Post job on Upwork — search "Bubble developer AI integration Claude API"

**Timeline:**
- August 2026: Finish databases, test agent prompts
- September 2026: Developer brief complete, job posted, developer hired
- October–November 2026: Build phase + CFP exam November
- February 2027: Working web app
- April 2027: iOS app, beta launch

**Cost estimates:**
- Offshore/AI-native developer: $18,000–$28,000
- Standard offshore team: $30,000–$45,000
- US agency: $80,000–$120,000 (not recommended for v1)
- Monthly operating cost post-launch: ~$1,800–$2,100

**Launch sequence:**
- v1.0: Friday + Home Manager + Relationship Manager
- v1.1: Add Personal Chef
- v1.2: Add Goals Agent
- v2.0: Personal Trainer + Financial Advisor
- v3.0: Social Coordinator + network graph

---

## INTEGRATION RESEARCH — 2026-08-11

Researched real third-party API landscape before assuming feasibility. Key findings that affect backend planning (Phase 5 of the predeveloper checklist):

- **Amazon:** no API exists for a third party to place an order on a user's behalf. Product Advertising API is read-only; the "Add to Cart" mechanism hands off to Amazon's own site for the user to complete checkout. **Design implication:** Friday builds the cart and hands the user a one-tap link — it doesn't execute the purchase. This is actually consistent with the Draft-then-Approve model already decided, not a compromise.
- **Fitness trackers:** Whoop and Strava have workable self-serve APIs. Fitbit's API is now effectively Google's Health API (Google owns Fitbit). **Garmin's Health API is not self-serve and, as of now, new partner sign-ups are on hold with no published reopen date** — a real current blocker, flag before committing to Garmin specifically. **Recommended approach: integrate via Terra API** (tryterra.co), which unifies Garmin/Fitbit/Apple Health/Oura/Whoop/Strava behind one consistent integration instead of building/maintaining six separately.
- **Entertainment (IMDb/Rotten Tomatoes):** neither has a good free public API. Not needed — Claude with web search (already the planned mechanism for the News agent) covers "what should I watch" without a dedicated integration.
- **Venmo:** same limitation as Amazon — no third-party "pay on my behalf" API. Realistic version: Friday reminds you with a link, doesn't execute the payment.
- **Confirmed working as already planned:** Plaid (financial, powers 7,000+ apps including Venmo/Robinhood/Coinbase — validates the existing Financial Snapshot design), Instacart (grocery, already scoped in `friday_v2_plan.docx`).
- **Other easy, low-friction additions worth having on the roadmap:** weather (NWS or OpenWeather, free, no user auth needed), Google Maps Distance Matrix (powers the train-vs-drive comparison already built into Calendar), **RSS feeds — the easiest integration on this entire list**, no API key/approval/cost, open standard most publishers (WSJ, NYT, Economist, Substacks) already support. This is the real backend for the News page's headline+link-out design as already built, nothing to change there.

## THE AGENT TEMPLATE (Reusable Framework)

Every new agent follows this structure. Fill this out to spec a new agent:

1. **Identity:** Name, one-line role, persona, scope, who needs this
2. **Databases owned:** Primary, secondary inputs, external APIs
3. **Onboarding prompts:** 4-6 setup questions, Feed Friday prompts, auto-logged fields
4. **What it does:** Proactive alerts, on-demand queries, execution actions
5. **Output to Friday:** JSON format, escalation rules (9-10 priority triggers), run frequency
6. **System prompt:** Core instruction, tone, constraints
7. **Build complexity:** Databases required, integrations, dev effort estimate

This template means any new agent — Personal Doctor, Career Manager, Pet Care — is specced by filling out this template and handed to a developer. The infrastructure already exists.

---

## DOCUMENTS IN THIS PROJECT FOLDER

| File | Contents |
|------|----------|
| `CLAUDE.md` | This file — read every session |
| `documents/friday_agent_framework.docx` | Full multi-agent architecture + 5 agents built out + agent template |
| `documents/friday_database_schemas.docx` | **Historical only — the abandoned early Notion-database exercise.** All 16 databases with every field, data type, and why Friday needs it, as originally conceived. None of it was ever built in Notion or anywhere else; superseded by the agent-derived schema approach in PHASE 4 (schema comes from interrogating the agent, not from this doc). Kept for the DB-number vocabulary and field-reasoning it recorded, not as a source of live data. |
| `documents/friday_predeveloper_checklist.docx` | Complete pre-developer to-do list — **original screen list is stale, SCREEN BUILD STATUS below is the authoritative current list (18 of 20 desktop app screens done, all 13 onboarding screens done)** |
| `documents/friday_v2_plan.docx` | Full product vision, roadmap, financial model |
| `documents/friday_master_plan.docx` | **Read 2026-08-14 (first time).** February 2026 business plan + build roadmap. Contains the abandoned Stage 1 validation plan — see STRATEGIC REVIEW finding 2. §9's model recommendation ("Claude Sonnet 4") is stale; fix before developer handoff |
| `documents/autonomous_business_playbook.docx` | **Read 2026-08-14 (first time).** February 2026. Generic $2.5K/month autonomous-business playbook. Its "stay out of legal, financial, or medical advice" rule is one of the three documents in the Financial Advisor conflict |
| `documents/holistic_review_2026-08-14.md` | Full strategic audit (Opus, 2026-08-14) — state of the project, integration classification per screen, sequencing, blind spots, 14-item punch list. Condensed into STRATEGIC REVIEW below; **this file is the detail, CLAUDE.md is authoritative for decisions** |
| `agent prompts/_STATUS.md` | **Phase 4 checklist — authoritative for agent-build progress.** Has a RESUME HERE block at the top |
| `agent prompts/_WORKFLOW.md` | The repeatable 5-pass procedure, run once per agent. Copy-paste prompts, session batching, file conventions, model notes for the brief |
| `agent prompts/NN_*.md` | One file per agent, 8 parts each. Currently `01_home_manager.md`, `02_relationship_manager.md`, `08_entertainment.md` exist |
| `agent prompts/_QUESTION_BANK.md` | **New 2026-10-07, at Matthew's request.** A fast-scan index of every interview question across every agent, pulled from each agent's own Part 6 — not a separate source of truth, a mirror kept in sync with it. Built so Matthew can review/fine-tune question wording without opening three multi-part files. |
| `databases/NN_*.json` | **The real data store — see THE DATA STORE, FOR REAL THIS TIME.** One flat JSON file per agent, `tier_a`/`tier_b`/`tier_c` fields matching that agent's prompt file. Not Notion, not a real database — a stand-in until a developer builds one. Currently only `01_home_manager.json` exists, created 2026-09-07 |
| `databases/NN_*_status.html` | **A generated read-only view of the matching `.json` file** — Tier A/B/C completion bars, the Standing Provider Checklist diffed against known providers, known problems, open data gaps. Not a live server and not fetched dynamically (data is embedded at generation time); Claude Code regenerates it whenever the underlying JSON changes. Deliberately kept out of `prototypes/` — this renders real data, not invented mockup content, so it isn't counted against the paused Phase 3 screen total. Currently only `01_home_manager_status.html` exists, created 2026-09-07 |
| `team_onboarding/NN_*.html` | **New folder, decided 2026-09-07.** The in-app view for "click an agent in Your Team → see its setup." One file per agent, question-by-question, organized by Tier A/B/C, pulling question text from `agent prompts/NN_*.md` Part 6 and current answers from `databases/NN_*.json`. Distinct from `databases/NN_*_status.html` (which is organized around findings/problems) — this one is organized around the interview itself, literally the question next to its answer or its pending state. **Not a live form** — there's no backend to submit through yet, so answering still happens in conversation; this page is regenerated after. Also distinct from the top-level `onboarding/` folder, which is reserved for the master, first-time Friday onboarding (still the Phase 3 static version, not rebuilt) — per-agent setup and the one-time app-level onboarding are two different things and shouldn't share a folder. Currently only `01_home_manager.html` exists |
| ~~`Restaurant_List_v2.csv`~~ | **No longer on disk as of 2026-08-13.** There is no Notion to have imported it into (see correction note at top of file) — it was simply removed or never kept. Don't assume it exists; ask Matthew if it's needed again |
| `documents/*.docx` (all 6 files above) | **None of these are plain-text/markdown — a raw file-read tool (including Claude Code's own `Read`) cannot parse `.docx` and will error.** Claude.ai/Desktop's upload/attach feature extracts text from `.docx` server-side and works fine; a local coding-agent tool generally does not. Convert to `.md`/`.txt` first if you need a coding agent to read them directly |
| `prototypes/*.html` | **25 current desktop app screens** (27 files in the folder — 2 are `friday_dashboard.html`/`friday_desktop.html`, superseded pre-Vault versions kept for reference only) — 24 in the cross-linked authenticated app shell, plus `friday_landing.html` (pre-login public marketing page, deliberately outside that cross-linking) — full list with descriptions is in SCREEN BUILD STATUS below, not duplicated here to avoid two lists drifting out of sync |
| `mobile/*.html` | **Mobile counterparts of `prototypes/` screens — same filename, different folder, see the `mobile/` note below.** Currently 1 of 24 shell screens: `friday_life_dashboard.html`. The gap is the real mobile-build backlog |
| `prototypes/friday_dashboard.html` | Superseded — pre-Vault "mobile" attempt, kept for reference only, not part of the current app |
| `prototypes/friday_desktop.html` | Superseded — pre-Vault 4-panel dashboard, kept for reference only, not part of the current app |
| `prototypes/friday_vision.html` | **New 2026-10-07.** Private vision/roadmap page — what Friday is, why multi-agent, real proof points pulled from Home Manager's and Relationship Manager's actual findings, and the build roadmap. Deliberately not deployed to the live domain (see OPEN DECISIONS item 6) and not cross-linked into the authenticated app shell — standalone, like `friday_landing.html`, but roadmap-focused rather than marketing-focused. |
| `onboarding/*.html` | **13 onboarding screens**, own folder, sibling to `prototypes/` — see SCREEN BUILD STATUS and `onboarding/onboarding_plan.md` |

---

## SCREEN BUILD STATUS (2026-08-13)

The predeveloper checklist's original "20 screens" concept has grown to **41 actual HTML files**: 25 current desktop screens in `prototypes/` (27 files there total — 2 are superseded legacy) + 1 in the new `mobile/` folder + 13 onboarding screens in `onboarding/` (some, like Agent Detail, Restaurant Detail, Family Activities, Finances, and Media, weren't on the original 20-screen list at all — they emerged from later decisions). **Of the 20 originally-scoped desktop app screens, 18 are done; the onboarding set (13 files) is fully done; 2 desktop screens remain: Feed Friday Session, Login/Sign Up.** Family Activities, Finances, and Media are net-new "Life" section additions beyond the original 20, all requested by Matthew after reviewing earlier builds — not counted against the remaining-2 list. `mobile/` is a separate, newer backlog (1 of 24 shell screens done) tracked in its own note below, not folded into the desktop remaining-count either. Key structural changes from the original list: **Home** (new front door, was implicit in "Main Dashboard") and **Your Team** (agent roster/staff page) were added; "Main Dashboard" split into Home + Dashboard, see IA section above.

**Weekly Planner built — 2026-08-13:** `prototypes/friday_weekly_planner.html`. Closes the dead CTA on Calendar's Sunday "Family Planning Session" entry (now links here via "Open this week's plan →", same fix pattern as Date Night Planner closed three dead CTAs on 2026-08-11). Framed as **Friday's pre-drafted plan for Sunday's session**, not a blank planning form — reinforces the draft-then-approve model already locked for Email: Friday assembles the whole week (meals, childcare, tasks, calendar) ahead of time, Matthew and Georgia review/adjust together Sunday at 4pm, then lock it in. Demonstrates cross-database cohesion explicitly — one page pulls from Personal Chef (7-day meal plan, Fri = no-cook/order-in, Sat = links out to the already-booked Date Night pick), childcare coverage (Marilyn weekdays, Georgia half-days, Claire & Eddy Saturday), Household Tasks (top 3 pulled from the existing Eisenhower Q1/Q2 data on `friday_tasks.html`, with a "See all tasks →" link out rather than duplicating the full quadrant view), and Calendar highlights for the week ahead. Has a stat-row summary (dinners drafted, childcare days covered, tasks flagged, calendar events) and ends with the same approve-gate pattern as elsewhere: "Looks Good — Lock In the Week" / "Adjust With Georgia Sunday" — nothing auto-commits. **Sidebar nav updated on all 20 existing app screens** (inserted after Tasks, before Email, in the Main group) to include the new "Weekly Planner" link — same full cross-link discipline used for every previous screen addition (Email/News, Life Score/Notifications, Date Night all got this same treatment).

**Weekly Planner refined — 2026-08-13, same session:** Matthew reviewed the first pass and asked for research into what real family/couple planning meetings cover, plus explicit gaps he wanted closed. Researched three angles — general family meeting templates, Cameron Herold/Jim Sheils' "Family Board Meeting" (kid-inclusive, ends every meeting on a fun activity), and couples/marriage weekly-planning-meeting structures (calendar sync, chore division, brief money check-in). Findings converged on one real gap: **childcare coverage needs to answer "who's driving to what and picking up by when," not just "who has the kid today"** — that pattern scales from Miles' age today (music class, Little Gym, a birthday party — each with drop-off/pick-up named separately) up through school-age soccer practice and pickups later, per Matthew's explicit "5-to-10-year-old" framing of the target user. Shipped three of the four researched additions (Matthew's picks): **(1)** Section renamed "Kids' Activities & Coverage," expanded with a dated activity list (time, activity, location, drop-off/pick-up owner) below the existing 7-day coverage grid — the grid answers daily custody, the list answers specific logistics. **(2)** "This Week's Family Activity" section — one planned fun thing (Farmers Market + playground), closing the page before the note box and lock-in, matching the Family Board Meeting model of ending on something positive; deliberately distinct from Date Night (couple-only) since this one is family-inclusive. **(3)** Real print/export: a 🖨 "Print for the Fridge" button (top-right of page-head) calling `window.print()`, backed by a `@media print` block that **redefines the `:root` CSS custom properties to a light/ink-friendly palette** rather than hand-overriding every element — since every component already consumes the same handful of tokens, swapping them at the media-query level was enough to relabel the whole page for print with almost no per-component print CSS. Also hides sidebar/topbar/interactive-only elements (grocery button, note input, action row) in print and shows a print-only masthead ("Friday — Week of August 17–23 · The Gruseke Household") that's invisible on screen. **Declined for now:** a money check-in line pulled from Financial Advisor — that agent is scoped for v2.0 per the launch sequence, so adding it to a v1.0-priority screen would run ahead of the roadmap; Matthew's call to skip it, flag if priorities shift. **Pattern worth reusing elsewhere:** the print-via-token-swap technique (redefine `:root` inside `@media print`, change nothing else) is cheap enough that other dense screens (Dashboard, Tasks) could get a real print view the same way if a "physical copy" need comes up there too.

**Family Activities built — 2026-08-13, same session:** `prototypes/friday_family_activities.html`, new "Life" nav item (inserted between Restaurants and Travel & Trips on all 21 existing app screens, same full cross-link discipline as every prior addition). Matthew's ask: a browsable idea list for "what do I do with Miles for two hours on a Saturday" up through "once-a-month bigger day trip," explicitly modeled on Date Night/Travel as a thing to plan or pull ideas from, with an easy add-to-calendar action per idea. **Structurally this is Travel & Trips' pattern reapplied at a shorter radius** — same "organize by time commitment first, type is a filter tag, not a section" IA decision from `friday_travel.html` (locked 2026-08-11), reused directly: **Quick & Local (under 2 hrs)** → Pear Tree Point Beach, Darien Farmers Market, Library Story Time; **Local Outing (half day)** → Maritime Aquarium (Norwalk), Stamford Museum & Nature Center, Harbor Point, a backup movie; **Day Trip (once a month)** → AMNH, Bronx Zoo, Liberty Science Center, Mystic Aquarium — all real Fairfield County / NYC-area places, not invented ones, reflecting Matthew's own examples. Tags are working multi-select filters (real JS, same pattern as Travel's tag-chip toggle and Calendar's chip filter) across Outdoor / Indoor / Animals / Museum / Playground / Movie — the Indoor/Outdoor split was a deliberate addition beyond what Matthew listed, since "it's raining, what do we do" is a real decision moment this page should answer directly. Each card has a static "+ Add to Calendar" button (same non-functional-but-establishes-the-pattern treatment as Restaurant's "Book via OpenTable"/"Order via Uber Eats" buttons — real wiring is a backend concern, not a prototype one). Friday's Take banner demonstrates the intended smart-suggestion behavior (weather-aware: rain Saturday → surfaces the indoor pick). **Cross-linked from Weekly Planner:** the "This Week's Family Activity" card built earlier this session now has a "See more ideas →" link into this page, closing the loop between the two features built in the same sitting.

**Done, in Vault aesthetic, wired together with real links — the entire "Main" nav section is complete (now 8 items):**
- Home — `prototypes/friday_home.html`
- Dashboard — `prototypes/friday_life_dashboard.html`
- Your Team — `prototypes/friday_your_team.html` (roster of all 9 agents; Home Manager is the one wired detail example, `prototypes/friday_agent_detail.html`)
- Calendar — `prototypes/friday_calendar.html` (merged Personal/Family/Miles-Childcare, filter chips, no work calendar option at all — not even disabled). **Has real working JS filtering** (click a chip, matching events show/hide) — proof this kind of interactivity is cheap frontend logic, not backend work.
- Tasks — `prototypes/friday_tasks.html` (full 2x2 Eisenhower quadrant view, not just the Dashboard's compact summary)
- Weekly Planner — `prototypes/friday_weekly_planner.html` (**new 2026-08-13**) — see dedicated entry below
- Email — `prototypes/friday_email.html` (**new 2026-08-11**) — merges 4 personal accounts (Personal, Joint w/ Georgia, Shopping, Crypto), working filter chips, same permanent no-work-inbox rule restated on-page. Real accounts Matthew described, not invented ones.
- News — `prototypes/friday_news.html` (**new 2026-08-11**) — subscriptions/newsletters feed (WSJ, Economist, NYT, Markets bucket for CNBC/ZeroHedge/Business Insider, Newsletters), working filter chips. **Deliberately headline+summary+link-out only, never full paywalled text** — see PAYWALL/NEWS ARCHITECTURE note below, this is a permanent design constraint, not a v1 limitation.
- People & Relationships — `prototypes/friday_people.html`
- Person Detail (Georgia, representative example) — `prototypes/friday_person_detail.html`
- Health — `prototypes/friday_health.html` (**new 2026-08-11**)
- Fitness — `prototypes/friday_fitness.html` (**new 2026-08-11**)
- Travel & Trips — `prototypes/friday_travel.html` (**new 2026-08-11**, working tag filter)

**Settings & Connections built — 2026-08-11:** `prototypes/friday_settings.html`. Reachable via the avatar icon in the top bar (not a sidebar nav item — matches how real apps place settings) — now wired on all 20 app screens, plus a Settings entry added to the bottom of every sidebar too. Sections: Profile, Notifications (including a real quiet-hours window implementing the "don't interrupt me at work" rule from onboarding), **Your Team agent toggles** (real switches, on/off, solves the "reactivate an agent you skipped at onboarding" gap — reuses the Choose-Your-Focus concept but as ongoing control, not a one-time choice), Connections (Plaid, fitness trackers, calendar, OpenTable, Uber Eats — connect/connected status), Household access (Georgia, referencing the three-tier Connection/Calendar Access/Full Coordination model already in `friday_v2_plan.docx`), and Privacy (restates the permanent no-work-email and draft-then-approve rules as visible, user-facing trust signals, not just internal rules).

**"Life" section status:** complete — People, Date Night, Restaurants, Family Activities, Travel & Trips, Goals & Progress, Finances, Media, Health, Fitness all done. Newest additions (2026-08-11 unless noted):
- Restaurants — `prototypes/friday_restaurants.html`. Cuisine tags (13-item starter list: Breakfast/Italian/Mexican/Chinese/Poke/Sushi/Indian/Ramen/Greek/Bakeries/Thai/Salads/BBQ — extensible, not exhaustive), plus Occasion (Date Night/Casual) and Service (Dine-in/Delivery/Takeout) filters, all working. Card-per-restaurant pattern deliberately mirrors People's card system, per Matthew's explicit request. Booking/ordering buttons ("Book via OpenTable", "Order via Uber Eats") follow the same connect-style pattern as Plaid/Fitness trackers.
- Restaurant Detail — `prototypes/friday_restaurant_detail.html` (Roots Prime, the one wired example, same "only one gets full depth" pattern as Georgia/Home Manager). Has a **working post-visit check-in widget** — rate 1-10, add a note, submit — demonstrating the flywheel concept Matthew described: after a date night happens, Friday prompts for a rating/notes, which sharpens future suggestions. This pattern (prompt for feedback after a logged event) should be reused anywhere Friday needs to close the loop on an action it recommended.
- Goals & Progress — `prototypes/friday_goals.html`. Three sections: Active Goals (the 5 goals already established on Dashboard, now with full progress + "why it matters" context), 2026 Big Rocks (Andrew's wedding Sept, CFP exam Nov — from the annual calendar concept in DB13), Life Bucket List (someday items, DB12). Built from already-established data since Matthew didn't specify new requirements here — flag to him if the structure needs adjusting.

**Onboarding — complete, 13 screens in `Friday/onboarding/` (final revision 2026-08-11):** `00_intro` → `00b_choose_focus` (agent-selection, benefit-phrased checkboxes, all on by default) → `01_who_you_are` → `01b_why_here` → `02_people` (Relationship Manager) → `03_big_rocks` (Goals Agent) → `04_home` (Home Manager) → `05_preferences` (Personal Chef) → `05b_trainer` → `05c_travel` → `05d_entertainment` → `05e_financial` → `06_complete`. No sidebar/topbar app-shell on any of these — deliberate, there's no account/data yet to navigate to. Every question screen from `02_people` onward carries a "For your [Agent Name]" label and a "[Agent] · one of your selected agents" footer instead of a generic step number — ties each question visibly back to what the user chose on Choose Focus. Each has a real textarea + mic-optional input, a "That's my answer" submit revealing a pre-written Friday reflection (the live-adaptive-reflection principle from the plan doc), a Continue button, and a Skip link. Complete references the Why Here answer directly and lists items across all agents actually asked, then hands off to `../prototypes/friday_home.html` (relative path — `onboarding/` and `prototypes/` are sibling folders). **Known, accepted limitation:** true conditional skipping based on Choose Focus selections isn't implemented — the file chain is linear regardless of which agents were checked. That's a real spec note for the developer build, not something to fake in static HTML. Fast/deep query param from Step 0 also doesn't yet branch content — same category of gap, noted not fixed.

**New folder — `onboarding/`, decided 2026-08-11:** Onboarding gets its own folder alongside `prototypes/`, not mixed in with it — Matthew's call, since onboarding is a one-time-per-user experience that deserves its own space to plan and iterate. `onboarding/onboarding_plan.md` is the working content/UX spec (questions, what each step captures, screen shape) — separate from this file, which is Claude Code's cross-session context. Read that file before building any onboarding screens. Key design constraint it captures: onboarding is **conversational, not a form wizard** (per `friday_v2_plan.docx` section 4.1 — "users never fill out a form, they talk") — screens should show Friday asking a question in her voice, an open-ended response area, and a visible "here's what I got" confirmation, not labeled input fields.

**Restaurant name note:** Matthew dictated a second Darien restaurant as "or molo" — rendered as **"Molo"** on the assumption dictation may have garbled the real name. Confirm/correct if wrong.

**Health/Fitness split and Travel/Hobbies structure — decided 2026-08-11:**
- **"Health & Fitness" is now two separate screens**, not one. `friday_health.html` = a provider-cadence tracker (PCP, dentist, dermatologist, eye doctor, therapist — last visit, recommended interval, next due), structurally identical to Home Manager's service-provider pattern, just for medical care. Scoped to Matthew only — Miles' pediatric visits live on his Person Detail, Loki's vet is under Service Providers, don't duplicate. `friday_fitness.html` = a **connection-first** page (Apple Health / Garmin / Fitbit / Whoop), same pattern as the Financial Snapshot's Plaid connection — Friday pulls a lightweight summary from whichever tracker the user already uses, it never tries to compete with or replace it. This affects the Health & Fitness Log DB conceptually too — expect it to eventually split into a care-providers table and a synced-activity-summary table, not stay one undifferentiated log.
- **Travel & Trips keeps hobby-driven travel (golf, skiing, hiking, etc.) nested inside it via flexible tags, not a separate "Hobbies" nav item.** This matches DB11 in `friday_database_schemas.docx`, which already lists golf/ski/romantic/family trips as categories within the travel bucket list — the tags aren't hardcoded to Matthew's golf/ski interests, they're user-defined so it scales to any hobby set. The page organizes primarily by **timeframe** (Day Trip / Long Weekend / Week+ / Someday-Discovery), with tags as filters within that — reusing the same chip-filter interaction pattern already built for Calendar/Email/News, not inventing a new one.

**Cross-database cohesion — core architecture principle, decided 2026-08-11:** any time Friday drafts or acts on something, it should pull the *full* relevant context from every database that touches it, not just the triggering item. Concrete example locked into `friday_email.html`: the Lawn Care of Darien draft reply doesn't just answer the invoice email — it also raises the gutters (from Home Manager's urgent flag, unrelated to this email thread) and proactively asks to schedule the next mowing cycle (from the provider's recurring service cadence in DB4/DB5). One outbound message bundling three things, instead of three separate emails over the following month. This is the actual payoff of one shared data model instead of nine siloed agents — apply this same instinct anywhere Friday drafts a message, schedules something, or takes an action: always check what else is known about that person/provider/entity before generating the output, don't just respond to the immediate trigger in isolation.

**Draft-then-approve permission model — decided 2026-08-11:** Friday can draft things (email replies) and capture things (tasks from emails) proactively, but never sends anything without an explicit human approval step. On `friday_email.html`, actionable emails get up to two buttons: "Draft Response" (reveals Friday's drafted reply inline, with Send/Discard — nothing sends until Send is clicked) and "Add to Task" (one-tap capture into the Eisenhower system, no approval gate needed since it's just adding to a list, not pushing anything external). This is the core trust mechanic for "Friday as the hub" — she pushes drafts up to Matthew, he approves, then it goes out. Also decided: routine/confirmation emails (appointment confirmations, shipping notices, statements) get **no action buttons at all** — only email that genuinely needs a response or a task gets buttons. Noise filtering happens before an email is even surfaced, not by cluttering every item with buttons nobody needs.

**Paywall/news architecture — permanent constraint, decided 2026-08-11:** Friday will never pull full paywalled article text from subscription sites (NYT/WSJ/Economist) via scraping or credential reuse. This isn't a technical gap — publishers deliberately don't offer this (engagement/ad revenue, licensing chains, access-control liability), and scraping around it violates ToS with real legal exposure once this is a product sold to other users, not just personal use. The real, legitimate architecture: (1) newsletter emails already landing in the inbox — no paywall involved, just email; (2) public RSS/headline feeds — headline + summary, link out to read on the publisher's own site; (3) Claude with web search for general relevant news. Don't scope future work around bypassing paywalls.

**Life Health Score detail + Notifications Center built — 2026-08-11:** `prototypes/friday_life_score.html` and `prototypes/friday_notifications.html`. Built specifically to close the most visible click-through gap in the whole product — the score badge and notification bell appear on *every single screen* but neither did anything when clicked, which is worse than a missing nav item since it looks broken rather than absent. Now wired as real links on all 20 app screens (top bar icons + new sidebar nav entries). Life Health Score breaks down each of the 5 sub-scores with what's driving it (real established facts, e.g. Household's 38 traces to gutters/HVAC/unpaid invoices) and one concrete fastest-fix action per score. Notifications Center consolidates alerts already established across the app (grouped by day, unread state) and explicitly reinforces the quiet-hours rule from Settings ("nothing but true emergencies gets through during work").

**Date Night Planner built — 2026-08-11:** `prototypes/friday_date_night.html`. Structured as one fully-assembled recommendation ("This Week's Pick": Georgia, Saturday 7:30pm, The Whelk, ready to book) rather than another list to browse — matches the "demonstrate, don't make them decide" pattern used elsewhere. Pulls real data already established: The Whelk from Saturday's open Calendar slot, alternatives from the Restaurants page's Date Night-tagged entries, history from Georgia's Person Detail visit log. Closed three previously-dead CTAs that pointed nowhere: Home's "Plan it →" feed item, Dashboard's "Date Night Picks" card link, and Calendar's suggested-Saturday "Book it →" — all three now link here. Added as a persistent sidebar nav item across all 20 app screens too, not just reachable via those three contextual entry points.

**Landing Page built — 2026-08-13, later same session:** `prototypes/friday_landing.html`. Matthew's ask: use Monarch Money's marketing site (monarch.com, he's a real user of it) as the structural reference — fetched and mapped its actual layout before building, not built from assumption. Reused Monarch's structure directly: sticky nav (Features / For Couples / For Professionals / Pricing / Download + Sign In / Sign Up), a promo banner, a short-punchy hero (headline = the existing "5 minutes to save 5 hours" tagline, not a new one), a 4-tab pillar switcher (**Household / Relationships / Family / You** — a deliberate remap of the 9 agents into Monarch's "Track/Budget/Collaborate/Plan" pattern), then alternating left-right feature sections each with a headline and a stylized "screenshot" — built as real inline HTML/CSS mini-previews reusing existing component styles (score bars, meal-item rows, the Eisenhower quadrant, activity cards) inside a `.preview-frame` browser-chrome wrapper, not actual screenshots or external images, so the file stays self-contained. Five feature sections shown: Life Health Score, Weekly Planner, Tasks, Family Activities/Date Night. Pricing section uses the real locked numbers ($19.99/mo, $149/yr, 7-day trial) — did not invent Monarch-style multi-tier core/advanced pricing since that's a real product decision Matthew hasn't made, not a wireframe detail; flag to him if he wants to revisit tiering later. **Three deliberate honesty departures from a literal Monarch copy**, all because Friday is pre-launch: (1) Testimonials section is explicitly labeled a placeholder ("Reserved for beta feedback," bracketed placeholder quotes) instead of fabricated reviews — inventing fake customer quotes would be actual dishonest marketing content, not a harmless wireframe choice. (2) Skipped Monarch's press-logo section entirely rather than implying coverage from real outlets that never covered Friday. (3) Footer social icons (X/IG/TikTok) are inert placeholders, since those handles aren't reserved yet (see deferred todo item) — no invented social URLs. App Store/Google Play footer badges are labeled "Coming April 2027" against the real timeline rather than pretending the app is downloadable today. "For Couples" and "For Professionals" nav items are static placeholders — Monarch has full dedicated pages behind those, Friday doesn't yet; that's a real gap for whoever builds this next, not an oversight. **Deliberately not wired into the app-shell sidebar** used by all other 22 screens — this is a pre-login public marketing page, structurally a third page type alongside "app" (`prototypes/`, authenticated shell) and "onboarding" (`onboarding/`, no shell); it belongs with the other two by folder but doesn't participate in their cross-linking.

**Mobile Dashboard built — 2026-08-13, later same session:** now `mobile/friday_life_dashboard.html` (see folder restructure note directly below — originally built as `prototypes/friday_mobile_dashboard.html`, moved same session). This is a true single-column responsive condensation of the desktop Dashboard's two-column layout, not a new page — same content, same data, reflowed for a phone. Key decisions: **(1)** The 232px sidebar can't survive at phone width, so it's replaced with a fixed bottom nav (Home / Dashboard / Tasks / Calendar / More) using the same dot-indicator active-state language as the desktop sidebar, not a new icon system — restraint carries over. **(2)** The other ~18 nav destinations (everything besides those 4) live behind "More," which slides up a bottom sheet grouped by the same Main/Life/Settings categories as the desktop sidebar — real working JS (tap More → sheet slides up over a backdrop, tap backdrop to dismiss), not a static mockup. **(3)** Tasks' 2×2 quadrant grid doesn't survive at ~360px of usable width either — it's stacked into 4 full-width rows instead of a grid, same content. Everything else that was already single-column on desktop (agenda, people row, date night list, goals, streaks, financial, inbox, reading digest) carried over basically unchanged, in the same left-column-then-right-column priority order, just fully stacked instead of two columns. **Presentation choice:** the page centers a phone-width (420px) framed "device shell" with rounded corners and a shadow so it reads as a mobile preview immediately when Matthew opens it in a desktop browser, but the frame drops to true edge-to-edge full-width below a 460px viewport — so it also behaves correctly if actually opened on a real phone. A small "Mobile Dashboard — phone-width preview" label sits above the frame (hidden on real mobile viewports) to make clear this is a device preview, not part of the in-app UI. **Known, accepted limitation, same category as onboarding's noted gaps:** this is one representative mobile screen demonstrating the responsive pattern, not a mobile version of all 22 screens — every link out of it (Home, Tasks, Calendar, and everything in the More sheet) currently lands on the desktop-layout version of that page in `prototypes/`, via `../prototypes/` relative paths. Building mobile-responsive versions of the rest is real future work, not something to fake here. **Not part of the sidebar cross-linking system** (same reasoning as the Landing Page) since it isn't a new nav destination — it's an alternate viewport rendering of the existing Dashboard page.

**New folder — `mobile/`, decided 2026-08-13:** Sibling to `prototypes/` and `onboarding/`, same rationale as onboarding getting its own folder (2026-08-11) — Matthew's call, wanted mobile kept visually/structurally separate from desktop so it's obvious at a glance which is which, rather than distinguishing by filename prefix within one shared folder. **Naming convention going forward: a mobile screen takes the exact same filename as its desktop counterpart in `prototypes/`, just in `mobile/` instead** — e.g. `mobile/friday_life_dashboard.html` mirrors `prototypes/friday_life_dashboard.html`. This is deliberate: it turns "does every web page have a mobile version" into a literal directory-diff checklist (compare filenames present in `prototypes/` against `mobile/`) instead of something that has to be tracked separately in prose. Internal links from a `mobile/` file to any page that doesn't have a mobile version yet point up and across via `../prototypes/friday_x.html` (same relative-path pattern `onboarding/` already uses to reach `prototypes/`). As of now `mobile/` contains exactly one file (Dashboard) against 22 in `prototypes/` — the gap between those two counts is effectively the real backlog for "finish the mobile build," separate from and in addition to the 2 remaining desktop screens tracked below.

**Finances and Media built — 2026-08-13, later same session:** `prototypes/friday_finances.html` and `prototypes/friday_media.html`, two new "Life" nav items (inserted between Goals and Health on all 22 existing app screens plus the mobile Dashboard's More sheet). Matthew's ask, two ideas at once.

**Finances** directly reuses Fitness's already-locked "connection-first, not a competitor" pattern (`friday_fitness.html`'s `.connect-grid`/`.connect-card` component, same philosophy-note styling) — Matthew's own words were "I don't wanna compete in that space," which is exactly the constraint Fitness was already built around, so this isn't a new pattern, it's the same one applied to money. Structure: **Due This Month** (the same real invoice data already shown on Dashboard's Financial Snapshot card — Nanny $400, Mitchell Oil $340, Landscaper $375 — not duplicated with different numbers) → **Connect Your Accounts** (5 Plaid-style connect cards: Checking & Savings, Credit Cards, Brokerage, Retirement, 529/Education, all "Not connected" since nothing's wired) → **What Friday Will Help You Answer** (six coaching questions Matthew specified — 401(k) contribution, IRA room, Miles' 529, emergency fund, idle cash/high-yield savings, conflicting big expenses — framed explicitly as capability preview, not live analysis, since asserting real answers with zero connected data would be fabricating insight) → **Short-Term Savings Goals**, which deliberately links out to `friday_goals.html` instead of duplicating a goals list, on the same "don't duplicate, link out" principle already used elsewhere (Weekly Planner links to Tasks rather than re-showing the quadrant). Also closed a small dead-end while here: Dashboard's Financial Snapshot card had no link out at all — added "Open →" to both the desktop and mobile versions.

**Media** is broader than DB15 ("TV Shows & Movies," owned by the Entertainment Agent) — Matthew's ask explicitly included books, podcasts, and YouTube alongside shows and movies. **This is a real scope expansion of the Entertainment Agent worth flagging, not a silent change**: DB15 as originally specified in `friday_database_schemas.docx` only covers shows/movies; this screen implies DB15 should conceptually become a broader "Media & Watchlist" database (or gain siblings) covering all consumption types. Flag to Matthew before finalizing DB15's real schema. Structurally: type filter chips (Books/Podcasts/TV Shows/Movies/YouTube, same working multi-select JS as Family Activities and Travel) + a ✨ free-text add row (same pattern as Calendar/Restaurants) + three status sections — **Currently** (in-progress items with a progress bar, reusing the goal-track/goal-fill component), **Want To** (the queue — this is the actual "what should I watch" repository Matthew described), **Recently Finished** (star-rated, closing the loop the same way Restaurant Detail's post-visit check-in does). No per-card action buttons, matching Travel's buttonless "someday list" pattern rather than Family Activities' "+Add to Calendar" — these are things to remember, not things to schedule.

**Pricing idea captured, not built — Matthew's own observation this session:** more integrated agents/accounts could map to pricing tiers ("flip on agents... drives pricing"). Worth noting this already has a UI seed: Settings' existing "Your Team agent toggles" (built 2026-08-11) already lets a user turn agents on/off — a tiering model would likely build on exactly that mechanism rather than needing a new one. This directly echoes the multi-tier core/advanced pricing question already flagged and deliberately deferred during the Landing Page build (same session) — worth resolving both together whenever real pricing/tiering gets decided, not two separate decisions.

**Not yet built (2 remaining):** Feed Friday Session, Login/Sign Up.

**Build approach being followed:** component system first (established via Home/Dashboard — card, feed-item, chip, nav, score-card, summary-banner patterns) → small wired core loop → batch the rest reusing established patterns, closing dead CTAs as they're found rather than leaving them. This has worked all the way through — every screen cross-links into the ones before it, and dead-end buttons/links get fixed the moment they're noticed (Date Night Planner closed three dead CTAs on 2026-08-11; Weekly Planner closed Calendar's last one on 2026-08-13). **Current state: "Main" and "Life" sidebar sections are both fully done, plus Settings, Life Health Score, Notifications, Date Night Planner, and Weekly Planner — all of "the app" is done except the 4 screens listed above.** No more known dead CTAs remain in the built screens as of 2026-08-13 — the next 4 aren't triggered by a dangling link, so pick order is open. Landing Page is deliberately low priority per Matthew's own call earlier in the build (personal/family use comes before public marketing — see IMPORTANT CONSTRAINTS); Mobile Dashboard, Feed Friday Session, and Login/Sign Up have no particular urgency order among them — ask Matthew which he wants next.

---

## KEY PEOPLE IN MATTHEW'S LIFE (for context)

**Georgia** — wife, 31, birthday March 18, works full-time for an ocean conservation nonprofit tracking fishing vessels remotely, marine biology background, genuinely environmentally conscious without being extreme. Loves the ocean, hyacinths (favorite flower, purple, loves the smell), cooking, and tending houseplants. Pregnant with their second child, due December 2026. Carries the household mental load and talks about it often — the direct inspiration for Friday. Her love language is acts of service, not gestures: flowers picked up incidentally, a tidy kitchen at night, things taken off her plate regarding Miles. Doesn't want big gift exchanges or expensive gestures — wants Matthew present, home more, and not distracted when he is home. Responds strongly to small planned things ("I'm making chicken parm tonight"). Anniversary June 11.

**Miles** — son, recorded birthdate November 30, 2023 — **unresolved age discrepancy noted 2026-09-07:** Matthew said he "turns two in November," which doesn't match a 2023 birth year (would make him three). Confirm the correct year before relying on this date. Starting preschool around 2026-09-09, 2-3 days/week through January then 5 days/week — a real routine change, will likely affect Marilyn's nanny days. Talking more, developing normally; "just starting to walk" is stale and retired. Goes to Stamford Pediatric Associates (Dr. Coursen Schneider), nanny is Marilyn.

**Loki** — dog, vet at Bulls Head Animal Hospital

**Andrew Gruseke** — brother (middle of Matthew's two brothers), bachelor party needs planning (no date set yet)

**Will Gruseke** — brother (youngest of Matthew's two brothers)

**Will Orenstein** — brother-in-law (Georgia's brother) and, separately, one of Matthew's oldest friends since age 13-14 — the connection through which Matthew came to know and eventually marry into Georgia's family. **Resolved 2026-09-07:** earlier versions of this file had one ambiguous "Will O" entry that read as a conflict between "brother-in-law" and "youngest brother" — those are two different people, Will Orenstein and Will Gruseke, not an error.

**Matthew's parents** — father Eric Gruseke (middle of three brothers; uncles Chris and Brian Gruseke), mother Anna Gruseke, née Milicia (oldest of three; aunt Sandra, uncle Joe Milicia). Full extended family tree captured 2026-09-07 in `databases/02_relationship_manager.json`, including two people named Joe (cousin Joe Gruseke, Chris's son; uncle Joe Milicia, Anna's brother) and two people named Claire (mother-in-law Claire Orenstein, below; cousin Claire Pirelli, Sandra's daughter) — all now carry full names specifically to prevent this recurring.

**Georgia's parents** — mother-in-law Claire Orenstein (British, loves gardening) and father-in-law Eddie Orenstein, live nearby, help with Miles once a week

---

## STRATEGIC REVIEW — 2026-08-14 (read this before proposing any new build work)

A full holistic review ran on 2026-08-14, verified against the actual files on disk rather than against these docs. **Full detail: `documents/holistic_review_2026-08-14.md`.** The findings below are the load-bearing ones — they are the reason the screen-building phase stopped, and a session that doesn't know them will drift straight back into building screens because that's the most legible form of progress.

**1. The product is roughly 15% built, and it's the 15% nobody doubted.** Verified: **zero** `fetch` / `localStorage` / `sessionStorage` / network calls across all 41 HTML files. The 23 files with `<script>` tags are all local show/hide filtering. Onboarding's 13 screens persist nothing. No backend, no auth, no database, no agent logic anywhere.

**2. A February 2026 plan existed, was correct, and was abandoned without ever being executed.** `documents/friday_master_plan.docx` — unread by any Claude session until 2026-08-14 — laid out *Stage 1: Validate — Use It Yourself*: 4 Notion tables, 30 days of personal daily use with a prompt library, show it to 3–5 people, ask if they'd pay $20/month. Cost: $0. It states plainly: *"You do not write a large check until the previous stage has validated demand."* Six months later the scorecard on Stage 1 is: **days of personal use 0, prompts run 0, people asked 0.** What happened instead: 4 tables → 19 databases, 5 screens → 41 files, $8–15K → $18–45K, launch → April 2027. **Nothing has ever been cut** — including the session of 2026-08-13, which added three screens and removed none.

**3. Nothing has been learned about whether anyone wants this.** Not one data point — not even from Matthew, who has never been Friday's *user*, only its designer. Those two roles produce different products. This is the gap Phase 4 exists to close.

**4. "Friends can log in and test it" is much further away than it looks.** 29 of the 41 HTML files hardcode Georgia, Miles, and Darien. A friend logging in today sees Matthew's life. Multi-tenancy isn't a polish step — it's most of the remaining work.

**5. Integration classification (all 25 current screens).** 15 need **no integration at all** — just a backend. 2 need integration but no per-user auth (News/RSS, Notifications/Twilio). 4 need real per-user OAuth (Calendar, Email, Finances/Plaid, Fitness/Terra). 3 are structurally draft-and-link-out forever (Date Night, Restaurants, Restaurant Detail — no true booking API exists for OpenTable or Uber Eats). **Recommendation on record: for a friends-testable sandbox, build exactly one OAuth — Google Calendar, read-only.** Google's "Testing" publishing status allows 100 users with no app verification and **no LLC required**. Reasoning: the entire value prop is *"Friday already knows you"* — if a tester has to type in their own week, you're testing a form and will get a false negative. Everything else stubs honestly ("Connect your account"). Plaid is hard-blocked regardless: it requires a business entity, which is deliberately not formed.

**6. The landing page has 20 dead `href="#"` links, including Sign Up.** There is no landing → onboarding → app path anywhere in 41 files.

**7. The 14-item punch list from the review** lives in `documents/holistic_review_2026-08-14.md`. Items 1–8 are free and compatible with CFP study. Item 1 was *"write the three agent prompts"* — that is what Phase 4 below is. **The developer brief is deliberately NOT next**: writing it now would specify 25 screens and 19 databases against zero validated usage, which is exactly how a $12–18K build becomes a $45K one.

**Two overlapping strategy docs currently exist** — `documents/holistic_review_2026-08-14.md` (the detailed audit, written by a background agent) and this section plus PHASE 4 below (the decisions taken from it). Matthew was asked whether to reconcile them into one and **has not decided yet.** Until he does: the review file is the evidence and detail; CLAUDE.md is authoritative for decisions. Don't let them drift.

---

## PHASE 4 — AGENT PROMPTS (started 2026-08-14)

**The screen-building phase is over. This is the current workstream.** A holistic review (Opus, 2026-08-14) found that after six months and 41 HTML files, zero agent prompts had ever been written or run — meaning the only genuinely untested assumption in the entire product had never been touched. `agent prompts/_STATUS.md` is now the authoritative checklist for this phase, the same way SCREEN BUILD STATUS was for screens. Read it before doing agent work.

**Architecture decided 2026-08-14 — the schema is derived from the agent, not designed for it.** An agent is three things: a system prompt (static identity), a data payload (queried per run), and an output schema (JSON contract). Nothing else. To find out what data an agent needs, ask the agent — paste its system prompt into Claude and have it enumerate its own requirements, tiered. That output *is* the schema draft, written by the thing that will consume it. This replaces the previous top-down approach of designing 16-19 databases and hoping the agents could use them, and is expected to **cut** database scope — any field the prompt never references shouldn't exist, and neither should the screens built to collect it.

**Every agent has three modes**, same identity, different task: **BRIEF** (data → findings), **INTERVIEW** (gaps → questions), **EXTRACT** (freeform answer → structured rows). This unifies two features previously built as unrelated: onboarding is INTERVIEW mode at t=0, Feed Friday is INTERVIEW mode running forever after. It also dissolves the known onboarding limitation logged on 2026-08-11 (no conditional skipping based on Choose Focus) — if each active agent contributes its own questions, a disabled agent simply never asks any, with no branching logic to build.

**Tiered data model + gamification, locked 2026-08-14:** Tier A is a **binary gate** (agent is Not Active without it, ~7 fields, under 4 minutes); Tiers B and C are scored separately and weighted by findings-unlocked, not field count. Display named states (Not Active → Active → Well-Fed → Sharp → Deep), never a raw percentage, and never 100% — Tier C is designed to never complete, which is what keeps Feed Friday alive long-term. This avoids two traps: demotivating "4% complete" bars, and the perverse effect where adding enrichment fields lowers every user's score. For multi-subject agents (Relationship Manager, Personal Chef, Travel), completeness is **weighted by subject importance** — depth on a peripheral acquaintance contributes nothing, depth on a spouse contributes heavily. Never nag about a tier-3 record.

**Question-design principles:** teach-then-ask (supply the domain knowledge, ask only for the fact — the user doesn't know they need their dryer vent cleaned, the agent does); never ask what you can infer (address alone yields year built, sq ft, climate zone, county records); never ask what you can default (populate standard cadences, ask for corrections); "I don't know" is always valid and often the most valuable answer since it means *investigate*; hard cap 3-5 questions per session.

**Interview-as-hiring-a-professional, locked 2026-10-07 as a core principle for every agent:** the activation interview should read like interviewing a candidate for a real role, not filling out a form — "have you managed a house like this, do you have gardening experience, have you coordinated pool cleanings" rather than a checkbox list. Matthew's own example for the eventual Personal Trainer agent: a good coach starts with "what sports did you play growing up," not "how much do you weigh" — get to know the person holistically first, the technical parameters come second and land better for it. Apply this lens when drafting every remaining agent's Part 6.

**Swipe/Tinder-style interaction — refined further 2026-10-07.** Matthew's original idea (left-right, "do you like this or that") was placed as a Tier C/Feed Friday enrichment mechanic, not primary onboarding. Real evidence now says it's more nuanced than that: Entertainment's first reality test showed an open-recall question ("name 3-5 things you want to watch") can fail outright when a household has no backlog to recall from. Matthew's own fix — show real, looked-up-live popular titles per owned service and ask which resonate — is a react-to-real-options mechanic, structurally similar to a swipe, and it's now built into Entertainment's **Tier A**, not deferred to enrichment. Updated rule: default to the deep interview, but when a question would otherwise require the user to generate ideas from nothing, prefer "react to real, specific options" instead — check whether that pattern applies before assuming every agent's Tier A should be open-ended recall.

**Positioning, locked 2026-10-07 — depth is the value exchange, stated honestly:** Friday should tell users plainly that it requires real depth of input to be worth using — "the more you give it, the better it gets" — rather than pretending to be a zero-effort app. This fits the target user directly: time-constrained but resourced enough to invest the setup once (upload the inspection report, answer the interview) in exchange for output a generic app can't produce. Don't soften this into "quick and easy" marketing language — the honesty is the pitch.

**The repeatable procedure lives in `agent prompts/_WORKFLOW.md`** (written 2026-08-14, corrected 2026-09-07) — five passes per agent (write system prompt → derive tiered schema by interrogating the agent → reality-test → cut fields that don't change output → generate teach-then-ask questions), with copy-paste prompts for each pass, model/effort guidance, file naming (`NN_agent_name.md`, numbers matching the agent list above, `00` = Friday orchestrator), the eight-part file structure, and session batching (2-3 agents per session, three sessions for all nine). **Read `_WORKFLOW.md` before building any agent; update `_STATUS.md` after every session.** Two constraints encoded there worth knowing without opening it: (1) a **hard checkpoint after session 1** — Home Manager and Relationship Manager must both be reality-tested before building agents 3-9, because those two have different shapes (one subject vs. N subjects) and testing both proves the template before it's replicated nine times; (2) **no real data exists anywhere for any agent** — there is no Notion, no export, no CSV. The reality test for every agent runs the same way: paste the Part 1 system prompt into a Claude Code session, then answer the Part 6 activation questions live, right there in the conversation. Those live answers *are* the Tier A data. Never fake a reality test with invented data — live conversational answers are real data, just gathered differently than the old plan assumed.

**Build order:** Home Manager first and completely, as the template — `agent prompts/01_home_manager.md` (prompt + tiered schema + 14 ordered questions + scoring, drafted 2026-08-14, **not yet reality-tested**). Then reality-test it by running Part 6's activation-set interview live against Matthew before building agent 2. Do NOT batch all nine — that's the same scope ratchet that took the screens from 20 to 41. v1.0 is Friday + Home Manager + Relationship Manager only. The Friday orchestrator gets built **last**, because synthesis can't be designed until there's real sub-agent output to synthesize.

**Financial Advisor agent is BLOCKED pending a decision** — see `agent prompts/_STATUS.md`. Three of Matthew's own documents conflict on whether Friday should be in financial-advice territory at all, and `friday_finances.html` is already built promising 401(k)/IRA/529 guidance. The *timing* of compliance disclosure and *whether the product gives financial advice* are two separate decisions currently being made as one. Recommendation on record: cut from v1, decide deliberately later.

---

## IMMEDIATE NEXT ACTIONS (updated 2026-10-07, end of session — this replaces all earlier versions of this section)

**This section was stale for a month — everything in the old version (reality-test Home Manager, build Relationship Manager) is done.** Read **THE AGENT ROSTER** above for the current priority order and brand names before doing anything else; it replaced the old 9-agent list on 2026-10-07.

### Start here next session

**Step 1 — run Food Manager's activation interview.** `agent prompts/03_food_manager.md` is fully drafted (Parts 1, 2, 3, 6, 7) but never run. Paste the Part 1 system prompt into a Claude Code session, walk through Part 6's seven Tier A questions live (eating pattern, freezer/pantry fallback, dietary constraints, planning cadence, kid meal logistics, current pain point, grocery pattern), then run the agent against the answers and log the verdict in Part 8 — same procedure as every prior agent, see `_WORKFLOW.md`.

**Step 2 — immediately after, Restaurant Manager.** `agent prompts/10_restaurant_manager.md` is drafted the same way. Matthew asked for these two back-to-back since they're both food-related but genuinely different jobs (what to eat vs. where to eat). Its Tier A includes `unexplored_areas` — Matthew's own idea of deliberately building depth in a nearby town that usually gets overlooked (his example: Westport from Darien) — worth actually doing that exercise once Tier A is answered, not just logging the idea.

Everything below is downstream of those two.

### Then, in order

1. **Reality-test both**, same pass/fail bar as every prior agent: does the output say something non-obvious, or connect facts that weren't already connected.
2. **Continue down THE AGENT ROSTER** — Goals and Tasks Manager next (owns the new miscellaneous-task catch-all, pairs with the never-built Eisenhower engine), then Travel and Experiences Manager, then Health Manager (personal-level only — see OPEN DECISIONS item 7 before touching kids' health), then Family Scheduler (new agent, not yet drafted at all — needs Parts 1-8 written from scratch, same process as every agent before it).
3. **Decide the Financial Advisor question** (archived, see THE AGENT ROSTER + OPEN DECISIONS item 1) — still genuinely unresolved, not just deprioritized.
4. **Decide OPEN DECISIONS item 6** — whether/when `friday_vision.html` goes live on the real domain, versus staying a private local file.
5. **Decide OPEN DECISIONS item 7** — whether and how a child's health/life ever gets its own managed scope. Flagged by Matthew as genuinely hard, not a placeholder to fill in casually.
6. **Fix Miles' birthdate discrepancy** — still unresolved since the Relationship Manager session (recorded as 2023-11-30, but Matthew said he "turns two in November," which don't reconcile).
7. **Still deferred, deliberately:** the developer brief (writing it now would lock in scope against barely-validated usage), the 23-screen mobile backlog, the 2 remaining Phase 3 screens (Feed Friday Session, Login/Sign Up), and the stale Claude-model reference in `friday_master_plan.docx` §9 (low urgency, cosmetic).

---

## SESSION LOG (what happened, for a cold start — newest entry last)

### 2026-08-13/14 — the pivot session

Two sessions ran back-to-back on 2026-08-13 → 08-14. Summary so a fresh session doesn't have to reconstruct it:

**First half (screens, 2026-08-13):** Built Weekly Planner (closing Calendar's last dead CTA), then refined it after research into how real family/couple planning meetings work — added kids' activity/pickup logistics, a family-activity section, and a real print/export via a `@media print` CSS-token swap. Then built Family Activities, the Landing Page (using Monarch Money as the structural reference, fetched and mapped rather than assumed), Mobile Dashboard (then split into its own `mobile/` folder with a filename-matching convention), and Finances + Media. Net: +6 screens, 41 HTML files total.

**Second half (the pivot, 2026-08-14):** Matthew asked for a holistic step-back review. It ran on Opus with full filesystem access, verified everything against disk, and read the two `documents/*.docx` files no session had ever opened. Findings are in STRATEGIC REVIEW above. **The screen-building phase stopped as a result** and Phase 4 (agent prompts) opened. Matthew then worked through three conceptual questions in sequence — *what is an agent prompt mechanically* → *how do you get a user to supply the data an agent needs* → *how do you avoid asking for everything up front* — and those three answers became the locked architecture in PHASE 4 (three modes; schema derived from the agent rather than designed for it; tiered data model with a binary Tier-A gate and named completeness states). The session ended with `agent prompts/_WORKFLOW.md` written as the repeatable 5-pass procedure to run nine times.

**Ideas raised and deliberately parked** (don't re-litigate, don't silently act on): pricing tiers driven by how many agents/integrations a user turns on — a UI seed for this already exists in Settings' agent toggles, and it's paired with the core/advanced tiering question flagged during the Landing Page build; both wait for a real pricing decision. Also unresolved: whether to merge the two overlapping strategy docs.

**Nothing is half-finished on disk.** Every file written this session is complete and internally consistent. The only "incomplete" item is deliberate: `01_home_manager.md` Part 8 is an empty run-log table awaiting the reality test, which is Step 1 above.

### 2026-09-06/07 — status readback + doc hygiene (no build work)

Matthew returned after three weeks and asked where things stood. Disk was re-verified: **nothing had changed** — all files still August-timestamped, `databases/` empty, Home Manager run log blank. The docs were confirmed accurate rather than stale. No screens, prompts, or schemas were touched.

Three things were fixed or added in this pass, all doc hygiene rather than new work:
- **A contradiction in IMPORTANT CONSTRAINTS** — *"Design comes before backend — always front end first"* was correct for Phase 3 and actively wrong after the pivot. Struck through and superseded in place rather than deleted, so the reversal is visible rather than silent. A fresh session could otherwise have cited it to justify building screen #42.
- **A scope note on the compliance constraint** — the *"don't suggest disclosing to Rockefeller"* rule governs disclosure timing only, and was at risk of being read as a reason to avoid the separate product question about financial advice. Now says so explicitly.
- **OPEN DECISIONS section added**, consolidating five judgment calls that were scattered across the file and blocked on Matthew.

**The September milestone in the old master plan has now been reached and passed.** `friday_master_plan.docx` had *"September 2026: Developer brief complete, job posted, developer hired."* None of that happened, and per STRATEGIC REVIEW it deliberately should not — the brief written today would specify 25 screens and 19 databases against zero validated usage. Noted so the slip is recognized on purpose rather than tripped over later. CFP exam is November; September–October is the window for the free, study-compatible validation work.

**Two strategy documents now exist and overlap:** `documents/holistic_review_2026-08-14.md` (written by a background Opus agent) and the Phase 4 section above. Matthew has been asked whether to reconcile them into one. Until he decides, treat the CLAUDE.md Phase 4 section as authoritative for architecture decisions and `_STATUS.md` as authoritative for progress.

### 2026-09-07 — Notion/database correction (no build work)

Matthew clarified something every prior session had gotten wrong: **there is no Notion workspace and never was one.** The "16 databases," the population counts ("40 people," "24 providers," etc.), and every "export to CSV" instruction throughout this file, `_STATUS.md`, and `_WORKFLOW.md` described a planning exercise from very early in the project (`documents/friday_database_schemas.docx`) that Matthew moved past — he now works directly with Claude, and has since moved this project into Claude Code. No external data store has ever existed.

This session corrected the framing everywhere it was operationally load-bearing: **THE 16 DATABASES** is now **THE 16 DATA DOMAINS**, stripped of fabricated population counts, and marked explicitly as a naming reference rather than a real system. `_WORKFLOW.md` Pass 3 (reality test) and `_STATUS.md`'s RESUME HERE block, which both instructed exporting Notion data to CSV, now instead run the reality test as a **live interview** — paste the agent's system prompt into a Claude Code session and answer its Part 6 activation questions directly in conversation. `01_home_manager.md` Part 8 was updated the same way. `friday_database_schemas.docx` is now documented as historical-only. The DB-numbering collision open decision is resolved as moot — there was never a live schema for the two source docs to disagree about.

**Immediate consequence:** the Home Manager reality test is no longer blocked on a 5-minute Notion export that could never happen. It can run the moment Matthew is ready to answer six questions about his house, in this session or the next one.

**Same session, later — Relationship Manager built, tested, and passed. The session-1 checkpoint is now complete.** Matthew described the intended user flow (master onboarding once, then per-agent setup from Your Team) and, separately, real design instincts for this specific agent: branch on relationship status first (single/dating/married), then use four distinct templates — Spouse/Partner, Kids, Friends, Family — since a spouse's flower preference matters and a golf friend's doesn't. Both were built exactly as described in `agent prompts/02_relationship_manager.md`. The live interview then ran for real: Georgia (pregnant with a second child, due December — new fact, not previously recorded anywhere), Miles (starting preschool in two days; his age doesn't reconcile with his recorded birthdate, flagged not guessed at), three friends (Matt Foster, Brandon Smith, Dan Dietrich — all three independently described with the same unprompted "don't see him enough" gap, a real cross-cutting finding), and an extended family tree that surfaced a genuine identity conflict (Will recorded elsewhere as a brother-in-law, now described as a brother) plus two internal name collisions (two Joes, two Claires), all flagged rather than silently merged. Passed its reality test — see `02_relationship_manager.md` Part 8. **This means both halves of the session-1 checkpoint locked back on 2026-08-14 are now done**, in one extended session, once the fictitious Notion blocker was cleared out of the way at the start of it.

**Same session, file hierarchy decided for the front-end layer.** Matthew described the intended app flow: master Friday onboarding once, then Home → Your Team → click an agent → that agent's own Tier A/B/C setup. Decided: keep `agent prompts/` (questions) and `databases/` (answers) exactly as they are — flat, one file per agent, no per-team-member folders, since that convention already scales fine. Added `team_onboarding/NN_*.html`, one new file per agent, as the actual "click into an agent and see its setup" view — distinct from `databases/NN_*_status.html` (findings-organized) and distinct from the top-level `onboarding/` folder (reserved for the master, still-Phase-3, first-time flow, not rebuilt). `team_onboarding/01_home_manager.html` is the first one. The master onboarding shell and wiring `friday_your_team.html` to real per-agent links are both real scope, deliberately deferred until Relationship Manager exists too — a "choose your team" experience needs more than one agent to mean anything.

**Same session, continued — the Home Manager activation interview actually ran.** Matthew answered five of the six Part 6 activation questions live (address: 33 Ridgeley Street, Darien CT; owns; moved in 2025; heating is oil for heat, propane for the stove, gas fireplaces; providers: an inherited-not-chosen landscaper, no plumber, no plow person on file), and deliberately deferred the sixth (known problems) to come back to later. Mid-interview he asked the exact right systems question — where does this data actually live, and does his mental model of "each agent owns its own data, Friday reads across everything" match the design. It does; that tree structure is the architecture locked back on 2026-08-14, he re-derived it independently. His question exposed that the architecture had never been paired with an actual storage mechanism now that Notion is off the table. **Decided on the spot:** one flat JSON file per agent in `databases/`, agent writes only its own file, Friday owns no file and reads across all of them at synthesis time — see **THE DATA STORE, FOR REAL THIS TIME** above. `databases/01_home_manager.json` was created with the five captured answers and is the reference example going forward.

**Same session, concluded — Home Manager passed its reality test.** Matthew answered the sixth Tier A field (known problems: damaged patio slate, broken garage door, a wanted golf-simulator conversion, an old/rusty AC compressor, an old oil tank with a broken gauge, a DIY-finished basement banister, a recently replaced fridge, a GE oven that's failed six repair visits, missing window screens, and gutters with no assigned provider). That completed Tier A. Home Manager then ran for the first time ever against real data and **passed** — three non-generic, non-obvious findings, all traced directly to stated facts with nothing invented: the oil tank/gauge/no-provider/heating-season risk chain, the garage door repair being the actual first step of the golf-simulator project rather than a separate task, and the oven's six failed repairs being a reason to stop repairing and decide replace-or-escalate instead. Full output and run log are in `01_home_manager.md` Part 8; the answers live in `databases/01_home_manager.json`. **This is the single most important thing that has happened in this project since it started** — six months and 41 screens produced zero data points on whether any of this works, and this session produced the first one, in about fifteen minutes of conversation once the fictitious Notion blocker was cleared out of the way. `agent prompts/_STATUS.md` is updated to reflect the pass and the corrected next steps (run mornings, then build Relationship Manager).

### 2026-10-07 — strategy session: sharper target user, three-MVP build order, a public-site question

Matthew returned a month after the 2026-09-07 session (nothing on disk had changed in between except an unrelated file). After a cold-start summary, he laid out a reprioritization: target user sharpened to HHI $250K+ (up from $150K+) in affluent areas, explicitly home-owning young parents — see WHAT FRIDAY IS. He wants a public-facing site on the already-registered domain explaining Friday's vision and rollout plan, and to build three MVP tools before the master coordinator: Home Manager (done), a "what should we watch/read/listen to" tool, and a meal-planning tool including kid-specific logistics (preschool breakfast/snacks).

**Both "new" tools turned out to already be scoped agents, not new concepts.** The watch/read/listen tool is Entertainment Agent (agent 8) — its scope note from 2026-08-13, asking whether `friday_media.html`'s books/podcasts/YouTube should be real, is now resolved yes. The meal-planning tool is Personal Chef (agent 3), extended to cover kid meal logistics explicitly. Both updated above. Matthew's "build the tools, then the coordinator" instinct also already matches the architecture locked 2026-08-14 (Friday gets built last) — independently re-derived, not a new decision.

**Flagged, not acted on unilaterally:** deploying a public vision site to the live, registered domain is a bigger step than building the content — it creates a discoverable public footprint tied to Matthew before the Rockefeller disclosure he's deliberately timing himself. Added as OPEN DECISIONS item 6 rather than built toward by default.

**Same session, continued — question-design feedback applied, and the full agent roster reprioritized.** Matthew gave concrete feedback on Entertainment's question order (move subscriptions earlier, replace blind recall with "react to real popular options" once services are known) — applied directly to `08_entertainment.md`, and the swipe-mechanic principle from earlier in this session corrected accordingly. He also independently re-derived the Tier A/B/C framework from first principles (10 most important questions, then 10-20 more, then 30-40, then keep adding) without being shown it first — confirmed as an exact match to what's already built. Built `agent prompts/_QUESTION_BANK.md`, a scannable mirror of every question across every agent, at his request, so he can review/fine-tune wording without opening three multi-part files.

Then a full re-scoping: Matthew brainstormed ~20 candidate pain points against the sharpened target user and cut the list himself. **THE AGENT ROSTER** above replaces **THE 9 SUB-AGENTS** — build order is now Home Manager → Entertainment → Personal Chef → Relationship Manager → Goals → Travel & Experiences → Personal Trainer → **Family Scheduler / Childcare Coordinator (new)**. Financial Advisor and Social Coordinator are archived, not discarded, alongside several other real-but-lower-priority ideas (Family Health Coordinator, Life-Stage Shopping, Household Staff Management, Education Coordinator, and others — full list in the Archived section above). Family Scheduler's rationale, Matthew's own words: "knowing where the bodies are" — who's covering childcare, pickups/dropoffs, and what a work trip or evening event breaks — a problem he expects to get exponentially harder, not easier, as more kids and activities enter the picture. It inherits DB6 (Weekly Family Planner), reassigned from Friday directly. `prototypes/friday_vision.html` updated to match throughout.

**Same session, closed out — brand names decided.** Internal docs/files keep "agent" and existing names (Matthew's call: "keep all the names as agents, for the docs that makes sense"). User-facing branding switches to "Manager" — House Manager, Food Manager, Goals and Tasks Manager, Health Manager, Travel and Experiences Manager, Personal Entertainment Manager, Relationship Manager unchanged. Health Manager's scope is deliberately personal-level only — extending it to Miles or the baby due in December raised a genuinely unresolved question Matthew flagged himself ("managing their lives is kind of parents' job"), logged as OPEN DECISIONS item 7 rather than guessed at. `prototypes/friday_vision.html` now uses brand names throughout; internal docs do not.

**Same session, continued — Personal Chef split into two agents.** Matthew's own reasoning: "Personal Chef" undersells the scope (cooking, leftovers, freezer, delivery, eating out — not just cooking), and restaurants turned out to be a genuinely different workflow (reservations, occasion/cuisine browsing) rather than a sub-feature. Agent 3 is now **Food Manager** (DB7+DB8, day-to-day "what are we eating," renamed again from "Food and Meals Manager" to the simpler "Food Manager"), and a new **agent 10, Restaurant Manager** (DB9) owns where-to-eat and booking. Matthew's own value-add idea — deliberately building real depth in nearby-but-unexplored towns (his example: Darien vs. Westport, one town over, rarely considered) — is built directly into Restaurant Manager's Tier A as `unexplored_areas`, not left as a vague aspiration. Both agents' full prompt files (`03_food_manager.md`, `10_restaurant_manager.md`) and data scaffolds are drafted and added to `_QUESTION_BANK.md`; neither is reality-tested yet. Build order: Food Manager, then Restaurant Manager, back-to-back, per Matthew's explicit request.

---

## OPEN DECISIONS — MATTHEW ONLY (consolidated 2026-09-07)

Everything here is blocked on a judgment call only Matthew can make. They were previously scattered across five sections; collected here so a fresh session can surface them in one pass instead of rediscovering them. **None of these should be decided unilaterally by Claude.** Date each one when it's resolved and move the decision into the relevant section.

| # | Decision | Status | What it blocks | Where the detail lives |
|---|---|---|---|---|
| 1 | **Does Friday give financial advice at all?** Three of Matthew's own docs conflict; `friday_finances.html` is already built promising 401(k)/IRA/529 guidance — securities-adjacent recommendations from a licensed advisor, about to be shown to friends. Distinct from *when* to disclose to compliance, which is settled (his timing). Recommendation on record: cut agent 07 from v1 and decide deliberately later. | ⬜ Open since 2026-08-14 | Agent 07, the fate of `friday_finances.html`, and part of the v1 scope cut | PHASE 4 · `agent prompts/_STATUS.md` · holistic review §5 |
| 2 | **Pricing model — flat vs. tiered by agents/integrations enabled.** Matthew's own idea: more agents or connected accounts → higher tier. A UI seed already exists (Settings' agent on/off toggles). Pairs with the core-vs-advanced tiering question raised during the Landing Page build. Currently the docs assume a single price ($19.99/mo, $149/yr). | ⬜ Open since 2026-08-13 | Landing page pricing section, the developer brief, unit-economics math | SCREEN BUILD STATUS (Finances/Media entry) · holistic review |
| 3 | **Reconcile the two strategy docs, or keep both?** `documents/holistic_review_2026-08-14.md` (detailed audit) overlaps CLAUDE.md's STRATEGIC REVIEW + PHASE 4 (decisions taken from it). Asked 2026-08-14, not answered. Interim rule in force: **review file = evidence and detail; CLAUDE.md = authoritative for decisions.** | ⬜ Open since 2026-08-14 | Nothing functionally — but this project has a documented history of parallel lists drifting apart | Header of the review file · STRATEGIC REVIEW |
| 4 | ~~DB numbering collision — which numbering is canonical?~~ | ✅ **Resolved (moot) 2026-09-07** — there is no real database, Notion or otherwise; both source docs describe an abandoned early exercise, not a live schema. Nothing to reconcile. | — | Correction note at top of this file |
| 5 | **Restaurant name — "Molo" correct?** Dictated as "or molo," rendered as **Molo** on the assumption dictation garbled it. Trivial, but it's live in `friday_restaurants.html` and `friday_date_night.html`. | ⬜ Open since 2026-08-11 | Nothing — cosmetic accuracy only | SCREEN BUILD STATUS |
| 6 | **Deploy a public vision/roadmap site to the live, registered domain now, or keep it local/private until closer to launch?** Matthew wants something people can go to that explains what Friday is and why it gets more powerful once agents link together. Building the content is fine; actually publishing it to the real domain is a bigger step — it's a discoverable public footprint tied to Matthew before the Rockefeller disclosure he's deliberately timing himself, distinct from a private local HTML file he can open and share selectively. | ⬜ Open since 2026-10-07 | Whether/when `friday_landing.html` (or a new vision page) goes live on the real domain | SESSION LOG 2026-10-07 · IMPORTANT CONSTRAINTS |
| 7 | **How should a child's health and life data actually be managed?** Health Manager is scoped personal-level only (Matthew's own fitness/doctors) for now, deliberately not extended to Miles or the baby due in December. Matthew's own framing of why this is genuinely hard, not just unscoped: "managing their lives is kind of parents' job" — a dedicated "Kids Manager" raises a real question about what it even means for software to hold that, not just a build-sequencing question. Not a placeholder to fill in casually. | ⬜ Open since 2026-10-07 | Whether a Kids Manager/agent ever gets built, and what it would and wouldn't do | THE AGENT ROSTER · SESSION LOG 2026-10-07 |

**Not on this list because they're already decided:** the Vault aesthetic, the no-work-email boundary (permanent), draft-then-approve, the paywall/news architecture, Health/Fitness split, timeframe-first organization for Travel and Family Activities, and the Phase 4 architecture (three modes, agent-derived schema, tiered gate). Don't reopen these without a specific reason.

---

## IMPORTANT CONSTRAINTS

- Do NOT suggest anything requiring business registration or compliance disclosure until Matthew explicitly says he is ready
- Do NOT suggest disclosing to Rockefeller compliance — Matthew is managing that timing deliberately. **Scope note added 2026-08-14:** this constraint governs the *timing of disclosure* only. It is **not** a reason to avoid the separate product question of whether Friday should be in financial-advice territory at all — those are two different decisions and the second one has been drifting by default. See OPEN DECISIONS below.
- Everything built should be formatted as developer-ready documentation
- ~~Design comes before backend — always front end first~~ **SUPERSEDED 2026-08-14.** This was correct for Phase 3 and is now actively wrong: 41 screens exist and the engine has never been switched on. The current rule is **prompts before more front end** — see PHASE 4. Do not use this line to justify building another screen.
- Keep costs realistic — bootstrapped, no outside investment planned

---

*This file is the single source of truth for all Friday project sessions.*
*When in doubt, re-read this file before proceeding.*
