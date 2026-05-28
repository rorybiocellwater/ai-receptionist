# Starling Holdings — Project Changelog

## Project Overview
**Starling Holdings Ltd / O'Neill & Associates**
A creative holding company where AI-powered staff generate real commercial revenue.
Managing Director: Rory (the user)
Server: Railway.app — `https://ai-receptionist-production-7512.up.railway.app`
App URL: `https://ai-receptionist-production-7512.up.railway.app/starling.html`
GitHub: `https://github.com/rorybiocellwater/ai-receptionist`
Stack: Node.js/Express, PostgreSQL (Railway), Anthropic API, Replicate API, OpenRouter API

---

## Environment Variables (Railway)
- `ANTHROPIC_API_KEY` — Claude API for all staff conversations, Li Ren reports, Latoya reviews
- `DATABASE_URL` — PostgreSQL connection string (auto-set by Railway)
- `REPLICATE_API_KEY` — Replicate for Bjorn (MusicGen) and Lami (FLUX image generation)
- `OPENROUTER_API_KEY` — Reserved for future uncensored model characters
- `RESEND_API_KEY` — Email notifications for Vapi call reports
- `EMAIL_TO` / `EMAIL_FROM` — Email routing
- `VAPI_API_KEY` / `VAPI_ASSISTANT_ID` — AI phone receptionist
- `PORT=8080`

---

## Database Tables
- `projects` — id, title, description, assigned_to[], status, cost_estimate, revenue, production_status, tools_used, distribution, promotion, earnings_to_date, activity_log (JSONB), latoya_clearance, latoya_cleared, created_at, updated_at
- `memory` — id, staff_id (unique), summary, updated_at
- `reports` — id, author, title, content, chief_assessment, read_by_chief, created_at

---

## Staff Roster (19 active)
| Name | ID | Floor | Room | Portrait | Notes |
|---|---|---|---|---|---|
| Chief O'Neill | chief | Top Floor | room_chief.png | chief.png | CEO, receives O'Neill reviews |
| The MD | md | Top Floor | room_md.png | — | User/MD |
| Sidney Turnbull | sidney | Top Floor | room_sidney.png | sidney.png | Accountant |
| Li Ren | liren | Floor 5 | room_liren.png | Liren.png | Intelligence, files daily reports |
| Doc Brown | docbrown | Floor 5 | room_docbrown.png | doc.png | Filmmaker |
| Layton Sutton | layton | Floor 4 | room_layton.png | layton.png | Brightwell Studios, ancient civilisations/children's content |
| The Bar | bar | Floor 4 | room_bar.png | — | After hours |
| Henry Turner | henry | Floor 3 | room_henry.png | henry.png | Writer |
| Theo | theo | Floor 3 | room_theo.png | theo.png | Designer |
| Norm Woods | norm | Floor 3 | room_norm.png | norm.png | Programmer |
| Lami Belle | lami | Floor 2 | room_lami.png | lami.png | Adult/fantasy content creator, FLUX image generation |
| Ulysses Becker | ulysses | Floor 2 | room_ulysses.png | ulysses.png | Dropshipping/e-commerce |
| Lorraine Hunter | lorraine | Floor 2 | room_lorraine.png | lorraine.png | Influencer/promotion |
| Latoya Mayflower | latoya | Floor 1 | room_latoya.png | latoya.png | Legal counsel, auto-reviews all projects |
| Meabh Molyneaux | meabh | Floor 1 | room_meabh.png | meabh.png | Molyneaux Memorials, pet/human memorial books, John Paul (Irish Wolfhound) |
| Tina Sullivan | tina | Ground | room_tina.png | tina.png | Receptionist |
| Steve Grabowski | steve | Ground | room_steve.png | steve.png | Security |
| Bjorn Chapeau-Rouge | bjorn | Basement | room_bjorn.png | bjorn.png | Music, MusicGen via Replicate, auto-composes from brief |
| Sandy de la Montana | sandy | Basement | room_sandy.png | sandy.png | Bjorn's agent, AI-friendly sync platforms |

