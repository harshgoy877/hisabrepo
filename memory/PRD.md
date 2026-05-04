# Hisab Book — Product Requirements Document

## Original Problem Statement
Build a traditional Indian hisab (ledger) maintaining software with:
- Separate accounts for each customer
- Pages containing dates and optional image attachments
- 5 entry types: bills (auto-numbers, optional amounts), items (qty/optional prices), money received + notes, plain notes, money given + notes
- "Pending Prices" and "Pending Bills" sections for missing amounts
- Price memory per customer (autofill), item name autocomplete
- "Settle pages" history feature
- Fast, simple UI (no fancy modern design)
- Cloud deployment
- Dashboard summary: total billed, given, received, net balance

## Architecture
- **Frontend**: React SPA (`/app/frontend/src/pages/`)
- **Backend**: FastAPI (`/app/backend/server.py`)
- **Database**: MongoDB Atlas (Motor async driver)
- **Image Storage**: Cloudinary (permanent CDN storage)
- **Deployment**: Docker multi-stage build (Node 20 + Python 3.11), Railway-ready

## DB Schema
- `customers`: {id, name, phone, bill_counter, created_at}
- `pages`: {id, customer_id, date, images (array of str or {url, public_id}), is_settled, settled_at, created_at}
- `entries`: {id, page_id, customer_id, type, amount, price, qty, item_name, note, bill_no, created_at}
- `item_prices`: {id, customer_id, item_name, price, updated_at}

## What's Been Implemented
- Full customer CRUD with balance calculations (bill_total, item_total, money_in, money_out, net balance)
- 5 entry types with auto bill numbering
- Page creation, settling, unsettling
- Image upload via Cloudinary (client-side signed upload)
- Cloudinary image deletion on page/customer delete (fixed Jan 2026)
- Pending bills & pending prices tabs
- Item price memory & autocomplete
- Search/filter across all tabs
- Docker single-container deployment (serves React via FastAPI StaticFiles)
- MongoDB indexes created on startup

### Performance & UX (Feb 2026)
- **Optimistic UI updates**: All mutations (add/delete customer, page, entry) update UI instantly without waiting for backend
- **Inline page expansion**: Pages expand in-place on CustomerDetail showing entries + quick-add form — no navigation to PageDetail needed
- **Auto-expand most recent page**: First page auto-expanded when opening a customer
- **All Pages tab**: Home screen shows date-sorted pages across all customers with expandable entry details
- **Removed polling**: No more setInterval re-fetches; events drive state updates
- **Minimum clicks**: Add a bill in 3 clicks (open customer → click Bill → submit)

## Completed Tasks (Chronological)
- Initial full-stack setup
- 5 core entry types + balance calculations
- Search bars and filtering
- Cloudinary integration for permanent image storage
- Docker multi-stage build (Node 20 fix)
- Fixed customer/page deletion — Cloudinary `destroy()` now called (Jan 2026)
- Optimistic updates + inline entries + All Pages view (Feb 2026)

## Key API Endpoints
- `GET/POST/DELETE /api/customers`
- `GET /api/customers/{cid}/single` — single customer with balance
- `GET/POST/DELETE /api/customers/{cid}/pages`
- `POST/PUT/DELETE /api/entries`
- `PATCH /api/entries/{eid}/fill`
- `GET /api/all-pages` — all pages across customers with customer_name
- `GET /api/cloudinary/signature`

## Prioritized Backlog
### P2
- Print/export customer summary as PDF

### P3 (Future)
- Split `server.py` into modular `routers/` directory (613 lines, approaching threshold)
- Authentication (if multi-user needed in future)
