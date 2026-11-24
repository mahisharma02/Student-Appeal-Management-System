import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getCurrentUser, getCsrfToken, loginRequest, logoutRequest } from "../services/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [csrfToken, setCsrfToken] = useState("");
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const current = await getCurrentUser();
      setUser(current);
      const token = await getCsrfToken();
      setCsrfToken(token);
      return current;
    } catch {
      setUser(null);
      setCsrfToken("");
      return null;
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  const login = async (email, password) => {
    const result = await loginRequest(email, password);
    setUser(result.user);
    setCsrfToken(result.csrfToken);
    return result.user;
  };

  const logout = async () => {
    try {
      if (csrfToken) await logoutRequest(csrfToken);
    } finally {
      setUser(null);
      setCsrfToken("");
    }
  };

  const value = useMemo(() => ({
    user, csrfToken, loading, login, logout, refreshUser
  }), [user, csrfToken, loading, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}