import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';

import AuthPage        from './pages/AuthPage';
import StorePage       from './pages/user/StorePage';
import CartPage        from './pages/user/CartPage';
import CheckoutPage    from './pages/user/CheckoutPage';
import ProfilePage     from './pages/user/ProfilePage';
import OrdersPage      from './pages/user/OrdersPage';
import OrderDetailPage from './pages/user/OrderDetailPage';

import AdminLogin      from './pages/admin/AdminLogin';
import AdminDashboard  from './pages/admin/AdminDashboard';

import './styles/global.css';

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { user } = useAuth();
  return user ? <Navigate to="/store" replace /> : children;
}

function AdminRoute({ children }) {
  const token = localStorage.getItem('shopnest_admin');
  return token ? children : <Navigate to="/admin/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: { background: '#15151f', color: '#f0f0f8', border: '1px solid #1e1e2e', borderRadius: '10px', fontSize: '14px' },
            success: { iconTheme: { primary: '#22c55e', secondary: '#15151f' } },
            error:   { iconTheme: { primary: '#ef4444', secondary: '#15151f' } },
          }}
        />
        <Routes>
          {/* Public */}
          <Route path="/"         element={<Navigate to="/login" replace />} />
          <Route path="/login"    element={<PublicRoute><AuthPage /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><AuthPage /></PublicRoute>} />

          {/* User — protected */}
          <Route path="/store"      element={<PrivateRoute><StorePage /></PrivateRoute>} />
          <Route path="/cart"       element={<PrivateRoute><CartPage /></PrivateRoute>} />
          <Route path="/checkout"   element={<PrivateRoute><CheckoutPage /></PrivateRoute>} />
          <Route path="/profile"    element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
          <Route path="/orders"     element={<PrivateRoute><OrdersPage /></PrivateRoute>} />
          <Route path="/orders/:id" element={<PrivateRoute><OrderDetailPage /></PrivateRoute>} />

          {/* Admin */}
          <Route path="/admin"           element={<Navigate to="/admin/login" replace />} />
          <Route path="/admin/login"     element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
