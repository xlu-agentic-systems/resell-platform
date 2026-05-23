# Resell Platform

MVP marketplace for listing items, reserving items, seller-buyer chat, image uploads, and manual payment follow-up notifications.

## Local Development

```bash
npm install
npm run dev
```

Open http://127.0.0.1:5173/ or the localhost URL Vite prints.

This mode uses browser `localStorage` as a fallback and does not require Cloudflare.

## Cloudflare Local Development

Apply the D1 migrations to the local Wrangler database and run the Pages app with Functions:

```bash
npm run cf:d1:migrate:local
npm run dev:cloudflare
```

Open http://localhost:8788/. The app will show `Cloudflare D1` when it is using the D1-backed API instead of local fallback storage.

## Verification

```bash
npm run test
npm run typecheck:functions
npm run build
```

## Current MVP

- Seller can publish listings with 1-6 uploaded images.
- Buyers can browse listings, reserve an available item, and open a reservation-scoped chat with the seller.
- The app does not process payments. It tracks off-platform payment status only.
- Payment is due 24 hours after reservation. The app creates one buyer notification and one seller notification when an unpaid reservation becomes overdue.
- Demo users can be switched from the left navigation on desktop. Mobile uses a bottom navigation for core workflows.

## Current Limits

- `npm run dev` still uses browser `localStorage`; use `npm run dev:cloudflare` to exercise D1.
- Seed demo images are stored as data URLs for portability. New Cloudflare listing uploads are written to R2 and D1 stores the served image path plus R2 key.
- Overdue monitoring runs when `/api/state` is called. A production scheduled Worker should be added before relying on background notifications.
- There is no real authentication, moderation, payment provider, or user signup yet.

## Cloudflare Deployment

The repository is configured for Cloudflare Pages Functions, D1, and R2:

- Build command: `npm run build`
- Output directory: `dist`
- Node version: `22.12.0` or newer
- Pages Functions directory: `functions`
- D1 binding: `DB`
- R2 binding: `LISTING_IMAGES`

Create the Cloudflare resources:

```bash
npm run cf:d1:create
npm run cf:r2:create
```

Copy the returned D1 database ID into `wrangler.toml`, replacing:

```text
00000000-0000-0000-0000-000000000000
```

Apply the remote migrations:

```bash
npm run cf:d1:migrate:remote
```

Deploy the Pages app:

```bash
npm run deploy
```

## Cloudflare Architecture

- D1 stores users, listings, listing image metadata, reservations, chat messages, and notifications.
- Pages Functions expose `/api/state`, `/api/listings`, `/api/reservations`, `/api/messages`, reservation status updates, and notification read actions.
- Reservation creation updates listing availability in D1 with a conditional update, so a second buyer cannot reserve the same available item.
- Chat writes messages to D1 after checking the sender is the reservation buyer or seller.
- R2 is configured as `LISTING_IMAGES`; new listing uploads store image bytes in R2 and D1 stores the served image path plus R2 key.
