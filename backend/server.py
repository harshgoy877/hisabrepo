from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os
import uuid
import shutil
import logging
import time
import cloudinary
import cloudinary.uploader
import cloudinary.utils
from pathlib import Path
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Cloudinary config
cloudinary.config(
    cloud_name=os.environ.get("CLOUDINARY_CLOUD_NAME"),
    api_key=os.environ.get("CLOUDINARY_API_KEY"),
    api_secret=os.environ.get("CLOUDINARY_API_SECRET"),
    secure=True,
)

app = FastAPI()
api_router = APIRouter(prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def oid(doc):
    if doc is None:
        return None
    doc["id"] = str(doc.pop("_id"))
    return doc


def cleanup_page_images(images: list):
    """Delete images from Cloudinary or local filesystem."""
    for img in images:
        if isinstance(img, dict):
            try:
                if img.get("public_id"):
                    cloudinary.uploader.destroy(img["public_id"], invalidate=True)
            except Exception as e:
                logger.error(f"Cloudinary delete error during cleanup: {e}")
        elif isinstance(img, str):
            fp = UPLOAD_DIR / img
            if fp.exists():
                fp.unlink()
async def create_indexes():
    await db.entries.create_index([("page_id", 1)])
    await db.entries.create_index([("customer_id", 1), ("type", 1)])
    await db.pages.create_index([("customer_id", 1), ("is_settled", 1)])
    await db.item_prices.create_index([("customer_id", 1), ("item_name", 1)], unique=True)


@app.on_event("shutdown")
async def shutdown():
    client.close()


# ────────── BALANCE HELPER ──────────

async def get_balance(customer_id: str):
    page_ids = []
    async for p in db.pages.find({"customer_id": customer_id, "is_settled": False}, {"_id": 1}):
        page_ids.append(str(p["_id"]))

    bill_total = item_total = money_received = money_given = 0.0
    pending_bills = pending_prices = 0

    if page_ids:
        async for e in db.entries.find({"page_id": {"$in": page_ids}}):
            t = e.get("type")
            if t == "bill":
                if e.get("amount") is not None:
                    bill_total += float(e["amount"])
                else:
                    pending_bills += 1
            elif t == "item":
                if e.get("price") is not None:
                    qty = float(e.get("qty") or 1)
                    item_total += qty * float(e["price"])
                else:
                    pending_prices += 1
            elif t == "money_received":
                if e.get("amount") is not None:
                    money_received += float(e["amount"])
            elif t == "money_given":
                if e.get("amount") is not None:
                    money_given += float(e["amount"])

    balance = bill_total + item_total + money_given - money_received
    return {
        "bill_total": bill_total,
        "item_total": item_total,
        "money_received": money_received,
        "money_given": money_given,
        "balance": balance,
        "pending_bills": pending_bills,
        "pending_prices": pending_prices,
    }


# ────────── CUSTOMERS ──────────

class CustomerCreate(BaseModel):
    name: str
    phone: Optional[str] = None

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None


@api_router.get("/customers")
async def list_customers():
    result = []
    async for c in db.customers.find().sort("name", 1):
        c = oid(c)
        bal = await get_balance(c["id"])
        c.update(bal)
        result.append(c)
    return result


@api_router.post("/customers")
async def create_customer(data: CustomerCreate):
    doc = {
        "name": data.name,
        "phone": data.phone,
        "bill_counter": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.customers.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    doc.pop("_id", None)
    return doc


@api_router.put("/customers/{cid}")
async def update_customer(cid: str, data: CustomerUpdate):
    upd = {k: v for k, v in data.model_dump().items() if v is not None}
    await db.customers.update_one({"_id": ObjectId(cid)}, {"$set": upd})
    return {"success": True}


@api_router.delete("/customers/{cid}")
async def delete_customer(cid: str):
    async for p in db.pages.find({"customer_id": cid}, {"_id": 1, "images": 1}):
        pid = str(p["_id"])
        cleanup_page_images(p.get("images", []))
        await db.entries.delete_many({"page_id": pid})
    await db.pages.delete_many({"customer_id": cid})
    await db.item_prices.delete_many({"customer_id": cid})
    await db.customers.delete_one({"_id": ObjectId(cid)})
    return {"success": True}


# ────────── PAGES ──────────

class PageCreate(BaseModel):
    date: str  # YYYY-MM-DD

class PageUpdate(BaseModel):
    date: Optional[str] = None


@api_router.get("/customers/{cid}/pages")
async def list_pages(cid: str, settled: bool = False, page: int = 1, limit: int = 20):
    skip = (page - 1) * limit
    sort_dir = 1 if settled else -1
    result = []
    async for p in db.pages.find({"customer_id": cid, "is_settled": settled}).sort("date", sort_dir).skip(skip).limit(limit):
        result.append(oid(p))
    total = await db.pages.count_documents({"customer_id": cid, "is_settled": settled})
    return {"pages": result, "total": total, "page": page, "limit": limit}


@api_router.post("/customers/{cid}/pages")
async def create_page(cid: str, data: PageCreate):
    doc = {
        "customer_id": cid,
        "date": data.date,
        "images": [],
        "is_settled": False,
        "settled_at": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.pages.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    doc.pop("_id", None)
    return doc


@api_router.get("/pages/{pid}")
async def get_page(pid: str):
    p = await db.pages.find_one({"_id": ObjectId(pid)})
    if not p:
        raise HTTPException(404, "Page not found")
    return oid(p)


@api_router.put("/pages/{pid}")
async def update_page(pid: str, data: PageUpdate):
    upd = {k: v for k, v in data.model_dump().items() if v is not None}
    if upd:
        await db.pages.update_one({"_id": ObjectId(pid)}, {"$set": upd})
    return {"success": True}


@api_router.delete("/pages/{pid}")
async def delete_page(pid: str):
    p = await db.pages.find_one({"_id": ObjectId(pid)}, {"images": 1})
    if p:
        cleanup_page_images(p.get("images", []))
    await db.entries.delete_many({"page_id": pid})
    await db.pages.delete_one({"_id": ObjectId(pid)})
    return {"success": True}


@api_router.post("/pages/settle")
async def settle_pages(data: dict):
    page_ids = data.get("page_ids", [])
    now = datetime.now(timezone.utc).isoformat()
    for pid in page_ids:
        await db.pages.update_one(
            {"_id": ObjectId(pid)},
            {"$set": {"is_settled": True, "settled_at": now}},
        )
    return {"success": True, "count": len(page_ids)}


@api_router.post("/pages/{pid}/unsettle")
async def unsettle_page(pid: str):
    await db.pages.update_one(
        {"_id": ObjectId(pid)},
        {"$set": {"is_settled": False, "settled_at": None}},
    )
    return {"success": True}


# ────────── IMAGES ──────────

@api_router.post("/pages/{pid}/images")
async def upload_image(pid: str, file: UploadFile = File(...)):
    ext = Path(file.filename).suffix or ".jpg"
    filename = f"{uuid.uuid4()}{ext}"
    fp = UPLOAD_DIR / filename
    with open(fp, "wb") as f:
        shutil.copyfileobj(file.file, f)
    await db.pages.update_one({"_id": ObjectId(pid)}, {"$push": {"images": filename}})
    return {"filename": filename}


@api_router.delete("/pages/{pid}/images/{filename}")
async def delete_image(pid: str, filename: str):
    await db.pages.update_one({"_id": ObjectId(pid)}, {"$pull": {"images": filename}})
    fp = UPLOAD_DIR / filename
    if fp.exists():
        fp.unlink()
    return {"success": True}


# ────────── ENTRIES ──────────

class EntryCreate(BaseModel):
    type: str  # bill | item | money_received | money_given | note
    amount: Optional[float] = None
    item_name: Optional[str] = None
    qty: Optional[float] = None
    price: Optional[float] = None
    note: Optional[str] = None

class EntryUpdate(BaseModel):
    amount: Optional[float] = None
    item_name: Optional[str] = None
    qty: Optional[float] = None
    price: Optional[float] = None
    note: Optional[str] = None


@api_router.get("/pages/{pid}/entries")
async def get_entries(pid: str):
    result = []
    async for e in db.entries.find({"page_id": pid}).sort("created_at", 1):
        result.append(oid(e))
    return result


@api_router.post("/pages/{pid}/entries")
async def create_entry(pid: str, data: EntryCreate):
    p = await db.pages.find_one({"_id": ObjectId(pid)})
    if not p:
        raise HTTPException(404, "Page not found")
    cid = p["customer_id"]
    now = datetime.now(timezone.utc).isoformat()

    doc = {"page_id": pid, "customer_id": cid, "type": data.type, "created_at": now}

    if data.type == "bill":
        customer = await db.customers.find_one_and_update(
            {"_id": ObjectId(cid)},
            {"$inc": {"bill_counter": 1}},
            return_document=True,
        )
        doc["bill_no"] = customer["bill_counter"]
        doc["amount"] = data.amount

    elif data.type == "item":
        doc["item_name"] = data.item_name
        doc["qty"] = data.qty
        doc["price"] = data.price
        if data.price is not None and data.item_name:
            await db.item_prices.update_one(
                {"customer_id": cid, "item_name": data.item_name},
                {"$set": {"price": data.price, "updated_at": now}},
                upsert=True,
            )

    elif data.type == "money_received":
        doc["amount"] = data.amount
        doc["note"] = data.note

    elif data.type == "money_given":
        doc["amount"] = data.amount
        doc["note"] = data.note

    elif data.type == "note":
        doc["note"] = data.note

    res = await db.entries.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    doc.pop("_id", None)
    return doc


@api_router.put("/entries/{eid}")
async def update_entry(eid: str, data: EntryUpdate):
    upd = data.model_dump(exclude_unset=True)
    if not upd:
        return {"success": True}
    e = await db.entries.find_one({"_id": ObjectId(eid)})
    if not e:
        raise HTTPException(404, "Entry not found")
    if e.get("type") == "item" and "price" in upd and upd["price"] is not None:
        await db.item_prices.update_one(
            {"customer_id": e["customer_id"], "item_name": e.get("item_name", "")},
            {"$set": {"price": upd["price"], "updated_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True,
        )
    await db.entries.update_one({"_id": ObjectId(eid)}, {"$set": upd})
    return {"success": True}


@api_router.delete("/entries/{eid}")
async def delete_entry(eid: str):
    await db.entries.delete_one({"_id": ObjectId(eid)})
    return {"success": True}


# Fill price or amount from pending sections
@api_router.patch("/entries/{eid}/fill")
async def fill_entry(eid: str, data: dict):
    e = await db.entries.find_one({"_id": ObjectId(eid)})
    if not e:
        raise HTTPException(404, "Entry not found")
    upd = {}
    if "amount" in data and data["amount"] is not None:
        upd["amount"] = float(data["amount"])
    if "price" in data and data["price"] is not None:
        upd["price"] = float(data["price"])
        if e.get("type") == "item" and e.get("item_name"):
            await db.item_prices.update_one(
                {"customer_id": e["customer_id"], "item_name": e["item_name"]},
                {"$set": {"price": upd["price"], "updated_at": datetime.now(timezone.utc).isoformat()}},
                upsert=True,
            )
    if upd:
        await db.entries.update_one({"_id": ObjectId(eid)}, {"$set": upd})
    return {"success": True}


# ────────── PENDING SECTIONS ──────────

@api_router.get("/customers/{cid}/pending-bills")
async def pending_bills(cid: str):
    page_ids, page_map = [], {}
    async for p in db.pages.find({"customer_id": cid, "is_settled": False}):
        pid = str(p["_id"])
        page_ids.append(pid)
        page_map[pid] = p.get("date", "")
    result = []
    if page_ids:
        async for e in db.entries.find(
            {"page_id": {"$in": page_ids}, "type": "bill", "amount": None}
        ).sort("created_at", 1):
            e = oid(e)
            e["page_date"] = page_map.get(e["page_id"], "")
            result.append(e)
    return result


@api_router.get("/customers/{cid}/pending-prices")
async def pending_prices(cid: str):
    page_ids, page_map = [], {}
    async for p in db.pages.find({"customer_id": cid, "is_settled": False}):
        pid = str(p["_id"])
        page_ids.append(pid)
        page_map[pid] = p.get("date", "")
    result = []
    if page_ids:
        async for e in db.entries.find(
            {"page_id": {"$in": page_ids}, "type": "item", "price": None}
        ).sort("created_at", 1):
            e = oid(e)
            e["page_date"] = page_map.get(e["page_id"], "")
            result.append(e)
    return result


# ────────── ITEM PRICES / AUTOCOMPLETE ──────────

@api_router.get("/customers/{cid}/item-prices")
async def get_item_prices(cid: str):
    result = []
    async for ip in db.item_prices.find({"customer_id": cid}).sort("item_name", 1):
        result.append(oid(ip))
    return result


@api_router.get("/customers/{cid}/item-names")
async def get_item_names(cid: str):
    names = set()
    async for ip in db.item_prices.find({"customer_id": cid}, {"item_name": 1}):
        names.add(ip["item_name"])
    async for e in db.entries.find(
        {"customer_id": cid, "type": "item"}, {"item_name": 1}
    ):
        if e.get("item_name"):
            names.add(e["item_name"])
    return sorted(list(names))


# ────────── SUMMARY ──────────

@api_router.get("/customers/{cid}/summary")
async def get_summary(cid: str):
    active_pages = []
    async for p in db.pages.find({"customer_id": cid, "is_settled": False}).sort("date", 1):
        active_pages.append(oid(p))

    page_map = {p["id"]: p for p in active_pages}
    page_ids = list(page_map.keys())

    bills, items, money_in, money_out = [], [], [], []

    if page_ids:
        async for e in db.entries.find({"page_id": {"$in": page_ids}}).sort("created_at", 1):
            e = oid(e)
            pdate = page_map.get(e["page_id"], {}).get("date", "")

            if e["type"] == "bill":
                bills.append({
                    "id": e["id"], "bill_no": e.get("bill_no"),
                    "amount": e.get("amount"), "date": pdate, "page_id": e["page_id"],
                })
            elif e["type"] == "item":
                qty = float(e.get("qty") or 0)
                price = e.get("price")
                items.append({
                    "id": e["id"], "item_name": e.get("item_name"),
                    "qty": qty, "price": price,
                    "total": round(qty * float(price), 2) if price is not None else None,
                    "date": pdate, "page_id": e["page_id"],
                })
            elif e["type"] == "money_received":
                money_in.append({
                    "id": e["id"], "amount": e.get("amount"),
                    "note": e.get("note"), "date": pdate, "page_id": e["page_id"],
                })
            elif e["type"] == "money_given":
                money_out.append({
                    "id": e["id"], "amount": e.get("amount"),
                    "note": e.get("note"), "date": pdate, "page_id": e["page_id"],
                })

    bal = await get_balance(cid)
    return {"bills": bills, "items": items, "money_in": money_in, "money_out": money_out, **bal}


# ────────── CLOUDINARY ──────────

@api_router.get("/cloudinary/signature")
async def cloudinary_signature():
    timestamp = int(time.time())
    folder = "hisab"
    params = {"timestamp": timestamp, "folder": folder}
    signature = cloudinary.utils.api_sign_request(params, os.environ.get("CLOUDINARY_API_SECRET"))
    return {
        "signature": signature,
        "timestamp": timestamp,
        "cloud_name": os.environ.get("CLOUDINARY_CLOUD_NAME"),
        "api_key": os.environ.get("CLOUDINARY_API_KEY"),
        "folder": folder,
    }


class CloudinaryImageSave(BaseModel):
    url: str
    public_id: str


@api_router.post("/pages/{pid}/images/save")
async def save_cloudinary_image(pid: str, data: CloudinaryImageSave):
    await db.pages.update_one(
        {"_id": ObjectId(pid)},
        {"$push": {"images": {"url": data.url, "public_id": data.public_id}}},
    )
    return {"success": True}


@api_router.post("/pages/{pid}/images/delete")
async def delete_cloudinary_image(pid: str, data: dict):
    public_id = data.get("public_id")
    url = data.get("url")
    if public_id:
        try:
            cloudinary.uploader.destroy(public_id, invalidate=True)
        except Exception as e:
            logger.error(f"Cloudinary delete error: {e}")
    pull_filter = {"url": url} if url else {"public_id": public_id}
    await db.pages.update_one({"_id": ObjectId(pid)}, {"$pull": {"images": pull_filter}})
    return {"success": True}


# ────────── MOUNT & INCLUDE ──────────

app.mount("/api/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")
app.include_router(api_router)

# ── Serve React build in production (when /app/backend/static/ exists) ──
BUILD_DIR = ROOT_DIR / "static"
if BUILD_DIR.exists():
    react_assets = BUILD_DIR / "static"
    if react_assets.exists():
        app.mount("/static", StaticFiles(directory=str(react_assets)), name="react-assets")

    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str):
        return FileResponse(str(BUILD_DIR / "index.html"))
