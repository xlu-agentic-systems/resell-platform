# Resell Platform

MVP marketplace for listing items, reserving items, seller-buyer chat, image uploads, and manual payment follow-up notifications.

## Local Development

```bash
npm install
npm run dev
```

Open http://127.0.0.1:5173/ or the localhost URL Vite prints.

## Verification

```bash
npm run test
npm run build
```

## Current MVP

- Seller can publish listings with 1-6 uploaded images.
- Buyers can browse listings, reserve an available item, and open a reservation-scoped chat with the seller.
- The app does not process payments. It tracks off-platform payment status only.
- Payment is due 24 hours after reservation. The app creates one buyer notification and one seller notification when an unpaid reservation becomes overdue.
- Demo users can be switched from the left navigation on desktop. Mobile uses a bottom navigation for core workflows.

## Current Limits

- Data is stored in browser `localStorage`, so multi-user behavior is simulated on one device.
- Uploaded images are stored as data URLs and are only suitable for demo-scale use.
- Overdue monitoring runs when the app is open.
- There is no real authentication, moderation, payment provider, or server-side reservation lock yet.

## Cloudflare Path

The first version is a static Vite app and can be deployed to Cloudflare Pages with:

- Build command: `npm run build`
- Output directory: `dist`
- Node version: `22.12.0` or newer

Next production steps should replace the local adapters with Cloudflare services:

- D1 for users, listings, reservations, messages, and notifications.
- R2 for listing images.
- Workers or Pages Functions for authorization, reservation locking, chat APIs, and overdue scheduled checks.
