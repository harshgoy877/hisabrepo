import axios from "axios";

const BASE = process.env.REACT_APP_BACKEND_URL + "/api";

const api = axios.create({ baseURL: BASE });

export default api;
