import { useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { clearSession, getStoredUser, saveSession, User } from "./api";
import { AuthCtx, homeOf, type Auth } from "./auth";
import Shell from "./components/Shell";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import { ProductDetails, LoanDetails } from "./pages/CreditDetails";
import Dashboard from "./pages/Dashboard";
import NewApplication from "./pages/NewApplication";
import ApplicationPage from "./pages/ApplicationPage";
import {
  ApplicationsList,
  DocumentsPage,
  LoansPage,
} from "./pages/CabinetPages";
import Settings from "./pages/Settings";
import BankQueue from "./pages/BankQueue";
import BankApplication from "./pages/BankApplication";
import BankAnalytics from "./pages/BankAnalytics";
import "./styles.css";
import "./theme.css";
import "./theme2.css";
import "./studio.css";
import "./credit.css";
import "./motion-design.css";
import "./experience.css";
import "./wizard2.css";

export default function App() {
  const [user, setUser] = useState<User | null>(getStoredUser());
  const auth: Auth = {
    user,
    login: (t, u) => {
      saveSession(t, u);
      setUser(u);
    },
    logout: () => {
      clearSession();
      setUser(null);
    },
  };
  const isClient = user?.role === "CLIENT";
  return (
    <AuthCtx.Provider value={auth}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/credits/:code" element={<ProductDetails />} />
          <Route
            path="/login"
            element={user ? <Navigate to={homeOf(user)} /> : <Login />}
          />
          {user && isClient && (
            <Route path="/cabinet" element={<Shell />}>
              <Route index element={<Dashboard />} />
              <Route path="new" element={<NewApplication />} />
              <Route path="new/:id" element={<NewApplication />} />
              <Route path="applications" element={<ApplicationsList />} />
              <Route path="applications/:id" element={<ApplicationPage />} />
              <Route path="loans" element={<LoansPage />} />
              <Route path="loans/:id" element={<LoanDetails />} />
              <Route path="documents" element={<DocumentsPage />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          )}
          {user && !isClient && (
            <Route path="/bank" element={<Shell />}>
              <Route index element={<BankQueue />} />
              <Route path="applications/:id" element={<BankApplication />} />
              <Route path="analytics" element={<BankAnalytics />} />
            </Route>
          )}
          <Route
            path="*"
            element={<Navigate to={user ? homeOf(user) : "/"} />}
          />
        </Routes>
      </BrowserRouter>
    </AuthCtx.Provider>
  );
}