**Removed:** Maddie Twister (rate limit concerns), Rod Driver (narrative clutter)
**Pending/Ready to add:** Maddie Twister can be re-added via OpenRouter when needed

---

## App Features

### Building View
- Exterior pixel art (`exterior.png`) with clickable floor zones
- Hover popup shows occupants
- Multi-occupant floors show office picker modal
- Left sidebar: Project Ledger button, Run Li Ren button, Staff Directory

### Room View
- Full-screen Midjourney room background
- Character portrait displayed
- Chat panel (right side, 360px)
- Call into meeting buttons
- Memory saves on room exit or sidebar navigation
- No auto-greeting (removed to save tokens)

### Memory System
- Saves on room exit AND on sidebar navigation (lpClick)
- Cumulative summary per staff member via `/api/memory/:staffId`
- Injected into system prompt on room entry
- Timestamp included in summary
- O'Neill, Li Ren, Latoya, Sidney get full project ledger injected
- Assigned staff get their specific project brief injected
- Guests called into meetings get their memory injected before entering

### Li Ren Intelligence System
- Runs every 24 hours automatically + manual "Run Li Ren" button in sidebar
- Files 1 report per run (was 3, reduced for rate limit reasons — can increase when on higher tier)
- Web search tool enabled for real market research
- Duplicate job prevention via `liRenRunning` flag
- No startup trigger (removed to prevent double-firing on deploy)
- Projects created directly in ledger from report — no greenlight step needed
- String parsing extracts title, assigned staff, cost, tools, distribution from report
- Claude extraction used for quality briefs (can fall back to string parsing if credits low)

### O'Neill Review System
- Runs 30 minutes after Li Ren files her report
- Writes per-opportunity assessment (2-3 sentences, in his voice)
- Saves to `chief_assessment` field on the report record
- O'Neill's office prompt does NOT inject recommendation (removed to save tokens)

