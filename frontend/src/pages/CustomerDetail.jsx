import { useState, useEffect, useCallback, useRef } from "react";
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

// ---- AutoInput ----
function AutoInput({ value, onChange, suggestions, priceMap, onSelect, ...rest }) {
  const [open, setOpen] = useState(false);
  const filtered = suggestions.filter(n => value.length > 0 && n.toLowerCase().includes(value.toLowerCase()));
  return (
    <div className="relative flex-1 min-w-24">
      <input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="border rounded px-2 py-1 text-sm w-full"
        {...rest}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-20 bg-white border rounded shadow mt-0.5 w-full max-h-36 overflow-y-auto">
          {filtered.map(n => (
            <div
              key={n}
              onMouseDown={() => { onSelect(n, priceMap[n]); setOpen(false); }}
              className="px-3 py-1.5 hover:bg-blue-50 cursor-pointer text-sm flex justify-between"
            >
              <span>{n}</span>
              {priceMap[n] != null && <span className="text-gray-400">{fmtAmt(priceMap[n])}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Inline Entry Row ----
function InlineEntryRow({ entry, onDelete, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [val, setVal] = useState({});

  function startEdit() {
    setVal({
      amount: entry.amount ?? "",
      item_name: entry.item_name ?? "",
      qty: entry.qty ?? "",
      price: entry.price ?? "",
      note: entry.note ?? "",
    });
    setEditing(true);
  }

  function save() {
    const payload = {};
    if (entry.type === "bill") {
      if (val.amount !== "") payload.amount = parseFloat(val.amount);
    } else if (entry.type === "item") {
      if (val.item_name) payload.item_name = val.item_name;
      if (val.qty !== "") payload.qty = parseFloat(val.qty);
      if (val.price !== "") payload.price = parseFloat(val.price);
    } else if (entry.type !== "note") {
      if (val.amount !== "") payload.amount = parseFloat(val.amount);
      if (val.note) payload.note = val.note;
    } else {
      if (val.note) payload.note = val.note;
    }
    onUpdate(entry.id, payload);
    setEditing(false);
  }

  const label = () => {
    if (entry._temp) return <span className="text-gray-400 italic">saving...</span>;
    if (entry.type === "bill") return (
      <span>
        <span className="font-medium text-gray-600">Bill #{entry.bill_no ?? "..."}</span>
        {" — "}
        {entry.amount != null
          ? <span className="font-semibold">{fmtAmt(entry.amount)}</span>
          : <span className="text-orange-500">pending</span>}
      </span>
    );
    if (entry.type === "item") {
      const total = entry.qty && entry.price != null ? entry.qty * entry.price : null;
      return (
        <span>
          <span className="font-medium">{entry.item_name}</span>
          {entry.qty ? ` — ${entry.qty}×` : ""}
          {entry.price != null
            ? <span>{fmtAmt(entry.price)} = <b>{fmtAmt(total)}</b></span>
            : <span className="text-orange-500"> (pending price)</span>}
        </span>
      );
    }
    if (entry.type === "money_received") return (
      <span>
        <span className="text-green-700 font-semibold">Received {fmtAmt(entry.amount)}</span>
        {entry.note && <span className="text-gray-400 text-xs ml-2">"{entry.note}"</span>}
      </span>
    );
    if (entry.type === "money_given") return (
      <span>
        <span className="text-red-700 font-semibold">Given {fmtAmt(entry.amount)}</span>
        {entry.note && <span className="text-gray-400 text-xs ml-2">"{entry.note}"</span>}
      </span>
    );
    if (entry.type === "note") return <span className="text-gray-500 italic">"{entry.note}"</span>;
    return null;
  };

  return (
    <div className={`border-b py-1.5 last:border-b-0 ${entry._temp ? "opacity-60" : ""}`}>
      {editing ? (
        <div className="flex flex-wrap gap-1.5 items-center">
          {entry.type === "bill" && (
            <input type="number" placeholder="Amount" value={val.amount}
              onChange={e => setVal(p => ({ ...p, amount: e.target.value }))}
              className="border rounded px-2 py-1 text-sm w-32" autoFocus />
          )}
          {entry.type === "item" && (
            <>
              <input placeholder="Item" value={val.item_name}
                onChange={e => setVal(p => ({ ...p, item_name: e.target.value }))}
                className="border rounded px-2 py-1 text-sm flex-1 min-w-24" autoFocus />
              <input type="number" placeholder="Qty" value={val.qty}
                onChange={e => setVal(p => ({ ...p, qty: e.target.value }))}
                className="border rounded px-2 py-1 text-sm w-16" />
              <input type="number" placeholder="Price" value={val.price}
                onChange={e => setVal(p => ({ ...p, price: e.target.value }))}
                className="border rounded px-2 py-1 text-sm w-20" />
            </>
          )}
          {(entry.type === "money_received" || entry.type === "money_given") && (
            <>
              <input type="number" placeholder="Amount" value={val.amount}
                onChange={e => setVal(p => ({ ...p, amount: e.target.value }))}
                className="border rounded px-2 py-1 text-sm w-28" autoFocus />
              <input placeholder="Note" value={val.note}
                onChange={e => setVal(p => ({ ...p, note: e.target.value }))}
                className="border rounded px-2 py-1 text-sm flex-1" />
            </>
          )}
          {entry.type === "note" && (
            <input placeholder="Note" value={val.note}
              onChange={e => setVal(p => ({ ...p, note: e.target.value }))}
              className="border rounded px-2 py-1 text-sm flex-1" autoFocus />
          )}
          <button onClick={save} className="bg-green-600 text-white px-2 py-1 rounded text-xs">Save</button>
          <button onClick={() => setEditing(false)} className="border px-2 py-1 rounded text-xs text-gray-500">×</button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm flex-1">{label()}</div>
          {!entry._temp && (
            <div className="flex gap-1 shrink-0">
              <button
                data-testid={`edit-entry-inline-${entry.id}`}
                onClick={startEdit}
                className="text-xs border px-1.5 py-0.5 rounded text-gray-500 hover:bg-gray-50"
              >Edit</button>
              {confirming ? (
                <>
                  <button
                    data-testid={`confirm-delete-entry-inline-${entry.id}`}
                    onClick={() => { onDelete(entry.id); setConfirming(false); }}
                    className="text-xs border px-1.5 py-0.5 rounded bg-red-500 text-white"
                  >Sure?</button>
                  <button
                    onClick={() => setConfirming(false)}
                    className="text-xs border px-1.5 py-0.5 rounded text-gray-500"
                  >No</button>
                </>
              ) : (
                <button
                  data-testid={`delete-entry-inline-${entry.id}`}
                  onClick={() => setConfirming(true)}
                  className="text-xs border px-1.5 py-0.5 rounded text-red-500"
                >Del</button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Inline Quick Add Form ----
function InlineAddForm({ onAdd, suggestions, priceMap, disabled }) {
  const [type, setType] = useState(null);
  const [amount, setAmount] = useState("");
  const [itemName, setItemName] = useState("");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");

  function reset() { setAmount(""); setItemName(""); setQty(""); setPrice(""); setNote(""); }

  function submit(e) {
    e.preventDefault();
    const payload = { type };
    if (type === "bill") {
      payload.amount = amount !== "" ? parseFloat(amount) : null;
    } else if (type === "item") {
      if (!itemName.trim()) return;
      payload.item_name = itemName.trim();
      payload.qty = qty !== "" ? parseFloat(qty) : null;
      payload.price = price !== "" ? parseFloat(price) : null;
    } else if (type === "money_received" || type === "money_given") {
      if (!amount) return;
      payload.amount = parseFloat(amount);
      payload.note = note.trim() || null;
    } else if (type === "note") {
      if (!note.trim()) return;
      payload.note = note.trim();
    }
    onAdd(payload);
    reset();
  }

  const btnCls = t =>
    `px-2.5 py-1 rounded text-xs font-medium border ${type === t ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 hover:bg-gray-50"}`;

  if (disabled) return (
    <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-400 italic">
      Creating page, please wait...
    </div>
  );

  return (
    <div className="mt-2 pt-2 border-t border-gray-100">
      <div className="flex flex-wrap gap-1 mb-1.5">
        {[["bill", "Bill"], ["item", "Item"], ["money_received", "Money In"], ["money_given", "Money Out"], ["note", "Note"]].map(([t, l]) => (
          <button key={t} data-testid={`inline-type-${t}`} className={btnCls(t)} onClick={() => setType(type === t ? null : t)}>{l}</button>
        ))}
      </div>
      {type && (
        <form onSubmit={submit} className="flex flex-wrap gap-1.5 items-center mt-1">
          {type === "bill" && (
            <>
              <input
                data-testid="inline-bill-amount"
                type="number" min="0" step="0.01" placeholder="Amount (optional)"
                value={amount} onChange={e => setAmount(e.target.value)}
                className="border rounded px-2 py-1 text-sm w-36" autoFocus
              />
              <button type="submit" data-testid="inline-add-bill" className="bg-green-600 text-white px-3 py-1 rounded text-sm">Add Bill</button>
            </>
          )}
          {type === "item" && (
            <>
              <AutoInput
                data-testid="inline-item-name"
                value={itemName} onChange={setItemName}
                suggestions={suggestions} priceMap={priceMap}
                onSelect={(n, p) => { setItemName(n); if (p != null) setPrice(String(p)); }}
                placeholder="Item name *" autoFocus
              />
              <input
                data-testid="inline-item-qty"
                type="number" min="0" step="0.01" placeholder="Qty"
                value={qty} onChange={e => setQty(e.target.value)}
                className="border rounded px-2 py-1 text-sm w-16"
              />
              <input
                data-testid="inline-item-price"
                type="number" min="0" step="0.01" placeholder="Price"
                value={price} onChange={e => setPrice(e.target.value)}
                className="border rounded px-2 py-1 text-sm w-24"
              />
              <button type="submit" data-testid="inline-add-item" className="bg-green-600 text-white px-3 py-1 rounded text-sm">Add</button>
            </>
          )}
          {(type === "money_received" || type === "money_given") && (
            <>
              <input
                data-testid="inline-money-amount"
                type="number" min="0" step="0.01" placeholder="Amount *"
                value={amount} onChange={e => setAmount(e.target.value)}
                className="border rounded px-2 py-1 text-sm w-32" autoFocus
              />
              <input
                data-testid="inline-money-note"
                placeholder="Note (optional)" value={note} onChange={e => setNote(e.target.value)}
                className="border rounded px-2 py-1 text-sm flex-1 min-w-28"
              />
              <button type="submit" data-testid="inline-add-money" className="bg-green-600 text-white px-3 py-1 rounded text-sm">Add</button>
            </>
          )}
          {type === "note" && (
            <>
              <input
                data-testid="inline-note-text"
                placeholder="Note text *" value={note} onChange={e => setNote(e.target.value)}
                className="border rounded px-2 py-1 text-sm flex-1 min-w-32" autoFocus
              />
              <button type="submit" data-testid="inline-add-note" className="bg-green-600 text-white px-3 py-1 rounded text-sm">Add</button>
            </>
          )}
          <button type="button" onClick={() => setType(null)} className="text-gray-400 text-xs px-1">✕</button>
        </form>
      )}
    </div>
  );
}

// ---- Main CustomerDetail ----
export default function CustomerDetail() {
  const { cid } = useParams();
  const nav = useNavigate();

  const [customer, setCustomer] = useState(null);
  const [pages, setPages] = useState([]);
  const [pagesTotal, setPagesTotal] = useState(0);
  const [pagesPage, setPagesPage] = useState(1);
  const [pageEntries, setPageEntries] = useState({});
  const [expandedPages, setExpandedPages] = useState(new Set());
  const [loadingEntries, setLoadingEntries] = useState(new Set());
  const [suggestions, setSuggestions] = useState([]);
  const [priceMap, setPriceMap] = useState({});

  const [tab, setTab] = useState("pages");
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

  const initialExpandDone = useRef(false);
  const LIMIT = 20;

  const loadCustomer = useCallback(async () => {
    const r = await api.get(`/customers/${cid}/single`);
    setCustomer(r.data);
  }, [cid]);

  const loadPages = useCallback(async (pg = 1) => {
    const r = await api.get(`/customers/${cid}/pages`, { params: { settled: false, page: pg, limit: LIMIT } });
    if (pg === 1) setPages(r.data.pages);
    else setPages(prev => [...prev, ...r.data.pages]);
    setPagesTotal(r.data.total);
    setPagesPage(pg);
  }, [cid]);

  const fetchPageEntries = useCallback(async (pid) => {
    if (pid.startsWith("tmp_")) return;
    setLoadingEntries(prev => new Set([...prev, pid]));
    try {
      const r = await api.get(`/pages/${pid}/entries`);
      setPageEntries(prev => ({ ...prev, [pid]: r.data }));
    } finally {
      setLoadingEntries(prev => { const n = new Set(prev); n.delete(pid); return n; });
    }
  }, []);

  function toggleExpandPage(pid) {
    setExpandedPages(prev => {
      const next = new Set(prev);
      if (next.has(pid)) {
        next.delete(pid);
      } else {
        next.add(pid);
        if (!pageEntries[pid] && !pid.startsWith("tmp_")) fetchPageEntries(pid);
      }
      return next;
    });
  }

  // Initial load
  useEffect(() => {
    loadCustomer();
    loadPages(1);
    // Load suggestions
    Promise.all([
      api.get(`/customers/${cid}/item-names`),
      api.get(`/customers/${cid}/item-prices`),
    ]).then(([namesRes, pricesRes]) => {
      setSuggestions(namesRes.data);
      const map = {};
      pricesRes.data.forEach(ip => { map[ip.item_name] = ip.price; });
      setPriceMap(map);
    });
  }, [cid, loadCustomer, loadPages]);

  // Auto-expand most recent page once
  useEffect(() => {
    if (pages.length > 0 && !initialExpandDone.current) {
      initialExpandDone.current = true;
      const firstPid = pages[0].id;
      setExpandedPages(new Set([firstPid]));
      fetchPageEntries(firstPid);
    }
  }, [pages, fetchPageEntries]);

  // Load tab data on tab switch
  useEffect(() => {
    if (tab === "summary") {
      api.get(`/customers/${cid}/summary`).then(r => setSummary(r.data));
    } else if (tab === "pending-bills") {
      api.get(`/customers/${cid}/pending-bills`).then(r => setPendingBills(r.data));
    } else if (tab === "pending-prices") {
      api.get(`/customers/${cid}/pending-prices`).then(r => setPendingPrices(r.data));
    } else if (tab === "price-memory") {
      api.get(`/customers/${cid}/item-prices`).then(r => setPriceMemory(r.data));
    } else if (tab === "settled") {
      api.get(`/customers/${cid}/pages`, { params: { settled: true, page: 1, limit: 50 } }).then(r => setSettledPages(r.data.pages));
    }
  }, [tab, cid]);

  // ---- Optimistic add page ----
  async function addPage(e) {
    e.preventDefault();
    const date = newDate;
    const tempId = "tmp_" + Date.now();
    const tempPage = { id: tempId, customer_id: cid, date, images: [], is_settled: false, created_at: new Date().toISOString(), _temp: true };
    setPages(prev => [tempPage, ...prev]);
    setExpandedPages(prev => new Set([...prev, tempId]));
    setPageEntries(prev => ({ ...prev, [tempId]: [] }));
    setShowAddPage(false);
    setNewDate(today());
    try {
      const res = await api.post(`/customers/${cid}/pages`, { date });
      setPages(prev => prev.map(p => p.id === tempId ? res.data : p));
      setExpandedPages(prev => {
        const next = new Set(prev);
        next.delete(tempId);
        next.add(res.data.id);
        return next;
      });
      setPageEntries(prev => {
        const n = { ...prev };
        n[res.data.id] = n[tempId] || [];
        delete n[tempId];
        return n;
      });
    } catch {
      setPages(prev => prev.filter(p => p.id !== tempId));
      setExpandedPages(prev => { const n = new Set(prev); n.delete(tempId); return n; });
      setPageEntries(prev => { const n = { ...prev }; delete n[tempId]; return n; });
    }
  }

  // ---- Optimistic delete page ----
  async function deletePage(pid) {
    const backup = [...pages];
    setPages(prev => prev.filter(p => p.id !== pid));
    setExpandedPages(prev => { const n = new Set(prev); n.delete(pid); return n; });
    setPendingDeletePage(null);
    try {
      await api.delete(`/pages/${pid}`);
      loadCustomer();
    } catch {
      setPages(backup);
    }
  }

  // ---- Optimistic add entry ----
  async function addEntry(pid, payload) {
    if (pid.startsWith("tmp_")) return;
    const tempId = "tmp_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
    const tempEntry = {
      id: tempId, page_id: pid, type: payload.type,
      amount: payload.amount ?? null, item_name: payload.item_name ?? null,
      qty: payload.qty ?? null, price: payload.price ?? null,
      note: payload.note ?? null, created_at: new Date().toISOString(), _temp: true,
    };
    setPageEntries(prev => ({ ...prev, [pid]: [...(prev[pid] || []), tempEntry] }));
    try {
      const res = await api.post(`/pages/${pid}/entries`, payload);
      setPageEntries(prev => ({
        ...prev,
        [pid]: (prev[pid] || []).map(e => e.id === tempId ? res.data : e),
      }));
      if (payload.type === "item" && payload.item_name) {
        setSuggestions(prev => prev.includes(payload.item_name) ? prev : [...prev, payload.item_name].sort());
        if (payload.price != null) setPriceMap(prev => ({ ...prev, [payload.item_name]: payload.price }));
      }
      loadCustomer();
    } catch {
      setPageEntries(prev => ({
        ...prev,
        [pid]: (prev[pid] || []).filter(e => e.id !== tempId),
      }));
    }
  }

  // ---- Optimistic delete entry ----
  async function deleteEntry(pid, eid) {
    const backup = [...(pageEntries[pid] || [])];
    setPageEntries(prev => ({ ...prev, [pid]: (prev[pid] || []).filter(e => e.id !== eid) }));
    try {
      await api.delete(`/entries/${eid}`);
      loadCustomer();
    } catch {
      setPageEntries(prev => ({ ...prev, [pid]: backup }));
    }
  }

  // ---- Optimistic update entry ----
  async function updateEntry(pid, eid, payload) {
    const backup = [...(pageEntries[pid] || [])];
    setPageEntries(prev => ({
      ...prev,
      [pid]: (prev[pid] || []).map(e => e.id === eid ? { ...e, ...payload } : e),
    }));
    try {
      await api.put(`/entries/${eid}`, payload);
      loadCustomer();
    } catch {
      setPageEntries(prev => ({ ...prev, [pid]: backup }));
    }
  }

  function toggleSelect(pid) {
    setSelected(prev => { const s = new Set(prev); s.has(pid) ? s.delete(pid) : s.add(pid); return s; });
  }

  async function settleSelected() {
    if (!selected.size) return;
    const ids = Array.from(selected);
    setPages(prev => prev.filter(p => !ids.includes(p.id)));
    setSelected(new Set());
    try {
      await api.post("/pages/settle", { page_ids: ids });
      loadCustomer();
    } catch {
      loadPages(1);
    }
  }

  async function unsettlePage(pid) {
    setSettledPages(prev => prev.filter(p => p.id !== pid));
    try {
      await api.post(`/pages/${pid}/unsettle`);
      loadPages(1);
      loadCustomer();
    } catch {
      api.get(`/customers/${cid}/pages`, { params: { settled: true, page: 1, limit: 50 } }).then(r => setSettledPages(r.data.pages));
    }
  }

  async function fillBillAmount(eid) {
    const amt = parseFloat(fillAmounts[eid]);
    if (!amt || isNaN(amt)) return;
    const backup = [...pendingBills];
    setPendingBills(prev => prev.filter(b => b.id !== eid));
    setFillAmounts(p => { const n = { ...p }; delete n[eid]; return n; });
    try {
      await api.patch(`/entries/${eid}/fill`, { amount: amt });
      loadCustomer();
    } catch {
      setPendingBills(backup);
    }
  }

  async function fillItemPrice(eid) {
    const price = parseFloat(fillPrices[eid]);
    if (!price || isNaN(price)) return;
    const backup = [...pendingPrices];
    setPendingPrices(prev => prev.filter(it => it.id !== eid));
    setFillPrices(p => { const n = { ...p }; delete n[eid]; return n; });
    try {
      await api.patch(`/entries/${eid}/fill`, { price });
      loadCustomer();
    } catch {
      setPendingPrices(backup);
    }
  }

  function groupByDate(items) {
    const map = {};
    items.forEach(it => { if (!map[it.date]) map[it.date] = []; map[it.date].push(it); });
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

      {/* ---- PAGES TAB ---- */}
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

          {pages.length === 0 && <div className="text-gray-400 text-sm py-8 text-center">No pages yet. Add one above.</div>}

          <div className="space-y-2">
            {pages
              .filter(p => !pageSearch.trim() || fmtDate(p.date).toLowerCase().includes(pageSearch.toLowerCase()) || p.date.includes(pageSearch))
              .map(p => {
                const isExpanded = expandedPages.has(p.id);
                const isLoadingEnt = loadingEntries.has(p.id);
                const entries = pageEntries[p.id] || [];
                return (
                  <div
                    key={p.id}
                    data-testid={`page-card-${p.id}`}
                    className={`bg-white border rounded ${p._temp ? "opacity-70" : ""}`}
                  >
                    {/* Page header row */}
                    <div className="flex items-center gap-2 p-2.5">
                      <input
                        type="checkbox"
                        data-testid={`select-page-${p.id}`}
                        checked={selected.has(p.id)}
                        onChange={() => toggleSelect(p.id)}
                        className="w-4 h-4 shrink-0"
                        disabled={!!p._temp}
                      />
                      {/* Click to expand */}
                      <div
                        className="flex-1 cursor-pointer flex items-center gap-2"
                        onClick={() => !p._temp && toggleExpandPage(p.id)}
                      >
                        <span className={`text-xs text-gray-400 transition-transform inline-block ${isExpanded ? "rotate-90" : ""}`}>▶</span>
                        <span className="text-sm font-medium text-gray-700">{fmtDate(p.date)}</span>
                        {entries.length > 0 && !isExpanded && (
                          <span className="text-xs text-gray-400">{entries.length} entr{entries.length === 1 ? "y" : "ies"}</span>
                        )}
                        {p.images && p.images.length > 0 && (
                          <span className="text-xs text-blue-400">{p.images.length} img</span>
                        )}
                      </div>
                      {/* Open full page (for images etc.) */}
                      {!p._temp && (
                        <button
                          data-testid={`open-page-${p.id}`}
                          onClick={e => { e.stopPropagation(); nav(`/customer/${cid}/page/${p.id}`); }}
                          className="text-xs text-blue-600 border border-blue-200 px-2 py-0.5 rounded hover:bg-blue-50"
                        >Full</button>
                      )}
                      {/* Delete page */}
                      {!p._temp && (
                        pendingDeletePage === p.id ? (
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
                          >Del</button>
                        )
                      )}
                    </div>

                    {/* Expanded entries + add form */}
                    {isExpanded && (
                      <div className="border-t px-3 py-2">
                        {isLoadingEnt && <div className="text-xs text-gray-400 py-2">Loading entries...</div>}
                        {!isLoadingEnt && entries.length === 0 && (
                          <div className="text-xs text-gray-400 py-1">No entries yet.</div>
                        )}
                        {!isLoadingEnt && entries.map(e => (
                          <InlineEntryRow
                            key={e.id}
                            entry={e}
                            onDelete={(eid) => deleteEntry(p.id, eid)}
                            onUpdate={(eid, payload) => updateEntry(p.id, eid, payload)}
                          />
                        ))}
                        <InlineAddForm
                          onAdd={(payload) => addEntry(p.id, payload)}
                          suggestions={suggestions}
                          priceMap={priceMap}
                          disabled={!!p._temp}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
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

      {/* ---- SUMMARY TAB ---- */}
      {tab === "summary" && (
        <div data-testid="summary-section">
          <input
            data-testid="summary-search"
            className="border rounded px-3 py-1.5 text-sm w-full mb-3 bg-white"
            placeholder="Search in summary..."
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
                  <div className="text-gray-400 py-4 text-center">{summarySearch ? "No results." : "No active entries yet."}</div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ---- PENDING BILLS TAB ---- */}
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
            {pendingBills
              .filter(b => !pendingBillSearch.trim() || String(b.bill_no).includes(pendingBillSearch) || fmtDate(b.page_date).toLowerCase().includes(pendingBillSearch.toLowerCase()))
              .map(b => (
                <div key={b.id} data-testid={`pending-bill-${b.id}`} className="bg-white border rounded p-2.5 flex items-center gap-2 flex-wrap">
                  <span className="text-gray-700 font-medium">Bill #{b.bill_no}</span>
                  <span className="text-gray-400 text-xs">({fmtDate(b.page_date)})</span>
                  <div className="flex gap-1.5 ml-auto items-center">
                    <input
                      data-testid={`fill-bill-input-${b.id}`}
                      type="number" min="0" step="0.01" placeholder="Amount"
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

      {/* ---- PENDING PRICES TAB ---- */}
      {tab === "pending-prices" && (
        <div data-testid="pending-prices-section">
          <div className="text-sm text-gray-500 mb-2">Items without price. Fill in to update price memory.</div>
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
            {pendingPrices
              .filter(it => !pendingPriceSearch.trim() || (it.item_name || "").toLowerCase().includes(pendingPriceSearch.toLowerCase()))
              .map(it => (
                <div key={it.id} data-testid={`pending-price-${it.id}`} className="bg-white border rounded p-2.5 flex items-center gap-2 flex-wrap">
                  <span className="text-gray-700 font-medium">{it.item_name}</span>
                  {it.qty && <span className="text-gray-500 text-sm">Qty: {it.qty}</span>}
                  <span className="text-gray-400 text-xs">({fmtDate(it.page_date)})</span>
                  <div className="flex gap-1.5 ml-auto items-center">
                    <input
                      data-testid={`fill-price-input-${it.id}`}
                      type="number" min="0" step="0.01" placeholder="Price"
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

      {/* ---- PRICE MEMORY TAB ---- */}
      {tab === "price-memory" && (
        <div data-testid="price-memory-section">
          <div className="text-sm text-gray-500 mb-2">Remembered prices for {customer.name}.</div>
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
            {priceMemory
              .filter(ip => !priceMemSearch.trim() || ip.item_name.toLowerCase().includes(priceMemSearch.toLowerCase()))
              .map(ip => (
                <div key={ip.id} data-testid={`price-memory-${ip.id}`} className="bg-white border rounded p-2 flex justify-between items-center text-sm">
                  <span className="font-medium text-gray-700">{ip.item_name}</span>
                  <span className="text-gray-600">{fmtAmt(ip.price)}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ---- SETTLED TAB ---- */}
      {tab === "settled" && (
        <div data-testid="settled-section">
          <div className="text-sm text-gray-500 mb-2">Settled pages (history, not counted in balance).</div>
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
            {settledPages
              .filter(p => !settledSearch.trim() || fmtDate(p.date).toLowerCase().includes(settledSearch.toLowerCase()) || p.date.includes(settledSearch))
              .map(p => (
                <div key={p.id} data-testid={`settled-page-${p.id}`} className="bg-white border rounded p-2.5 flex items-center gap-2">
                  <div className="flex-1 cursor-pointer" onClick={() => nav(`/customer/${cid}/page/${p.id}`)}>
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
