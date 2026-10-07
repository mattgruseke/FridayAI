# GigFrog Marketing Plan — B2B (Employer-Sponsored, Given to Laid-Off Employees)

**Audience:** Companies conducting layoffs who'd offer GigFrog to departing employees as part of severance/outplacement support.
**Status: exploratory, not committed.** Buyer motion is undecided and no product surface exists for this yet (no multi-seat access, admin view, or bulk invite mechanism). This doc is a validation plan, not an execution plan — don't build product for this until there's a real demand signal.

---

## Why this is a different motion than the individual (B2C) plan

The [B2C individual plan](marketing-plan-b2c-individuals.md) sells to the person who's laid off, one at a time, via Reddit/YouTube. This plan sells to a company *on behalf of* people who are about to be laid off — a B2B sale with a completely different buyer, sales cycle, and proof requirements. Don't run both as if they're the same funnel; the individual plan can continue independently regardless of what happens here.

## Two possible buyer paths (undecided — test cheaply before picking)

| Path | What it looks like | Pros | Cons |
|---|---|---|---|
| **Direct to HR/People teams** | Outreach to companies doing layoffs, pitch GigFrog as part of the severance package | Direct relationship, no revenue share, faster feedback loop | Layoffs are reactive/time-pressured — HR has little bandwidth to evaluate new vendors mid-layoff; long, unpredictable sales cycle for a solo founder |
| **Outplacement firm partnerships** | Bundle GigFrog into what an existing outplacement provider (e.g. firms that already run severance transition services) offers their clients | Reach many laid-off employees at once through one relationship; outplacement firms already have the HR relationships | Slower to close a partnership than a single sale; likely wants revenue share or white-label; GigFrog becomes a vendor to a vendor, less control over brand/UX |

**Recommendation:** don't commit to either yet. Both require validation before any product or marketing investment.

## Validation phase (do this before building anything)

The goal of the next 4-6 weeks isn't marketing execution — it's answering: *does anyone actually want this, and who?*

1. **Talk to 10-15 people who've been through a layoff recently.** Ask what their severance/outplacement package actually included (if anything), what they wish they'd had. This tells you if "employer gives you a tool" is even a real want, or if individuals just prefer finding their own tools (which the B2C plan already assumes).
2. **Talk to 3-5 HR/People leaders** (even informally, via network) who've run a layoff. Ask what they currently offer departing employees and what it would take to add something new — budget owner, procurement process, decision timeline.
3. **Look for existing outplacement providers** and see how they currently package tools like this — is there an obvious partner-shaped gap, or is this space already crowded/commoditized.
4. **No-code test the offer** before building product: a simple one-page pitch ("give your departing employees GigFrog free/discounted for 3 months") sent to a handful of HR contacts or small outplacement firms, just to see if anyone bites before writing multi-seat code.

## What would need to exist before this is sellable

- A way to provision access in bulk (invite codes or an admin/org view) — currently nothing built
- Some way to track usage/value at the org level if selling to a company (even lightweight — "12 of the 20 people you sponsored are active")
- A pricing/packaging decision (per-seat, flat fee per layoff cohort, free-with-upsell) — not yet decided and shouldn't be until buyer path is clearer

## Decision point after validation

At the end of the validation phase, you should be able to answer:
- Is there real pull from either HR teams or outplacement firms, or is this a "nice idea, no one's asking" situation?
- If there's pull, which path (direct vs. partner) showed the stronger signal?
- Only then: scope the minimum product work needed (bulk invites is likely the floor) and write an actual execution plan with timeline, similar in structure to the B2C plan.

**Bottom line:** this is a distinct GTM motion from the individual plan, aimed at a buyer who isn't the end user, selling into a moment (layoffs) that's inherently reactive and hard to plan around. Validate demand and pick a path before investing founder time or engineering time — a solo founder can't afford to build B2B infrastructure on a guess.