### Project Ledger
- Overview tab: add/edit/cancel/delete projects
- Project Detail tab: production status, tools, distribution, promotion, earnings, activity log, Latoya clearance
- Activity log shows audio player for MP3 URLs (Bjorn's tracks)
- Activity log shows image viewer for image URLs (Lami's panels)
- Compose Now button (Bjorn) and Generate Panel Now button (Lami) in Project Detail
- Delete All button for testing

### Latoya Auto-Review
- Triggered on project creation from Li Ren
- Reviews project brief for legal/compliance issues
- Saves to `latoya_clearance` and `latoya_cleared` fields
- Displayed in Project Detail tab with green (cleared) or amber (flagged) styling

### Bjorn Auto-Compose
- Triggered when Bjorn is assigned to a project
- Claude writes a MusicGen prompt from the project brief
- Replicate MusicGen generates 30-second MP3
- Track URL saved to project activity log
- Manual "Compose Now" button in Project Detail
- Compose panel in Bjorn's office for manual generation
- Model: `b05b1dff1d8c6dc63d14b0cdb42135378dcb87f6373b0d3d341ede46e59e2b38` (stereo-melody-large)

### Lami Auto-Generate (NEW)
- Triggered when Lami is assigned to a project
- Claude writes a FLUX image prompt from the project brief
- Replicate FLUX 1.1 Pro generates manga/fantasy panel (832x1216)
- Image URL saved to project activity log
- Manual "Generate Panel Now" button in Project Detail
- Model: `black-forest-labs/flux-1.1-pro`
- Target platforms: SubscribeStar, Fansly (accounts not yet set up)

---

## Autonomous Pipeline
```
Li Ren (24h) → web search → project created in ledger
→ Latoya reviews legal compliance
→ Bjorn auto-composes if assigned (MusicGen)
→ Lami auto-generates if assigned (FLUX)
→ [Future] Sandy submits Bjorn tracks to AI-friendly sync platforms
→ [Future] Lorraine posts previews to social media
→ Revenue tracked in ledger by Sidney
```

---

## Commercial Strategy Notes

### Music (Bjorn + Sandy)
- Target: AI-friendly sync platforms only
- Approved: Pixabay Music, Soundsnap, Jamendo, Audiojungle (AI-tagged), Pond5 (with disclosure)
- Avoid: Epidemic Sound, Artlist, Musicbed (ban AI content)
- Detection: Platforms use SynthID-style waveform analysis + metadata watermarks
- MusicGen via Replicate does NOT embed Suno/Udio watermarks
- Position: AI-assisted composer with proper disclosure
- Revenue model: Sync licensing fees (one-off), not streaming
- Timeline: Long game, catalogue needs 50+ tracks to generate meaningful income

### Adult Content (Lami)
- Target platforms: SubscribeStar (explicit OK), Fansly (explicit OK), Pixiv FANBOX (manga/anime community)
- Free preview: DeviantArt, X/Twitter for discovery
- Revenue model: Monthly subscriptions
- Realistic: €400+/month with 50 subscribers once audience established
- Requires: Lorraine driving traffic from Reddit, X, DeviantArt
- Accounts: Not yet set up — need identity verification

### Memorials (Meabh)
- Service: Bespoke memorial books, human and pet
- Pricing: Digital €150, Print €250-400, Music add-on €75
- Fulfilment: Printful (print-on-demand, no stock held)
- B2B: Veterinary clinic referral partnerships (highest conversion channel)
- Legal: Latoya agreement in place
- Status: Character built, not yet commercially active

### Print-on-Demand (Theo + Ulysses + Lorraine)
- Theo designs, Ulysses lists on Redbubble/Merch by Amazon, Lorraine promotes
- Zero inventory, fully passive after setup
- Status: Not yet started

### Ebooks (Henry + Layton)
- Kindle Direct Publishing, profitable niches
- Low production cost, Amazon algorithm drives discovery
- Status: Not yet started

---

## API Rate Limits & Costs
- Anthropic Tier 1: 30,000 input tokens/minute
- Rate limit hit when: Li Ren fires multiple calls simultaneously, or large prompts in O'Neill's office
- Fix: Removed auto-greeting, removed recommendation injection from O'Neill, 1 report per Li Ren run
- Anthropic credits: ~$0.50-1.00/day normal operation
- Replicate: ~$0.08 per 30s music track (MusicGen), ~$0.05-0.10 per image (FLUX)
- To advance to Tier 2 (40k tokens/min): add more credits at console.anthropic.com

---

## Roadmap

### Immediate
- Lami image generation deployed and tested ← CURRENT
- Assign Lami to a project and verify panel generation works

### Phase 3 — Publishing Pipelines
- Sandy submits Bjorn tracks to Pixabay Music (manual upload + Sandy's metadata package)
- SubscribeStar/Fansly account setup for Lami
- Lorraine social media posting automation (X API, Reddit where possible)
- Theo + Ulysses print-on-demand pipeline (Redbubble API)

### Phase 4 — More Staff Tooling
- Theo → image generation for product design (FLUX via Replicate)
- Layton → YouTube channel + ElevenLabs voiceover + video assembly
- Henry → Kindle ebook pipeline
- Meabh → Molyneaux Memorials customer intake flow

### Phase 5 — Sidney's Wallet
- Real revenue tracking
- Incoming payments recorded
- Expenditure against projects
- Profit distribution
- Interactive safe interface

### Future Considerations
- Replicate as backbone for all visual staff (one API key, multiple models)
- Trading/investment module for Li Ren (on-demand, requires explicit MD greenlight)
- Repeat prevention for Li Ren reports
- O'Neill autonomous project creation from Li Ren reports
- Maddie Twister re-addition via OpenRouter when rate limits allow

---

## Key Decisions Made
- Greenlight mechanic removed — Li Ren projects go straight to ledger (speed > control for now)
- No startup trigger for Li Ren (prevents double-fire on deploy)
- String parsing for project extraction (saves tokens) with Claude extraction option for quality
- Bjorn targets sync licensing not streaming (better fit for instrumental AI music)
- Disclosure strategy for AI content (transparent, legally defensible)
- 1 Li Ren report per run (reduced from 3 for rate limit reasons)
- Auto-greeting removed from room entry (saves tokens)
- O'Neill recommendation injection removed from prompt (saves tokens)

