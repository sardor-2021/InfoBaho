import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import '../assets/css/Pages.css';

const API_BASE = (process.env.REACT_APP_API_URL || '').replace('/api', '');

// ─── Helpers ─────────────────────────────────────────────────
const TYPE_LABELS  = { project:'Loyiha', certificate:'Sertifikat', achievement:'Yutuq', test_result:'Test natijasi' };
const TYPE_ICONS   = { project:'💻', certificate:'🏆', achievement:'⭐', test_result:'📊' };
const LEVEL_COLORS = ['bronze','silver','gold','platinum','diamond'];
const IMG_EXTS     = ['jpg','jpeg','png','gif','webp'];

function isImageUrl(url) {
  if (!url) return false;
  const ext = url.split('?')[0].split('.').pop().toLowerCase();
  return IMG_EXTS.includes(ext);
}
function fileIcon(type) {
  return { image:'🖼️', pdf:'📄', doc:'📝', video:'🎬', zip:'📦' }[type] || '📎';
}

// ─── Lightbox ─────────────────────────────────────────────────
const Lightbox = ({ src, alt, onClose }) => (
  <div onClick={onClose} style={{
    position:'fixed', inset:0, background:'rgba(0,0,0,0.92)',
    display:'flex', alignItems:'center', justifyContent:'center',
    zIndex:9999, cursor:'zoom-out'
  }}>
    <img src={src} alt={alt}
      style={{ maxWidth:'92vw', maxHeight:'92vh', borderRadius:'8px', objectFit:'contain' }}
      onClick={e => e.stopPropagation()} />
    <button onClick={onClose} style={{
      position:'absolute', top:'1.5rem', right:'1.5rem',
      background:'rgba(255,255,255,0.2)', border:'none', color:'#fff',
      width:'40px', height:'40px', borderRadius:'50%', fontSize:'1.1rem', cursor:'pointer'
    }}>✕</button>
  </div>
);

// ─── Like tugmasi ─────────────────────────────────────────────
const LikeButton = ({ item, onLike, canLike }) => {
  const [loading, setLoading] = useState(false);
  const liked = item.user_liked;
  const count = item.likes_count || 0;

  const handleClick = async (e) => {
    e.stopPropagation();
    if (!canLike || loading) return;
    setLoading(true);
    await onLike(item.id);
    setLoading(false);
  };

  return (
    <button
      onClick={handleClick}
      disabled={!canLike || loading}
      title={!canLike ? "O'z ishingizga like bosa olmaysiz" : liked ? "Like olib tashlash" : "Like bosish"}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
        padding: '0.3rem 0.7rem', borderRadius: '20px', border: 'none',
        cursor: canLike ? 'pointer' : 'default',
        fontSize: '0.82rem', fontWeight: 600,
        background: liked
          ? 'linear-gradient(135deg,#f43f5e,#e11d48)'
          : 'var(--bg-secondary)',
        color: liked ? '#fff' : 'var(--text-secondary)',
        transition: 'all 0.2s',
        transform: loading ? 'scale(0.95)' : 'scale(1)',
        opacity: !canLike ? 0.5 : 1,
        boxShadow: liked ? '0 2px 8px rgba(244,63,94,0.3)' : 'none'
      }}
    >
      <span style={{ fontSize: '0.9rem' }}>{liked ? '❤️' : '🤍'}</span>
      {count > 0 && <span>{count}</span>}
    </button>
  );
};

