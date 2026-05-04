import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../utils/api";
import { fmtAmt, fmtDate, today } from "../utils/fmt";

const BACKEND = process.env.REACT_APP_BACKEND_URL;

// ── Item name autocomplete input ──────────────────────────────
function AutoInput({ value, onChange, suggestions, priceMap, onSelect, ...rest }) {
  const [open, setOpen] = useState(false);
  const filtered = suggestions.filter(n => value.length > 0 && n.toLowerCase().includes(value.toLowerCase()));

  return (
    <div className="relative flex-1 min-w-32">
      <input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="border rounded px-2 py-1 text-sm w-full"
        {...rest}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-20 bg-white border rounded shadow mt-0.5 w-full max-h-40 overflow-y-auto">
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

// ── Single entry display + edit ──────────────────────────────
function EntryRow({ entry, onDelete, onUpdate }) {
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

  async function save() {
    const payload = {};
    if (entry.type === "bill") {
      if (val.amount !== "") payload.amount = parseFloat(val.amount);
    } else if (entry.type === "item") {
      if (val.item_name) payload.item_name = val.item_name;
      if (val.qty !== "") payload.qty = parseFloat(val.qty);
      if (val.price !== "") payload.price = parseFloat(val.price);
    } else {
      if (val.amount !== "") payload.amount = parseFloat(val.amount);
      if (val.note !== "") payload.note = val.note;
    }
    if (entry.type === "note") {
      delete payload.amount;
      if (val.note) payload.note = val.note;
    }
    setEditing(false);
    onUpdate(payload);
  }

  const label = () => {
    if (entry.type === "bill") {
      return (
        <span>
          <span className="font-medium text-gray-600">Bill #{entry.bill_no}</span>
          {" — "}
          {entry.amount != null
            ? <span className="font-semibold text-gray-800">{fmtAmt(entry.amount)}</span>
            : <span className="text-orange-500">pending amt</span>}
        </span>
      );
    }
    if (entry.type === "item") {
      const qty = entry.qty || "";
      const price = entry.price;
      const total = qty && price != null ? qty * price : null;
      return (
        <span>
          <span className="font-medium text-gray-800">{entry.item_name}</span>
          {qty ? ` — ${qty}×` : ""}
          {price != null
            ? <span>{fmtAmt(price)} = <span className="font-semibold">{fmtAmt(total)}</span></span>
            : <span className="text-orange-500">(pending price)</span>}
        </span>
      );
    }
    if (entry.type === "money_received") {
      return (
        <span>
          <span className="text-green-700 font-semibold">Received {fmtAmt(entry.amount)}</span>
          {entry.note && <span className="text-gray-400 text-xs ml-2">"{entry.note}"</span>}
        </span>
      );
    }
    if (entry.type === "money_given") {
      return (
        <span>
          <span className="text-red-700 font-semibold">Given {fmtAmt(entry.amount)}</span>
          {entry.note && <span className="text-gray-400 text-xs ml-2">"{entry.note}"</span>}
        </span>
      );
    }
    if (entry.type === "note") {
      return <span className="text-gray-600 italic">"{entry.note}"</span>;
    }
    return null;
  };

  return (
    <div data-testid={`entry-${entry.id}`} className="border-b py-2 last:border-b-0">
      {editing ? (
        <div className="flex flex-wrap gap-2 items-center">
          {entry.type === "bill" && (
            <input type="number" placeholder="Amount (optional)" value={val.amount}
              onChange={e => setVal(p => ({ ...p, amount: e.target.value }))}
              className="border rounded px-2 py-1 text-sm w-36"
            />
          )}
          {entry.type === "item" && (
            <>
              <input placeholder="Item name" value={val.item_name}
                onChange={e => setVal(p => ({ ...p, item_name: e.target.value }))}
                className="border rounded px-2 py-1 text-sm flex-1 min-w-28"
              />
              <input type="number" placeholder="Qty" value={val.qty}
                onChange={e => setVal(p => ({ ...p, qty: e.target.value }))}
                className="border rounded px-2 py-1 text-sm w-20"
              />
              <input type="number" placeholder="Price" value={val.price}
                onChange={e => setVal(p => ({ ...p, price: e.target.value }))}
                className="border rounded px-2 py-1 text-sm w-24"
              />
            </>
          )}
          {(entry.type === "money_received" || entry.type === "money_given") && (
            <>
              <input type="number" placeholder="Amount" value={val.amount}
                onChange={e => setVal(p => ({ ...p, amount: e.target.value }))}
                className="border rounded px-2 py-1 text-sm w-32"
              />
              <input placeholder="Note (optional)" value={val.note}
                onChange={e => setVal(p => ({ ...p, note: e.target.value }))}
                className="border rounded px-2 py-1 text-sm flex-1"
              />
            </>
          )}
          {entry.type === "note" && (
            <input placeholder="Note text" value={val.note}
              onChange={e => setVal(p => ({ ...p, note: e.target.value }))}
              className="border rounded px-2 py-1 text-sm flex-1"
            />
          )}
          <button onClick={save} className="bg-green-600 text-white px-3 py-1 rounded text-sm">Save</button>
          <button onClick={() => setEditing(false)} className="border px-3 py-1 rounded text-sm text-gray-600">Cancel</button>
        </div>
      ) : (
        <div className="flex items-center gap-2 justify-between">
          <div className="text-sm flex-1">{label()}</div>
          <div className="flex gap-1 shrink-0">
            <button
              data-testid={`edit-entry-${entry.id}`}
              onClick={startEdit}
              className="text-xs border px-2 py-0.5 rounded text-gray-500 hover:bg-gray-50"
            >Edit</button>
            {confirming ? (
              <>
                <button
                  data-testid={`confirm-delete-entry-${entry.id}`}
                  onClick={() => { onDelete(entry.id); setConfirming(false); }}
                  className="text-xs border px-2 py-0.5 rounded bg-red-500 text-white"
                >Sure?</button>
                <button
                  onClick={() => setConfirming(false)}
                  className="text-xs border px-2 py-0.5 rounded text-gray-500"
                >No</button>
              </>
            ) : (
              <button
                data-testid={`delete-entry-${entry.id}`}
                onClick={() => setConfirming(true)}
                className="text-xs border px-2 py-0.5 rounded text-red-500 hover:bg-red-50"
              >Del</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Add Entry Form ────────────────────────────────────────────
function AddEntryForm({ pid, onAdded, suggestions, priceMap }) {
  const [type, setType] = useState(null);
  const [amount, setAmount] = useState("");
  const [itemName, setItemName] = useState("");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const fileRef = useRef();

  function reset() { setType(null); setAmount(""); setItemName(""); setQty(""); setPrice(""); setNote(""); }

  async function submit(e) {
    e.preventDefault();
    let payload = { type };
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
    const res = await api.post(`/pages/${pid}/entries`, payload);
    reset();
    onAdded(res.data);
  }

  const btnCls = (t) =>
    `px-3 py-1.5 rounded text-sm font-medium border ${type === t ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 hover:bg-gray-50"}`;

  return (
    <div data-testid="add-entry-form" className="bg-gray-50 border rounded p-3 mt-3">
      <div className="flex flex-wrap gap-1.5 mb-3">
        <button data-testid="type-bill" className={btnCls("bill")} onClick={() => setType(type === "bill" ? null : "bill")}>Bill</button>
        <button data-testid="type-item" className={btnCls("item")} onClick={() => setType(type === "item" ? null : "item")}>Item</button>
        <button data-testid="type-money-received" className={btnCls("money_received")} onClick={() => setType(type === "money_received" ? null : "money_received")}>Money In</button>
        <button data-testid="type-money-given" className={btnCls("money_given")} onClick={() => setType(type === "money_given" ? null : "money_given")}>Money Out</button>
        <button data-testid="type-note" className={btnCls("note")} onClick={() => setType(type === "note" ? null : "note")}>Note</button>
      </div>

      {type && (
        <form onSubmit={submit} className="flex flex-wrap gap-2 items-center">
          {type === "bill" && (
            <>
              <input
                data-testid="bill-amount-input"
                type="number" min="0" step="0.01" placeholder="Amount (optional)"
                value={amount} onChange={e => setAmount(e.target.value)}
                className="border rounded px-2 py-1 text-sm w-40"
              />
              <button type="submit" data-testid="add-bill-btn" className="bg-green-600 text-white px-3 py-1.5 rounded text-sm">Add Bill</button>
            </>
          )}

          {type === "item" && (
            <>
              <AutoInput
                data-testid="item-name-input"
                value={itemName}
                onChange={setItemName}
                suggestions={suggestions}
                priceMap={priceMap}
                onSelect={(n, p) => { setItemName(n); if (p != null) setPrice(String(p)); }}
                placeholder="Item name *"
              />
              <input
                data-testid="item-qty-input"
                type="number" min="0" step="0.01" placeholder="Qty"
                value={qty} onChange={e => setQty(e.target.value)}
                className="border rounded px-2 py-1 text-sm w-20"
              />
              <input
                data-testid="item-price-input"
                type="number" min="0" step="0.01" placeholder="Price (optional)"
                value={price} onChange={e => setPrice(e.target.value)}
                className="border rounded px-2 py-1 text-sm w-28"
              />
              <button type="submit" data-testid="add-item-btn" className="bg-green-600 text-white px-3 py-1.5 rounded text-sm">Add Item</button>
            </>
          )}

          {(type === "money_received" || type === "money_given") && (
            <>
              <input
                data-testid="money-amount-input"
                type="number" min="0" step="0.01" placeholder="Amount *"
                value={amount} onChange={e => setAmount(e.target.value)}
                className="border rounded px-2 py-1 text-sm w-36"
              />
              <input
                data-testid="money-note-input"
                placeholder="Note (optional)"
                value={note} onChange={e => setNote(e.target.value)}
                className="border rounded px-2 py-1 text-sm flex-1 min-w-32"
              />
              <button type="submit" data-testid="add-money-btn" className="bg-green-600 text-white px-3 py-1.5 rounded text-sm">Add</button>
            </>
          )}

          {type === "note" && (
            <>
              <input
                data-testid="note-input"
                placeholder="Note text *"
                value={note} onChange={e => setNote(e.target.value)}
                className="border rounded px-2 py-1 text-sm flex-1 min-w-40"
                autoFocus
              />
              <button type="submit" data-testid="add-note-btn" className="bg-green-600 text-white px-3 py-1.5 rounded text-sm">Add Note</button>
            </>
          )}

          <button type="button" onClick={reset} className="text-gray-400 text-sm px-2">✕</button>
        </form>
      )}
    </div>
  );
}

// ── Main Page Detail ──────────────────────────────────────────
export default function PageDetail() {
  const { cid, pid } = useParams();
  const nav = useNavigate();
  const [page, setPage] = useState(null);
  const [entries, setEntries] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [priceMap, setPriceMap] = useState({});
  const [editDate, setEditDate] = useState(false);
  const [dateVal, setDateVal] = useState("");
  const [entrySearch, setEntrySearch] = useState("");
  const fileRef = useRef();

  const load = useCallback(async () => {
    const [pRes, eRes] = await Promise.all([
      api.get(`/pages/${pid}`),
      api.get(`/pages/${pid}/entries`),
    ]);
    setPage(pRes.data);
    setEntries(eRes.data);
  }, [pid]);

  const loadSuggestions = useCallback(async () => {
    const [namesRes, pricesRes] = await Promise.all([
      api.get(`/customers/${cid}/item-names`),
      api.get(`/customers/${cid}/item-prices`),
    ]);
    setSuggestions(namesRes.data);
    const map = {};
    pricesRes.data.forEach(ip => { map[ip.item_name] = ip.price; });
    setPriceMap(map);
  }, [cid]);

  useEffect(() => {
    load();
    loadSuggestions();
  }, [load, loadSuggestions]);

  async function saveDate() {
    await api.put(`/pages/${pid}`, { date: dateVal });
    setEditDate(false);
    load();
  }

  async function deleteEntry(eid) {
    setEntries(prev => prev.filter(e => e.id !== eid));
    try {
      await api.delete(`/entries/${eid}`);
    } catch {
      load();
    }
  }

  async function uploadImage(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      // 1. Get signature from backend
      const sigRes = await api.get("/cloudinary/signature");
      const sig = sigRes.data;

      // 2. Upload directly to Cloudinary
      const fd = new FormData();
      fd.append("file", file);
      fd.append("api_key", sig.api_key);
      fd.append("timestamp", sig.timestamp);
      fd.append("signature", sig.signature);
      fd.append("folder", sig.folder);

      const cloudRes = await fetch(
        `https://api.cloudinary.com/v1_1/${sig.cloud_name}/image/upload`,
        { method: "POST", body: fd }
      );
      const cloudData = await cloudRes.json();
      if (!cloudData.secure_url) throw new Error("Upload failed");

      // 3. Save URL to backend
      await api.post(`/pages/${pid}/images/save`, {
        url: cloudData.secure_url,
        public_id: cloudData.public_id,
      });
      load();
    } catch (err) {
      console.error("Image upload failed:", err);
      alert("Image upload failed. Please try again.");
    }
    e.target.value = "";
  }

  async function deleteImage(img) {
    if (typeof img === "object" && img !== null) {
      await api.post(`/pages/${pid}/images/delete`, { public_id: img.public_id, url: img.url });
    } else {
      await api.delete(`/pages/${pid}/images/${img}`);
    }
    load();
  }

  if (!page) return <div className="p-6 text-center text-gray-400">Loading...</div>;

  return (
    <div className="container">
      {/* Header */}
      <div className="flex items-center gap-3 mt-3 mb-3">
        <button data-testid="back-to-customer" onClick={() => nav(`/customer/${cid}`)} className="text-blue-600 text-sm hover:underline">← Back</button>
        {editDate ? (
          <div className="flex gap-2 items-center">
            <input
              data-testid="edit-date-input"
              type="date"
              value={dateVal}
              onChange={e => setDateVal(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            />
            <button onClick={saveDate} className="bg-green-600 text-white px-2 py-1 rounded text-sm">Save</button>
            <button onClick={() => setEditDate(false)} className="border px-2 py-1 rounded text-sm text-gray-500">Cancel</button>
          </div>
        ) : (
          <h2
            data-testid="page-date"
            className="text-xl font-bold text-gray-800 cursor-pointer hover:text-blue-600"
            onClick={() => { setDateVal(page.date); setEditDate(true); }}
            title="Click to edit date"
          >
            {fmtDate(page.date)}
          </h2>
        )}
        {page.is_settled && (
          <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded">Settled</span>
        )}
      </div>

      {/* Images */}
      <div className="bg-white border rounded p-3 mb-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium text-gray-700">Images</span>
          <button
            data-testid="upload-image-btn"
            onClick={() => fileRef.current.click()}
            className="text-xs border px-2 py-0.5 rounded text-blue-600 hover:bg-blue-50"
          >+ Upload</button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadImage} />
        </div>
        {page.images && page.images.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {page.images.map((img, idx) => {
              const isObj = typeof img === "object" && img !== null;
              const src = isObj ? img.url : `${BACKEND}/api/uploads/${img}`;
              const key = isObj ? img.public_id : img;
              return (
                <div key={key || idx} className="relative group">
                  <a href={src} target="_blank" rel="noreferrer">
                    <img
                      data-testid={`image-${key}`}
                      src={src}
                      alt=""
                      className="w-20 h-20 object-cover rounded border"
                    />
                  </a>
                  <button
                    data-testid={`delete-image-${key}`}
                    onClick={() => deleteImage(img)}
                    className="absolute top-0.5 right-0.5 bg-red-500 text-white text-xs w-5 h-5 rounded-full items-center justify-center hidden group-hover:flex"
                  >✕</button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-gray-400">No images</div>
        )}
      </div>

      {/* Entries */}
      <div className="bg-white border rounded p-3 mb-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium text-gray-700">Entries</span>
          <input
            data-testid="entry-search"
            className="border rounded px-2 py-1 text-sm flex-1"
            placeholder="Search entries..."
            value={entrySearch}
            onChange={e => setEntrySearch(e.target.value)}
          />
        </div>
        {entries.length === 0 && <div className="text-gray-400 text-sm py-3 text-center">No entries yet. Add below.</div>}
        <div>
          {entries.filter(e => {
            if (!entrySearch.trim()) return true;
            const q = entrySearch.toLowerCase();
            return (
              (e.item_name && e.item_name.toLowerCase().includes(q)) ||
              (e.note && e.note.toLowerCase().includes(q)) ||
              (e.bill_no && String(e.bill_no).includes(q)) ||
              (e.amount && String(e.amount).includes(q)) ||
              e.type.includes(q)
            );
          }).map(e => (
          <EntryRow
              key={e.id}
              entry={e}
              onDelete={deleteEntry}
              onUpdate={(payload) => {
                setEntries(prev => prev.map(en => en.id === e.id ? { ...en, ...payload } : en));
                api.put(`/entries/${e.id}`, payload).then(() => loadSuggestions()).catch(() => load());
              }}
            />
          ))}
        </div>
      </div>

      {/* Add Entry Form */}
      <AddEntryForm
        pid={pid}
        onAdded={(newEntry) => {
          if (newEntry) setEntries(prev => [...prev, newEntry]);
          else load();
          loadSuggestions();
        }}
        suggestions={suggestions}
        priceMap={priceMap}
      />
    </div>
  );
}
