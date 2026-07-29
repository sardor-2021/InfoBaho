import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import '../assets/css/Forum.css';

const Forum = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [categories, setCategories] = useState([]);
  const [posts, setPosts] = useState([]);
  const [topHelpers, setTopHelpers] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState(searchParams.get('category') || '');
  const [sort, setSort] = useState('latest');
  const [filter, setFilter] = useState('');

  useEffect(() => { fetchAll(); }, [activeCategory, sort, filter]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const params = {};
      if (activeCategory) params.category_id = activeCategory;
      if (sort) params.sort = sort;
      if (filter) params.filter = filter;
      if (search) params.search = search;

      const [postsRes, catsRes, helpersRes, statsRes] = await Promise.all([
        api.get('/forum/posts', { params }),
        api.get('/forum/categories'),
        api.get('/forum/top-helpers').catch(() => ({ data: [] })),
        api.get('/forum/stats').catch(() => ({ data: {} })),
      ]);

      setPosts(Array.isArray(postsRes.data) ? postsRes.data : []);
      setCategories(Array.isArray(catsRes.data) ? catsRes.data : []);
      setTopHelpers(Array.isArray(helpersRes.data) ? helpersRes.data : []);
      setStats(statsRes.data || {});
    } catch (err) {
      console.error('Forum fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchAll();
  };

  const handleCategoryClick = (catId) => {
    setActiveCategory(catId === activeCategory ? '' : catId);
  };

  const timeAgo = (date) => {
    const now = new Date();
    const d = new Date(date);
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return 'hozirgina';
    if (diff < 3600) return `${Math.floor(diff / 60)} daqiqa oldin`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} soat oldin`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} kun oldin`;
    return d.toLocaleDateString('uz-UZ');
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Forum yuklanmoqda...</p>
      </div>
    );
  }

  return (
    <div className="forum-container">
      {/* Header */}
      <div className="forum-header">
        <div className="forum-header-content">
          <div>
            <h1>💬 Forum</h1>
            <p className="subtitle">Savol bering, javob oling, bilim ulashing</p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/forum/new')}>
            ✍️ Yangi mavzu
          </button>
        </div>

        {/* Forum stats */}
        <div className="forum-stats-bar">
          <div className="forum-stat-item">
            <span className="fs-number">{stats.total_posts || 0}</span>
            <span className="fs-label">Mavzular</span>
          </div>
          <div className="forum-stat-item">
            <span className="fs-number">{stats.total_comments || 0}</span>
            <span className="fs-label">Javoblar</span>
          </div>
          <div className="forum-stat-item">
            <span className="fs-number">{stats.solved_posts || 0}</span>
            <span className="fs-label">Yechildi ✅</span>
          </div>
          <div className="forum-stat-item">
            <span className="fs-number">{stats.active_users || 0}</span>
            <span className="fs-label">Faol a'zo</span>
          </div>
        </div>
      </div>

      <div className="forum-layout">
        {/* Sidebar */}
        <aside className="forum-sidebar">
          {/* Kategoriyalar */}
          <div className="sidebar-section">
            <h3>📂 Kategoriyalar</h3>
            <div className="category-list">
              <button
                className={`category-btn ${!activeCategory ? 'active' : ''}`}
                onClick={() => handleCategoryClick('')}
              >
                <span>🌐</span> Barchasi
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  className={`category-btn ${activeCategory == cat.id ? 'active' : ''}`}
                  onClick={() => handleCategoryClick(cat.id)}
                >
                  <span>{cat.icon}</span>
                  <span className="cat-name">{cat.name}</span>
                  <span className="cat-count">{cat.posts_count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Top Helpers */}
          {topHelpers.length > 0 && (
            <div className="sidebar-section">
              <h3>🏅 Top yordamchilar</h3>
              <div className="top-helpers-list">
                {topHelpers.slice(0, 5).map((h, i) => (
                  <div key={h.id} className="helper-item">
                    <span className="helper-rank">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`}</span>
                    <div className="helper-info">
                      <span className="helper-name">{h.full_name}</span>
                      <span className="helper-stats">
                        {h.best_answers}× ✅ · {h.answers_count} javob
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Main Content */}
        <main className="forum-main">
          {/* Search & Filters */}
          <div className="forum-filters">
            <form onSubmit={handleSearch} className="forum-search">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Mavzularni qidirish..."
                className="search-input"
              />
              <button type="submit" className="search-btn">🔍</button>
            </form>

            <div className="forum-sort-btns">
              <button className={`sort-btn ${sort === 'latest' ? 'active' : ''}`}
                onClick={() => setSort('latest')}>🕐 Yangi</button>
              <button className={`sort-btn ${sort === 'popular' ? 'active' : ''}`}
                onClick={() => setSort('popular')}>🔥 Mashhur</button>
              <button className={`sort-btn ${filter === 'unanswered' ? 'active' : ''}`}
                onClick={() => setFilter(filter === 'unanswered' ? '' : 'unanswered')}>❓ Javobsiz</button>
              <button className={`sort-btn ${filter === 'solved' ? 'active' : ''}`}
                onClick={() => setFilter(filter === 'solved' ? '' : 'solved')}>✅ Yechildi</button>
            </div>
          </div>

          {/* Posts List */}
          {posts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">💬</div>
              <h3>Hozircha mavzu yo'q</h3>
              <p>Birinchi bo'lib savol bering!</p>
              <button className="btn btn-primary" onClick={() => navigate('/forum/new')}>
                ✍️ Mavzu ochish
              </button>
            </div>
          ) : (
            <div className="posts-list">
              {posts.map(post => (
                <Link to={`/forum/post/${post.id}`} key={post.id}
                  className={`post-card ${post.pinned ? 'pinned' : ''} ${post.has_best_answer ? 'solved' : ''}`}>
                  {/* Vote score */}
                  <div className="post-votes">
                    <span className="vote-score">{post.score || 0}</span>
                    <span className="vote-label">ovoz</span>
                  </div>

                  {/* Content */}
                  <div className="post-content">
                    <div className="post-title-row">
                      {post.pinned && <span className="pin-badge">📌</span>}
                      {post.has_best_answer > 0 && <span className="solved-badge">✅</span>}
                      <h3 className="post-title">{post.title}</h3>
                    </div>

                    <div className="post-meta">
                      <span className="post-category">
                        {post.category_icon} {post.category_name}
                      </span>
                      <span className="post-author">
                        {post.author_role === 'teacher' ? '👨‍🏫' : post.author_role === 'admin' ? '⚙️' : '👤'}
                        {post.author_name}
                      </span>
                      <span className="post-time">{timeAgo(post.created_at)}</span>
                    </div>

                    {post.tags?.length > 0 && (
                      <div className="post-tags">
                        {post.tags.slice(0, 4).map((t, i) => (
                          <span key={i} className="tag">#{t}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="post-stats">
                    <div className="post-stat">
                      <span className="ps-number">{post.comments_count}</span>
                      <span className="ps-label">javob</span>
                    </div>
                    <div className="post-stat">
                      <span className="ps-number">{post.views}</span>
                      <span className="ps-label">ko'rish</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Forum;
