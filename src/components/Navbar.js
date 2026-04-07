import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { notificationAPI } from '../utils/api';
import toast from 'react-hot-toast';
import './Navbar.css';

/**
 * Shared top navbar — Amazon-style with profile dropdown + notification bell.
 *
 * Props:
 *   cartCount     {number}  – badge on cart icon (0 = hide badge)
 *   middleContent {node}    – optional slot (e.g. search bar for StorePage)
 *   showCart      {bool}    – default true
 */
export default function Navbar({ cartCount = 0, middleContent = null, showCart = true }) {
  const navigate        = useNavigate();
  const location        = useLocation();
  const { user, logout} = useAuth();

  // ── Profile dropdown ──
  const [open, setOpen]       = useState(false);
  const dropRef               = useRef(null);

  // ── Notification panel ──
  const [notifOpen, setNotifOpen]         = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [notifLoading, setNotifLoading]   = useState(false);
  const notifRef                          = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function onClickOutside(e) {
      if (dropRef.current  && !dropRef.current.contains(e.target))  setOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // Fetch unread count on mount and every 60 s
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await notificationAPI.getUnreadCount();
      setUnreadCount(res.data.unread_count || 0);
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60_000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Open notification panel → load notifications
  async function openNotifications() {
    if (notifOpen) { setNotifOpen(false); return; }
    setNotifOpen(true);
    setOpen(false);
    if (notifLoading) return;
    setNotifLoading(true);
    try {
      const res = await notificationAPI.getAll(20);
      setNotifications(res.data.notifications || []);
    } catch (_) {
      setNotifications([]);
    } finally {
      setNotifLoading(false);
    }
  }

  async function markAllRead() {
    try {
      await notificationAPI.markAllRead();
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (_) {}
  }

  // ── Profile helpers ──
  async function handleLogout() {
    setOpen(false);
    await logout();
    toast.success('Signed out successfully');
    navigate('/login');
  }

  function go(path) {
    setOpen(false);
    navigate(path);
  }

  const initials  = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';
  const firstName = user?.name?.split(' ')[0] || 'User';

  // ── Notification icon by type ──
  function notifIcon(type) {
    const icons = {
      order_placed:    '🎉',
      order_cancelled: '❌',
      order_delivered: '📦',
      payment_success: '💳',
      payment_verified:'✅',
      general:         '🔔',
    };
    return icons[type] || '🔔';
  }

  return (
    <header className="sn-navbar">
      {/* ── Logo ── */}
      <div className="sn-nav-logo" onClick={() => navigate('/store')}>
        <span className="sn-logo-icon">⬡</span>
        <span className="sn-logo-text">ShopNest</span>
      </div>

      {/* ── Middle slot (search bar injected by StorePage) ── */}
      {middleContent && (
        <div className="sn-nav-middle">{middleContent}</div>
      )}

      {/* ── Right side ── */}
      <div className="sn-nav-right">

        {/* ── Notification Bell ── */}
        <div className="sn-notif-wrap" ref={notifRef}>
          <button
            className={`sn-notif-btn ${notifOpen ? 'open' : ''}`}
            onClick={openNotifications}
            title="Notifications"
          >
            <span className="sn-notif-icon">🔔</span>
            {unreadCount > 0 && (
              <span className="sn-notif-badge">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* ── Notification Panel ── */}
          {notifOpen && (
            <div className="sn-notif-panel">
              <div className="sn-notif-header">
                <span className="sn-notif-title">Notifications</span>
                {unreadCount > 0 && (
                  <button className="sn-notif-mark-read" onClick={markAllRead}>
                    Mark all read
                  </button>
                )}
              </div>

              <div className="sn-notif-list">
                {notifLoading ? (
                  <div className="sn-notif-empty">Loading…</div>
                ) : notifications.length === 0 ? (
                  <div className="sn-notif-empty">
                    <span>🔔</span>
                    <p>No notifications yet</p>
                  </div>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      className={`sn-notif-item ${!n.is_read ? 'unread' : ''}`}
                      onClick={async () => {
                        if (!n.is_read) {
                          await notificationAPI.markOneRead(n.id).catch(() => {});
                          setNotifications(prev =>
                            prev.map(x => x.id === n.id ? { ...x, is_read: true } : x)
                          );
                          setUnreadCount(c => Math.max(0, c - 1));
                        }
                        if (n.meta?.order_id) {
                          setNotifOpen(false);
                          navigate('/orders');
                        }
                      }}
                    >
                      <span className="sn-notif-type-icon">{notifIcon(n.type)}</span>
                      <div className="sn-notif-content">
                        <div className="sn-notif-item-title">{n.title}</div>
                        <div className="sn-notif-item-msg">{n.message}</div>
                        <div className="sn-notif-time">
                          {new Date(n.created_at).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </div>
                      </div>
                      {!n.is_read && <div className="sn-notif-dot" />}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Cart ── */}
        {showCart && (
          <button className="sn-cart-btn" onClick={() => navigate('/cart')}>
            <span className="sn-cart-icon">🛒</span>
            {cartCount > 0 && <span className="sn-cart-badge">{cartCount}</span>}
            <span className="sn-cart-label">Cart</span>
          </button>
        )}

        {/* ── Profile Dropdown ── */}
        <div className="sn-profile-wrap" ref={dropRef}>
          <button
            className={`sn-profile-trigger ${open ? 'open' : ''}`}
            onClick={() => { setOpen(o => !o); setNotifOpen(false); }}
          >
            <div className="sn-avatar-wrap">
              {user?.avatar
                ? <img src={user.avatar} alt="avatar" className="sn-avatar-img" />
                : <div className="sn-avatar-initials">{initials}</div>
              }
            </div>
            <div className="sn-trigger-text">
              <span className="sn-greeting">Hello, {firstName}</span>
              <span className="sn-account-label">
                Account &amp; Lists <span className="sn-caret">▾</span>
              </span>
            </div>
          </button>

          {/* ── Dropdown panel ── */}
          {open && (
            <div className="sn-dropdown">
              {/* User card */}
              <div className="sn-dropdown-user">
                <div className="sn-dropdown-avatar">
                  {user?.avatar
                    ? <img src={user.avatar} alt="avatar" />
                    : <div className="sn-dd-initials">{initials}</div>
                  }
                </div>
                <div className="sn-dropdown-info">
                  <div className="sn-dd-name">{user?.name}</div>
                  <div className="sn-dd-email">{user?.email || user?.mobile}</div>
                  {user?.is_verified && <div className="sn-dd-verified">✓ Verified</div>}
                </div>
              </div>

              <div className="sn-dd-divider" />

              {/* Account section */}
              <div className="sn-dd-section">
                <div className="sn-dd-section-title">Your Account</div>
                <button
                  className={`sn-dd-item ${location.pathname === '/profile' ? 'active' : ''}`}
                  onClick={() => go('/profile')}
                >
                  <span className="sn-dd-icon">👤</span>
                  <span>Your Profile</span>
                </button>
                <button
                  className={`sn-dd-item ${location.pathname === '/orders' ? 'active' : ''}`}
                  onClick={() => go('/orders')}
                >
                  <span className="sn-dd-icon">📦</span>
                  <span>Your Orders</span>
                </button>
                <button
                  className={`sn-dd-item ${location.pathname === '/store' ? 'active' : ''}`}
                  onClick={() => go('/store')}
                >
                  <span className="sn-dd-icon">🛍️</span>
                  <span>Browse Store</span>
                </button>
              </div>

              <div className="sn-dd-divider" />

              {/* Sign out */}
              <button className="sn-dd-signout" onClick={handleLogout}>
                <span className="sn-dd-icon">🚪</span>
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
