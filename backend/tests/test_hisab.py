"""Backend tests for Hisab Book app - all CRUD flows"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# ── Helper ──────────────────────────────────────────────────────
def api(method, path, **kwargs):
    return getattr(requests, method)(f"{BASE_URL}/api{path}", **kwargs)


# ── Customers ────────────────────────────────────────────────────
class TestCustomers:
    customer_id = None

    def test_create_customer(self):
        r = api("post", "/customers", json={"name": "TEST_Customer_Alpha", "phone": "9999999999"})
        assert r.status_code == 200
        d = r.json()
        assert d["name"] == "TEST_Customer_Alpha"
        assert "id" in d
        TestCustomers.customer_id = d["id"]
        print(f"Created customer: {TestCustomers.customer_id}")

    def test_list_customers(self):
        r = api("get", "/customers")
        assert r.status_code == 200
        names = [c["name"] for c in r.json()]
        assert "TEST_Customer_Alpha" in names

    def test_customer_has_balance_fields(self):
        r = api("get", "/customers")
        assert r.status_code == 200
        cust = next((c for c in r.json() if c["name"] == "TEST_Customer_Alpha"), None)
        assert cust is not None
        for field in ["balance", "pending_bills", "pending_prices", "bill_total", "item_total", "money_received", "money_given"]:
            assert field in cust, f"Missing field: {field}"

    def test_update_customer(self):
        assert TestCustomers.customer_id
        r = api("put", f"/customers/{TestCustomers.customer_id}", json={"name": "TEST_Customer_Alpha_Updated"})
        assert r.status_code == 200

    def test_delete_customer(self):
        # cleanup - test at end
        r = api("delete", f"/customers/{TestCustomers.customer_id}")
        assert r.status_code == 200


# ── Full Flow: Pages + Entries ──────────────────────────────────
class TestPagesAndEntries:
    cid = None
    page_id = None
    bill_eid = None
    item_eid_no_price = None

    @pytest.fixture(autouse=True, scope="class")
    def setup_customer(self):
        r = api("post", "/customers", json={"name": "TEST_Flow_Customer"})
        TestPagesAndEntries.cid = r.json()["id"]
        yield
        # cleanup
        api("delete", f"/customers/{TestPagesAndEntries.cid}")

    def test_create_page(self):
        r = api("post", f"/customers/{self.cid}/pages", json={"date": "2025-01-15"})
        assert r.status_code == 200
        d = r.json()
        assert d["date"] == "2025-01-15"
        assert d["is_settled"] == False
        TestPagesAndEntries.page_id = d["id"]

    def test_list_pages(self):
        r = api("get", f"/customers/{self.cid}/pages", params={"settled": False})
        assert r.status_code == 200
        d = r.json()
        assert "pages" in d and "total" in d
        assert d["total"] >= 1

    def test_get_page(self):
        r = api("get", f"/pages/{self.page_id}")
        assert r.status_code == 200
        assert r.json()["id"] == self.page_id

    # ── Entries ──
    def test_add_bill_with_amount(self):
        r = api("post", f"/pages/{self.page_id}/entries", json={"type": "bill", "amount": 500.0})
        assert r.status_code == 200
        d = r.json()
        assert d["type"] == "bill"
        assert d["amount"] == 500.0
        assert "bill_no" in d
        TestPagesAndEntries.bill_eid = d["id"]

    def test_add_bill_without_amount(self):
        r = api("post", f"/pages/{self.page_id}/entries", json={"type": "bill", "amount": None})
        assert r.status_code == 200
        d = r.json()
        assert d["amount"] is None
        assert "bill_no" in d

    def test_add_item_with_price(self):
        r = api("post", f"/pages/{self.page_id}/entries", json={"type": "item", "item_name": "Rice", "qty": 2.0, "price": 50.0})
        assert r.status_code == 200
        d = r.json()
        assert d["item_name"] == "Rice"
        assert d["price"] == 50.0

    def test_add_item_without_price(self):
        r = api("post", f"/pages/{self.page_id}/entries", json={"type": "item", "item_name": "Sugar", "qty": 1.0, "price": None})
        assert r.status_code == 200
        d = r.json()
        assert d["price"] is None
        TestPagesAndEntries.item_eid_no_price = d["id"]

    def test_add_money_received(self):
        r = api("post", f"/pages/{self.page_id}/entries", json={"type": "money_received", "amount": 200.0, "note": "Cash"})
        assert r.status_code == 200
        d = r.json()
        assert d["amount"] == 200.0
        assert d["note"] == "Cash"

    def test_add_money_given(self):
        r = api("post", f"/pages/{self.page_id}/entries", json={"type": "money_given", "amount": 100.0, "note": "Advance"})
        assert r.status_code == 200
        assert r.json()["amount"] == 100.0

    def test_add_note(self):
        r = api("post", f"/pages/{self.page_id}/entries", json={"type": "note", "note": "Test note entry"})
        assert r.status_code == 200
        assert r.json()["note"] == "Test note entry"

    def test_get_entries(self):
        r = api("get", f"/pages/{self.page_id}/entries")
        assert r.status_code == 200
        assert len(r.json()) >= 5

    def test_update_entry(self):
        r = api("put", f"/entries/{self.bill_eid}", json={"amount": 600.0})
        assert r.status_code == 200
        # Verify updated
        entries = api("get", f"/pages/{self.page_id}/entries").json()
        bill = next((e for e in entries if e["id"] == self.bill_eid), None)
        assert bill["amount"] == 600.0

    def test_delete_entry(self):
        # Add one to delete
        r = api("post", f"/pages/{self.page_id}/entries", json={"type": "note", "note": "to delete"})
        eid = r.json()["id"]
        dr = api("delete", f"/entries/{eid}")
        assert dr.status_code == 200
        entries = api("get", f"/pages/{self.page_id}/entries").json()
        assert not any(e["id"] == eid for e in entries)

    # ── Balance / Summary ──
    def test_balance_calculation(self):
        r = api("get", "/customers")
        cust = next((c for c in r.json() if c["id"] == self.cid), None)
        assert cust is not None
        # bill 600 + item 100 (2*50) + given 100 - received 200 = 600
        assert cust["balance"] == pytest.approx(600.0, abs=1.0)

    def test_summary(self):
        r = api("get", f"/customers/{self.cid}/summary")
        assert r.status_code == 200
        d = r.json()
        assert "bills" in d and "items" in d and "money_in" in d and "money_out" in d

    # ── Pending Bills/Prices ──
    def test_pending_bills(self):
        r = api("get", f"/customers/{self.cid}/pending-bills")
        assert r.status_code == 200
        # There should be 1 bill without amount
        assert len(r.json()) >= 1

    def test_pending_prices(self):
        r = api("get", f"/customers/{self.cid}/pending-prices")
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_fill_bill_amount(self):
        pending = api("get", f"/customers/{self.cid}/pending-bills").json()
        eid = pending[0]["id"]
        r = api("patch", f"/entries/{eid}/fill", json={"amount": 300.0})
        assert r.status_code == 200
        # Verify pending count decreased
        remaining = api("get", f"/customers/{self.cid}/pending-bills").json()
        assert len(remaining) < len(pending) or all(e["id"] != eid for e in remaining)

    def test_fill_item_price(self):
        r = api("patch", f"/entries/{self.item_eid_no_price}/fill", json={"price": 80.0})
        assert r.status_code == 200

    # ── Item prices/autocomplete ──
    def test_item_names(self):
        r = api("get", f"/customers/{self.cid}/item-names")
        assert r.status_code == 200
        assert "Rice" in r.json()

    def test_item_prices_memory(self):
        r = api("get", f"/customers/{self.cid}/item-prices")
        assert r.status_code == 200
        names = [ip["item_name"] for ip in r.json()]
        assert "Rice" in names

    # ── Settle / Unsettle ──
    def test_settle_page(self):
        r = api("post", "/pages/settle", json={"page_ids": [self.page_id]})
        assert r.status_code == 200
        # Verify settled
        settled = api("get", f"/customers/{self.cid}/pages", params={"settled": True}).json()
        assert any(p["id"] == self.page_id for p in settled["pages"])

    def test_settled_not_in_active(self):
        active = api("get", f"/customers/{self.cid}/pages", params={"settled": False}).json()
        assert not any(p["id"] == self.page_id for p in active["pages"])

    def test_unsettle_page(self):
        r = api("post", f"/pages/{self.page_id}/unsettle")
        assert r.status_code == 200
        active = api("get", f"/customers/{self.cid}/pages", params={"settled": False}).json()
        assert any(p["id"] == self.page_id for p in active["pages"])

    def test_delete_page(self):
        r = api("delete", f"/pages/{self.page_id}")
        assert r.status_code == 200
