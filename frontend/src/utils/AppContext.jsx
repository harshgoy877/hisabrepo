import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "./api";

const AppCtx = createContext(null);

export function AppProvider({ children }) {
  // customers list (shared - persists across navigations)
  const [customers, setCustomers] = useState(null); // null = never loaded yet

  // individual customer data with balance {cid: customerObj}
  const [customerMap, setCustomerMap] = useState({});

  // pages per customer {cid: pages[]}
  const [pagesMap, setPagesMap] = useState({});
  const [pagesTotalMap, setPagesTotalMap] = useState({});

  // entries per page {pid: entries[]}
  const [pageEntriesMap, setPageEntriesMap] = useState({});

  // Refresh full customer list (also syncs customerMap)
  const refreshCustomers = useCallback(async () => {
    try {
      const r = await api.get("/customers");
      setCustomers(r.data);
      setCustomerMap(prev => {
        const next = { ...prev };
        r.data.forEach(c => { next[c.id] = c; });
        return next;
      });
    } catch {}
  }, []);

  // Refresh single customer balance+data
  const refreshCustomer = useCallback(async (cid) => {
    try {
      const r = await api.get(`/customers/${cid}/single`);
      setCustomerMap(prev => ({ ...prev, [cid]: r.data }));
      setCustomers(prev => prev ? prev.map(c => c.id === cid ? r.data : c) : prev);
    } catch {}
  }, []);

  // Initial load + 30s background sync
  useEffect(() => {
    refreshCustomers();
    const t = setInterval(refreshCustomers, 30000);
    return () => clearInterval(t);
  }, [refreshCustomers]);

  return (
    <AppCtx.Provider value={{
      customers, setCustomers,
      customerMap, setCustomerMap,
      pagesMap, setPagesMap,
      pagesTotalMap, setPagesTotalMap,
      pageEntriesMap, setPageEntriesMap,
      refreshCustomers,
      refreshCustomer,
    }}>
      {children}
    </AppCtx.Provider>
  );
}

export const useApp = () => useContext(AppCtx);
