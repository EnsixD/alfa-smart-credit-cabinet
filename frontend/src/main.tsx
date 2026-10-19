import React, { createContext, useContext, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { clearSession, getStoredUser, saveSession, User } from "./api";
import Shell from "./components/Shell";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import NewApplication from "./pages/NewApplication";
import ApplicationPage from "./pages/ApplicationPage";
import { ApplicationsList, DocumentsPage, LoansPage, SettingsPage } from "./pages/CabinetPages";
import BankQueue from "./pages/BankQueue";
import BankApplication from "./pages/BankApplication";
import BankAnalytics from "./pages/BankAnalytics";
import "./styles.css";
import "./theme.css";
import "./theme2.css";

type Auth = { user: User | null; login: (t: string, u: User) => void; logout: () => void };
const AuthCtx = createContext<Auth>({ user: null, login: () => {}, logout: () => {} });
export const useAuth = () => useContext(AuthCtx);
export const homeOf = (u: User | null) => (!u ? "/login" : u.role === "CLIENT" ? "/cabinet" : "/bank");

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
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={user ? <Navigate to={homeOf(user)} /> : <Login />} />
          {user && isClient && (
            <Route path="/cabinet" element={<Shell />}>
              <Route index element={<Dashboard />} />
              <Route path="new" element={<NewApplication />} />
              <Route path="new/:id" element={<NewApplication />} />
              <Route path="applications" element={<ApplicationsList />} />
              <Route path="applications/:id" element={<ApplicationPage />} />
              <Route path="loans" element={<LoansPage />} />
              <Route path="documents" element={<DocumentsPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          )}
          {user && !isClient && (
            <Route path="/bank" element={<Shell />}>
              <Route index element={<BankQueue />} />
              <Route path="applications/:id" element={<BankApplication />} />
              <Route path="analytics" element={<BankAnalytics />} />
            </Route>
          )}
          <Route path="*" element={<Navigate to={user ? homeOf(user) : "/"} />} />
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
