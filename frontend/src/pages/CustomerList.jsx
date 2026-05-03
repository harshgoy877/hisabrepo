import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api";
import { fmtAmt } from "../utils/fmt";

export default function CustomerList() {
  const nav = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);

  const load = useCallback(async () => {
    try {
      const r = await api.get("/customers");
      setCustomers(r.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  async function addCustomer(e) {
    e.preventDefault();
    if (!name.trim()) return;
    await api.post("/customers", { name: name.trim(), phone: phone.trim() || null });
    setName(""); setPhone(""); setShowAdd(false);
    load();
  }

  async function saveEdit(id) {
    if (!editName.trim()) return;
    await api.put(`/customers/${id}`, { name: editName.trim(), phone: editPhone.trim() || null });
    setEditId(null);
    load();
  }

  async function deleteCustomer(id) {
    await api.delete(`/customers/${id}`);
    setPendingDelete(null);
    load();
  }

  if (loading) return <div className="p-6 text-center text-gray-400">Loading...</div>;

  return (
    <div className="container">
      <div className="flex items-center justify-between mb-3 mt-3">
        <h1 className="text-2xl font-bold text-gray-800">Hisab Book</h1>
        <button
          data-testid="add-customer-btn"
          onClick={() => { setShowAdd(!showAdd); setName(""); setPhone(""); }}
          className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium"
        >
          + Add Customer
        </button>
      </div>

      <input
        data-testid="customer-search"
        className="border rounded px-3 py-1.5 text-sm w-full mb-3 bg-white"
        placeholder="Search customers by name or phone..."
        value={search}
        onChange={e => setSearch(e.target.value)}
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
        {customers.filter(c =>
          !search.trim() ||
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          (c.phone && c.phone.includes(search))
        ).map(c => (
          <div key={c.id} data-testid={`customer-card-${c.id}`} className="bg-white border rounded p-3">
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
                <div className="flex-1 cursor-pointer" onClick={() => nav(`/customer/${c.id}`)}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-800">{c.name}</span>
                    {c.phone && <span className="text-xs text-gray-400">{c.phone}</span>}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-3 text-sm">
                    {c.balance > 0 && (
                      <span data-testid={`balance-${c.id}`} className="text-red-600 font-semibold">
                        Owes you {fmtAmt(c.balance)}
                      </span>
                    )}
                    {c.balance < 0 && (
                      <span data-testid={`balance-${c.id}`} className="text-green-600 font-semibold">
                        You owe {fmtAmt(Math.abs(c.balance))}
                      </span>
                    )}
                    {(!c.balance || c.balance === 0) && (
                      <span data-testid={`balance-${c.id}`} className="text-gray-400 text-xs">No balance</span>
                    )}
                    {c.pending_bills > 0 && (
                      <span className="text-orange-500 text-xs font-medium">{c.pending_bills} pending bill{c.pending_bills > 1 ? "s" : ""}</span>
                    )}
                    {c.pending_prices > 0 && (
                      <span className="text-orange-500 text-xs font-medium">{c.pending_prices} pending price{c.pending_prices > 1 ? "s" : ""}</span>
                    )}
                  </div>
                </div>
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
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
