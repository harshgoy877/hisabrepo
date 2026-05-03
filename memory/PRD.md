# Hisab Book App — PRD

## Original Problem Statement
Single-user hisab (accounting) maintaining software. Traditional ledger-book experience digitized. Each customer gets their own hisab book with pages. Pages have dates and can have images attached. 5 entry types per page. Smart features: pending sections, price memory, autocomplete. Settle feature for archiving paid pages.

## Architecture
- **Frontend**: React SPA (Tailwind CSS, React Router v6)
- **Backend**: FastAPI (Python) with MongoDB (Motor async)
- **Storage**: MongoDB local (MongoDB Atlas / Supabase PostgreSQL for production)
- **Image Storage**: Local filesystem at /app/backend/uploads/ served via /api/uploads/
- **Sync**: 5-second polling on all pages

## User Personas
- Single business owner / shopkeeper
- Non-tech savvy traditional user
- Needs fast, simple interface

## Core Requirements (Static)
1. Customer list dashboard with balance per customer
2. Each customer has a hisab book with paginated pages
3. Each page has a date and optional images
4. 5 entry types per page: Bill, Item, Money Received, Money Given, Note
5. Bill: auto-incrementing bill number per customer, optional amount
6. Item: name + qty + optional price; if no price → pending prices
7. Bill with no amount → pending bills
8. Pending Bills section: fill amount directly, updates the page entry
9. Pending Prices section: fill price directly, updates the page entry and price memory
10. Price Memory: remembers last price per item per customer, autofills
11. Item Name Autocomplete: suggests previously used item names
12. Settle Pages: mark pages as settled → removed from active, shown in history
13. Unsettle pages: move back to active
14. Balance calculation: (Bills + Items + Money Given) - Money Received
15. Summary per customer: Bills / Items (grouped by date) / Money In / Money Out sections

## What's Been Implemented (as of initial build)
**Date: Feb 2026**
- ✅ Customer CRUD (add, edit, delete) with balance display on dashboard
- ✅ Page CRUD (add, delete) with pagination
- ✅ All 5 entry types (Bill, Item, Money Received, Money Given, Note)
- ✅ Auto bill number per customer
- ✅ Pending Bills tab with fill-in-place
- ✅ Pending Prices tab with fill-in-place
- ✅ Item Name Autocomplete from price memory + entry history
- ✅ Price Memory tab showing remembered prices per customer
- ✅ Price autofill when selecting item from autocomplete
- ✅ Settle/Unsettle pages
- ✅ Summary tab (Bills, Items grouped by date, Money In, Money Out)
- ✅ Balance bar in customer detail
- ✅ Image upload/delete per page
- ✅ 5-second auto-refresh/sync
- ✅ Edit/delete all entry types inline

## Test Results
- Backend: 100% (30/30 passed)
- Frontend: 95% - all core flows work

## Prioritized Backlog

### P0 (Critical - must have)
- None blocking

### P1 (Important)
- Search/filter customers
- Customer notes/phone display improvements
- Date range filter on summary
- Print/export hisab summary

### P2 (Nice to have)
- Dark mode
- Multi-user / auth (login/logout for multiple users)
- Supabase migration for cloud storage
- Netlify deployment guide
- Item categories/tags

## Next Tasks
1. Test with real data
2. Setup Supabase for production deployment
3. Deploy to Netlify (frontend) + Railway/Render (backend)
