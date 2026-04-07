import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { authAPI } from '../../utils/api';
import Navbar from '../../components/Navbar';
import toast from 'react-hot-toast';
import './ProfilePage.css';

export default function ProfilePage() {
  const navigate       = useNavigate();
  const { user, saveAuth } = useAuth();
  const [editing, setEditing]   = useState(false);
  const [saving,  setSaving]    = useState(false);
  const [form, setForm] = useState({
    name:   user?.name   || '',
    mobile: user?.mobile || '',
  });

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Name cannot be empty'); return; }
    setSaving(true);
    try {
      const res = await authAPI.updateProfile({ name: form.name, mobile: form.mobile });
      saveAuth(res.data.user);
      setEditing(false);
      toast.success('Profile updated!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setForm({ name: user?.name || '', mobile: user?.mobile || '' });
    setEditing(false);
  }

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const quickLinks = [
    { icon: '📦', label: 'Your Orders',    sub: 'Track, return, or buy things again', path: '/orders' },
    { icon: '🛍️', label: 'Browse Store',  sub: 'Discover new products',              path: '/store'  },
  ];

  return (
    <div className="profile-root">
      <Navbar />

      <div className="profile-body">

        {/* ── Page header ── */}
        <div className="profile-header">
          <h1 className="profile-title">Your Account</h1>
          <p className="profile-sub">Manage your profile and account settings</p>
        </div>

        <div className="profile-grid">

          {/* ── LEFT: Account card ── */}
          <div className="profile-card">
            <div className="pcard-avatar-section">
              {user?.avatar
                ? <img src={user.avatar} alt="avatar" className="pcard-avatar-img" />
                : <div className="pcard-avatar-initials">{initials}</div>
              }
              <div className="pcard-auth-badge">
                {user?.auth_provider === 'google'
                  ? '🔵 Google Account'
                  : user?.auth_provider === 'mobile'
                  ? '📱 Mobile Account'
                  : '📧 Email Account'}
              </div>
            </div>

            {editing ? (
              /* ── Edit mode ── */
              <div className="pcard-edit-form">
                <div className="pf-field">
                  <label>Full Name</label>
                  <input
                    value={form.name}
                    onChange={e => setField('name', e.target.value)}
                    placeholder="Your full name"
                  />
                </div>
                <div className="pf-field">
                  <label>Mobile Number</label>
                  <input
                    value={form.mobile}
                    onChange={e => setField('mobile', e.target.value)}
                    placeholder="+1 234 567 8900"
                  />
                </div>
                <div className="pf-actions">
                  <button className="pf-save-btn" onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                  <button className="pf-cancel-btn" onClick={handleCancel}>Cancel</button>
                </div>
              </div>
            ) : (
              /* ── View mode ── */
              <div className="pcard-info">
                <div className="pinfo-row">
                  <span className="pinfo-label">Full Name</span>
                  <span className="pinfo-value">{user?.name || '—'}</span>
                </div>
                <div className="pinfo-row">
                  <span className="pinfo-label">Email</span>
                  <span className="pinfo-value">{user?.email || '—'}</span>
                </div>
                <div className="pinfo-row">
                  <span className="pinfo-label">Mobile</span>
                  <span className="pinfo-value">{user?.mobile || '—'}</span>
                </div>
                <div className="pinfo-row">
                  <span className="pinfo-label">Verified</span>
                  <span className={`pinfo-value ${user?.is_verified ? 'verified' : 'unverified'}`}>
                    {user?.is_verified ? '✅ Verified' : '❌ Not verified'}
                  </span>
                </div>
                <div className="pinfo-row">
                  <span className="pinfo-label">Role</span>
                  <span className="pinfo-value role-badge">{user?.role || 'customer'}</span>
                </div>
                <button className="pcard-edit-btn" onClick={() => setEditing(true)}>
                  ✏️ Edit Profile
                </button>
              </div>
            )}
          </div>

          {/* ── RIGHT: Quick links ── */}
          <div className="profile-quick-links">
            {quickLinks.map(link => (
              <button key={link.path} className="quick-link-card" onClick={() => navigate(link.path)}>
                <div className="ql-icon">{link.icon}</div>
                <div className="ql-text">
                  <div className="ql-label">{link.label}</div>
                  <div className="ql-sub">{link.sub}</div>
                </div>
                <div className="ql-arrow">›</div>
              </button>
            ))}

            {/* Security card */}
            <div className="security-card">
              <div className="sc-header">🔒 Account Security</div>
              <div className="sc-rows">
                <div className="sc-row">
                  <span>Password</span>
                  <span className="sc-status">
                    {user?.auth_provider === 'google' ? 'Managed by Google' : '••••••••'}
                  </span>
                </div>
                <div className="sc-row">
                  <span>Two-Factor Auth</span>
                  <span className="sc-status">Via OTP email</span>
                </div>
                <div className="sc-row">
                  <span>Login Method</span>
                  <span className="sc-status">{user?.auth_provider}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
