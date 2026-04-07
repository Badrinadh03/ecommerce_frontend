import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAPI } from '../../utils/api';
import toast from 'react-hot-toast';
import './AdminLogin.css';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSeed() {
    try {
      await adminAPI.seed({ email: 'admin@shopnest.com', password: 'Admin@123', name: 'ShopNest Admin' });
      toast.success('Default admin created!\nEmail: admin@shopnest.com\nPassword: Admin@123');
    } catch { toast.error('Admin already exists'); }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await adminAPI.login({ email, password });
      // Only save display info — token is in httpOnly cookie
      localStorage.setItem('shopnest_admin', JSON.stringify(res.data.admin));
      toast.success('Welcome, Admin!');
      navigate('/admin/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally { setBusy(false); }
  }

  return (
    <div className="al-root">
      <div className="al-card">
        <div className="al-logo">
          <span className="al-icon">⬡</span>
          <span>ShopNest</span>
          <span className="al-badge">ADMIN</span>
        </div>
        <h2>Admin Portal</h2>
        <p className="al-sub">Sign in to manage your store</p>

        <form onSubmit={handleLogin} className="al-form">
          <div className="al-field">
            <label>Email</label>
            <input type="email" placeholder="admin@shopnest.com" value={email}
              onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="al-field">
            <label>Password</label>
            <div className="al-pw-wrap">
              <input type={show ? 'text' : 'password'} placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)} required />
              <button type="button" onClick={() => setShow(s => !s)}>{show ? '🙈' : '👁'}</button>
            </div>
          </div>
          <button className="al-btn" type="submit" disabled={busy}>
            {busy ? <span className="al-spin" /> : 'Sign In to Admin'}
          </button>
        </form>

        <div className="al-divider" />
        <button className="al-seed-btn" onClick={handleSeed}>
          🔧 Create Default Admin Account
        </button>
        <p className="al-hint">Default: admin@shopnest.com / Admin@123</p>
      </div>
    </div>
  );
}
