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

  const signIn = async (mobileNumber, password) => {
    const { data } = await login(mobileNumber, password);
    // The caller validates the role and calls commitSignIn() before any
    // route guard (e.g. GuestRoute) sees a signed-in user, so wrong-role
    // credentials can be rejected without a redirect.
    return data.user;
  };

  const commitSignIn = (user) => setUser(user);

  const signOut = async () => {
    await logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, role: user?.role ?? null, loading, signIn, commitSignIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
