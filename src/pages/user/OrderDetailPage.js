import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { orderAPI, getImageUrl } from '../../utils/api';
import Navbar from '../../components/Navbar';
import toast from 'react-hot-toast';
import './OrderDetailPage.css';

const STATUS_STEPS = ['confirmed', 'processing', 'shipped', 'delivered'];
const STATUS_META  = {
  confirmed:  { label: 'Order Confirmed', icon: '✅', color: '#3b82f6' },
  processing: { label: 'Processing',       icon: '⚙️', color: '#f59e0b' },
  shipped:    { label: 'Shipped',           icon: '🚚', color: '#8b5cf6' },
  delivered:  { label: 'Delivered',         icon: '📦', color: '#22c55e' },
  cancelled:  { label: 'Cancelled',         icon: '❌', color: '#ef4444' },
};

export default function OrderDetailPage() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const [order,    setOrder]   = useState(null);
  const [payment,  setPayment] = useState(null);
  const [loading,  setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => { fetchOrder(); }, [id]);

  async function fetchOrder() {
    setLoading(true);
    try {
      const res = await orderAPI.getOrder(id);
      setOrder(res.data.order);
      setPayment(res.data.payment);
    } catch (err) {
      toast.error('Order not found');
      navigate('/orders');
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel() {
    if (!window.confirm('Are you sure you want to cancel this order?')) return;
    setCancelling(true);
    try {
      await orderAPI.cancelOrder(id);
      toast.success('Order cancelled successfully');
      fetchOrder();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Cannot cancel this order');
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <div className="od-root">
        <Navbar />
        <div className="od-loading">
          <div className="od-skeleton-header" />
          <div className="od-skeleton-body" />
        </div>
      </div>
    );
  }

  if (!order) return null;

  const meta        = STATUS_META[order.status] || STATUS_META.confirmed;
  const isCancelled = order.status === 'cancelled';
  const stepIndex   = STATUS_STEPS.indexOf(order.status);
  const addr        = order.shipping_address || {};
  const pricing     = order.pricing || {};

  const orderDate = new Date(order.created_at).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const deliveryDate = order.estimated_delivery
    ? new Date(order.estimated_delivery).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '—';

  return (
    <div className="od-root">
      <Navbar />

      <div className="od-body">
        {/* ── Breadcrumb ── */}
        <div className="od-breadcrumb">
          <button onClick={() => navigate('/orders')}>← Your Orders</button>
          <span>›</span>
          <span>{order.order_id}</span>
        </div>

        {/* ── Page title ── */}
        <div className="od-title-row">
          <div>
            <h1 className="od-title">Order Details</h1>
            <p className="od-subtitle">Placed on {orderDate}</p>
          </div>
          <div className="od-status-badge" style={{ background: `${meta.color}22`, color: meta.color, borderColor: `${meta.color}44` }}>
            {meta.icon} {meta.label}
          </div>
        </div>

        {/* ── Progress tracker (skip for cancelled) ── */}
        {!isCancelled && (
          <div className="od-tracker">
            {STATUS_STEPS.map((step, i) => {
              const m    = STATUS_META[step];
              const done = i <= stepIndex;
              return (
                <React.Fragment key={step}>
                  <div className={`od-track-step ${done ? 'done' : ''}`}>
                    <div className="od-track-circle" style={{ background: done ? m.color : '#2a2a3e', borderColor: done ? m.color : '#3a3a4e' }}>
                      {done ? '✓' : i + 1}
                    </div>
                    <div className="od-track-label">{m.label}</div>
                  </div>
                  {i < STATUS_STEPS.length - 1 && (
                    <div className={`od-track-line ${i < stepIndex ? 'done' : ''}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}

        {/* ── Main grid ── */}
        <div className="od-grid">

          {/* LEFT: Items + Address + Payment */}
          <div className="od-left">

            {/* Items */}
            <div className="od-section">
              <h2 className="od-section-title">🛍️ Items Ordered ({order.items?.length || 0})</h2>
              <div className="od-items">
                {(order.items || []).map((item, i) => (
                  <OrderItem key={i} item={item} />
                ))}
              </div>
            </div>

            {/* Shipping address */}
            <div className="od-section">
              <h2 className="od-section-title">📦 Shipping Address</h2>
              <div className="od-address">
                <div className="od-addr-name">{addr.full_name}</div>
                <div className="od-addr-line">{addr.street}{addr.apt ? `, ${addr.apt}` : ''}</div>
                <div className="od-addr-line">{addr.city}, {addr.state} {addr.zip}</div>
                <div className="od-addr-line">{addr.country}</div>
                {addr.phone && <div className="od-addr-line">📞 {addr.phone}</div>}
                {addr.email && <div className="od-addr-line">✉️ {addr.email}</div>}
              </div>
            </div>

            {/* Payment */}
            <div className="od-section">
              <h2 className="od-section-title">💳 Payment</h2>
              <div className="od-payment">
                <div className="od-pay-row">
                  <span>Method</span>
                  <span>
                    {order.payment?.method === 'cod'
                      ? '💵 Cash on Delivery'
                      : `💳 Card`}
                  </span>
                </div>
                {order.payment?.method === 'card' && payment?.card_last4 && (
                  <div className="od-pay-row">
                    <span>Card</span>
                    <span>···· ···· ···· {payment.card_last4}</span>
                  </div>
                )}
                <div className="od-pay-row">
                  <span>Status</span>
                  <span className={`od-pay-status ${order.payment?.status}`}>
                    {order.payment?.status === 'completed' ? '✅ Paid' : order.payment?.status}
                  </span>
                </div>
                {payment?.payment_id && (
                  <div className="od-pay-row">
                    <span>Payment ID</span>
                    <span className="od-mono">{payment.payment_id}</span>
                  </div>
                )}
                {payment?.transaction_id && (
                  <div className="od-pay-row">
                    <span>Transaction</span>
                    <span className="od-mono">{payment.transaction_id}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: Summary + Actions */}
          <div className="od-right">

            {/* Order summary */}
            <div className="od-summary">
              <h3 className="od-sum-title">Order Summary</h3>

              <div className="od-sum-id">
                <span>Order #</span>
                <span className="od-mono">{order.order_id}</span>
              </div>

              <div className="od-sum-rows">
                <div className="od-sum-row">
                  <span>Items ({order.items?.reduce((s, i) => s + i.quantity, 0) || 0}):</span>
                  <span>${(pricing.subtotal || 0).toFixed(2)}</span>
                </div>
                {pricing.savings > 0 && (
                  <div className="od-sum-row savings">
                    <span>Savings:</span>
                    <span>−${pricing.savings.toFixed(2)}</span>
                  </div>
                )}
                <div className="od-sum-row">
                  <span>Shipping:</span>
                  <span>{pricing.shipping === 0
                    ? <span className="od-free">FREE</span>
                    : `$${(pricing.shipping || 0).toFixed(2)}`}
                  </span>
                </div>
                <div className="od-sum-row">
                  <span>Tax:</span>
                  <span>${(pricing.tax || 0).toFixed(2)}</span>
                </div>
              </div>

              <div className="od-sum-divider" />

              <div className="od-sum-total">
                <span>Order Total:</span>
                <span>${(pricing.total || 0).toFixed(2)}</span>
              </div>
            </div>

            {/* Delivery info */}
            <div className="od-delivery-card">
              <div className="od-del-icon">🚚</div>
              <div>
                <div className="od-del-label">Estimated Delivery</div>
                <div className="od-del-date">{deliveryDate}</div>
              </div>
            </div>

            {/* Actions */}
            <div className="od-actions">
              <button className="od-btn-primary" onClick={() => navigate('/store')}>
                🛍️ Continue Shopping
              </button>
              <button className="od-btn-secondary" onClick={() => navigate('/orders')}>
                ← Back to Orders
              </button>
              {(order.status === 'confirmed' || order.status === 'processing') && (
                <button
                  className="od-btn-danger"
                  onClick={handleCancel}
                  disabled={cancelling}
                >
                  {cancelling ? 'Cancelling…' : '❌ Cancel Order'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderItem({ item }) {
  const [err, setErr] = useState(false);
  return (
    <div className="od-item">
      <img
        src={err ? 'https://placehold.co/80x80?text=No+Img' : getImageUrl(item.thumbnail)}
        alt={item.name}
        onError={() => setErr(true)}
        className="od-item-img"
      />
      <div className="od-item-info">
        <div className="od-item-name">{item.name}</div>
        {item.category && <div className="od-item-cat">{item.category}</div>}
        <div className="od-item-qty">Qty: <strong>{item.quantity}</strong></div>
        <div className="od-item-price">${item.price?.toFixed(2)} each</div>
      </div>
      <div className="od-item-total">${(item.price * item.quantity).toFixed(2)}</div>
    </div>
  );
}
