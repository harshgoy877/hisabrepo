import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import CustomerList from "./pages/CustomerList";
import CustomerDetail from "./pages/CustomerDetail";
import PageDetail from "./pages/PageDetail";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CustomerList />} />
        <Route path="/customer/:cid" element={<CustomerDetail />} />
        <Route path="/customer/:cid/page/:pid" element={<PageDetail />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
