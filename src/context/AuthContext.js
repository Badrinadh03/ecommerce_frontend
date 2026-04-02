import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('shopnest_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(false);

  function saveAuth(token, userData) {
    localStorage.setItem('shopnest_token', token);
    localStorage.setItem('shopnest_user', JSON.stringify(userData));
    setUser(userData);
  }

  function clearAuth() {
    localStorage.removeItem('shopnest_token');
    localStorage.removeItem('shopnest_user');
    setUser(null);
  }

  async function logout() {
    try { await authAPI.logout(); } catch {}
    clearAuth();
  }

  return (
    <AuthContext.Provider value={{ user, loading, setLoading, saveAuth, clearAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
