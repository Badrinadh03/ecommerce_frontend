import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getImageUrl } from '../../utils/api';
import useCart from '../../hooks/useCart';
import Navbar from '../../components/Navbar';
import toast from 'react-hot-toast';
import './CartPage.css';

export default function CartPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    cart,
    cartCount,
    syncing,
    updateQty,
    removeItem,
    clearCart,
  } = useCart();

  function handleRemove(id) {
    removeItem(id);
    toast.success('Item removed');
  }

  function handleClear() {
    clearCart();
    toast.success('Cart cleared');
  }

  const subtotal   = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const savings    = cart.reduce((s, i) => s + ((i.original_price || i.price) - i.price) * i.qty, 0);
  const shipping   = subtotal > 35 ? 0 : 5.99;
  const tax        = subtotal * 0.08;
  const total      = subtotal + shipping + tax;
  const totalItems = cart.reduce((s, i) => s + i.qty, 0);

  return (
    <div className="cart-root">
      {/* Navbar */}
      <Navbar cartCount={cartCount} />

      <div className="cart-body">
        {/* Left — Cart Items */}
        <div className="cart-left">
          <div className="cart-header-bar">
            <h1>Shopping Cart</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Live sync indicator */}
              {syncing && (
                <span style={{
                  fontSize: 12, color: '#6b7280',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: '#f97316', display: 'inline-block',
                    animation: 'pulse 1s infinite',
                  }} />
                  Saving…
                </span>
              )}
              {!syncing && cart.length > 0 && user && (
                <span style={{ fontSize: 12, color: '#22c55e' }}>✓ Saved</span>
              )}
              {cart.length > 0 && (
                <button className="deselect-btn" onClick={handleClear}>
                  Clear cart
                </button>
              )}
            </div>
          </div>

          {cart.length === 0 ? (
            <div className="cart-empty">
              <div className="empty-icon">🛒</div>
              <h2>Your cart is empty</h2>
              <p>You have no items in your shopping cart.</p>
              <button className="shop-now-btn" onClick={() => navigate('/store')}>
                Shop Now
              </button>
            </div>
          ) : (
            <>
              <div className="cart-price-header">Price</div>
              <div className="cart-items">
                {cart.map(item => (
                  <CartItem
                    key={item.id}
                    item={item}
                    onUpdateQty={updateQty}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
              <div className="cart-subtotal-bar">
                Subtotal ({totalItems} {totalItems === 1 ? 'item' : 'items'}):
                <strong> ${subtotal.toFixed(2)}</strong>
              </div>
            </>
          )}
        </div>

        {/* Right — Order Summary */}
        {cart.length > 0 && (
          <div className="cart-right">
            <div className="summary-card">
              {shipping === 0 && (
                <div className="free-shipping-banner">
                  ✅ Your order qualifies for <strong>FREE Shipping</strong>
                </div>
              )}
              {shipping > 0 && (
                <div className="shipping-notice">
                  Add <strong>${(35 - subtotal).toFixed(2)}</strong> more for FREE shipping
                  <div className="shipping-bar">
                    <div className="shipping-fill" style={{ width: `${Math.min((subtotal / 35) * 100, 100)}%` }} />
                  </div>
                </div>
              )}

              <div className="summary-title">Order Summary</div>

              <div className="summary-rows">
                <div className="summary-row">
                  <span>Items ({totalItems}):</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                {savings > 0 && (
                  <div className="summary-row savings">
                    <span>Your savings:</span>
                    <span>-${savings.toFixed(2)}</span>
                  </div>
                )}
                <div className="summary-row">
                  <span>Shipping:</span>
                  <span>{shipping === 0 ? <span className="free-tag">FREE</span> : `$${shipping.toFixed(2)}`}</span>
                </div>
                <div className="summary-row">
                  <span>Estimated tax (8%):</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
              </div>

              <div className="summary-divider" />

              <div className="summary-total">
                <span>Order Total:</span>
                <span>${total.toFixed(2)}</span>
              </div>

              <button
                className="checkout-btn"
                onClick={() => navigate('/checkout')}
              >
                Proceed to Checkout ({totalItems} {totalItems === 1 ? 'item' : 'items'})
              </button>

              <div className="secure-badge">
                🔒 Secure checkout — SSL encrypted
              </div>

              {/* Accepted payments */}
              <div className="payment-icons">
                <span>💳</span><span>🏦</span><span>📱</span>
                <div className="payment-label">Visa · Mastercard · PayPal · Apple Pay</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Cart Item Component ───────────────────
function CartItem({ item, onUpdateQty, onRemove }) {
  const [imgError, setImgError] = useState(false);
  const savings = ((item.original_price || item.price) - item.price) * item.qty;

  return (
    <div className="cart-item">
      <div className="item-img-wrap">
        <img
          src={imgError ? 'https://placehold.co/120x120?text=No+Image' : getImageUrl(item.thumbnail)}
          alt={item.name}
          onError={() => setImgError(true)}
          className="item-img"
        />
      </div>

      <div className="item-details">
        <div className="item-name">{item.name}</div>
        <div className="item-brand">{item.brand}</div>
        <div className="item-category">{item.category}</div>

        {item.quantity > 0
          ? <div className="item-instock">In Stock</div>
          : <div className="item-outstock">Out of Stock</div>
        }

        {savings > 0 && (
          <div className="item-savings">You save: ${savings.toFixed(2)}</div>
        )}

        <div className="item-actions">
          {/* Qty selector */}
          <div className="qty-selector">
            <button onClick={() => onUpdateQty(item.id, item.qty - 1)}>−</button>
            <span>{item.qty}</span>
            <button onClick={() => onUpdateQty(item.id, item.qty + 1)}>+</button>
          </div>
          <span className="action-divider">|</span>
          <button className="remove-btn" onClick={() => onRemove(item.id)}>
            Delete
          </button>
          <span className="action-divider">|</span>
          <button className="save-btn">Save for later</button>
        </div>
      </div>

      <div className="item-price-col">
        <div className="item-price">${(item.price * item.qty).toFixed(2)}</div>
        {item.original_price > item.price && (
          <div className="item-orig">${(item.original_price * item.qty).toFixed(2)}</div>
        )}
        <div className="item-unit-price">${item.price.toFixed(2)} each</div>
      </div>
    </div>
  );
}
