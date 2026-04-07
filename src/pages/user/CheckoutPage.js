import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getImageUrl, orderAPI } from '../../utils/api';
import toast from 'react-hot-toast';
import './CheckoutPage.css';

// Steps change depending on payment method:
//   COD  → [Shipping, Payment, Review]
//   Card → [Shipping, Payment, Verify Card, Review]
const COD_STEPS  = ['Shipping', 'Payment', 'Review'];
const CARD_STEPS = ['Shipping', 'Payment', 'Verify Card', 'Review'];

const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
  'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
  'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
  'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire',
  'New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio',
  'Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota',
  'Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia',
  'Wisconsin','Wyoming'
];

const OTP_TTL = 600; // 10 minutes in seconds

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cart, setCart] = useState(() => JSON.parse(localStorage.getItem('shopnest_cart') || '[]'));
  const [step, setStep] = useState(0);
  const [placing,       setPlacing]       = useState(false);
  const [orderPlaced,   setOrderPlaced]   = useState(false);
  const [orderId,       setOrderId]       = useState('');
  const [placedOrderId, setPlacedOrderId] = useState('');

  // ── OTP state ──
  const [otpSent,      setOtpSent]      = useState(false);
  const [otpVerified,  setOtpVerified]  = useState(false);
  const [otpValue,     setOtpValue]     = useState('');
  const [otpSending,   setOtpSending]   = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [otpChannels,  setOtpChannels]  = useState([]);   // ["email (x@y.com)", "phone (*****1234)"]
  const countdownRef = useRef(null);

  const [shipping, setShipping] = useState({
    fullName: user?.name || '',
    email:    user?.email || '',
    phone:    user?.mobile || '',
    address: '', apt: '', city: '', state: '', zip: '',
    country: 'United States',
  });

  const [payment, setPayment] = useState({
    method: 'card',
    cardNumber: '', cardName: '', expiry: '', cvv: '',
  });

  const subtotal    = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const savings     = cart.reduce((s, i) => s + ((i.original_price || i.price) - i.price) * i.qty, 0);
  const shippingFee = subtotal > 35 ? 0 : 5.99;
  const tax         = subtotal * 0.08;
  const total       = subtotal + shippingFee + tax;
  const totalItems  = cart.reduce((s, i) => s + i.qty, 0);

  // Derive current step labels
  const STEPS = payment.method === 'card' ? CARD_STEPS : COD_STEPS;

  // When switching to COD and we were on the "Verify Card" step, skip back
  useEffect(() => {
    if (payment.method === 'cod' && step === 2 && STEPS.length === 3) {
      // step 2 is Review for COD — fine
    }
  }, [payment.method]); // eslint-disable-line

  function setShipField(k, v) { setShipping(s => ({ ...s, [k]: v })); }
  function setPayField(k, v)  {
    setPayment(p => ({ ...p, [k]: v }));
    // Reset OTP if card details change
    if (k !== 'method') {
      setOtpSent(false);
      setOtpVerified(false);
      setOtpValue('');
    }
  }

  function formatCard(val)   { return val.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim(); }
  function formatExpiry(val) { const d = val.replace(/\D/g, '').slice(0, 4); return d.length >= 3 ? d.slice(0, 2) + '/' + d.slice(2) : d; }

  function validateShipping() {
    const r = ['fullName', 'email', 'address', 'city', 'state', 'zip'];
    for (const f of r) {
      if (!shipping[f].trim()) { toast.error(`${f} is required`); return false; }
    }
    return true;
  }

  function validatePayment() {
    if (payment.method === 'cod') return true;
    if (!payment.cardNumber || payment.cardNumber.replace(/\s/g, '').length < 16) {
      toast.error('Enter a valid 16-digit card number'); return false;
    }
    if (!payment.cardName) { toast.error('Enter card holder name'); return false; }
    if (!payment.expiry || payment.expiry.length < 5) { toast.error('Enter valid expiry date'); return false; }
    if (!payment.cvv || payment.cvv.length < 3) { toast.error('Enter valid CVV'); return false; }
    return true;
  }

  // ── OTP helpers ────────────────────────────────────────────────────────
  function startCountdown() {
    clearInterval(countdownRef.current);
    setOtpCountdown(OTP_TTL);
    countdownRef.current = setInterval(() => {
      setOtpCountdown(c => {
        if (c <= 1) { clearInterval(countdownRef.current); return 0; }
        return c - 1;
      });
    }, 1000);
  }

  useEffect(() => () => clearInterval(countdownRef.current), []);

  async function handleSendOTP() {
    setOtpSending(true);
    try {
      const res = await orderAPI.requestPaymentOTP(total);
      const channels = res.data.channels || [];
      setOtpChannels(channels);
      setOtpSent(true);
      setOtpValue('');
      startCountdown();
      const dest = channels.length > 0 ? channels.join(' & ') : (user?.email || 'your contact');
      toast.success(`OTP sent via ${dest}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send OTP. Please try again.');
    } finally {
      setOtpSending(false);
    }
  }

  function formatCountdown(secs) {
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  // Verify OTP locally (actual crypto check happens on backend when placing order)
  function handleVerifyOTP() {
    if (!otpValue || otpValue.length < 6) { toast.error('Enter the 6-digit OTP'); return; }
    // We just store the OTP and mark as verified client-side.
    // Backend will fully validate it during place_order.
    setOtpVerified(true);
    toast.success('OTP accepted! Please review your order.');
  }

  // ── Navigation ──────────────────────────────────────────────────────────
  function handleNext() {
    if (step === 0 && !validateShipping()) return;
    if (step === 1 && !validatePayment()) return;
    // Verify Card step (only for card, step index 2 in CARD_STEPS)
    if (payment.method === 'card' && step === 2) {
      if (!otpVerified) { toast.error('Please verify your card with the OTP first'); return; }
    }
    setStep(s => s + 1);
    window.scrollTo(0, 0);
  }

  function handleBack() {
    setStep(s => s - 1);
    window.scrollTo(0, 0);
  }

  // ── Place Order ─────────────────────────────────────────────────────────
  async function handlePlaceOrder() {
    setPlacing(true);
    try {
      const orderPayload = {
        items: cart.map(item => ({
          product_id: item.id,
          name:       item.name,
          price:      item.price,
          quantity:   item.qty,
          thumbnail:  item.thumbnail || '',
          category:   item.category  || '',
        })),
        shipping_address: {
          full_name: shipping.fullName,
          street:    shipping.address,
          apt:       shipping.apt,
          city:      shipping.city,
          state:     shipping.state,
          zip:       shipping.zip,
          country:   shipping.country,
          phone:     shipping.phone,
          email:     shipping.email,
        },
        payment_method: payment.method,
        card_number:    payment.method === 'card' ? payment.cardNumber.replace(/\s/g, '') : '',
        payment_otp:    payment.method === 'card' ? otpValue : '',
        pricing: {
          subtotal: subtotal,
          shipping: shippingFee,
          tax:      tax,
          total:    total,
          savings:  savings,
        },
      };

      const res = await orderAPI.placeOrder(orderPayload);
      const placedOrder = res.data.order;

      localStorage.removeItem('shopnest_cart');
      setCart([]);
      setOrderId(placedOrder.order_id);
      setOrderPlaced(true);
      setPlacedOrderId(placedOrder.id);
      window.scrollTo(0, 0);
      toast.success('Order placed successfully!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to place order. Please try again.');
    } finally {
      setPlacing(false);
    }
  }

  // ── Order Placed Screen ─────────────────────────────────────────────────
  if (orderPlaced) {
    return (
      <div className="order-success-root">
        <header className="co-navbar">
          <div className="co-logo" onClick={() => navigate('/store')}>
            <span style={{ color: '#f97316' }}>⬡</span> ShopNest
          </div>
        </header>
        <div className="order-success-card">
          <div className="success-checkmark">✅</div>
          <h1>Order Placed Successfully!</h1>
          <p>Thank you, <strong>{user?.name}</strong>! Your order has been confirmed.</p>
          <div className="order-id-box">
            <span>Order ID</span>
            <strong>{orderId}</strong>
          </div>
          <div className="success-details">
            <div className="sd-row"><span>Delivery address</span><strong>{shipping.address}, {shipping.city}, {shipping.state} {shipping.zip}</strong></div>
            <div className="sd-row"><span>Estimated delivery</span><strong>{getDeliveryDate()}</strong></div>
            <div className="sd-row"><span>Payment</span><strong>{payment.method === 'cod' ? 'Cash on Delivery' : `Card ending in ${payment.cardNumber.slice(-4)}`}</strong></div>
            <div className="sd-row"><span>Order total</span><strong>${total.toFixed(2)}</strong></div>
          </div>
          <div className="success-actions">
            <button className="track-btn" onClick={() => navigate(placedOrderId ? `/orders/${placedOrderId}` : '/orders')}>
              📦 Track Order
            </button>
            <button className="continue-btn" onClick={() => navigate('/store')}>
              Continue Shopping
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Review step index: last step ────────────────────────────────────────
  const reviewStepIdx = STEPS.length - 1;

  return (
    <div className="co-root">
      {/* Navbar */}
      <header className="co-navbar">
        <div className="co-logo" onClick={() => navigate('/store')}>
          <span style={{ color: '#f97316' }}>⬡</span> ShopNest
        </div>
        <div className="co-secure">🔒 Secure Checkout</div>
        <div className="co-steps">
          {STEPS.map((s, i) => (
            <div key={s} className={`co-step ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}>
              <div className="step-num">{i < step ? '✓' : i + 1}</div>
              <span>{s}</span>
              {i < STEPS.length - 1 && <div className="step-line" />}
            </div>
          ))}
        </div>
      </header>

      <div className="co-body">
        {/* ── LEFT ── */}
        <div className="co-left">

          {/* ── STEP 0: Shipping ── */}
          {step === 0 && (
            <div className="co-section">
              <h2 className="co-section-title">📦 Shipping Address</h2>
              <div className="co-form">
                <div className="co-row">
                  <div className="co-field">
                    <label>Full Name *</label>
                    <input value={shipping.fullName} onChange={e => setShipField('fullName', e.target.value)} placeholder="John Doe" />
                  </div>
                  <div className="co-field">
                    <label>Email *</label>
                    <input type="email" value={shipping.email} onChange={e => setShipField('email', e.target.value)} placeholder="john@example.com" />
                  </div>
                </div>
                <div className="co-row">
                  <div className="co-field">
                    <label>Phone</label>
                    <input value={shipping.phone} onChange={e => setShipField('phone', e.target.value)} placeholder="+1 234 567 8900" />
                  </div>
                  <div className="co-field">
                    <label>Country</label>
                    <select value={shipping.country} onChange={e => setShipField('country', e.target.value)}>
                      <option>United States</option>
                      <option>Canada</option>
                      <option>United Kingdom</option>
                      <option>Australia</option>
                      <option>India</option>
                    </select>
                  </div>
                </div>
                <div className="co-field full">
                  <label>Street Address *</label>
                  <input value={shipping.address} onChange={e => setShipField('address', e.target.value)} placeholder="123 Main Street" />
                </div>
                <div className="co-field full">
                  <label>Apt, Suite, Unit (optional)</label>
                  <input value={shipping.apt} onChange={e => setShipField('apt', e.target.value)} placeholder="Apt 4B" />
                </div>
                <div className="co-row three">
                  <div className="co-field">
                    <label>City *</label>
                    <input value={shipping.city} onChange={e => setShipField('city', e.target.value)} placeholder="New York" />
                  </div>
                  <div className="co-field">
                    <label>State *</label>
                    <select value={shipping.state} onChange={e => setShipField('state', e.target.value)}>
                      <option value="">Select state</option>
                      {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="co-field">
                    <label>ZIP Code *</label>
                    <input value={shipping.zip} onChange={e => setShipField('zip', e.target.value.replace(/\D/g, '').slice(0, 5))} placeholder="10001" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 1: Payment ── */}
          {step === 1 && (
            <div className="co-section">
              <h2 className="co-section-title">💳 Payment Method</h2>

              <div className="payment-methods">
                <div
                  className={payment.method === 'card' ? 'pay-method active' : 'pay-method'}
                  onClick={() => { setPayField('method', 'card'); }}
                >
                  <div className="pay-radio" />
                  <span>💳</span>
                  <div>
                    <div className="pay-title">Credit / Debit Card</div>
                    <div className="pay-sub">Visa, Mastercard, Amex · OTP verified</div>
                  </div>
                  <span className="pay-secure-tag">🔐 Secure</span>
                </div>
                <div
                  className={payment.method === 'cod' ? 'pay-method active' : 'pay-method'}
                  onClick={() => { setPayField('method', 'cod'); setOtpSent(false); setOtpVerified(false); }}
                >
                  <div className="pay-radio" />
                  <span>💵</span>
                  <div>
                    <div className="pay-title">Cash on Delivery</div>
                    <div className="pay-sub">Pay when you receive your order</div>
                  </div>
                </div>
              </div>

              {payment.method === 'card' && (
                <div className="co-form" style={{ marginTop: 20 }}>
                  <div className="co-field full">
                    <label>Card Number *</label>
                    <div className="card-input-wrap">
                      <input
                        value={payment.cardNumber}
                        onChange={e => setPayField('cardNumber', formatCard(e.target.value))}
                        placeholder="1234 5678 9012 3456"
                        maxLength={19}
                      />
                      <span className="card-icons">💳</span>
                    </div>
                  </div>
                  <div className="co-field full">
                    <label>Cardholder Name *</label>
                    <input
                      value={payment.cardName}
                      onChange={e => setPayField('cardName', e.target.value)}
                      placeholder="John Doe"
                    />
                  </div>
                  <div className="co-row">
                    <div className="co-field">
                      <label>Expiry Date *</label>
                      <input
                        value={payment.expiry}
                        onChange={e => setPayField('expiry', formatExpiry(e.target.value))}
                        placeholder="MM/YY"
                        maxLength={5}
                      />
                    </div>
                    <div className="co-field">
                      <label>CVV *</label>
                      <input
                        value={payment.cvv}
                        onChange={e => setPayField('cvv', e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="123"
                        type="password"
                        maxLength={4}
                      />
                    </div>
                  </div>
                  <div className="card-security-note">
                    🔒 Your card details are encrypted. We never store your full card number.<br />
                    <strong>
                      An OTP will be sent to your{user?.email ? ` email (${user.email})` : ''}
                      {user?.mobile ? ` & phone (${user.mobile.slice(-4).padStart(user.mobile.length, '*')})` : ''}
                      {' '}to confirm this payment.
                    </strong>
                  </div>
                </div>
              )}

              {payment.method === 'cod' && (
                <div className="cod-info">
                  <p>✅ You will pay <strong>${total.toFixed(2)}</strong> in cash when your order is delivered to:</p>
                  <p><strong>{shipping.address}, {shipping.city}, {shipping.state} {shipping.zip}</strong></p>
                  <p className="cod-note">Please keep exact change ready for a faster delivery experience.</p>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 2 (card only): Verify Card with OTP ── */}
          {payment.method === 'card' && step === 2 && (
            <div className="co-section">
              <h2 className="co-section-title">🔐 Verify Your Payment</h2>

              <div className="otp-verify-card">
                <div className="otp-card-amount">
                  Authorising payment of <span>${total.toFixed(2)}</span>
                </div>

                {/* Show which channels OTP will be sent to */}
                <div className="otp-channels-info">
                  <p className="otp-card-desc">
                    🔐 For your security, a 6-digit OTP will be sent to:
                  </p>
                  <div className="otp-channel-badges">
                    {user?.email && (
                      <span className="otp-channel-badge email">
                        📧 {user.email}
                      </span>
                    )}
                    {user?.mobile && (
                      <span className="otp-channel-badge phone">
                        📱 {user.mobile.slice(-4).padStart(user.mobile.length, '•')}
                      </span>
                    )}
                    {!user?.email && !user?.mobile && (
                      <span className="otp-channel-badge email">📧 your registered contact</span>
                    )}
                  </div>
                </div>

                {!otpVerified ? (
                  <>
                    {/* Send / Resend OTP */}
                    <div className="otp-send-row">
                      <button
                        className="otp-send-btn"
                        onClick={handleSendOTP}
                        disabled={otpSending || otpCountdown > 0}
                      >
                        {otpSending
                          ? '⏳ Sending OTP…'
                          : otpSent
                            ? `🔄 Resend OTP${otpCountdown > 0 ? ` (${formatCountdown(otpCountdown)})` : ''}`
                            : `🔐 Send OTP${user?.mobile ? ' via Email & SMS' : ' via Email'}`}
                      </button>
                      {otpSent && otpCountdown > 0 && (
                        <span className="otp-timer">⏱ {formatCountdown(otpCountdown)}</span>
                      )}
                    </div>

                    {otpSent && (
                      <div className="otp-input-group">
                        <label>
                          Enter the 6-digit OTP
                          {otpChannels.length > 0 && (
                            <span className="otp-sent-to"> · sent via {otpChannels.join(' & ')}</span>
                          )}
                        </label>
                        <div className="otp-input-row">
                          <input
                            className="otp-input"
                            value={otpValue}
                            onChange={e => setOtpValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="● ● ● ● ● ●"
                            maxLength={6}
                            autoFocus
                          />
                          <button
                            className="otp-verify-btn"
                            onClick={handleVerifyOTP}
                            disabled={otpValue.length < 6}
                          >
                            Verify
                          </button>
                        </div>
                        <p className="otp-hint">
                          📧 Check your inbox and spam folder.
                          {user?.mobile && ' 📱 Also check your SMS messages.'}
                          {' '}OTP expires in {formatCountdown(otpCountdown)}.
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="otp-success-banner">
                    <span className="otp-success-icon">✅</span>
                    <div>
                      <div className="otp-success-title">Payment Verified!</div>
                      <div className="otp-success-sub">Your identity has been confirmed. Proceed to review your order.</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── LAST STEP: Review ── */}
          {step === reviewStepIdx && (
            <div className="co-section">
              <h2 className="co-section-title">📋 Review Your Order</h2>

              {/* Shipping summary */}
              <div className="review-block">
                <div className="review-block-header">
                  <span>📦 Shipping to</span>
                  <button onClick={() => setStep(0)}>Change</button>
                </div>
                <p>{shipping.fullName}</p>
                <p>{shipping.address}{shipping.apt ? `, ${shipping.apt}` : ''}</p>
                <p>{shipping.city}, {shipping.state} {shipping.zip}</p>
                <p>{shipping.email} · {shipping.phone}</p>
              </div>

              {/* Payment summary */}
              <div className="review-block">
                <div className="review-block-header">
                  <span>💳 Payment</span>
                  <button onClick={() => setStep(1)}>Change</button>
                </div>
                {payment.method === 'cod'
                  ? <p>Cash on Delivery</p>
                  : <p>Card ending in {payment.cardNumber.slice(-4)} · {payment.expiry} <span style={{ color: '#22c55e', fontWeight: 600, fontSize: 12 }}>✅ OTP Verified</span></p>
                }
              </div>

              {/* Items */}
              <div className="review-block">
                <div className="review-block-header">
                  <span>🛍️ Items ({totalItems})</span>
                  <button onClick={() => navigate('/cart')}>Edit cart</button>
                </div>
                {cart.map(item => (
                  <div key={item.id} className="review-item">
                    <img
                      src={getImageUrl(item.thumbnail)}
                      alt={item.name}
                      onError={e => e.target.src = 'https://placehold.co/60x60?text=No+Img'}
                    />
                    <div className="review-item-info">
                      <div className="review-item-name">{item.name}</div>
                      <div className="review-item-qty">Qty: {item.qty}</div>
                    </div>
                    <div className="review-item-price">${(item.price * item.qty).toFixed(2)}</div>
                  </div>
                ))}
              </div>

              <div className="estimated-delivery">
                🚚 Estimated delivery: <strong>{getDeliveryDate()}</strong>
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="co-nav-btns">
            {step > 0 && (
              <button className="co-back-btn" onClick={handleBack}>
                ← Back
              </button>
            )}
            {step < reviewStepIdx ? (
              <button className="co-next-btn" onClick={handleNext}>
                Continue to {STEPS[step + 1]} →
              </button>
            ) : (
              <button className="co-place-btn" onClick={handlePlaceOrder} disabled={placing}>
                {placing ? (
                  <><span className="co-spinner" /> Processing...</>
                ) : (
                  `🛒 Place Order — $${total.toFixed(2)}`
                )}
              </button>
            )}
          </div>
        </div>

        {/* ── RIGHT: Order Summary ── */}
        <div className="co-right">
          <div className="co-summary">
            <h3>Order Summary</h3>
            <div className="co-summary-items">
              {cart.map(item => (
                <div key={item.id} className="co-sum-item">
                  <div className="co-sum-img-wrap">
                    <img
                      src={getImageUrl(item.thumbnail)}
                      alt={item.name}
                      onError={e => e.target.src = 'https://placehold.co/50x50?text=Img'}
                    />
                    <span className="co-sum-qty">{item.qty}</span>
                  </div>
                  <div className="co-sum-name">{item.name}</div>
                  <div className="co-sum-price">${(item.price * item.qty).toFixed(2)}</div>
                </div>
              ))}
            </div>

            <div className="co-summary-rows">
              <div className="co-sum-row"><span>Items ({totalItems}):</span><span>${subtotal.toFixed(2)}</span></div>
              {savings > 0 && <div className="co-sum-row savings"><span>Savings:</span><span>-${savings.toFixed(2)}</span></div>}
              <div className="co-sum-row"><span>Shipping:</span><span>{shippingFee === 0 ? <span style={{ color: '#007600', fontWeight: 700 }}>FREE</span> : `$${shippingFee.toFixed(2)}`}</span></div>
              <div className="co-sum-row"><span>Tax (8%):</span><span>${tax.toFixed(2)}</span></div>
            </div>

            <div className="co-sum-divider" />
            <div className="co-sum-total"><span>Order Total:</span><span>${total.toFixed(2)}</span></div>

            <div className="co-secure-note">🔒 SSL Encrypted · Safe Checkout</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getDeliveryDate() {
  const d = new Date();
  d.setDate(d.getDate() + 5);
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}
