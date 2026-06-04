import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: "admin" | "agent";
  isBlocked: boolean;
  phone: string | null;
  createdAt: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  initialized: boolean;
  login: (user: AuthUser, token: string) => void;
  logout: () => void;
  isAdmin: boolean;
  isAgent: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem("crm_token");
    const storedUser = localStorage.getItem("crm_user");
    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem("crm_token");
        localStorage.removeItem("crm_user");
      }
    }
    setInitialized(true);
  }, []);

  const login = (user: AuthUser, token: string) => {
    localStorage.setItem("crm_token", token);
    localStorage.setItem("crm_user", JSON.stringify(user));
    setUser(user);
    setToken(token);
  };

  const logout = () => {
    localStorage.removeItem("crm_token");
    localStorage.removeItem("crm_user");
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{
      user, token, initialized, login, logout,
      isAdmin: user?.role === "admin",
      isAgent: user?.role === "agent",
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
