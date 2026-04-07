import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { orderAPI, getImageUrl } from '../../utils/api';
import Navbar from '../../components/Navbar';
import toast from 'react-hot-toast';
import './OrdersPage.css';

const STATUS_META = {
  confirmed:  { label: 'Order Confirmed', color: '#3b82f6', icon: '✅' },
  processing: { label: 'Processing',       color: '#f59e0b', icon: '⚙️' },
  shipped:    { label: 'Shipped',           color: '#8b5cf6', icon: '🚚' },
  delivered:  { label: 'Delivered',         color: '#22c55e', icon: '📦' },
  cancelled:  { label: 'Cancelled',         color: '#ef4444', icon: '❌' },
};

const FILTERS = [
  { key: 'all',     label: 'All Orders' },
  { key: '30',      label: 'Last 30 days' },
  { key: '90',      label: 'Last 3 months' },
  { key: '365',     label: 'This year' },
];

export default function OrdersPage() {
  const navigate = useNavigate();
  const [orders,  setOrders]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('all');
  const [page,    setPage]    = useState(1);
  const [total,   setTotal]   = useState(0);
  const [pages,   setPages]   = useState(1);
  const LIMIT = 5;

  useEffect(() => { fetchOrders(); }, [page]);

  async function fetchOrders() {
    setLoading(true);
    try {
      const res = await orderAPI.getOrders({ page, limit: LIMIT });
      setOrders(res.data.orders || []);
      setTotal(res.data.total || 0);
      setPages(res.data.pages || 1);
    } catch (err) {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel(orderId, e) {
    e.stopPropagation();
    if (!window.confirm('Cancel this order?')) return;
    try {
      await orderAPI.cancelOrder(orderId);
      toast.success('Order cancelled');
      fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Cannot cancel order');
    }
  }

  // Client-side date filter
  const now = new Date();
  const filtered = filter === 'all' ? orders : orders.filter(o => {
    const days = parseInt(filter);
    const created = new Date(o.created_at);
    return (now - created) / (1000 * 60 * 60 * 24) <= days;
  });

  return (
    <div className="orders-root">
      <Navbar />

      <div className="orders-body">
        {/* ── Header ── */}
        <div className="orders-header">
          <div>
            <h1 className="orders-title">Your Orders</h1>
            <p className="orders-sub">{total} order{total !== 1 ? 's' : ''} placed</p>
          </div>
          <button className="orders-shop-btn" onClick={() => navigate('/store')}>
            Continue Shopping →
          </button>
        </div>

        {/* ── Filter tabs ── */}
        <div className="orders-filter-tabs">
          {FILTERS.map(f => (
            <button
              key={f.key}
              className={`filter-tab ${filter === f.key ? 'active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* ── Orders list ── */}
        {loading ? (
          <div className="orders-loading">
            {[...Array(3)].map((_, i) => <div key={i} className="order-skeleton" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="orders-empty">
            <div className="empty-icon">📭</div>
            <h2>No orders found</h2>
            <p>Looks like you haven't placed any orders yet.</p>
            <button className="start-shop-btn" onClick={() => navigate('/store')}>
              Start Shopping
            </button>
          </div>
        ) : (
          <div className="orders-list">
            {filtered.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onClick={() => navigate(`/orders/${order.id}`)}
                onCancel={handleCancel}
              />
            ))}
          </div>
        )}

        {/* ── Pagination ── */}
        {pages > 1 && (
          <div className="orders-pagination">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <span>Page {page} of {pages}</span>
            <button disabled={page === pages} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}

function OrderCard({ order, onClick, onCancel }) {
  const meta = STATUS_META[order.status] || STATUS_META.confirmed;
  const date = new Date(order.created_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  return (
    <div className="order-card" onClick={onClick}>
      {/* ── Card header ── */}
      <div className="oc-header">
        <div className="oc-header-left">
          <div className="oc-meta">
            <span className="oc-label">ORDER PLACED</span>
            <span className="oc-val">{date}</span>
          </div>
          <div className="oc-meta">
            <span className="oc-label">TOTAL</span>
            <span className="oc-val">${(order.pricing?.total || 0).toFixed(2)}</span>
          </div>
          <div className="oc-meta">
            <span className="oc-label">PAYMENT</span>
            <span className="oc-val">
              {order.payment?.method === 'cod' ? 'Cash on Delivery' : `Card ····${order.payment?.transaction_id?.slice(-4) || ''}`}
            </span>
          </div>
        </div>
        <div className="oc-header-right">
          <span className="oc-order-num">#{order.order_id}</span>
          <span className="oc-view-link">View order details ›</span>
        </div>
      </div>

      {/* ── Status bar ── */}
      <div className="oc-status-bar" style={{ borderColor: meta.color }}>
        <span className="oc-status-icon">{meta.icon}</span>
        <span className="oc-status-text" style={{ color: meta.color }}>{meta.label}</span>
        {order.status === 'confirmed' || order.status === 'processing' ? (
          <span className="oc-eta">
            Estimated delivery: {new Date(order.estimated_delivery).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        ) : null}
      </div>

      {/* ── Items preview ── */}
      <div className="oc-items">
        {(order.items || []).slice(0, 3).map((item, i) => (
          <ItemThumb key={i} item={item} />
        ))}
        {order.items?.length > 3 && (
          <div className="oc-more-items">+{order.items.length - 3} more</div>
        )}
      </div>

      {/* ── Actions ── */}
      <div className="oc-actions" onClick={e => e.stopPropagation()}>
        <button className="oc-btn-primary" onClick={() => window.location.href = `/orders/${order.id}`}>
          View Details
        </button>
        {(order.status === 'confirmed' || order.status === 'processing') && (
          <button className="oc-btn-danger" onClick={e => onCancel(order.id, e)}>
            Cancel Order
          </button>
        )}
        <button className="oc-btn-secondary" onClick={() => window.location.href = '/store'}>
          Buy Again
        </button>
      </div>
    </div>
  );
}

function ItemThumb({ item }) {
  const [err, setErr] = useState(false);
  return (
    <div className="oc-item-thumb">
      <img
        src={err ? 'https://placehold.co/60x60?text=No+Img' : getImageUrl(item.thumbnail)}
        alt={item.name}
        onError={() => setErr(true)}
      />
      <div className="oc-item-info">
        <div className="oc-item-name">{item.name}</div>
        <div className="oc-item-qty">Qty: {item.quantity}</div>
        <div className="oc-item-price">${(item.price * item.quantity).toFixed(2)}</div>
      </div>
    </div>
  );
}
