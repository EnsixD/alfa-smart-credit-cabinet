import { createContext, useContext } from "react";
import type { User } from "./api";

export type Auth = {
  user: User | null;
  login: (t: string, u: User) => void;
  logout: () => void;
};
export const AuthCtx = createContext<Auth>({
  user: null,
  login: () => {},
  logout: () => {},
});
export const useAuth = () => useContext(AuthCtx);
export const homeOf = (u: User | null) =>
  !u ? "/login" : u.role === "CLIENT" ? "/cabinet" : "/bank";
