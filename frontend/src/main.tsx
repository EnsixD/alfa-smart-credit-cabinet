import React, { createContext, useContext, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { clearSession, getStoredUser, saveSession, User } from "./api";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import NewApplication from "./pages/NewApplication";
import ApplicationPage from "./pages/ApplicationPage";
import BankQueue from "./pages/BankQueue";
import BankApplication from "./pages/BankApplication";
import BankAnalytics from "./pages/BankAnalytics";
import "./styles.css";

type Auth = { user: User | null; login: (t: string, u: User) => void; logout: () => void };
const AuthCtx = createContext<Auth>({ user: null, login: () => {}, logout: () => {} });
export const useAuth = () => useContext(AuthCtx);

function App() {
  const [user, setUser] = useState<User | null>(getStoredUser());
  const auth: Auth = {
    user,
    login: (t, u) => { saveSession(t, u); setUser(u); },
    logout: () => { clearSession(); setUser(null); },
  };
  const isClient = user?.role === "CLIENT";
  return (
    <AuthCtx.Provider value={auth}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          {!user && <Route path="*" element={<Navigate to="/login" />} />}
          {user && (
            <Route element={<Layout />}>
              {isClient ? (
                <>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/new" element={<NewApplication />} />
                  <Route path="/new/:id" element={<NewApplication />} />
                  <Route path="/applications/:id" element={<ApplicationPage />} />
                </>
              ) : (
                <>
                  <Route path="/" element={<BankQueue />} />
                  <Route path="/bank/applications/:id" element={<BankApplication />} />
                  <Route path="/bank/analytics" element={<BankAnalytics />} />
                </>
              )}
              <Route path="*" element={<Navigate to="/" />} />
            </Route>
          )}
        </Routes>
      </BrowserRouter>
    </AuthCtx.Provider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
