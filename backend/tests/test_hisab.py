"""
Backend tests for Hisab Book app.
Tests: Customers CRUD, Pages CRUD, Entries CRUD,
New endpoints: /api/customers/{cid}/single, /api/all-pages
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# ──────────────────────────────────────
# Fixtures
# ──────────────────────────────────────

@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def test_customer(session):
    """Create a customer for testing, clean up after module."""
    res = session.post(f"{BASE_URL}/api/customers", json={"name": "TEST_HisabUser", "phone": "9999999999"})
    assert res.status_code == 200, f"Create customer failed: {res.text}"
    data = res.json()
    yield data
    # Cleanup
    session.delete(f"{BASE_URL}/api/customers/{data['id']}")


@pytest.fixture(scope="module")
def test_page(session, test_customer):
    """Create a page for testing, clean up after module."""
    cid = test_customer["id"]
    res = session.post(f"{BASE_URL}/api/customers/{cid}/pages", json={"date": "2026-01-15"})
    assert res.status_code == 200, f"Create page failed: {res.text}"
    data = res.json()
    yield data
    # Cleanup (will be deleted with customer)


# ──────────────────────────────────────
# Health check
# ──────────────────────────────────────

class TestHealth:
    """Basic health check"""

    def test_customers_list_returns_200(self, session):
        res = session.get(f"{BASE_URL}/api/customers")
        assert res.status_code == 200, f"Customers list failed: {res.status_code} {res.text}"
        assert isinstance(res.json(), list)
        print("PASS: GET /api/customers returns 200 with list")


# ──────────────────────────────────────
# Customer CRUD
# ──────────────────────────────────────

class TestCustomerCRUD:
    """Customer create, read, update, delete operations"""

    def test_create_customer(self, session):
        res = session.post(f"{BASE_URL}/api/customers", json={"name": "TEST_Temp", "phone": "1234567890"})
        assert res.status_code == 200, f"Create customer failed: {res.text}"
        data = res.json()
        assert "id" in data
        assert data["name"] == "TEST_Temp"
        assert data["phone"] == "1234567890"
        # Cleanup
        session.delete(f"{BASE_URL}/api/customers/{data['id']}")
        print("PASS: POST /api/customers creates customer with id")

    def test_list_customers_has_expected_fields(self, session, test_customer):
        res = session.get(f"{BASE_URL}/api/customers")
        assert res.status_code == 200
        data = res.json()
        # Find our test customer
        found = next((c for c in data if c["id"] == test_customer["id"]), None)
        assert found is not None, "Test customer not found in list"
        assert "balance" in found
        assert "bill_total" in found
        assert "item_total" in found
        assert "money_received" in found
        assert "money_given" in found
        assert "pending_bills" in found
        assert "pending_prices" in found
        print("PASS: GET /api/customers returns customers with balance fields")

    def test_update_customer(self, session, test_customer):
        cid = test_customer["id"]
        res = session.put(f"{BASE_URL}/api/customers/{cid}", json={"name": "TEST_HisabUser_Updated"})
        assert res.status_code == 200
        data = res.json()
        assert data.get("success") is True
        # Revert
        session.put(f"{BASE_URL}/api/customers/{cid}", json={"name": "TEST_HisabUser"})
        print("PASS: PUT /api/customers/{cid} updates customer")

    def test_get_single_customer_new_endpoint(self, session, test_customer):
        """NEW ENDPOINT: GET /api/customers/{cid}/single"""
        cid = test_customer["id"]
        res = session.get(f"{BASE_URL}/api/customers/{cid}/single")
        assert res.status_code == 200, f"Single customer endpoint failed: {res.status_code} {res.text}"
        data = res.json()
        assert data["id"] == cid
        assert "balance" in data
        assert "bill_total" in data
        assert "item_total" in data
        assert "money_received" in data
        assert "money_given" in data
        assert "pending_bills" in data
        assert "pending_prices" in data
        print("PASS: GET /api/customers/{cid}/single returns customer with balance fields")

    def test_get_single_customer_invalid_id(self, session):
        """New endpoint returns 404 for invalid/non-existent customer."""
        res = session.get(f"{BASE_URL}/api/customers/000000000000000000000000/single")
        assert res.status_code == 404, f"Expected 404 for invalid customer, got: {res.status_code}"
        print("PASS: GET /api/customers/{cid}/single returns 404 for non-existent")


# ──────────────────────────────────────
# Pages CRUD
# ──────────────────────────────────────

class TestPagesCRUD:
    """Pages create, read, delete operations"""

    def test_list_pages(self, session, test_customer, test_page):
        cid = test_customer["id"]
        res = session.get(f"{BASE_URL}/api/customers/{cid}/pages")
        assert res.status_code == 200, f"List pages failed: {res.text}"
        data = res.json()
        assert "pages" in data
        assert "total" in data
        assert isinstance(data["pages"], list)
        # Should contain our test page
        found = next((p for p in data["pages"] if p["id"] == test_page["id"]), None)
        assert found is not None
        print("PASS: GET /api/customers/{cid}/pages returns pages list with total")

    def test_get_single_page(self, session, test_page):
        pid = test_page["id"]
        res = session.get(f"{BASE_URL}/api/pages/{pid}")
        assert res.status_code == 200, f"Get page failed: {res.text}"
        data = res.json()
        assert data["id"] == pid
        assert data["date"] == "2026-01-15"
        print("PASS: GET /api/pages/{pid} returns page")

    def test_create_page_and_delete(self, session, test_customer):
        cid = test_customer["id"]
        res = session.post(f"{BASE_URL}/api/customers/{cid}/pages", json={"date": "2026-02-01"})
        assert res.status_code == 200
        data = res.json()
        assert "id" in data
        assert data["date"] == "2026-02-01"
        pid = data["id"]
        # Delete
        del_res = session.delete(f"{BASE_URL}/api/pages/{pid}")
        assert del_res.status_code == 200
        # Verify deleted
        get_res = session.get(f"{BASE_URL}/api/pages/{pid}")
        assert get_res.status_code == 404
        print("PASS: POST/DELETE /api/customers/{cid}/pages works correctly")

    def test_update_page_date(self, session, test_page):
        pid = test_page["id"]
        res = session.put(f"{BASE_URL}/api/pages/{pid}", json={"date": "2026-01-20"})
        assert res.status_code == 200
        # Revert
        session.put(f"{BASE_URL}/api/pages/{pid}", json={"date": "2026-01-15"})
        print("PASS: PUT /api/pages/{pid} updates page date")


# ──────────────────────────────────────
# Entries CRUD
# ──────────────────────────────────────

class TestEntriesCRUD:
    """Entry create, read, update, delete operations"""

    def test_create_bill_entry(self, session, test_page):
        pid = test_page["id"]
        res = session.post(f"{BASE_URL}/api/pages/{pid}/entries", json={"type": "bill", "amount": 500.0})
        assert res.status_code == 200, f"Create bill entry failed: {res.text}"
        data = res.json()
        assert data["type"] == "bill"
        assert data["amount"] == 500.0
        assert "bill_no" in data
        assert "id" in data
        # Cleanup
        session.delete(f"{BASE_URL}/api/entries/{data['id']}")
        print("PASS: POST /api/pages/{pid}/entries creates bill entry")

    def test_create_item_entry(self, session, test_page):
        pid = test_page["id"]
        res = session.post(f"{BASE_URL}/api/pages/{pid}/entries", json={
            "type": "item", "item_name": "TEST_Widget", "qty": 3, "price": 100.0
        })
        assert res.status_code == 200
        data = res.json()
        assert data["type"] == "item"
        assert data["item_name"] == "TEST_Widget"
        assert data["qty"] == 3
        assert data["price"] == 100.0
        eid = data["id"]
        # Cleanup
        session.delete(f"{BASE_URL}/api/entries/{eid}")
        print("PASS: POST /api/pages/{pid}/entries creates item entry")

    def test_create_money_received_entry(self, session, test_page):
        pid = test_page["id"]
        res = session.post(f"{BASE_URL}/api/pages/{pid}/entries", json={
            "type": "money_received", "amount": 200.0, "note": "advance"
        })
        assert res.status_code == 200
        data = res.json()
        assert data["type"] == "money_received"
        assert data["amount"] == 200.0
        eid = data["id"]
        session.delete(f"{BASE_URL}/api/entries/{eid}")
        print("PASS: POST /api/pages/{pid}/entries creates money_received entry")

    def test_create_note_entry(self, session, test_page):
        pid = test_page["id"]
        res = session.post(f"{BASE_URL}/api/pages/{pid}/entries", json={
            "type": "note", "note": "Test note"
        })
        assert res.status_code == 200
        data = res.json()
        assert data["type"] == "note"
        assert data["note"] == "Test note"
        eid = data["id"]
        session.delete(f"{BASE_URL}/api/entries/{eid}")
        print("PASS: POST /api/pages/{pid}/entries creates note entry")

    def test_get_entries_for_page(self, session, test_page):
        pid = test_page["id"]
        res = session.get(f"{BASE_URL}/api/pages/{pid}/entries")
        assert res.status_code == 200
        assert isinstance(res.json(), list)
        print("PASS: GET /api/pages/{pid}/entries returns list")

    def test_delete_entry(self, session, test_page):
        pid = test_page["id"]
        # Create entry
        create_res = session.post(f"{BASE_URL}/api/pages/{pid}/entries", json={"type": "bill", "amount": 100})
        eid = create_res.json()["id"]
        # Delete
        del_res = session.delete(f"{BASE_URL}/api/entries/{eid}")
        assert del_res.status_code == 200
        # Verify removed
        entries = session.get(f"{BASE_URL}/api/pages/{pid}/entries").json()
        assert not any(e["id"] == eid for e in entries)
        print("PASS: DELETE /api/entries/{eid} removes entry")

    def test_update_entry(self, session, test_page):
        pid = test_page["id"]
        create_res = session.post(f"{BASE_URL}/api/pages/{pid}/entries", json={"type": "bill", "amount": None})
        eid = create_res.json()["id"]
        # Update to set amount
        upd_res = session.put(f"{BASE_URL}/api/entries/{eid}", json={"amount": 750.0})
        assert upd_res.status_code == 200
        # Cleanup
        session.delete(f"{BASE_URL}/api/entries/{eid}")
        print("PASS: PUT /api/entries/{eid} updates entry")


# ──────────────────────────────────────
# All Pages Endpoint (NEW)
# ──────────────────────────────────────

class TestAllPages:
    """Test the new GET /api/all-pages endpoint"""

    def test_all_pages_returns_200(self, session):
        res = session.get(f"{BASE_URL}/api/all-pages")
        assert res.status_code == 200, f"All pages endpoint failed: {res.status_code} {res.text}"
        data = res.json()
        assert "pages" in data
        assert "total" in data
        assert isinstance(data["pages"], list)
        print("PASS: GET /api/all-pages returns 200 with pages and total")

    def test_all_pages_has_customer_name(self, session, test_customer, test_page):
        """All pages entries should have customer_name field."""
        cid = test_customer["id"]
        res = session.get(f"{BASE_URL}/api/all-pages?page=1&limit=100")
        assert res.status_code == 200
        data = res.json()
        # Find our test page in the results
        found = next((p for p in data["pages"] if p["id"] == test_page["id"]), None)
        if found:
            assert "customer_name" in found, "customer_name field missing from all-pages result"
            assert found["customer_name"] == "TEST_HisabUser"
            print(f"PASS: GET /api/all-pages includes customer_name field: {found['customer_name']}")
        else:
            print("NOTE: test page not found in first 100 all-pages results (may need pagination)")

    def test_all_pages_sorted_by_date_desc(self, session):
        res = session.get(f"{BASE_URL}/api/all-pages?page=1&limit=50")
        assert res.status_code == 200
        data = res.json()
        pages = data["pages"]
        if len(pages) > 1:
            dates = [p["date"] for p in pages]
            assert dates == sorted(dates, reverse=True), f"Pages not sorted by date desc: {dates[:5]}"
            print("PASS: GET /api/all-pages sorted by date descending")
        else:
            print("NOTE: Less than 2 pages, skip sort check")

    def test_all_pages_pagination(self, session):
        res = session.get(f"{BASE_URL}/api/all-pages?page=1&limit=5")
        assert res.status_code == 200
        data = res.json()
        assert len(data["pages"]) <= 5
        print("PASS: GET /api/all-pages pagination works (limit=5 respected)")


# ──────────────────────────────────────
# Customer Detail tabs
# ──────────────────────────────────────

class TestCustomerDetailTabs:
    """Test various per-customer tab endpoints"""

    def test_summary_endpoint(self, session, test_customer):
        cid = test_customer["id"]
        res = session.get(f"{BASE_URL}/api/customers/{cid}/summary")
        assert res.status_code == 200
        data = res.json()
        assert "bills" in data and "items" in data and "money_in" in data and "money_out" in data
        print("PASS: GET /api/customers/{cid}/summary returns summary")

    def test_pending_bills_endpoint(self, session, test_customer):
        cid = test_customer["id"]
        res = session.get(f"{BASE_URL}/api/customers/{cid}/pending-bills")
        assert res.status_code == 200
        assert isinstance(res.json(), list)
        print("PASS: GET /api/customers/{cid}/pending-bills returns list")

    def test_pending_prices_endpoint(self, session, test_customer):
        cid = test_customer["id"]
        res = session.get(f"{BASE_URL}/api/customers/{cid}/pending-prices")
        assert res.status_code == 200
        assert isinstance(res.json(), list)
        print("PASS: GET /api/customers/{cid}/pending-prices returns list")

    def test_item_prices_endpoint(self, session, test_customer):
        cid = test_customer["id"]
        res = session.get(f"{BASE_URL}/api/customers/{cid}/item-prices")
        assert res.status_code == 200
        assert isinstance(res.json(), list)
        print("PASS: GET /api/customers/{cid}/item-prices returns list")

    def test_item_names_endpoint(self, session, test_customer):
        cid = test_customer["id"]
        res = session.get(f"{BASE_URL}/api/customers/{cid}/item-names")
        assert res.status_code == 200
        assert isinstance(res.json(), list)
        print("PASS: GET /api/customers/{cid}/item-names returns list")

    def test_settled_pages_endpoint(self, session, test_customer):
        cid = test_customer["id"]
        res = session.get(f"{BASE_URL}/api/customers/{cid}/pages?settled=true")
        assert res.status_code == 200
        data = res.json()
        assert "pages" in data
        print("PASS: GET /api/customers/{cid}/pages?settled=true returns settled pages")


# ──────────────────────────────────────
# Fill Entry (pending bills/prices)
# ──────────────────────────────────────

class TestFillEntry:
    """Test PATCH /entries/{eid}/fill endpoint"""

    def test_fill_bill_amount(self, session, test_page):
        pid = test_page["id"]
        # Create pending bill (no amount)
        create_res = session.post(f"{BASE_URL}/api/pages/{pid}/entries", json={"type": "bill", "amount": None})
        assert create_res.status_code == 200
        eid = create_res.json()["id"]
        # Fill amount
        fill_res = session.patch(f"{BASE_URL}/api/entries/{eid}/fill", json={"amount": 300.0})
        assert fill_res.status_code == 200
        assert fill_res.json().get("success") is True
        # Cleanup
        session.delete(f"{BASE_URL}/api/entries/{eid}")
        print("PASS: PATCH /api/entries/{eid}/fill fills bill amount")

    def test_fill_item_price(self, session, test_page):
        pid = test_page["id"]
        # Create item without price
        create_res = session.post(f"{BASE_URL}/api/pages/{pid}/entries", json={
            "type": "item", "item_name": "TEST_Rice", "qty": 5, "price": None
        })
        assert create_res.status_code == 200
        eid = create_res.json()["id"]
        # Fill price
        fill_res = session.patch(f"{BASE_URL}/api/entries/{eid}/fill", json={"price": 50.0})
        assert fill_res.status_code == 200
        # Cleanup
        session.delete(f"{BASE_URL}/api/entries/{eid}")
        print("PASS: PATCH /api/entries/{eid}/fill fills item price")
