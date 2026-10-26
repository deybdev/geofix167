import { useState } from "react";
import { AuthContext } from "../../shared/hooks/useAuth";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);

  const value = {
    user,
    role,
    signIn: (selectedRole) => {
      setUser({ role: selectedRole });
      setRole(selectedRole);
    },
    signOut: () => {
      setUser(null);
      setRole(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
