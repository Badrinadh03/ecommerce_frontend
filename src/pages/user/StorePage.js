import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { productAPI, getImageUrl } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import useCart from '../../hooks/useCart';
import Navbar from '../../components/Navbar';
import toast from 'react-hot-toast';
import './StorePage.css';

const SORT_OPTIONS = [
  { value: 'default', label: 'Featured' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'rating', label: 'Avg. Customer Review' },
  { value: 'newest', label: 'Newest Arrivals' },
];

export default function StorePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { cart, cartCount, addToCart: addToCartDB, syncing } = useCart();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sort, setSort] = useState('default');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [priceRange, setPriceRange] = useState([0, 10000]);

  useEffect(() => { fetchCategories(); }, []);
  useEffect(() => { fetchProducts(); }, [search, selectedCategory, page]);

  async function fetchCategories() {
    try {
      const res = await productAPI.getCategories();
      setCategories(res.data.categories || []);
    } catch {}
  }

  async function fetchProducts() {
    setLoading(true);
    try {
      const res = await productAPI.getAll({
        category: selectedCategory || undefined,
        search: search || undefined,
        page, limit: 20,
      });
      setProducts(res.data.products || []);
      setTotalPages(res.data.pages || 1);
      setTotalProducts(res.data.total || 0);
    } catch { toast.error('Failed to load products'); }
    finally { setLoading(false); }
  }

  function handleSearch(e) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  function addToCart(product) {
    const existing = cart.find(i => i.id === product.id);
    addToCartDB(product);
    toast.success(existing ? 'Quantity updated!' : 'Added to cart!');
  }

  const sorted = [...products].sort((a, b) => {
    if (sort === 'price_asc') return a.price - b.price;
    if (sort === 'price_desc') return b.price - a.price;
    if (sort === 'rating') return b.rating - a.rating;
    return 0;
  }).filter(p => p.price >= priceRange[0] && p.price <= priceRange[1]);

  const searchBar = (
    <form className="nav-search" onSubmit={handleSearch}>
      <select className="nav-cat-select" value={selectedCategory}
        onChange={e => { setSelectedCategory(e.target.value); setPage(1); }}>
        <option value="">All Categories</option>
        {categories.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <input
        placeholder="Search products..."
        value={searchInput}
        onChange={e => setSearchInput(e.target.value)}
      />
      <button type="submit" className="nav-search-btn">🔍</button>
    </form>
  );

  return (
    <div className="store-root">
      {/* ── NAVBAR ── */}
      <Navbar cartCount={cartCount} middleContent={searchBar} />

      {/* ── SECONDARY NAV ── */}
      <div className="store-subnav">
        <div className="subnav-inner">
          <button className={!selectedCategory ? 'subnav-btn active' : 'subnav-btn'}
            onClick={() => { setSelectedCategory(''); setPage(1); }}>All</button>
          {categories.map(c => (
            <button key={c} className={selectedCategory === c ? 'subnav-btn active' : 'subnav-btn'}
              onClick={() => { setSelectedCategory(c); setPage(1); }}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="store-body">
        {/* ── SIDEBAR ── */}
        <aside className="store-sidebar">
          <div className="sidebar-section">
            <h4>Department</h4>
            <div className="sidebar-list">
              <button className={!selectedCategory ? 'sidebar-item active' : 'sidebar-item'}
                onClick={() => { setSelectedCategory(''); setPage(1); }}>
                All Departments
              </button>
              {categories.map(c => (
                <button key={c} className={selectedCategory === c ? 'sidebar-item active' : 'sidebar-item'}
                  onClick={() => { setSelectedCategory(c); setPage(1); }}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="sidebar-section">
            <h4>Price Range</h4>
            <div className="price-range">
              <div className="price-inputs">
                <input type="number" placeholder="Min" value={priceRange[0]}
                  onChange={e => setPriceRange([+e.target.value, priceRange[1]])} />
                <span>—</span>
                <input type="number" placeholder="Max" value={priceRange[1]}
                  onChange={e => setPriceRange([priceRange[0], +e.target.value])} />
              </div>
              {[['Under $25', 0, 25], ['$25–$50', 25, 50], ['$50–$100', 50, 100], ['$100–$500', 100, 500], ['$500+', 500, 10000]].map(([label, min, max]) => (
                <button key={label} className="price-btn"
                  onClick={() => setPriceRange([min, max])}>{label}</button>
              ))}
            </div>
          </div>

          <div className="sidebar-section">
            <h4>Avg. Customer Review</h4>
            {[4, 3, 2, 1].map(r => (
              <div key={r} className="star-filter">
                {'⭐'.repeat(r)}{'☆'.repeat(4 - r)} <span>& Up</span>
              </div>
            ))}
          </div>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <main className="store-main">
          {/* Toolbar */}
          <div className="store-toolbar">
            <div className="results-info">
              {search && <span>Results for "<strong>{search}</strong>"  — </span>}
              <span>{totalProducts.toLocaleString()} results</span>
            </div>
            <div className="sort-wrap">
              <label>Sort by:</label>
              <select value={sort} onChange={e => setSort(e.target.value)}>
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* Products grid */}
          {loading ? (
            <div className="store-loading">
              {[...Array(8)].map((_, i) => <div key={i} className="skeleton-card" />)}
            </div>
          ) : sorted.length === 0 ? (
            <div className="store-empty">
              <div className="empty-icon">📭</div>
              <h3>No products found</h3>
              <p>Try a different search or category</p>
              <button onClick={() => { setSearch(''); setSearchInput(''); setSelectedCategory(''); }}>
                Clear filters
              </button>
            </div>
          ) : (
            <div className="products-grid">
              {sorted.map(p => (
                <ProductCard key={p.id} product={p} onAddToCart={addToCart} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
              {[...Array(totalPages)].map((_, i) => (
                <button key={i} className={page === i + 1 ? 'page-btn active' : 'page-btn'}
                  onClick={() => setPage(i + 1)}>{i + 1}</button>
              ))}
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ── Product Card (Amazon style) ───────────
function ProductCard({ product: p, onAddToCart }) {
  const [imgError, setImgError] = useState(false);

  function renderStars(rating) {
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5;
    return (
      <span className="stars">
        {'★'.repeat(full)}{half ? '½' : ''}{'☆'.repeat(5 - full - (half ? 1 : 0))}
        <span className="review-count">({p.review_count})</span>
      </span>
    );
  }

  const isSoldOut = p.quantity === 0 || p.sold_out;

  return (
    <div className={`product-card${isSoldOut ? ' sold-out-card' : ''}`}>
      <div className="card-img-wrap">
        {p.discount_pct > 0 && !isSoldOut && <span className="discount-badge">-{p.discount_pct}%</span>}
        {p.is_featured && !isSoldOut && <span className="featured-badge">⭐ Featured</span>}
        <img
          src={imgError ? 'https://placehold.co/280x280?text=No+Image' : getImageUrl(p.thumbnail)}
          alt={p.name}
          onError={() => setImgError(true)}
          className="card-img"
        />
        {/* Sold Out overlay on the image */}
        {isSoldOut && (
          <div className="sold-out-overlay">
            <span className="sold-out-badge">SOLD OUT</span>
          </div>
        )}
      </div>
      <div className="card-body">
        <div className="card-category">{p.category}</div>
        <h3 className="card-name">{p.name}</h3>
        {p.brand && <div className="card-brand">by {p.brand}</div>}
        <div className="card-rating">{renderStars(p.rating || 0)}</div>

        <div className="card-pricing">
          <span className="card-price">${p.price.toFixed(2)}</span>
          {p.original_price > p.price && (
            <span className="card-orig">${p.original_price.toFixed(2)}</span>
          )}
        </div>

        {isSoldOut ? (
          <div className="card-stock out">❌ Sold Out</div>
        ) : (
          <div className="card-stock in">✅ In Stock</div>
        )}

        <button
          className="add-cart-btn"
          onClick={() => !isSoldOut && onAddToCart(p)}
          disabled={isSoldOut}
        >
          {isSoldOut ? '🚫 Sold Out' : 'Add to Cart'}
        </button>
      </div>
    </div>
  );
}
