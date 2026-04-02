import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import './Dashboard.css';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    toast.success('Logged out');
    navigate('/login');
  }

  return (
    <div className="dash-root">
      <header className="dash-header">
        <div className="dash-brand">
          <span className="brand-icon">⬡</span>
          <span>ShopNest</span>
        </div>
        <div className="dash-user">
          {user?.avatar && <img src={user.avatar} alt="avatar" className="avatar" />}
          <span>{user?.name}</span>
          <button className="logout-btn" onClick={handleLogout}>Logout</button>
        </div>
      </header>
      <main className="dash-main">
        <div className="welcome-card">
          <div className="welcome-icon">🎉</div>
          <h1>Welcome, {user?.name}!</h1>
          <p>You are successfully logged in to ShopNest.</p>
          <div className="user-info">
            <div className="info-row"><span>Email</span><strong>{user?.email || '—'}</strong></div>
            <div className="info-row"><span>Mobile</span><strong>{user?.mobile || '—'}</strong></div>
            <div className="info-row"><span>Auth</span><strong>{user?.auth_provider}</strong></div>
            <div className="info-row"><span>Verified</span><strong>{user?.is_verified ? '✅ Yes' : '❌ No'}</strong></div>
          </div>
          <p className="next-step">🚀 Next: Products, Cart, Orders, Kafka & PySpark coming soon!</p>
        </div>
      </main>
    </div>
  );
}
