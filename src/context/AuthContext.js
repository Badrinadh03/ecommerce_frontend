import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Only store non-sensitive user info in localStorage (name, email, avatar)
  // The actual session token lives in httpOnly cookie — JS cannot read it
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('shopnest_user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  // On app load — verify session with backend (cookie sent automatically)
  useEffect(() => {
    verifySession();
  }, []);

  async function verifySession() {
    try {
      const res = await authAPI.getMe();
      const userData = res.data.user;
      setUser(userData);
      localStorage.setItem('shopnest_user', JSON.stringify(userData));
    } catch {
      // No valid session — clear user
      setUser(null);
      localStorage.removeItem('shopnest_user');
    } finally {
      setLoading(false);
    }
  }

  function saveAuth(userData) {
    // Only save display info — NOT the token
    localStorage.setItem('shopnest_user', JSON.stringify(userData));
    setUser(userData);
  }

  function clearAuth() {
    localStorage.removeItem('shopnest_user');
    localStorage.removeItem('shopnest_admin');
    // ← Token is cleared by backend via cookie
    setUser(null);
  }

  async function logout() {
    try {
      await authAPI.logout(); // ← Backend deletes session from MongoDB + clears cookie
    } catch {}
    clearAuth();
  }

  return (
    <AuthContext.Provider value={{ user, loading, setLoading, saveAuth, clearAuth, logout, verifySession }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
