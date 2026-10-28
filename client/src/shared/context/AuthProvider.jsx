import { useState, useEffect } from "react";
import { AuthContext } from "../hooks/useAuth";
import { getMe, login, logout } from "../../services/authService";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMe()
      .then(({ data }) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));

    const interval = setInterval(() => {
      getMe()
        .then(({ data }) => setUser(data.user))
        .catch(() => setUser(null));
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const signIn = async (email, password) => {
    const { data } = await login(email, password);
    setUser(data.user);
    return data.user;
  };

  const signOut = async () => {
    await logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, role: user?.role ?? null, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
