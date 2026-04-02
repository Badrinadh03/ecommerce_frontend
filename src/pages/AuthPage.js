import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import toast from 'react-hot-toast';
import { authAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import './AuthPage.css';

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';

export default function AuthPage() {
  const navigate = useNavigate();
  const { saveAuth, setLoading } = useAuth();

  const [mode, setMode] = useState('login'); // login | register
  const [loginMethod, setLoginMethod] = useState('password'); // password | otp
  const [identifierType, setIdentifierType] = useState('email'); // email | mobile
  const [otpSent, setOtpSent] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);

  const [form, setForm] = useState({
    name: '', email: '', mobile: '', password: '',
    confirmPassword: '', identifier: '', otp: '',
  });

  const [busy, setBusy] = useState(false);

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

  function startTimer() {
    setOtpTimer(60);
    const iv = setInterval(() => {
      setOtpTimer(t => { if (t <= 1) { clearInterval(iv); return 0; } return t - 1; });
    }, 1000);
  }

  // ── Register ─────────────────────────────
  async function handleRegister(e) {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match'); return;
    }
    setBusy(true);
    try {
      const res = await authAPI.register({
        name: form.name, email: form.email,
        mobile: form.mobile, password: form.password,
      });
      toast.success('Account created! Check your email for OTP.');
      setMode('verify');
      set('identifier', form.email);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally { setBusy(false); }
  }

  // ── Login with Password ───────────────────
  async function handlePasswordLogin(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await authAPI.login({
        identifier: form.identifier,
        password: form.password,
      });
      saveAuth(res.data.token, res.data.user);
      toast.success(`Welcome back, ${res.data.user.name}!`);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally { setBusy(false); }
  }

  // ── Send OTP ─────────────────────────────
  async function handleSendOTP() {
    if (!form.identifier) { toast.error('Enter your email or mobile'); return; }
    if (otpTimer > 0) return;
    setBusy(true);
    try {
      await authAPI.sendOTP(form.identifier, identifierType);
      toast.success('OTP sent!');
      setOtpSent(true);
      startTimer();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send OTP');
    } finally { setBusy(false); }
  }

  // ── Verify OTP ───────────────────────────
  async function handleOTPLogin(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await authAPI.verifyOTP(form.identifier, form.otp, 'login');
      saveAuth(res.data.token, res.data.user);
      toast.success(`Welcome, ${res.data.user.name}!`);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invalid OTP');
    } finally { setBusy(false); }
  }

  // ── Email Verification OTP ───────────────
  async function handleVerifyEmail(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await authAPI.verifyOTP(form.identifier, form.otp, 'verify_email');
      saveAuth(res.data.token, res.data.user);
      toast.success('Email verified! Welcome to ShopNest 🎉');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invalid OTP');
    } finally { setBusy(false); }
  }

  // ── Google Login ─────────────────────────
  async function handleGoogleSuccess(credentialResponse) {
    setBusy(true);
    try {
      const res = await authAPI.googleToken(credentialResponse.credential);
      saveAuth(res.data.token, res.data.user);
      toast.success(`Welcome, ${res.data.user.name}!`);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Google login failed');
    } finally { setBusy(false); }
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className="auth-root">
        {/* Left Panel */}
        <div className="auth-left">
          <div className="auth-brand">
            <div className="brand-icon">⬡</div>
            <span className="brand-name">ShopNest</span>
          </div>
          <div className="auth-tagline">
            <h1>Shop the future,<br />delivered today.</h1>
            <p>Millions of products. One trusted platform. Zero compromise.</p>
          </div>
          <div className="auth-features">
            {['🚀 Fast delivery', '🔒 Secure payments', '📦 Easy returns', '💬 24/7 support'].map(f => (
              <div key={f} className="feature-chip">{f}</div>
            ))}
          </div>
          <div className="auth-glow" />
        </div>

        {/* Right Panel */}
        <div className="auth-right">
          <div className="auth-card">

            {/* ── EMAIL VERIFY MODE ── */}
            {mode === 'verify' && (
              <>
                <div className="card-head">
                  <h2>Verify your email</h2>
                  <p>Enter the 6-digit OTP sent to <strong>{form.identifier}</strong></p>
                </div>
                <form onSubmit={handleVerifyEmail} className="auth-form">
                  <OTPInput value={form.otp} onChange={v => set('otp', v)} />
                  <button className="btn-primary" type="submit" disabled={busy || form.otp.length < 6}>
                    {busy ? <Spinner /> : 'Verify Email'}
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => { setMode('login'); setOtpSent(false); }}>
                    ← Back to Login
                  </button>
                </form>
              </>
            )}

            {/* ── LOGIN MODE ── */}
            {mode === 'login' && (
              <>
                <div className="card-head">
                  <h2>Welcome back</h2>
                  <p>Sign in to your ShopNest account</p>
                </div>

                {/* Login method tabs */}
                <div className="method-tabs">
                  <button className={loginMethod === 'password' ? 'tab active' : 'tab'} onClick={() => { setLoginMethod('password'); setOtpSent(false); }}>Password</button>
                  <button className={loginMethod === 'otp' ? 'tab active' : 'tab'} onClick={() => { setLoginMethod('otp'); setOtpSent(false); }}>OTP Login</button>
                </div>

                {loginMethod === 'password' && (
                  <form onSubmit={handlePasswordLogin} className="auth-form">
                    <div className="identifier-wrap">
                      <div className="id-type-toggle">
                        <button type="button" className={identifierType === 'email' ? 'id-btn active' : 'id-btn'} onClick={() => setIdentifierType('email')}>Email</button>
                        <button type="button" className={identifierType === 'mobile' ? 'id-btn active' : 'id-btn'} onClick={() => setIdentifierType('mobile')}>Mobile</button>
                      </div>
                      <Input
                        type={identifierType === 'email' ? 'email' : 'tel'}
                        placeholder={identifierType === 'email' ? 'Enter your email' : '+1 234 567 8900'}
                        value={form.identifier}
                        onChange={v => set('identifier', v)}
                        icon={identifierType === 'email' ? '✉' : '📱'}
                      />
                    </div>
                    <Input type="password" placeholder="Password" value={form.password} onChange={v => set('password', v)} icon="🔒" />
                    <button className="btn-primary" type="submit" disabled={busy}>
                      {busy ? <Spinner /> : 'Sign In'}
                    </button>
                  </form>
                )}

                {loginMethod === 'otp' && (
                  <form onSubmit={handleOTPLogin} className="auth-form">
                    <div className="identifier-wrap">
                      <div className="id-type-toggle">
                        <button type="button" className={identifierType === 'email' ? 'id-btn active' : 'id-btn'} onClick={() => setIdentifierType('email')}>Email</button>
                        <button type="button" className={identifierType === 'mobile' ? 'id-btn active' : 'id-btn'} onClick={() => setIdentifierType('mobile')}>Mobile</button>
                      </div>
                      <Input
                        type={identifierType === 'email' ? 'email' : 'tel'}
                        placeholder={identifierType === 'email' ? 'Enter your email' : '+1 234 567 8900'}
                        value={form.identifier}
                        onChange={v => set('identifier', v)}
                        icon={identifierType === 'email' ? '✉' : '📱'}
                      />
                    </div>
                    <div className="otp-row">
                      <button type="button" className="btn-send-otp" onClick={handleSendOTP} disabled={busy || otpTimer > 0}>
                        {otpTimer > 0 ? `Resend in ${otpTimer}s` : (otpSent ? 'Resend OTP' : 'Send OTP')}
                      </button>
                    </div>
                    {otpSent && (
                      <>
                        <OTPInput value={form.otp} onChange={v => set('otp', v)} />
                        <button className="btn-primary" type="submit" disabled={busy || form.otp.length < 6}>
                          {busy ? <Spinner /> : 'Verify & Login'}
                        </button>
                      </>
                    )}
                  </form>
                )}

                <Divider />

                <div className="google-wrap">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => toast.error('Google login failed')}
                    theme="filled_black"
                    shape="pill"
                    size="large"
                    text="signin_with"
                    width="100%"
                  />
                </div>

                <p className="switch-mode">
                  Don't have an account?{' '}
                  <button type="button" onClick={() => { setMode('register'); setOtpSent(false); }}>Create one</button>
                </p>
              </>
            )}

            {/* ── REGISTER MODE ── */}
            {mode === 'register' && (
              <>
                <div className="card-head">
                  <h2>Create account</h2>
                  <p>Join millions of happy shoppers</p>
                </div>
                <form onSubmit={handleRegister} className="auth-form">
                  <Input type="text" placeholder="Full name" value={form.name} onChange={v => set('name', v)} icon="👤" />
                  <Input type="email" placeholder="Email address" value={form.email} onChange={v => set('email', v)} icon="✉" />
                  <Input type="tel" placeholder="Mobile number (optional)" value={form.mobile} onChange={v => set('mobile', v)} icon="📱" />
                  <Input type="password" placeholder="Password (min 6 chars)" value={form.password} onChange={v => set('password', v)} icon="🔒" />
                  <Input type="password" placeholder="Confirm password" value={form.confirmPassword} onChange={v => set('confirmPassword', v)} icon="🔒" />
                  <button className="btn-primary" type="submit" disabled={busy}>
                    {busy ? <Spinner /> : 'Create Account'}
                  </button>
                </form>

                <Divider />

                <div className="google-wrap">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => toast.error('Google signup failed')}
                    theme="filled_black"
                    shape="pill"
                    size="large"
                    text="signup_with"
                    width="100%"
                  />
                </div>

                <p className="switch-mode">
                  Already have an account?{' '}
                  <button type="button" onClick={() => setMode('login')}>Sign in</button>
                </p>
              </>
            )}

          </div>
        </div>
      </div>
    </GoogleOAuthProvider>
  );
}

// ── Sub-components ─────────────────────────
function Input({ type, placeholder, value, onChange, icon }) {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  return (
    <div className="input-wrap">
      <span className="input-icon">{icon}</span>
      <input
        type={isPassword ? (show ? 'text' : 'password') : type}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        required={!placeholder.includes('optional')}
        autoComplete={isPassword ? 'current-password' : 'on'}
      />
      {isPassword && (
        <button type="button" className="pw-toggle" onClick={() => setShow(s => !s)}>
          {show ? '🙈' : '👁'}
        </button>
      )}
    </div>
  );
}

function OTPInput({ value, onChange }) {
  return (
    <div className="otp-input-wrap">
      <input
        type="text"
        className="otp-input"
        placeholder="000000"
        maxLength={6}
        value={value}
        onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
      />
      <p className="otp-hint">Enter the 6-digit OTP</p>
    </div>
  );
}

function Divider() {
  return (
    <div className="divider">
      <span />
      <p>or continue with</p>
      <span />
    </div>
  );
}

function Spinner() {
  return <div className="btn-spinner" />;
}