// ─── Portfolio Card (o'qituvchi ko'rinishi) ───────────────────
const StudentPortfolioCard = ({ item, onView, onLike, canLike }) => {
  const [lightbox, setLightbox] = useState(false);
  const imageUrl = isImageUrl(item.file_url) ? (item.file_url.startsWith('http') ? item.file_url : `${API_BASE}${item.file_url}`) : null;
  const hasFile  = item.file_url && !imageUrl;

  return (
    <div
      onClick={() => onView(item)}
      style={{
        background:'var(--card-bg)', borderRadius:'14px',
        border:'1px solid var(--border-color)', overflow:'hidden',
        cursor:'pointer', transition:'box-shadow 0.2s'
      }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.1)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>

      {/* ── Rasm miniaturasi ── */}
      {imageUrl && (
        <div style={{ position:'relative', paddingTop:'56.25%', overflow:'hidden', background:'var(--bg-secondary)' }}>
          <img src={imageUrl} alt={item.title}
            style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover' }} />
          {/* Kattalashtirish tugmasi */}
          <button onClick={e => { e.stopPropagation(); setLightbox(true); }}
            style={{
              position:'absolute', bottom:'0.5rem', right:'0.5rem',
              background:'rgba(0,0,0,0.65)', color:'#fff', border:'none',
              borderRadius:'6px', padding:'0.25rem 0.6rem',
              fontSize:'0.72rem', cursor:'pointer'
            }}>🔍 Kattalashtirish</button>
        </div>
      )}
      {lightbox && <Lightbox src={imageUrl} alt={item.title} onClose={() => setLightbox(false)} />}

      <div style={{ padding:'1rem' }}>
        {/* Sarlavha */}
        <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.4rem' }}>
          <span style={{ fontSize:'1.15rem' }}>{TYPE_ICONS[item.item_type] || '📌'}</span>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontWeight:700, fontSize:'0.9rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {item.title}
            </div>
            <div style={{ fontSize:'0.7rem', color:'var(--text-secondary)', marginTop:'1px' }}>
              {TYPE_LABELS[item.item_type]} · {new Date(item.created_at).toLocaleDateString('uz-UZ')}
              {item.is_public && <span style={{ color:'#16a34a', marginLeft:'0.5rem' }}>🌐</span>}
            </div>
          </div>
        </div>

        {/* Tavsif */}
        {item.description && (
          <p style={{
            fontSize:'0.8rem', color:'var(--text-secondary)', margin:'0.4rem 0 0.6rem',
            lineHeight:1.5, display:'-webkit-box', WebkitLineClamp:2,
            WebkitBoxOrient:'vertical', overflow:'hidden'
          }}>{item.description}</p>
        )}

        {/* Fayl (rasm emas) — yuklab olish tugmasi */}
        {hasFile && (
          <a href={`${API_BASE}${item.file_url}`}
            target="_blank" rel="noopener noreferrer"
            download={item.file_name}
            onClick={e => e.stopPropagation()}
            style={{
              display:'inline-flex', alignItems:'center', gap:'0.4rem',
              fontSize:'0.78rem', color:'#fff', background:'var(--primary-color)',
              padding:'0.3rem 0.75rem', borderRadius:'6px', textDecoration:'none',
              marginBottom:'0.4rem'
            }}>
            ⬇️ {item.file_name || 'Yuklab olish'}
          </a>
        )}

        {/* Tashqi URL */}
        {item.file_url && !item.file_url.startsWith('/') && (
          <a href={item.file_url} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{
              display:'inline-flex', alignItems:'center', gap:'0.3rem',
              fontSize:'0.78rem', color:'var(--primary-color)', textDecoration:'none'
            }}>
            🔗 Havolani ochish
          </a>
        )}

        {/* Teglar */}
        {item.tags?.length > 0 && (
          <div style={{ display:'flex', gap:'0.3rem', flexWrap:'wrap', marginTop:'0.5rem' }}>
            {item.tags.slice(0,4).map((t,i) => (
              <span key={i} style={{
                fontSize:'0.68rem', background:'rgba(99,102,241,0.1)',
                color:'#6366f1', padding:'2px 8px', borderRadius:'20px'
              }}>#{t}</span>
            ))}
          </div>
        )}

        {/* Like tugmasi */}
        <div style={{ marginTop:'0.75rem', paddingTop:'0.6rem', borderTop:'1px solid var(--border-color)',
                      display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <LikeButton item={item} onLike={onLike} canLike={canLike} />
          <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
            {item.avg_rating > 0 && (
              <span style={{
                fontSize:'0.75rem', fontWeight:600, color:'#7c3aed',
                background:'#f5f3ff', padding:'0.2rem 0.5rem', borderRadius:'12px'
              }}>⭐ {item.avg_rating}/10</span>
            )}
            {item.likes_count > 0 && !item.user_liked && (
              <span style={{ fontSize:'0.72rem', color:'var(--text-secondary)' }}>
                {item.likes_count} ❤️
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Rating Component (o'qituvchi ball beradi) ───────────────
const RatingSection = ({ item, user }) => {
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const [ratings, setRatings] = useState([]);
  const [avgScore, setAvgScore] = useState(0);
  const [totalRatings, setTotalRatings] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchRatings();
  }, [item.id]);

  const fetchRatings = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/portfolio/${item.id}/ratings`);
      setRatings(res.data.ratings || []);
      setAvgScore(res.data.avg_score || 0);
      setTotalRatings(res.data.total_ratings || 0);
      // Agar avval baho bergan bo'lsa — uni ko'rsat
      const myRating = res.data.ratings?.find(r => r.teacher_id === user.id);
      if (myRating) {
        setScore(myRating.score);
        setComment(myRating.comment || '');
      }
    } catch (err) { console.error('Fetch ratings error:', err); }
    finally { setLoading(false); }
  };

  const handleSubmit = async () => {
    if (score < 1 || score > 10) {
      alert('Ball 1 dan 10 gacha bo\'lishi kerak');
      return;
    }
    try {
      setSubmitting(true);
      const res = await api.post(`/portfolio/${item.id}/rate`, { score, comment });
      setAvgScore(res.data.item_avg_score);
      setTotalRatings(res.data.total_ratings);
      setSuccess(`✅ ${res.data.rating.points_added > 0 ? '+' : ''}${res.data.rating.points_added} ball qo'shildi! (Jami: ${res.data.student_points} ball)`);
      fetchRatings();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      alert(err.response?.data?.error || 'Baholashda xatolik');
    } finally { setSubmitting(false); }
  };

  const canRate = user.role === 'teacher' || user.role === 'admin';

  return (
    <div style={{
      marginTop: '1.25rem', padding: '1.25rem', borderRadius: '12px',
      background: 'linear-gradient(135deg, #faf5ff, #eef2ff)',
      border: '1px solid #e9d5ff'
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.75rem' }}>
        <h4 style={{ margin:0, fontSize:'0.95rem', color:'#581c87' }}>
          ⭐ Baholash {totalRatings > 0 && `(${totalRatings} ta baho)`}
        </h4>
        {avgScore > 0 && (
          <div style={{
            background:'linear-gradient(135deg,#f59e0b,#d97706)', color:'#fff',
            padding:'0.3rem 0.75rem', borderRadius:'20px', fontSize:'0.85rem', fontWeight:700
          }}>
            ⭐ {avgScore}/10
          </div>
        )}
      </div>

      {/* O'qituvchi baholash formasi */}
      {canRate && (
        <div style={{ marginBottom:'1rem' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.5rem' }}>
            <span style={{ fontSize:'0.85rem', color:'#6b21a8' }}>Ball:</span>
            <div style={{ display:'flex', gap:'0.25rem' }}>
              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                <button key={n} onClick={() => setScore(n)}
                  style={{
                    width:'30px', height:'30px', borderRadius:'50%',
                    border: score === n ? '2px solid #7c3aed' : '1px solid #d8b4fe',
                    background: score >= n
                      ? `linear-gradient(135deg, ${n<=3?'#ef4444':n<=6?'#f59e0b':n<=8?'#10b981':'#6366f1'}, ${n<=3?'#dc2626':n<=6?'#d97706':n<=8?'#059669':'#4338ca'})`
                      : '#fff',
                    color: score >= n ? '#fff' : '#6b21a8',
                    fontSize:'0.7rem', fontWeight:700, cursor:'pointer',
                    transition:'all 0.15s', transform: score === n ? 'scale(1.15)' : 'scale(1)'
                  }}>
                  {n}
                </button>
              ))}
            </div>
            <span style={{ fontSize:'0.8rem', color:'#9333ea', fontWeight:600, marginLeft:'0.5rem' }}>
              {score > 0 ? `${score}/10` : ''}
            </span>
          </div>
          <div style={{ display:'flex', gap:'0.5rem', alignItems:'flex-end' }}>
            <input
              type="text"
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Izoh (ixtiyoriy)..."
              style={{
                flex:1, padding:'0.5rem 0.75rem', border:'1px solid #d8b4fe',
                borderRadius:'8px', fontSize:'0.85rem', outline:'none'
              }}
            />
            <button
              onClick={handleSubmit}
              disabled={submitting || score < 1}
              style={{
                padding:'0.5rem 1.25rem', borderRadius:'8px', border:'none',
                background: score > 0 ? 'linear-gradient(135deg,#7c3aed,#6366f1)' : '#e5e7eb',
                color:'#fff', fontWeight:600, fontSize:'0.85rem',
                cursor: score > 0 ? 'pointer' : 'not-allowed',
                opacity: submitting ? 0.6 : 1
              }}>
              {submitting ? '...' : ratings.find(r=>r.teacher_id===user.id) ? '✏️ Yangilash' : '⭐ Baholash'}
            </button>
          </div>
          {success && (
            <div style={{
              marginTop:'0.5rem', padding:'0.5rem 0.75rem', borderRadius:'8px',
              background:'#d1fae5', color:'#065f46', fontSize:'0.82rem', fontWeight:600
            }}>{success}</div>
          )}
        </div>
      )}

      {/* Barcha baholar */}
      {!loading && ratings.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
          {ratings.map((r, i) => (
            <div key={i} style={{
              display:'flex', alignItems:'center', gap:'0.75rem',
              padding:'0.5rem 0.75rem', background:'#fff', borderRadius:'8px',
              border:'1px solid #f3e8ff'
            }}>
              <div style={{
                width:'28px', height:'28px', borderRadius:'50%',
                background:'linear-gradient(135deg,#7c3aed,#6366f1)', color:'#fff',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:'0.75rem', fontWeight:700
              }}>{r.score}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:'0.8rem', fontWeight:600, color:'#1e293b' }}>{r.teacher_name}</div>
                {r.comment && <div style={{ fontSize:'0.75rem', color:'#64748b' }}>{r.comment}</div>}
              </div>
              <div style={{ fontSize:'0.7rem', color:'#94a3b8' }}>
                {new Date(r.updated_at || r.created_at).toLocaleDateString('uz-UZ')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Detail Modal (o'qituvchi) ────────────────────────────────
const DetailModal = ({ item, onClose, onLike, canLike, user }) => {
  const [lightbox, setLightbox] = useState(false);
  const imageUrl = isImageUrl(item.file_url) ? (item.file_url.startsWith('http') ? item.file_url : `${API_BASE}${item.file_url}`) : null;
  const hasFile  = item.file_url && !imageUrl;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-large" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
            <span style={{ fontSize:'1.8rem' }}>{TYPE_ICONS[item.item_type]}</span>
            <div>
              <h2 style={{ margin:0 }}>{item.title}</h2>
              <p style={{ margin:'0.2rem 0 0', color:'var(--text-secondary)', fontSize:'0.82rem' }}>
                {TYPE_LABELS[item.item_type]} · {new Date(item.created_at).toLocaleDateString('uz-UZ')}
                {item.is_public && <span style={{ color:'#16a34a', marginLeft:'0.5rem' }}>🌐 Ommaviy</span>}
              </p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding:'1.5rem' }}>

          {/* Rasm to'liq ko'rinish */}
          {imageUrl && (
            <div style={{ marginBottom:'1.25rem', textAlign:'center' }}>
              <img src={imageUrl} alt={item.title}
                onClick={() => setLightbox(true)}
                style={{
                  maxWidth:'100%', maxHeight:'380px', objectFit:'contain',
                  borderRadius:'10px', cursor:'zoom-in',
                  border:'1px solid var(--border-color)'
                }} />
              <div style={{ fontSize:'0.72rem', color:'var(--text-secondary)', marginTop:'0.4rem' }}>
                🔍 Kattalashtirish uchun bosing
              </div>
            </div>
          )}
          {lightbox && <Lightbox src={imageUrl} alt={item.title} onClose={() => setLightbox(false)} />}

          {/* Tavsif */}
          {item.description && (
            <div style={{ marginBottom:'1rem' }}>
              <div style={{
                fontWeight:600, marginBottom:'0.4rem', fontSize:'0.82rem',
                color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.05em'
              }}>Tavsif</div>
              <p style={{ lineHeight:1.7, margin:0 }}>{item.description}</p>
            </div>
          )}

          {/* Fayl yuklab olish */}
          {hasFile && (
            <div style={{ marginBottom:'1rem' }}>
              <div style={{
                fontWeight:600, marginBottom:'0.6rem', fontSize:'0.82rem',
                color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.05em'
              }}>Yuklangan fayl</div>
              <a href={`${API_BASE}${item.file_url}`}
                target="_blank" rel="noopener noreferrer"
                download={item.file_name}
                style={{
                  display:'inline-flex', alignItems:'center', gap:'0.5rem',
                  background:'var(--primary-color)', color:'#fff',
                  padding:'0.5rem 1.25rem', borderRadius:'8px',
                  textDecoration:'none', fontWeight:600, fontSize:'0.9rem'
                }}>
                ⬇️ {item.file_name || 'Yuklab olish'}
              </a>
              {item.file_size && (
                <span style={{ marginLeft:'0.75rem', fontSize:'0.78rem', color:'var(--text-secondary)' }}>
                  ({item.file_size < 1024*1024
                    ? (item.file_size/1024).toFixed(0)+' KB'
                    : (item.file_size/1024/1024).toFixed(1)+' MB'})
                </span>
              )}
            </div>
          )}

          {/* Tashqi URL */}
          {item.file_url && !item.file_url.startsWith('/') && (
            <div style={{ marginBottom:'1rem' }}>
              <a href={item.file_url} target="_blank" rel="noopener noreferrer"
                className="btn btn-outline"
                style={{ display:'inline-flex', alignItems:'center', gap:'0.4rem' }}>
                🔗 Havolani ochish
              </a>
            </div>
          )}

          {/* Teglar */}
          {item.tags?.length > 0 && (
            <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap', marginTop:'0.75rem' }}>
              {item.tags.map((t,i) => (
                <span key={i} style={{
                  fontSize:'0.78rem', background:'rgba(99,102,241,0.1)',
                  color:'#6366f1', padding:'3px 10px', borderRadius:'20px'
                }}>#{t}</span>
              ))}
            </div>
          )}

          {/* Baholash bo'limi */}
          <RatingSection item={item} user={user} />
        </div>

        <div className="modal-actions">
          <LikeButton item={item} onLike={onLike} canLike={canLike} />
          <div style={{ flex:1 }} />
          <button className="btn btn-primary" onClick={onClose}>Yopish</button>
        </div>
      </div>
    </div>
  );
};

// ─── Main StudentPortfolio Page ────────────────────────────────
const StudentPortfolio = () => {
  const { userId }   = useParams();
  const navigate     = useNavigate();
  const { user }     = useAuth();

  const [student,      setStudent]      = useState(null);
  const [items,        setItems]        = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [stats,        setStats]        = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [filter,       setFilter]       = useState('all');
  const [viewItem,     setViewItem]     = useState(null);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [uRes, pRes, sRes] = await Promise.all([
        api.get(`/users/${userId}`),
        api.get(`/portfolio/${userId}`),
        api.get(`/statistics/user/${userId}`).catch(() => ({ data:{} }))
      ]);
      setStudent(uRes.data);
      setItems(Array.isArray(pRes.data.portfolio) ? pRes.data.portfolio : []);
      setAchievements(sRes.data?.achievements || []);
      setStats(sRes.data);
    } catch (err) {
      console.error(err);
      alert("Ma'lumotlarni yuklashda xatolik");
    } finally { setLoading(false); }
  };

  // useEffect
  useEffect(() => {
    if (user.role === 'student') { navigate('/portfolio'); return; }
    fetchAll();
  // eslint-disable-next-line
  }, [userId]);

  // Like bosish (optimistic update)
  const handleLike = async (itemId) => {
    try {
      const res = await api.post(`/portfolio/${itemId}/like`);
      setItems(prev => prev.map(it =>
        it.id === itemId
          ? { ...it, user_liked: res.data.liked, likes_count: res.data.likes_count }
          : it
      ));
      setViewItem(prev =>
        prev?.id === itemId
          ? { ...prev, user_liked: res.data.liked, likes_count: res.data.likes_count }
          : prev
      );
    } catch (err) {
      alert(err.response?.data?.error || "Like qo'yishda xatolik");
    }
  };

  if (loading) return <div className="loading-container"><div className="spinner"/><p>Yuklanmoqda...</p></div>;
  if (!student) return <div className="error-container"><h2>O'quvchi topilmadi</h2><Link to="/students" className="btn btn-primary">Orqaga</Link></div>;

  const levelLabel = (LEVEL_COLORS[student.level-1] || 'bronze').toUpperCase();
  const filtered   = filter === 'all' ? items : items.filter(i => i.item_type === filter);

  // Kategoriyalar soni
  const counts = items.reduce((acc, i) => { acc[i.item_type]=(acc[i.item_type]||0)+1; return acc; }, {});

  return (
    <div className="page-container">

      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <Link to="/students" className="btn btn-outline" style={{ marginBottom:'0.5rem', display:'inline-block' }}>
            ← Orqaga
          </Link>
          <h1>💼 {student.full_name || student.username}</h1>
          <p className="subtitle">@{student.username} · {student.class_name} sinf</p>
        </div>
      </div>

      {/* ── Statistika ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:'1rem', marginBottom:'2rem' }}>
        <div className="stat-card" style={{ background:'linear-gradient(135deg,#667eea,#764ba2)', color:'#fff' }}>
          <div className="stat-icon">🏅</div>
          <div className="stat-content">
            <h3 style={{ color:'#fff' }}>Daraja {student.level}</h3>
            <p style={{ color:'rgba(255,255,255,0.85)' }}>{levelLabel}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⭐</div>
          <div className="stat-content"><h3>{student.mastery_percent || 0}%</h3><p>O'zlashtirish</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <h3>{stats?.totalAttempts || 0}</h3><p>Testlar</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📈</div>
          <div className="stat-content">
            <h3>{stats?.averageScore ? `${stats.averageScore.toFixed(1)}%` : '0%'}</h3>
            <p>O'rtacha ball</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📁</div>
          <div className="stat-content"><h3>{items.length}</h3><p>Portfolio</p></div>
        </div>
      </div>

      {/* ── Yutuqlar ── */}
      {achievements.length > 0 && (
        <div className="section" style={{ marginBottom:'2rem' }}>
          <h2>🏆 Yutuqlar</h2>
          <div className="achievements-grid">
            {achievements.map(a => (
              <div key={a.id} className="achievement-card">
                <div className="achievement-icon-large">{a.icon||'🏆'}</div>
                <h3>{a.title}</h3>
                <p>{a.description}</p>
                <div className="achievement-date">{new Date(a.earned_at).toLocaleDateString('uz-UZ')}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Portfolio ── */}
      <div className="section">
        <h2>💼 Portfolio elementlari</h2>

        {/* Filter tabs */}
        <div style={{
          display:'flex', gap:'0.4rem', marginBottom:'1.5rem',
          borderBottom:'2px solid var(--border-color)', paddingBottom:0, overflowX:'auto'
        }}>
          {[
            { id:'all',         label:`Barchasi (${items.length})` },
            { id:'project',     label:`💻 Loyihalar (${counts.project||0})` },
            { id:'certificate', label:`🏆 Sertifikatlar (${counts.certificate||0})` },
            { id:'achievement', label:`⭐ Yutuqlar (${counts.achievement||0})` },
            { id:'test_result', label:`📊 Testlar (${counts.test_result||0})` },
          ].map(t => (
            <button key={t.id} onClick={() => setFilter(t.id)} style={{
              padding:'0.5rem 1rem', border:'none', cursor:'pointer', background:'transparent',
              borderBottom: filter===t.id ? '3px solid var(--primary-color)' : '3px solid transparent',
              color: filter===t.id ? 'var(--primary-color)' : 'var(--text-secondary)',
              fontWeight: filter===t.id ? 700 : 400,
              fontSize:'0.85rem', marginBottom:'-2px', transition:'all 0.2s', whiteSpace:'nowrap'
            }}>{t.label}</button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💼</div>
            <h3>{filter==='all' ? "Portfolio bo'sh" : "Bu kategoriyada elementlar yo'q"}</h3>
            <p>O'quvchi hali hech narsa qo'shmagan</p>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:'1.25rem' }}>
            {filtered.map(item => (
              <StudentPortfolioCard key={item.id} item={item} onView={setViewItem}
                onLike={handleLike}
                canLike={user.role !== 'student' && item.user_id !== user.id} />
            ))}
          </div>
        )}
      </div>

      {viewItem && <DetailModal item={viewItem} onClose={() => setViewItem(null)}
        onLike={handleLike}
        canLike={user.role !== 'student' && viewItem.user_id !== user.id}
        user={user} />}
    </div>
  );
};

export default StudentPortfolio;
