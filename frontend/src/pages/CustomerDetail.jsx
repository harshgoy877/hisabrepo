import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../utils/api";
import { fmtAmt, fmtDate, today } from "../utils/fmt";

const TABS = [
  { key: "pages", label: "Pages" },
  { key: "summary", label: "Summary" },
  { key: "pending-bills", label: "Pending Bills" },
  { key: "pending-prices", label: "Pending Prices" },
  { key: "price-memory", label: "Price Memory" },
  { key: "settled", label: "Settled" },
];

export default function CustomerDetail() {
  const { cid } = useParams();
  const nav = useNavigate();
  const [tab, setTab] = useState("pages");
  const [customer, setCustomer] = useState(null);
  const [pages, setPages] = useState([]);
  const [pagesTotal, setPagesTotal] = useState(0);
  const [pagesPage, setPagesPage] = useState(1);
  const [summary, setSummary] = useState(null);
  const [pendingBills, setPendingBills] = useState([]);
  const [pendingPrices, setPendingPrices] = useState([]);
  const [priceMemory, setPriceMemory] = useState([]);
  const [settledPages, setSettledPages] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [showAddPage, setShowAddPage] = useState(false);
  const [newDate, setNewDate] = useState(today());
  const [fillAmounts, setFillAmounts] = useState({});
  const [fillPrices, setFillPrices] = useState({});
  const [pageSearch, setPageSearch] = useState("");
  const [summarySearch, setSummarySearch] = useState("");
  const [pendingBillSearch, setPendingBillSearch] = useState("");
  const [pendingPriceSearch, setPendingPriceSearch] = useState("");
  const [priceMemSearch, setPriceMemSearch] = useState("");
  const [settledSearch, setSettledSearch] = useState("");
  const [pendingDeletePage, setPendingDeletePage] = useState(null);

  const LIMIT = 20;

  const loadCustomer = useCallback(async () => {
    const r = await api.get("/customers");
    const c = r.data.find(x => x.id === cid);
    if (c) setCustomer(c);
  }, [cid]);

  const loadPages = useCallback(async (pg = 1) => {
    const r = await api.get(`/customers/${cid}/pages`, { params: { settled: false, page: pg, limit: LIMIT } });
    if (pg === 1) setPages(r.data.pages);
    else setPages(prev => [...prev, ...r.data.pages]);
    setPagesTotal(r.data.total);
    setPagesPage(pg);
  }, [cid]);

  const loadSummary = useCallback(async () => {
    const r = await api.get(`/customers/${cid}/summary`);
    setSummary(r.data);
  }, [cid]);

  const loadPendingBills = useCallback(async () => {
    const r = await api.get(`/customers/${cid}/pending-bills`);
    setPendingBills(r.data);
  }, [cid]);

  const loadPendingPrices = useCallback(async () => {
    const r = await api.get(`/customers/${cid}/pending-prices`);
    setPendingPrices(r.data);
  }, [cid]);

  const loadPriceMemory = useCallback(async () => {
    const r = await api.get(`/customers/${cid}/item-prices`);
    setPriceMemory(r.data);
  }, [cid]);

  const loadSettled = useCallback(async () => {
    const r = await api.get(`/customers/${cid}/pages`, { params: { settled: true, page: 1, limit: 50 } });
    setSettledPages(r.data.pages);
  }, [cid]);

  const refreshTab = useCallback(() => {
    loadCustomer();
    if (tab === "pages") loadPages(1);
    else if (tab === "summary") loadSummary();
    else if (tab === "pending-bills") loadPendingBills();
    else if (tab === "pending-prices") loadPendingPrices();
    else if (tab === "price-memory") loadPriceMemory();
    else if (tab === "settled") loadSettled();
  }, [tab, loadCustomer, loadPages, loadSummary, loadPendingBills, loadPendingPrices, loadPriceMemory, loadSettled]);

  useEffect(() => {
    refreshTab();
    const t = setInterval(refreshTab, 5000);
    return () => clearInterval(t);
  }, [refreshTab]);

  async function addPage(e) {
    e.preventDefault();
    await api.post(`/customers/${cid}/pages`, { date: newDate });
    setShowAddPage(false);
    setNewDate(today());
    loadPages(1);
    setSelected(new Set());
  }

  async function deletePage(pid) {
    await api.delete(`/pages/${pid}`);
    setPendingDeletePage(null);
    loadPages(1);
    loadCustomer();
  }

  function toggleSelect(pid) {
    setSelected(prev => {
      const s = new Set(prev);
      s.has(pid) ? s.delete(pid) : s.add(pid);
      return s;
    });
  }

  async function settleSelected() {
    if (!selected.size) return;
    await api.post("/pages/settle", { page_ids: Array.from(selected) });
    setSelected(new Set());
    loadPages(1);
    loadCustomer();
  }

  async function unsettlePage(pid) {
    await api.post(`/pages/${pid}/unsettle`);
    loadSettled();
    loadCustomer();
  }

  async function fillBillAmount(eid) {
    const amt = parseFloat(fillAmounts[eid]);
    if (!amt || isNaN(amt)) return;
    await api.patch(`/entries/${eid}/fill`, { amount: amt });
    setFillAmounts(p => { const n = { ...p }; delete n[eid]; return n; });
    loadPendingBills();
    loadCustomer();
  }

  async function fillItemPrice(eid) {
    const price = parseFloat(fillPrices[eid]);
    if (!price || isNaN(price)) return;
    await api.patch(`/entries/${eid}/fill`, { price });
    setFillPrices(p => { const n = { ...p }; delete n[eid]; return n; });
    loadPendingPrices();
    loadCustomer();
  }

  // Group items by date for summary
  function groupByDate(items) {
    const map = {};
    items.forEach(it => {
      if (!map[it.date]) map[it.date] = [];
      map[it.date].push(it);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }

  if (!customer) return <div className="p-6 text-center text-gray-400">Loading...</div>;

  const bal = customer.balance || 0;

  return (
    <div className="container">
      {/* Header */}
      <div className="flex items-center gap-3 mt-3 mb-3">
        <button data-testid="back-btn" onClick={() => nav("/")} className="text-blue-600 text-sm hover:underline">← Back</button>
        <h2 className="text-xl font-bold text-gray-800 flex-1">{customer.name}</h2>
      </div>

      {/* Balance Bar */}
      <div data-testid="balance-bar" className="bg-white border rounded p-3 mb-3 flex flex-wrap gap-3 text-sm items-center">
        <div className="font-semibold">
          {bal > 0 && <span className="text-red-600">Owes you {fmtAmt(bal)}</span>}
          {bal < 0 && <span className="text-green-600">You owe {fmtAmt(Math.abs(bal))}</span>}
          {bal === 0 && <span className="text-gray-500">Settled (no balance)</span>}
        </div>
        <div className="flex gap-3 text-xs text-gray-500 flex-wrap">
          <span>Bills: {fmtAmt(customer.bill_total)}</span>
          <span>Items: {fmtAmt(customer.item_total)}</span>
          <span>Received: {fmtAmt(customer.money_received)}</span>
          <span>Given: {fmtAmt(customer.money_given)}</span>
        </div>
        {(customer.pending_bills > 0 || customer.pending_prices > 0) && (
          <div className="text-orange-500 text-xs font-medium ml-auto">
            {customer.pending_bills > 0 && <span>{customer.pending_bills} pending bill{customer.pending_bills > 1 ? "s" : ""} </span>}
            {customer.pending_prices > 0 && <span>{customer.pending_prices} pending price{customer.pending_prices > 1 ? "s" : ""}</span>}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b mb-3 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            data-testid={`tab-${t.key}`}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px ${tab === t.key ? "border-blue-600 text-blue-600 font-medium" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >{t.label}</button>
        ))}
      </div>

      {/* Pages Tab */}
      {tab === "pages" && (
        <div>
          <div className="flex gap-2 mb-3 items-center">
            <button
              data-testid="add-page-btn"
              onClick={() => setShowAddPage(!showAddPage)}
              className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm"
            >+ Add Page</button>
            {selected.size > 0 && (
              <button
                data-testid="settle-selected-btn"
                onClick={settleSelected}
                className="bg-orange-500 text-white px-3 py-1.5 rounded text-sm"
              >Settle {selected.size} page{selected.size > 1 ? "s" : ""}</button>
            )}
          </div>

          <input
            data-testid="page-search"
            className="border rounded px-3 py-1.5 text-sm w-full mb-3 bg-white"
            placeholder="Search pages by date..."
            value={pageSearch}
            onChange={e => setPageSearch(e.target.value)}
          />

          {showAddPage && (
            <form onSubmit={addPage} className="bg-white border rounded p-3 mb-3 flex gap-2 items-center">
              <label className="text-sm text-gray-600">Date:</label>
              <input
                data-testid="new-page-date"
                type="date"
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
                className="border rounded px-2 py-1 text-sm"
              />
              <button type="submit" className="bg-green-600 text-white px-3 py-1.5 rounded text-sm">Create</button>
              <button type="button" onClick={() => setShowAddPage(false)} className="border px-3 py-1.5 rounded text-sm text-gray-600">Cancel</button>
            </form>
          )}

          {pages.length === 0 && <div className="text-gray-400 text-sm py-8 text-center">No pages yet.</div>}

          <div className="space-y-1.5">
            {pages.filter(p => !pageSearch.trim() || fmtDate(p.date).toLowerCase().includes(pageSearch.toLowerCase()) || p.date.includes(pageSearch)).map(p => (
              <div key={p.id} data-testid={`page-card-${p.id}`} className="bg-white border rounded p-2.5 flex items-center gap-2">
                <input
                  type="checkbox"
                  data-testid={`select-page-${p.id}`}
                  checked={selected.has(p.id)}
                  onChange={() => toggleSelect(p.id)}
                  className="w-4 h-4 shrink-0"
                />
                <div
                  className="flex-1 cursor-pointer"
                  onClick={() => nav(`/customer/${cid}/page/${p.id}`)}
                >
                  <span className="text-sm font-medium text-gray-700">{fmtDate(p.date)}</span>
                  {p.images && p.images.length > 0 && (
                    <span className="ml-2 text-xs text-gray-400">{p.images.length} image{p.images.length > 1 ? "s" : ""}</span>
                  )}
                </div>
                {pendingDeletePage === p.id ? (
                  <>
                    <button
                      data-testid={`confirm-delete-page-${p.id}`}
                      onClick={() => deletePage(p.id)}
                      className="text-xs border px-2 py-0.5 rounded bg-red-500 text-white"
                    >Sure?</button>
                    <button
                      onClick={() => setPendingDeletePage(null)}
                      className="text-xs border px-2 py-0.5 rounded text-gray-500"
                    >No</button>
                  </>
                ) : (
                  <button
                    data-testid={`delete-page-${p.id}`}
                    onClick={() => setPendingDeletePage(p.id)}
                    className="text-xs text-red-500 border px-2 py-0.5 rounded hover:bg-red-50"
                  >Delete</button>
                )}
              </div>
            ))}
          </div>

          {pages.length < pagesTotal && (
            <button
              data-testid="load-more-pages"
              onClick={() => loadPages(pagesPage + 1)}
              className="mt-3 w-full border rounded py-2 text-sm text-gray-500 hover:bg-gray-50"
            >Load more ({pagesTotal - pages.length} remaining)</button>
          )}
        </div>
      )}

      {/* Summary Tab */}
      {tab === "summary" && (
        <div data-testid="summary-section">
          <input
            data-testid="summary-search"
            className="border rounded px-3 py-1.5 text-sm w-full mb-3 bg-white"
            placeholder="Search in summary (item name, bill no, note)..."
            value={summarySearch}
            onChange={e => setSummarySearch(e.target.value)}
          />
          {!summary && <div className="text-gray-400 text-sm py-4 text-center">Loading summary...</div>}
          {summary && (() => {
            const q = summarySearch.toLowerCase();
            const filtBills = summary.bills.filter(b => !q || String(b.bill_no).includes(q) || fmtDate(b.date).toLowerCase().includes(q));
            const filtItems = summary.items.filter(it => !q || (it.item_name || "").toLowerCase().includes(q) || fmtDate(it.date).toLowerCase().includes(q));
            const filtMoneyIn = summary.money_in.filter(m => !q || (m.note || "").toLowerCase().includes(q) || fmtDate(m.date).toLowerCase().includes(q));
            const filtMoneyOut = summary.money_out.filter(m => !q || (m.note || "").toLowerCase().includes(q) || fmtDate(m.date).toLowerCase().includes(q));
            return (
            <div className="space-y-4 text-sm">
              {/* Bills */}
              {filtBills.length > 0 && (
                <div>
                  <div className="font-semibold text-gray-700 mb-1 text-base">Bills</div>
                  <div className="space-y-0.5">
                    {filtBills.map(b => (
                      <div key={b.id} data-testid={`summary-bill-${b.id}`} className="flex gap-2">
                        <span className="text-gray-500 w-4 text-right">{b.bill_no}</span>
                        <span>—</span>
                        <span className={b.amount === null ? "text-orange-500" : "text-gray-800"}>
                          {b.amount !== null ? fmtAmt(b.amount) : "(pending)"}
                        </span>
                        <span className="text-gray-400">({fmtDate(b.date)})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Items grouped by date */}
              {filtItems.length > 0 && (
                <div>
                  <div className="font-semibold text-gray-700 mb-1 text-base">Items</div>
                  {groupByDate(filtItems).map(([date, its]) => (
                    <div key={date} className="mb-2">
                      <div className="text-gray-400 text-xs mb-0.5">({fmtDate(date)})</div>
                      {its.map(it => (
                        <div key={it.id} data-testid={`summary-item-${it.id}`} className="ml-2 text-gray-800">
                          {it.item_name} — {it.qty || ""}
                          {it.qty ? "×" : ""}
                          {it.price !== null ? `${fmtAmt(it.price)} = ${fmtAmt(it.total)}` : <span className="text-orange-500">(pending price)</span>}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* Money In */}
              {filtMoneyIn.length > 0 && (
                <div>
                  <div className="font-semibold text-gray-700 mb-1 text-base">Money In</div>
                  <div className="space-y-0.5">
                    {filtMoneyIn.map(m => (
                      <div key={m.id} data-testid={`summary-moneyin-${m.id}`} className="flex gap-2 flex-wrap">
                        <span className="text-green-700">{fmtAmt(m.amount)}</span>
                        <span className="text-gray-400">({fmtDate(m.date)})</span>
                        {m.note && <span className="text-gray-500">"{m.note}"</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Money Out */}
              {filtMoneyOut.length > 0 && (
                <div>
                  <div className="font-semibold text-gray-700 mb-1 text-base">Money Out</div>
                  <div className="space-y-0.5">
                    {filtMoneyOut.map(m => (
                      <div key={m.id} data-testid={`summary-moneyout-${m.id}`} className="flex gap-2 flex-wrap">
                        <span className="text-red-700">{fmtAmt(m.amount)}</span>
                        <span className="text-gray-400">({fmtDate(m.date)})</span>
                        {m.note && <span className="text-gray-500">"{m.note}"</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {filtBills.length === 0 && filtItems.length === 0 && filtMoneyIn.length === 0 && filtMoneyOut.length === 0 && (
                <div className="text-gray-400 py-4 text-center">{summarySearch ? "No results for your search." : "No active entries yet."}</div>
              )}
            </div>
          );
          })()}
        </div>
      )}

      {/* Pending Bills Tab */}
      {tab === "pending-bills" && (
        <div data-testid="pending-bills-section">
          <div className="text-sm text-gray-500 mb-2">Bills without amount. Fill in to update the page.</div>
          <input
            data-testid="pending-bills-search"
            className="border rounded px-3 py-1.5 text-sm w-full mb-3 bg-white"
            placeholder="Search by bill number or date..."
            value={pendingBillSearch}
            onChange={e => setPendingBillSearch(e.target.value)}
          />
          {pendingBills.filter(b => !pendingBillSearch.trim() || String(b.bill_no).includes(pendingBillSearch) || fmtDate(b.page_date).toLowerCase().includes(pendingBillSearch.toLowerCase())).length === 0 && (
            <div className="text-gray-400 text-sm py-6 text-center">{pendingBillSearch ? "No results." : "No pending bills."}</div>
          )}
          <div className="space-y-2">
            {pendingBills.filter(b => !pendingBillSearch.trim() || String(b.bill_no).includes(pendingBillSearch) || fmtDate(b.page_date).toLowerCase().includes(pendingBillSearch.toLowerCase())).map(b => (
              <div key={b.id} data-testid={`pending-bill-${b.id}`} className="bg-white border rounded p-2.5 flex items-center gap-2 flex-wrap">
                <span className="text-gray-700 font-medium">Bill #{b.bill_no}</span>
                <span className="text-gray-400 text-xs">({fmtDate(b.page_date)})</span>
                <div className="flex gap-1.5 ml-auto items-center">
                  <input
                    data-testid={`fill-bill-input-${b.id}`}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Amount"
                    value={fillAmounts[b.id] || ""}
                    onChange={e => setFillAmounts(p => ({ ...p, [b.id]: e.target.value }))}
                    className="border rounded px-2 py-1 text-sm w-28"
                  />
                  <button
                    data-testid={`fill-bill-btn-${b.id}`}
                    onClick={() => fillBillAmount(b.id)}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
                  >Fill</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Prices Tab */}
      {tab === "pending-prices" && (
        <div data-testid="pending-prices-section">
          <div className="text-sm text-gray-500 mb-2">Items without price. Fill in to update the page and price memory.</div>
          <input
            data-testid="pending-prices-search"
            className="border rounded px-3 py-1.5 text-sm w-full mb-3 bg-white"
            placeholder="Search by item name..."
            value={pendingPriceSearch}
            onChange={e => setPendingPriceSearch(e.target.value)}
          />
          {pendingPrices.filter(it => !pendingPriceSearch.trim() || (it.item_name || "").toLowerCase().includes(pendingPriceSearch.toLowerCase())).length === 0 && (
            <div className="text-gray-400 text-sm py-6 text-center">{pendingPriceSearch ? "No results." : "No pending prices."}</div>
          )}
          <div className="space-y-2">
            {pendingPrices.filter(it => !pendingPriceSearch.trim() || (it.item_name || "").toLowerCase().includes(pendingPriceSearch.toLowerCase())).map(it => (
              <div key={it.id} data-testid={`pending-price-${it.id}`} className="bg-white border rounded p-2.5 flex items-center gap-2 flex-wrap">
                <span className="text-gray-700 font-medium">{it.item_name}</span>
                {it.qty && <span className="text-gray-500 text-sm">Qty: {it.qty}</span>}
                <span className="text-gray-400 text-xs">({fmtDate(it.page_date)})</span>
                <div className="flex gap-1.5 ml-auto items-center">
                  <input
                    data-testid={`fill-price-input-${it.id}`}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Price"
                    value={fillPrices[it.id] || ""}
                    onChange={e => setFillPrices(p => ({ ...p, [it.id]: e.target.value }))}
                    className="border rounded px-2 py-1 text-sm w-28"
                  />
                  <button
                    data-testid={`fill-price-btn-${it.id}`}
                    onClick={() => fillItemPrice(it.id)}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
                  >Fill</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Price Memory Tab */}
      {tab === "price-memory" && (
        <div data-testid="price-memory-section">
          <div className="text-sm text-gray-500 mb-2">Remembered prices for {customer.name}. Used for autofill.</div>
          <input
            data-testid="price-memory-search"
            className="border rounded px-3 py-1.5 text-sm w-full mb-3 bg-white"
            placeholder="Search item name..."
            value={priceMemSearch}
            onChange={e => setPriceMemSearch(e.target.value)}
          />
          {priceMemory.filter(ip => !priceMemSearch.trim() || ip.item_name.toLowerCase().includes(priceMemSearch.toLowerCase())).length === 0 && (
            <div className="text-gray-400 text-sm py-6 text-center">{priceMemSearch ? "No results." : "No prices remembered yet."}</div>
          )}
          <div className="space-y-1.5">
            {priceMemory.filter(ip => !priceMemSearch.trim() || ip.item_name.toLowerCase().includes(priceMemSearch.toLowerCase())).map(ip => (
              <div key={ip.id} data-testid={`price-memory-${ip.id}`} className="bg-white border rounded p-2 flex justify-between items-center text-sm">
                <span className="font-medium text-gray-700">{ip.item_name}</span>
                <span className="text-gray-600">{fmtAmt(ip.price)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settled Tab */}
      {tab === "settled" && (
        <div data-testid="settled-section">
          <div className="text-sm text-gray-500 mb-2">Settled pages (history only, not counted in balance).</div>
          <input
            data-testid="settled-search"
            className="border rounded px-3 py-1.5 text-sm w-full mb-3 bg-white"
            placeholder="Search by date..."
            value={settledSearch}
            onChange={e => setSettledSearch(e.target.value)}
          />
          {settledPages.filter(p => !settledSearch.trim() || fmtDate(p.date).toLowerCase().includes(settledSearch.toLowerCase()) || p.date.includes(settledSearch)).length === 0 && (
            <div className="text-gray-400 text-sm py-6 text-center">{settledSearch ? "No results." : "No settled pages."}</div>
          )}
          <div className="space-y-1.5">
            {settledPages.filter(p => !settledSearch.trim() || fmtDate(p.date).toLowerCase().includes(settledSearch.toLowerCase()) || p.date.includes(settledSearch)).map(p => (
              <div key={p.id} data-testid={`settled-page-${p.id}`} className="bg-white border rounded p-2.5 flex items-center gap-2">
                <div
                  className="flex-1 cursor-pointer"
                  onClick={() => nav(`/customer/${cid}/page/${p.id}`)}
                >
                  <span className="text-sm text-gray-500 font-medium">{fmtDate(p.date)}</span>
                  {p.settled_at && (
                    <span className="ml-2 text-xs text-gray-400">settled {fmtDate(p.settled_at?.slice(0, 10))}</span>
                  )}
                </div>
                <button
                  data-testid={`unsettle-page-${p.id}`}
                  onClick={() => unsettlePage(p.id)}
                  className="text-xs border px-2 py-1 rounded text-blue-600 hover:bg-blue-50"
                >Unsettle</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
