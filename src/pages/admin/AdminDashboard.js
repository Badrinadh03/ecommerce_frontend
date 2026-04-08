import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAPI, getImageUrl } from '../../utils/api';
import toast from 'react-hot-toast';
import './AdminDashboard.css';

const CATEGORIES = ['Electronics', 'Clothing', 'Home & Kitchen', 'Books', 'Sports', 'Beauty', 'Toys', 'Automotive', 'Food', 'Other'];

const EMPTY_FORM = {
  name: '', description: '', price: '', original_price: '',
  category: '', brand: '', quantity: '', sku: '',
  tags: '', is_featured: false,
  metadata: '',
  images: [],
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const admin = JSON.parse(localStorage.getItem('shopnest_admin') || '{}');

  const [tab, setTab] = useState('products'); // products | add | stats
  const [products, setProducts] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [previewImgs, setPreviewImgs] = useState([]);
  const [search, setSearch] = useState('');
  const [analytics, setAnalytics] = useState(null);
  const [analyticsWindow, setAnalyticsWindow] = useState(7);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    if (!localStorage.getItem('shopnest_admin')) { navigate('/admin/login'); return; }
    fetchProducts();
    fetchStats();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    try {
      const res = await adminAPI.getProducts();
      setProducts(res.data.products);
    } catch { toast.error('Failed to load products'); }
    finally { setLoading(false); }
  }

  async function fetchStats() {
    try {
      const res = await adminAPI.getStats();
      setStats(res.data);
    } catch {}
  }

  async function fetchAnalytics(days) {
    setAnalyticsLoading(true);
    try {
      const res = await adminAPI.getAnalytics(days);
      setAnalytics(res.data);
    } catch { toast.error('Analytics not available. Run jobs first.'); }
    finally { setAnalyticsLoading(false); }
  }

  // ── Job trigger + polling ─────────────────
  const [jobStatuses, setJobStatuses] = useState({});
  const [jobPolling, setJobPolling] = useState(false);
  const pollRef = React.useRef(null);

  async function triggerJob(label, apiFn) {
    try {
      const res = await apiFn();
      const jobs = res.data.jobs || [res.data.job];
      toast.success(`${label} started on server!`);
      startPolling(jobs);
    } catch (err) {
      toast.error(err.response?.data?.error || `Failed to start ${label}`);
    }
  }

  function startPolling(jobNames) {
    setJobPolling(true);
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await adminAPI.getAllJobStatuses();
        const statuses = res.data;
        setJobStatuses(statuses);
        const relevant = jobNames.filter(j => statuses[j]);
        const allDone  = relevant.length > 0 && relevant.every(j => statuses[j]?.status !== 'running');
        if (allDone) {
          clearInterval(pollRef.current);
          setJobPolling(false);
          const anyError = relevant.some(j => statuses[j]?.status === 'error');
          if (anyError) {
            toast.error('One or more jobs failed. Check server logs.');
          } else {
            toast.success('All jobs completed! Loading results...');
            setTimeout(() => fetchAnalytics(analyticsWindow), 800);
          }
        }
      } catch { clearInterval(pollRef.current); setJobPolling(false); }
    }, 2500);
  }

  // Cleanup polling on unmount
  React.useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

  // ── Image upload ──────────────────────────
  function handleImages(e) {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setForm(f => ({ ...f, images: [...f.images, ev.target.result] }));
        setPreviewImgs(p => [...p, ev.target.result]);
      };
      reader.readAsDataURL(file);
    });
  }

  function removeImage(idx) {
    setForm(f => ({ ...f, images: f.images.filter((_, i) => i !== idx) }));
    setPreviewImgs(p => p.filter((_, i) => i !== idx));
  }

  // ── Submit product ────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    const payload = {
      ...form,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()) : [],
      metadata: form.metadata ? JSON.parse(form.metadata || '{}') : {},
    };
    try {
      if (editId) {
        await adminAPI.updateProduct(editId, payload);
        toast.success('Product updated!');
      } else {
        await adminAPI.addProduct(payload);
        toast.success('Product added!');
      }
      setForm(EMPTY_FORM);
      setPreviewImgs([]);
      setEditId(null);
      setTab('products');
      fetchProducts();
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save product');
    } finally { setLoading(false); }
  }

  // ── Edit ──────────────────────────────────
  function handleEdit(p) {
    setForm({
      name: p.name, description: p.description,
      price: p.price, original_price: p.original_price,
      category: p.category, brand: p.brand,
      quantity: p.quantity, sku: p.sku,
      tags: (p.tags || []).join(', '),
      is_featured: p.is_featured,
      metadata: JSON.stringify(p.metadata || {}),
      images: p.images || [],
    });
    setPreviewImgs(p.images || []);
    setEditId(p.id);
    setTab('add');
  }

  // ── Delete ────────────────────────────────
  async function handleDelete(id) {
    if (!window.confirm('Delete this product?')) return;
    try {
      await adminAPI.deleteProduct(id);
      toast.success('Product deleted');
      fetchProducts();
      fetchStats();
    } catch { toast.error('Delete failed'); }
  }

  function handleLogout() {
    localStorage.removeItem('shopnest_admin');
    localStorage.removeItem('shopnest_admin');
    navigate('/admin/login');
  }

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="adm-root">
      {/* Header */}
      <header className="adm-header">
        <div className="adm-brand">
          <span className="adm-icon">⬡</span>
          <span>ShopNest</span>
          <span className="adm-badge">ADMIN</span>
        </div>
        <nav className="adm-nav">
          {[['products', '📦 Products'], ['add', editId ? '✏️ Edit' : '➕ Add Product'], ['stats', '📊 Stats'], ['analytics', '🔥 Analytics']].map(([key, label]) => (
            <button key={key} className={tab === key ? 'adm-tab active' : 'adm-tab'}
              onClick={() => { setTab(key); if (key !== 'add') { setEditId(null); setForm(EMPTY_FORM); setPreviewImgs([]); } }}>
              {label}
            </button>
          ))}
        </nav>
        <div className="adm-user">
          <span>👤 {admin.name}</span>
          <button className="adm-logout" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <main className="adm-main">

        {/* ── STATS TAB ── */}
        {tab === 'stats' && (
          <div className="stats-grid">
            {[
              { label: 'Total Products', value: stats.total_products || 0, icon: '📦', color: '#6ee7b7' },
              { label: 'Total Users', value: stats.total_users || 0, icon: '👥', color: '#818cf8' },
              { label: 'Total Orders', value: stats.total_orders || 0, icon: '🛒', color: '#fb923c' },
              { label: 'Categories', value: (stats.categories || []).length, icon: '🏷️', color: '#f472b6' },
            ].map(s => (
              <div className="stat-card" key={s.label} style={{ '--c': s.color }}>
                <div className="stat-icon">{s.icon}</div>
                <div className="stat-val">{s.value}</div>
                <div className="stat-lbl">{s.label}</div>
              </div>
            ))}
            <div className="categories-card">
              <h3>Categories</h3>
              <div className="cat-chips">
                {(stats.categories || []).map(c => (
                  <span key={c} className="cat-chip">{c}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── PRODUCTS LIST TAB ── */}
        {tab === 'products' && (
          <div className="products-tab">
            <div className="products-toolbar">
              <input className="search-input" placeholder="🔍 Search products..."
                value={search} onChange={e => setSearch(e.target.value)} />
              <button className="add-btn" onClick={() => setTab('add')}>➕ Add Product</button>
            </div>

            {loading ? <div className="loading">Loading...</div> : (
              <div className="products-table-wrap">
                <table className="products-table">
                  <thead>
                    <tr>
                      <th>Image</th><th>Name</th><th>Category</th><th>Price</th>
                      <th>Stock</th><th>Status</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 && (
                      <tr><td colSpan={7} className="empty-row">No products found. Add your first product!</td></tr>
                    )}
                    {filtered.map(p => (
                      <tr key={p.id}>
                        <td>
                          <img src={getImageUrl(p.thumbnail)} alt={p.name} className="prod-thumb" />
                        </td>
                        <td>
                          <div className="prod-name">{p.name}</div>
                          <div className="prod-sku">{p.sku}</div>
                        </td>
                        <td><span className="cat-badge">{p.category}</span></td>
                        <td>
                          <div className="price-col">
                            <span className="price-main">${p.price}</span>
                            {p.original_price > p.price && (
                              <span className="price-orig">${p.original_price}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={p.quantity > 0 ? 'stock-badge in' : 'stock-badge out'}>
                            {p.quantity > 0 ? `${p.quantity} in stock` : 'Out of stock'}
                          </span>
                        </td>
                        <td>
                          <span className={p.is_active ? 'status-badge active' : 'status-badge inactive'}>
                            {p.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <div className="action-btns">
                            <button className="edit-btn" onClick={() => handleEdit(p)}>✏️ Edit</button>
                            <button className="del-btn" onClick={() => handleDelete(p.id)}>🗑️ Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── ANALYTICS TAB (Kafka + PySpark results) ── */}
        {tab === 'analytics' && (
          <div className="analytics-tab">
            <div className="analytics-header">
              <h2 className="analytics-title">🔥 Kafka &amp; PySpark Analytics</h2>
              <div className="analytics-controls">
                <select className="window-select" value={analyticsWindow}
                  onChange={e => setAnalyticsWindow(Number(e.target.value))}>
                  <option value={7}>Last 7 days</option>
                  <option value={30}>Last 30 days</option>
                  <option value={90}>Last 90 days</option>
                </select>
                <button className="fetch-analytics-btn"
                  onClick={() => fetchAnalytics(analyticsWindow)} disabled={analyticsLoading}>
                  {analyticsLoading ? <span className="adm-spin" /> : '📊 Load Results'}
                </button>
              </div>
            </div>

            {/* ── Job Trigger Panel ── */}
            <div className="job-trigger-panel">
              <div className="job-trigger-title">
                <span>⚙️ Run Analytics Jobs on Server</span>
                {jobPolling && <span className="job-polling-badge">⏳ Polling...</span>}
              </div>
              <div className="job-trigger-grid">

                <div className="job-card">
                  <div className="job-card-icon">📈</div>
                  <div className="job-card-info">
                    <strong>Sales Report</strong>
                    <span>Revenue, top products, daily chart</span>
                  </div>
                  <div className="job-card-right">
                    <JobStatusBadge status={jobStatuses[`sales_report_${analyticsWindow}d`]?.status} />
                    <button className="job-run-btn"
                      disabled={jobPolling}
                      onClick={() => triggerJob('Sales Report', () => adminAPI.runSalesReport(analyticsWindow))}>
                      ▶ Run
                    </button>
                  </div>
                </div>

                <div className="job-card">
                  <div className="job-card-icon">🤝</div>
                  <div className="job-card-info">
                    <strong>Recommendations</strong>
                    <span>Frequently bought together</span>
                  </div>
                  <div className="job-card-right">
                    <JobStatusBadge status={jobStatuses['recommendations']?.status} />
                    <button className="job-run-btn"
                      disabled={jobPolling}
                      onClick={() => triggerJob('Recommendations', adminAPI.runRecommendations)}>
                      ▶ Run
                    </button>
                  </div>
                </div>

                <div className="job-card">
                  <div className="job-card-icon">👥</div>
                  <div className="job-card-info">
                    <strong>User Funnel</strong>
                    <span>VIP / Repeat / One-time segments</span>
                  </div>
                  <div className="job-card-right">
                    <JobStatusBadge status={jobStatuses['user_funnel']?.status} />
                    <button className="job-run-btn"
                      disabled={jobPolling}
                      onClick={() => triggerJob('User Funnel', adminAPI.runFunnel)}>
                      ▶ Run
                    </button>
                  </div>
                </div>

                <div className="job-card job-card-all">
                  <div className="job-card-icon">🚀</div>
                  <div className="job-card-info">
                    <strong>Run All Jobs</strong>
                    <span>Sales + Recommendations + Funnel at once</span>
                  </div>
                  <div className="job-card-right">
                    <button className="job-run-btn job-run-all"
                      disabled={jobPolling}
                      onClick={() => triggerJob('All Jobs', () => adminAPI.runAllJobs(analyticsWindow))}>
                      {jobPolling ? <span className="adm-spin" /> : '▶▶ Run All'}
                    </button>
                  </div>
                </div>

                <div className="job-card job-card-backfill">
                  <div className="job-card-icon">🔄</div>
                  <div className="job-card-info">
                    <strong>Backfill Existing Orders</strong>
                    <span>Populate analytics_events &amp; inventory_log from all past orders</span>
                  </div>
                  <div className="job-card-right">
                    <JobStatusBadge status={jobStatuses['backfill']?.status} />
                    <button className="job-run-btn job-run-backfill"
                      disabled={jobPolling}
                      onClick={() => triggerJob('Backfill', adminAPI.backfillEvents)}>
                      ▶ Backfill
                    </button>
                  </div>
                </div>

              </div>
            </div>

            {/* ── Results Section ── */}
            {!analytics && !analyticsLoading && (
              <div className="analytics-empty">
                <div className="analytics-empty-icon">📊</div>
                <h3>No Results Yet</h3>
                <p>Click <strong>▶ Run</strong> on any job above to generate analytics on the server, then click <strong>Load Results</strong>.</p>
                <p className="analytics-hint">Jobs run in the background — results auto-load when complete.</p>
              </div>
            )}

            {analyticsLoading && (
              <div className="analytics-loading">
                <span className="adm-spin large-spin" />
                <p>Loading results from MongoDB...</p>
              </div>
            )}

            {analytics && !analyticsLoading && (
              <>
                {analytics.kpis && Object.keys(analytics.kpis).length > 0 ? (
                  <div className="kpi-grid">
                    {[
                      { label: 'Gross Revenue',     value: `$${(analytics.kpis.gross_revenue || 0).toFixed(2)}`,   icon: '💰', color: '#6ee7b7' },
                      { label: 'Total Orders',       value: analytics.kpis.total_orders || 0,                       icon: '🛒', color: '#818cf8' },
                      { label: 'Avg Order Value',    value: `$${(analytics.kpis.avg_order_value || 0).toFixed(2)}`, icon: '📈', color: '#fb923c' },
                      { label: 'Unique Customers',   value: analytics.kpis.unique_customers || 0,                   icon: '👥', color: '#f472b6' },
                    ].map(k => (
                      <div className="kpi-card" key={k.label} style={{ '--kc': k.color }}>
                        <div className="kpi-icon">{k.icon}</div>
                        <div className="kpi-val">{k.value}</div>
                        <div className="kpi-lbl">{k.label}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="analytics-no-data">
                    <p>⚠️ {analytics.message || 'No data. Run jobs above first.'}</p>
                  </div>
                )}

                {(analytics.revenue_by_category || []).length > 0 && (
                  <div className="analytics-section">
                    <h3 className="analytics-section-title">📂 Revenue by Category</h3>
                    <div className="category-bars">
                      {(() => {
                        const maxRev = Math.max(...analytics.revenue_by_category.map(c => c.revenue));
                        return analytics.revenue_by_category.map(cat => (
                          <div key={cat.category} className="cat-bar-row">
                            <span className="cat-bar-label">{cat.category}</span>
                            <div className="cat-bar-track">
                              <div className="cat-bar-fill" style={{ width: `${(cat.revenue / maxRev) * 100}%` }} />
                            </div>
                            <span className="cat-bar-val">${cat.revenue.toFixed(0)}</span>
                            <span className="cat-bar-units">{cat.units_sold} units</span>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}

                {(analytics.daily_revenue || []).length > 0 && (
                  <div className="analytics-section">
                    <h3 className="analytics-section-title">📅 Daily Revenue</h3>
                    <div className="daily-chart">
                      {(() => {
                        const maxDay = Math.max(...analytics.daily_revenue.map(d => d.revenue));
                        return analytics.daily_revenue.map(day => (
                          <div key={day.date} className="day-col">
                            <div className="day-bar-wrap">
                              <div className="day-bar"
                                style={{ height: `${maxDay > 0 ? (day.revenue / maxDay) * 100 : 0}%` }}
                                title={`$${day.revenue.toFixed(2)} — ${day.orders} orders`} />
                            </div>
                            <span className="day-label">{day.date.slice(5)}</span>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}

                {(analytics.top_products || []).length > 0 && (
                  <div className="analytics-section">
                    <h3 className="analytics-section-title">🏆 Top Selling Products</h3>
                    <div className="top-products-list">
                      {analytics.top_products.slice(0, 10).map((p, i) => (
                        <div key={p.product_id} className="top-prod-row">
                          <span className="top-prod-rank">#{i + 1}</span>
                          <span className="top-prod-name">{p.product_name}</span>
                          <span className="top-prod-cat">{p.category}</span>
                          <span className="top-prod-units">{p.units_sold} sold</span>
                          <span className="top-prod-rev">${p.revenue.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {analytics.status_distribution && Object.keys(analytics.status_distribution).length > 0 && (
                  <div className="analytics-section">
                    <h3 className="analytics-section-title">📦 Order Status Distribution</h3>
                    <div className="status-dist-grid">
                      {Object.entries(analytics.status_distribution).map(([status, count]) => (
                        <div key={status} className={`status-dist-card status-${status}`}>
                          <div className="status-dist-count">{count}</div>
                          <div className="status-dist-label">{status}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <p className="analytics-generated">
                  Engine: <strong>{analytics.engine || 'pymongo'}</strong>
                  &nbsp;·&nbsp; Generated: {analytics.generated_at ? new Date(analytics.generated_at).toLocaleString() : 'N/A'}
                  &nbsp;·&nbsp; Window: {analytics.window_days} days
                </p>
              </>
            )}
          </div>
        )}

        {/* ── ADD / EDIT PRODUCT TAB ── */}
        {tab === 'add' && (
          <div className="add-tab">
            <h2 className="form-title">{editId ? '✏️ Edit Product' : '➕ Add New Product'}</h2>
            <form onSubmit={handleSubmit} className="product-form">

              <div className="form-grid">
                {/* Basic Info */}
                <div className="form-section">
                  <h3>Basic Information</h3>
                  <div className="field">
                    <label>Product Name *</label>
                    <input placeholder="e.g. iPhone 15 Pro Max" value={form.name} onChange={e => set('name', e.target.value)} required />
                  </div>
                  <div className="field">
                    <label>Description</label>
                    <textarea rows={4} placeholder="Product description..." value={form.description} onChange={e => set('description', e.target.value)} />
                  </div>
                  <div className="field-row">
                    <div className="field">
                      <label>Category *</label>
                      <select value={form.category} onChange={e => set('category', e.target.value)} required>
                        <option value="">Select category</option>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label>Brand</label>
                      <input placeholder="e.g. Apple" value={form.brand} onChange={e => set('brand', e.target.value)} />
                    </div>
                  </div>
                </div>

                {/* Pricing & Stock */}
                <div className="form-section">
                  <h3>Pricing & Stock</h3>
                  <div className="field-row">
                    <div className="field">
                      <label>Price ($) *</label>
                      <input type="number" step="0.01" min="0" placeholder="0.00" value={form.price} onChange={e => set('price', e.target.value)} required />
                    </div>
                    <div className="field">
                      <label>Original Price ($)</label>
                      <input type="number" step="0.01" min="0" placeholder="0.00" value={form.original_price} onChange={e => set('original_price', e.target.value)} />
                    </div>
                  </div>
                  <div className="field-row">
                    <div className="field">
                      <label>Quantity *</label>
                      <input type="number" min="0" placeholder="0" value={form.quantity} onChange={e => set('quantity', e.target.value)} required />
                    </div>
                    <div className="field">
                      <label>SKU</label>
                      <input placeholder="e.g. APL-IP15-128" value={form.sku} onChange={e => set('sku', e.target.value)} />
                    </div>
                  </div>
                  <div className="field">
                    <label>Tags (comma separated)</label>
                    <input placeholder="phone, apple, 5g, camera" value={form.tags} onChange={e => set('tags', e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Extra Metadata (JSON)</label>
                    <input placeholder='{"color":"black","weight":"200g"}' value={form.metadata} onChange={e => set('metadata', e.target.value)} />
                  </div>
                  <div className="field check-field">
                    <input type="checkbox" id="featured" checked={form.is_featured} onChange={e => set('is_featured', e.target.checked)} />
                    <label htmlFor="featured">⭐ Featured product (show on homepage)</label>
                  </div>
                </div>
              </div>

              {/* Images */}
              <div className="form-section full-width">
                <h3>Product Images</h3>
                <div className="image-upload-area" onClick={() => fileRef.current?.click()}>
                  <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleImages} />
                  <div className="upload-placeholder">
                    <span>📷</span>
                    <p>Click to upload product images</p>
                    <p className="upload-hint">PNG, JPG, WEBP — multiple allowed</p>
                  </div>
                </div>
                {previewImgs.length > 0 && (
                  <div className="image-previews">
                    {previewImgs.map((img, i) => (
                      <div key={i} className="preview-wrap">
                        <img src={img} alt={`preview-${i}`} />
                        <button type="button" className="remove-img" onClick={() => removeImage(i)}>×</button>
                        {i === 0 && <span className="main-badge">Main</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={() => { setTab('products'); setEditId(null); setForm(EMPTY_FORM); setPreviewImgs([]); }}>
                  Cancel
                </button>
                <button type="submit" className="submit-btn" disabled={loading}>
                  {loading ? <span className="adm-spin" /> : (editId ? '💾 Update Product' : '➕ Add Product')}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

// ── Job Status Badge component ────────────
function JobStatusBadge({ status }) {
  if (!status)            return <span className="job-badge job-badge-idle">idle</span>;
  if (status === 'running') return <span className="job-badge job-badge-running">⏳ running</span>;
  if (status === 'done')    return <span className="job-badge job-badge-done">✅ done</span>;
  if (status === 'error')   return <span className="job-badge job-badge-error">❌ error</span>;
  return <span className="job-badge">{status}</span>;
}
