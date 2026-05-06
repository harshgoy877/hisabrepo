import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api";
import { fmtAmt, fmtDate } from "../utils/fmt";
import { useApp } from "../utils/AppContext";

export default function CustomerList() {
  const nav = useNavigate();
  const { customers, setCustomers, refreshCustomers } = useApp();
  const custLoaded = customers !== null;

  const [tab, setTab] = useState("customers");
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [custSearch, setCustSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);

  // ---- All Pages state ----
  const [allPages, setAllPages] = useState([]);
  const [allPagesTotal, setAllPagesTotal] = useState(0);
  const [allPagesPage, setAllPagesPage] = useState(1);
  const [allPagesLoaded, setAllPagesLoaded] = useState(false);
  const [expandedAllPages, setExpandedAllPages] = useState(new Set());
  const [allPageEntries, setAllPageEntries] = useState({});
  const [loadingAllPageEntries, setLoadingAllPageEntries] = useState(new Set());
  const [allPagesSearch, setAllPagesSearch] = useState("");

  const loadAllPages = useCallback(async (pg = 1) => {
    const r = await api.get("/all-pages", { params: { page: pg, limit: 50 } });
    if (pg === 1) setAllPages(r.data.pages);
    else setAllPages(prev => [...prev, ...r.data.pages]);
    setAllPagesTotal(r.data.total);
    setAllPagesPage(pg);
    setAllPagesLoaded(true);
  }, []);

  useEffect(() => {
    if (tab === "all-pages" && !allPagesLoaded) loadAllPages(1);
  }, [tab, allPagesLoaded, loadAllPages]);

  async function fetchAllPageEntries(pid) {
    if (allPageEntries[pid]) return;
    setLoadingAllPageEntries(prev => new Set([...prev, pid]));
    try {
      const r = await api.get(`/pages/${pid}/entries`);
      setAllPageEntries(prev => ({ ...prev, [pid]: r.data }));
    } finally {
      setLoadingAllPageEntries(prev => { const n = new Set(prev); n.delete(pid); return n; });
    }
  }

  function toggleAllPageExpand(pid) {
    setExpandedAllPages(prev => {
      const next = new Set(prev);
      if (next.has(pid)) { next.delete(pid); }
      else { next.add(pid); fetchAllPageEntries(pid); }
      return next;
    });
  }

  // ---- Optimistic add customer ----
  async function addCustomer(e) {
    e.preventDefault();
    if (!name.trim()) return;
    const tempId = "tmp_" + Date.now();
    const tempCust = {
      id: tempId, name: name.trim(), phone: phone.trim() || null,
      balance: 0, bill_total: 0, item_total: 0, money_received: 0, money_given: 0,
      pending_bills: 0, pending_prices: 0, _temp: true,
    };
    setCustomers(prev => [...prev, tempCust].sort((a, b) => a.name.localeCompare(b.name)));
    setName(""); setPhone(""); setShowAdd(false);
    try {
      const res = await api.post("/customers", { name: tempCust.name, phone: tempCust.phone });
      setCustomers(prev => prev.map(c => c.id === tempId
        ? { ...res.data, balance: 0, bill_total: 0, item_total: 0, money_received: 0, money_given: 0, pending_bills: 0, pending_prices: 0 }
        : c
      ));
    } catch {
      setCustomers(prev => prev.filter(c => c.id !== tempId));
    }
  }

  // ---- Optimistic edit customer ----
  async function saveEdit(id) {
    if (!editName.trim()) return;
    const backup = [...customers];
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, name: editName.trim(), phone: editPhone.trim() || null } : c));
    setEditId(null);
    try {
      await api.put(`/customers/${id}`, { name: editName.trim(), phone: editPhone.trim() || null });
    } catch {
      setCustomers(backup);
    }
  }

  // ---- Optimistic delete customer ----
  async function deleteCustomer(id) {
    const backup = [...customers];
    setCustomers(prev => prev.filter(c => c.id !== id));
    setPendingDelete(null);
    try {
      await api.delete(`/customers/${id}`);
    } catch {
      setCustomers(backup);
    }
  }

  function entryLabel(e) {
    if (e.type === "bill") return `Bill #${e.bill_no}${e.amount != null ? " — " + fmtAmt(e.amount) : " (pending)"}`;
    if (e.type === "item") {
      const t = e.qty && e.price != null ? e.qty * e.price : null;
      return `${e.item_name}${e.qty ? " " + e.qty + "×" : ""}${e.price != null ? fmtAmt(e.price) + (t ? " = " + fmtAmt(t) : "") : " (pending price)"}`;
    }
    if (e.type === "money_received") return `Received ${fmtAmt(e.amount)}${e.note ? ' "' + e.note + '"' : ""}`;
    if (e.type === "money_given") return `Given ${fmtAmt(e.amount)}${e.note ? ' "' + e.note + '"' : ""}`;
    if (e.type === "note") return `"${e.note}"`;
    return "";
  }

  function entryColor(e) {
    if (e.type === "money_received") return "text-green-700";
    if (e.type === "money_given") return "text-red-700";
    if ((e.type === "bill" && e.amount == null) || (e.type === "item" && e.price == null)) return "text-orange-500";
    return "text-gray-700";
  }

  if (!custLoaded) return <div className="p-6 text-center text-gray-400">Loading...</div>;

  return (
    <div className="container">
      <div className="flex items-center justify-between mb-3 mt-3">
        <h1 className="text-2xl font-bold text-gray-800">Hisab Book</h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-3">
        <button
          onClick={() => setTab("customers")}
          className={`px-4 py-2 text-sm border-b-2 -mb-px font-medium ${tab === "customers" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >Customers</button>
        <button
          data-testid="tab-all-pages"
          onClick={() => setTab("all-pages")}
          className={`px-4 py-2 text-sm border-b-2 -mb-px font-medium ${tab === "all-pages" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >All Pages</button>
      </div>

      {/* Customers Tab */}
      {tab === "customers" && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div />
            <button
              data-testid="add-customer-btn"
              onClick={() => { setShowAdd(!showAdd); setName(""); setPhone(""); }}
              className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium"
            >+ Add Customer</button>
          </div>

          <input
            data-testid="customer-search"
            className="border rounded px-3 py-1.5 text-sm w-full mb-3 bg-white"
            placeholder="Search customers by name or phone..."
            value={custSearch}
            onChange={e => setCustSearch(e.target.value)}
          />

          {showAdd && (
            <form
              data-testid="add-customer-form"
              onSubmit={addCustomer}
              className="bg-white border rounded p-3 mb-3 flex gap-2 flex-wrap items-center"
            >
              <input
                data-testid="new-customer-name"
                className="border rounded px-2 py-1 text-sm flex-1 min-w-40"
                placeholder="Name *"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
              />
              <input
                data-testid="new-customer-phone"
                className="border rounded px-2 py-1 text-sm w-36"
                placeholder="Phone (optional)"
                value={phone}
                onChange={e => setPhone(e.target.value)}
              />
              <button type="submit" className="bg-green-600 text-white px-3 py-1.5 rounded text-sm">Save</button>
              <button type="button" onClick={() => setShowAdd(false)} className="border px-3 py-1.5 rounded text-sm text-gray-600">Cancel</button>
            </form>
          )}

          {customers.length === 0 && (
            <div className="text-center text-gray-400 py-16">No customers yet. Add one above.</div>
          )}

          <div className="space-y-2">
            {customers
              .filter(c =>
                !custSearch.trim() ||
                c.name.toLowerCase().includes(custSearch.toLowerCase()) ||
                (c.phone && c.phone.includes(custSearch))
              )
              .map(c => (
                <div
                  key={c.id}
                  data-testid={`customer-card-${c.id}`}
                  className={`bg-white border rounded p-3 ${c._temp ? "opacity-70" : ""}`}
                >
                  {editId === c.id ? (
                    <div className="flex gap-2 flex-wrap items-center">
                      <input
                        data-testid={`edit-name-${c.id}`}
                        className="border rounded px-2 py-1 text-sm flex-1 min-w-40"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        autoFocus
                      />
                      <input
                        className="border rounded px-2 py-1 text-sm w-36"
                        placeholder="Phone"
                        value={editPhone}
                        onChange={e => setEditPhone(e.target.value)}
                      />
                      <button onClick={() => saveEdit(c.id)} className="bg-green-600 text-white px-3 py-1.5 rounded text-sm">Save</button>
                      <button onClick={() => setEditId(null)} className="border px-3 py-1.5 rounded text-sm text-gray-600">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between">
                      <div className="flex-1 cursor-pointer" onClick={() => !c._temp && nav(`/customer/${c.id}`)}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-800">{c.name}</span>
                          {c.phone && <span className="text-xs text-gray-400">{c.phone}</span>}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-3 text-sm">
                          {c.balance > 0 && <span data-testid={`balance-${c.id}`} className="text-red-600 font-semibold">Owes you {fmtAmt(c.balance)}</span>}
                          {c.balance < 0 && <span data-testid={`balance-${c.id}`} className="text-green-600 font-semibold">You owe {fmtAmt(Math.abs(c.balance))}</span>}
                          {(!c.balance || c.balance === 0) && <span data-testid={`balance-${c.id}`} className="text-gray-400 text-xs">No balance</span>}
                          {c.pending_bills > 0 && <span className="text-orange-500 text-xs font-medium">{c.pending_bills} pending bill{c.pending_bills > 1 ? "s" : ""}</span>}
                          {c.pending_prices > 0 && <span className="text-orange-500 text-xs font-medium">{c.pending_prices} pending price{c.pending_prices > 1 ? "s" : ""}</span>}
                        </div>
                      </div>
                      {!c._temp && (
                        <div className="flex gap-1 ml-2 shrink-0">
                          <button
                            data-testid={`edit-customer-${c.id}`}
                            onClick={() => { setEditId(c.id); setEditName(c.name); setEditPhone(c.phone || ""); }}
                            className="text-xs border px-2 py-1 rounded text-gray-600 hover:bg-gray-50"
                          >Edit</button>
                          {pendingDelete === c.id ? (
                            <>
                              <button
                                data-testid={`confirm-delete-${c.id}`}
                                onClick={() => deleteCustomer(c.id)}
                                className="text-xs border px-2 py-1 rounded bg-red-500 text-white"
                              >Sure?</button>
                              <button
                                onClick={() => setPendingDelete(null)}
                                className="text-xs border px-2 py-1 rounded text-gray-500"
                              >No</button>
                            </>
                          ) : (
                            <button
                              data-testid={`delete-customer-${c.id}`}
                              onClick={() => setPendingDelete(c.id)}
                              className="text-xs border px-2 py-1 rounded text-red-500 hover:bg-red-50"
                            >Delete</button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* All Pages Tab */}
      {tab === "all-pages" && (
        <div>
          <input
            data-testid="all-pages-search"
            className="border rounded px-3 py-1.5 text-sm w-full mb-3 bg-white"
            placeholder="Search by customer name or date..."
            value={allPagesSearch}
            onChange={e => setAllPagesSearch(e.target.value)}
          />

          {!allPagesLoaded && <div className="text-center text-gray-400 py-8">Loading...</div>}
          {allPagesLoaded && allPages.length === 0 && (
            <div className="text-center text-gray-400 py-16">No pages yet.</div>
          )}

          <div className="space-y-1.5">
            {allPages
              .filter(p => {
                if (!allPagesSearch.trim()) return true;
                const q = allPagesSearch.toLowerCase();
                return fmtDate(p.date).toLowerCase().includes(q) ||
                  p.date.includes(q) ||
                  (p.customer_name || "").toLowerCase().includes(q);
              })
              .map(p => (
                <div key={p.id} data-testid={`all-page-${p.id}`} className="bg-white border rounded overflow-hidden">
                  <div
                    className="flex items-center gap-2 p-2.5 cursor-pointer hover:bg-gray-50"
                    onClick={() => toggleAllPageExpand(p.id)}
                  >
                    <span className={`text-xs text-gray-400 transition-transform inline-block ${expandedAllPages.has(p.id) ? "rotate-90" : ""}`}>▶</span>
                    <span className="text-sm font-medium text-gray-700 w-24 shrink-0">{fmtDate(p.date)}</span>
                    <span className="text-xs text-gray-400">—</span>
                    <span
                      className="text-sm text-blue-600 hover:underline"
                      onClick={e => { e.stopPropagation(); nav(`/customer/${p.customer_id}`); }}
                    >{p.customer_name || "Unknown"}</span>
                    {p.images && p.images.length > 0 && (
                      <span className="ml-auto text-xs text-gray-400">{p.images.length} img</span>
                    )}
                  </div>
                  {expandedAllPages.has(p.id) && (
                    <div className="border-t px-3 py-2">
                      {loadingAllPageEntries.has(p.id) && (
                        <div className="text-xs text-gray-400 py-2">Loading entries...</div>
                      )}
                      {!loadingAllPageEntries.has(p.id) && (
                        <>
                          {(allPageEntries[p.id] || []).length === 0 && (
                            <div className="text-xs text-gray-400 py-1">No entries on this page.</div>
                          )}
                          <div className="space-y-1">
                            {(allPageEntries[p.id] || []).map(e => (
                              <div key={e.id} className={`text-sm py-0.5 ${entryColor(e)}`}>
                                {entryLabel(e)}
                              </div>
                            ))}
                          </div>
                          <div className="mt-2 pt-1.5 border-t border-gray-100 flex gap-3">
                            <button
                              onClick={() => nav(`/customer/${p.customer_id}/page/${p.id}`)}
                              className="text-xs text-blue-600 hover:underline"
                            >Open full page →</button>
                            <button
                              onClick={() => nav(`/customer/${p.customer_id}`)}
                              className="text-xs text-gray-500 hover:underline"
                            >Customer →</button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
          </div>

          {allPages.length < allPagesTotal && (
            <button
              data-testid="load-more-all-pages"
              onClick={() => loadAllPages(allPagesPage + 1)}
              className="mt-3 w-full border rounded py-2 text-sm text-gray-500 hover:bg-gray-50"
            >Load more ({allPagesTotal - allPages.length} remaining)</button>
          )}
        </div>
      )}
    </div>
  );
}
