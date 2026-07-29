import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import '../assets/css/Pages.css';

const API_BASE = (process.env.REACT_APP_API_URL || '').replace('/api', '');

// ─── Helpers ─────────────────────────────────────────────────
const TYPE_LABELS = { project:'Loyiha', certificate:'Sertifikat', achievement:'Yutuq', test_result:'Test natijasi' };
const TYPE_ICONS  = { project:'💻', certificate:'🏆', achievement:'⭐', test_result:'📊' };
const LEVEL_COLORS = ['bronze','silver','gold','platinum','diamond'];
const IMG_EXTS = ['jpg','jpeg','png','gif','webp'];

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
      width:'40px', height:'40px', borderRadius:'50%', fontSize:'1.1rem',
      cursor:'pointer'
    }}>✕</button>
  </div>
);

// ─── PortfolioCard ─────────────────────────────────────────────
const PortfolioCard = ({ item, onView, onDelete, onTogglePublic }) => {
  const [lightbox, setLightbox] = useState(false);
  const imageUrl = isImageUrl(item.file_url) ? (item.file_url.startsWith('http') ? item.file_url : `${API_BASE}${item.file_url}`) : null;

  return (
    <div style={{
      background:'var(--card-bg)', borderRadius:'14px', border:'1px solid var(--border-color)',
      overflow:'hidden', transition:'box-shadow 0.2s', cursor:'pointer'
    }}
      onMouseEnter={e=>e.currentTarget.style.boxShadow='0 6px 24px rgba(0,0,0,0.1)'}
      onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}
      onClick={()=>onView(item)}>

      {/* Rasm miniaturasi — 16:9 */}
      {imageUrl && (
        <div style={{ position:'relative', paddingTop:'56.25%', overflow:'hidden', background:'var(--bg-secondary)' }}>
          <img src={imageUrl} alt={item.title}
            style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover' }} />
          <button onClick={e=>{e.stopPropagation(); setLightbox(true);}}
            style={{ position:'absolute', bottom:'0.5rem', right:'0.5rem',
              background:'rgba(0,0,0,0.6)', color:'#fff', border:'none',
              borderRadius:'6px', padding:'0.25rem 0.6rem', fontSize:'0.72rem', cursor:'pointer' }}>
            🔍 Kattalashtirish
          </button>
        </div>
      )}
      {lightbox && <Lightbox src={imageUrl} alt={item.title} onClose={()=>setLightbox(false)} />}

      <div style={{ padding:'1rem' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'0.5rem' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', flex:1, minWidth:0 }}>
            <span style={{ fontSize:'1.2rem', flexShrink:0 }}>{TYPE_ICONS[item.item_type]||'📌'}</span>
            <div style={{ minWidth:0 }}>
              <div style={{ fontWeight:700, fontSize:'0.9rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.title}</div>
              <div style={{ fontSize:'0.7rem', color:'var(--text-secondary)', marginTop:'1px' }}>
                {TYPE_LABELS[item.item_type]} · {new Date(item.created_at).toLocaleDateString('uz-UZ')}
              </div>
            </div>
          </div>
          <div style={{ display:'flex', gap:'0.25rem', flexShrink:0 }}>
            <button onClick={e=>{e.stopPropagation(); onTogglePublic(item);}}
              title={item.is_public?'Yashirish':"Ommaga ko'rsatish"}
              style={{ background:'none', border:'none', cursor:'pointer', fontSize:'0.9rem', opacity:item.is_public?1:0.35 }}>
              {item.is_public?'🌐':'🔒'}
            </button>
            <button onClick={e=>{e.stopPropagation(); onDelete(item.id);}}
              style={{ background:'none', border:'none', cursor:'pointer', fontSize:'0.85rem', color:'#dc2626' }}>
              🗑️
            </button>
          </div>
        </div>

        {item.description && (
          <p style={{ fontSize:'0.8rem', color:'var(--text-secondary)', margin:'0 0 0.6rem', lineHeight:1.5,
                      display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
            {item.description}
          </p>
        )}

        {item.file_url && !imageUrl && item.file_url.startsWith('/') && (
          <a href={`${API_BASE}${item.file_url}`} target="_blank" rel="noopener noreferrer"
            onClick={e=>e.stopPropagation()}
            style={{ fontSize:'0.78rem', color:'var(--primary-color)', textDecoration:'none',
                     display:'inline-flex', alignItems:'center', gap:'0.3rem' }}>
            {fileIcon(item.file_type)} {item.file_name||'Fayl yuklab olish'}
          </a>
        )}
        {item.file_url && !imageUrl && item.file_url.startsWith('http') && !item.file_url.includes('storage.googleapis.com') && (
          <a href={item.file_url} target="_blank" rel="noopener noreferrer"
            onClick={e=>e.stopPropagation()}
            style={{ fontSize:'0.78rem', color:'var(--primary-color)', textDecoration:'none',
                     display:'inline-flex', alignItems:'center', gap:'0.3rem' }}>
            🔗 Havolani ochish
          </a>
        )}
        {item.file_url && !imageUrl && item.file_url.includes('storage.googleapis.com') && (
          <a href={item.file_url} target="_blank" rel="noopener noreferrer"
            onClick={e=>e.stopPropagation()}
            style={{ fontSize:'0.78rem', color:'var(--primary-color)', textDecoration:'none',
                     display:'inline-flex', alignItems:'center', gap:'0.3rem' }}>
            {fileIcon(item.file_type)} {item.file_name||'Fayl yuklab olish'}
          </a>
        )}

        {/* Teglar */}
        {item.tags?.length > 0 && (
          <div style={{ display:'flex', gap:'0.3rem', flexWrap:'wrap', marginTop:'0.5rem' }}>
            {item.tags.slice(0,4).map((t,i)=>(
              <span key={i} style={{ fontSize:'0.68rem', background:'rgba(99,102,241,0.1)',
                color:'#6366f1', padding:'2px 8px', borderRadius:'20px' }}>#{t}</span>
            ))}
          </div>
        )}

        {/* Like soni va baho (o'z ishida faqat ko'rsatish) */}
        <div style={{ marginTop:'0.6rem', paddingTop:'0.5rem',
                      borderTop:'1px solid var(--border-color)',
                      display:'flex', alignItems:'center', justifyContent:'space-between',
                      fontSize:'0.78rem' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
            {item.likes_count > 0 && (
              <span style={{ color:'#f43f5e', display:'flex', alignItems:'center', gap:'0.2rem' }}>
                ❤️ <strong>{item.likes_count}</strong>
              </span>
            )}
          </div>
          {item.avg_rating > 0 && (
            <span style={{
              background:'linear-gradient(135deg,#faf5ff,#eef2ff)',
              border:'1px solid #e9d5ff', padding:'0.2rem 0.6rem',
              borderRadius:'12px', fontSize:'0.75rem', fontWeight:700, color:'#7c3aed'
            }}>
              ⭐ {item.avg_rating}/10
              {item.ratings_count > 0 && <span style={{ fontWeight:400, color:'#a78bfa' }}> ({item.ratings_count})</span>}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};


// ─── Detail Modal ──────────────────────────────────────────────
const DetailModal = ({ item, onClose, onDelete, onEdit }) => {
  const [lightbox, setLightbox] = useState(false);
  const imageUrl = isImageUrl(item.file_url) ? (item.file_url.startsWith('http') ? item.file_url : `${API_BASE}${item.file_url}`) : null;
  const hasFile  = item.file_url && !imageUrl;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-large" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
            <span style={{ fontSize:'1.8rem' }}>{TYPE_ICONS[item.item_type]}</span>
            <div>
              <h2 style={{ margin:0 }}>{item.title}</h2>
              <p style={{ margin:'0.2rem 0 0', color:'var(--text-secondary)', fontSize:'0.82rem' }}>
                {TYPE_LABELS[item.item_type]} · {new Date(item.created_at).toLocaleDateString('uz-UZ')}
                {item.is_public && <span style={{color:'#16a34a',marginLeft:'0.5rem'}}>🌐 Ommaviy</span>}
              </p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding:'1.5rem' }}>
          {imageUrl && (
            <div style={{ marginBottom:'1.25rem', textAlign:'center' }}>
              <img src={imageUrl} alt={item.title} onClick={()=>setLightbox(true)}
                style={{ maxWidth:'100%', maxHeight:'380px', objectFit:'contain',
                         borderRadius:'10px', cursor:'zoom-in', border:'1px solid var(--border-color)' }} />
              <div style={{ fontSize:'0.72rem', color:'var(--text-secondary)', marginTop:'0.4rem' }}>
                🔍 Kattalashtirish uchun bosing
              </div>
            </div>
          )}
          {lightbox && <Lightbox src={imageUrl} alt={item.title} onClose={()=>setLightbox(false)} />}

          {item.description && <p style={{ lineHeight:1.7, marginBottom:'1rem' }}>{item.description}</p>}

          {hasFile && !imageUrl && (
            <div style={{ marginBottom:'1rem' }}>
              <a href={`${API_BASE}${item.file_url}`} target="_blank" rel="noopener noreferrer"
                className="btn btn-outline" style={{ display:'inline-flex', alignItems:'center', gap:'0.4rem' }}>
                {fileIcon(item.file_type)} {item.file_name||'Yuklab olish'}
              </a>
            </div>
          )}
          {item.file_url && !item.file_url.startsWith('/') && (
            <div style={{ marginBottom:'1rem' }}>
              <a href={item.file_url} target="_blank" rel="noopener noreferrer"
                className="btn btn-outline" style={{ display:'inline-flex', alignItems:'center', gap:'0.4rem' }}>
                🔗 Havolani ochish
              </a>
            </div>
          )}
          {item.tags?.length > 0 && (
            <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap' }}>
              {item.tags.map((t,i)=>(
                <span key={i} style={{ fontSize:'0.78rem', background:'rgba(99,102,241,0.1)',
                  color:'#6366f1', padding:'3px 10px', borderRadius:'20px' }}>#{t}</span>
              ))}
            </div>
          )}
          {item.likes_count > 0 && (
            <div style={{ marginTop:'1rem', fontSize:'0.85rem', color:'#f43f5e', display:'flex', alignItems:'center', gap:'0.4rem' }}>
              ❤️ <strong>{item.likes_count}</strong> kishi yoqtirdi
            </div>
          )}

          {/* O'qituvchi baholari */}
          {item.avg_rating > 0 && (
            <div style={{
              marginTop:'1rem', padding:'1rem', borderRadius:'10px',
              background:'linear-gradient(135deg,#faf5ff,#eef2ff)',
              border:'1px solid #e9d5ff'
            }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.5rem' }}>
                <h4 style={{ margin:0, fontSize:'0.9rem', color:'#581c87' }}>⭐ O'qituvchi bahosi</h4>
                <span style={{
                  background:'linear-gradient(135deg,#f59e0b,#d97706)', color:'#fff',
                  padding:'0.25rem 0.65rem', borderRadius:'20px', fontSize:'0.85rem', fontWeight:700
                }}>{item.avg_rating}/10</span>
              </div>
              {item.ratings_count > 0 && (
                <p style={{ margin:0, fontSize:'0.8rem', color:'#7c3aed' }}>
                  {item.ratings_count} ta o'qituvchi baholagan
                </p>
              )}
            </div>
          )}
        </div>
        <div className="modal-actions">
          <button className="btn btn-danger" onClick={()=>{onClose();onDelete(item.id);}}>🗑️ O'chirish</button>
          <div style={{flex:1}}/>
          <button className="btn btn-outline" onClick={()=>onEdit(item)}>✏️ Tahrirlash</button>
          <button className="btn btn-primary" onClick={onClose}>Yopish</button>
        </div>
      </div>
    </div>
  );
};


// ─── Add / Edit Form ───────────────────────────────────────────
const PortfolioForm = ({ initial, onSave, onClose }) => {
  const [form, setForm] = useState(initial || {
    title:'', description:'', item_type:'project',
    file_url:'', file_name:'', file_type:'', tags:'', is_public:false
  });
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(
    initial?.file_url && isImageUrl(initial.file_url)
      ? `${API_BASE}${initial.file_url}` : null
  );
  const [fileName, setFileName] = useState(initial?.file_name||'');

  const handleFileChange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 10*1024*1024) { alert('Fayl 10MB dan oshmasligi kerak'); return; }
    const fd = new FormData(); fd.append('file', file);
    try {
      setUploading(true);
      const res = await api.post('/portfolio/upload', fd, { headers:{'Content-Type':'multipart/form-data'} });
      setForm(f=>({...f, file_url:res.data.file_url, file_name:res.data.file_name, file_type:res.data.file_type}));
      setFileName(res.data.file_name);
      setPreview(res.data.is_image ? `${API_BASE}${res.data.file_url}` : null);
    } catch (err) { alert('Fayl yuklashda xatolik: '+(err.response?.data?.error||err.message)); }
    finally { setUploading(false); }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) { alert('Sarlavha kiritilishi shart'); return; }
    const tags = form.tags
      ? (Array.isArray(form.tags) ? form.tags : form.tags.split(',').map(t=>t.trim()).filter(Boolean))
      : [];
    onSave({...form, tags});
  };

  const tagsStr = Array.isArray(form.tags) ? form.tags.join(', ') : (form.tags||'');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-large" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <h2>{initial?'✏️ Tahrirlash':'➕ Yangi element'}</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row">
            <div className="form-group">
              <label>Kategoriya *</label>
              <select value={form.item_type} onChange={e=>setForm({...form,item_type:e.target.value})}>
                <option value="project">💻 Loyiha</option>
                <option value="certificate">🏆 Sertifikat</option>
                <option value="achievement">⭐ Yutuq</option>
                <option value="test_result">📊 Test natijasi</option>
              </select>
            </div>
            <div className="form-group" style={{display:'flex',alignItems:'flex-end'}}>
              <label style={{display:'flex',alignItems:'center',gap:'0.5rem',cursor:'pointer',paddingBottom:'0.6rem'}}>
                <input type="checkbox" checked={!!form.is_public}
                  onChange={e=>setForm({...form,is_public:e.target.checked})} />
                🌐 Ommaviy ko'rsatish
              </label>
            </div>
          </div>
          <div className="form-group">
            <label>Sarlavha *</label>
            <input type="text" required value={form.title}
              onChange={e=>setForm({...form,title:e.target.value})}
              placeholder="Masalan: Python loyiham, IELTS sertifikati..." />
          </div>
          <div className="form-group">
            <label>Tavsif</label>
            <textarea rows="3" value={form.description}
              onChange={e=>setForm({...form,description:e.target.value})}
              placeholder="Loyiha yoki yutuq haqida qisqacha..." />
          </div>
          {/* Fayl yuklash */}
          <div className="form-group">
            <label>📎 Fayl yuklash <small style={{color:'var(--text-secondary)'}}>(rasm, PDF, .docx, .zip — max 10MB)</small></label>
            <div style={{display:'flex',gap:'0.75rem',alignItems:'center',flexWrap:'wrap'}}>
              <label className="btn btn-outline" style={{cursor:'pointer'}}>
                {uploading?'⏳ Yuklanmoqda...':'📂 Fayl tanlash'}
                <input type="file" style={{display:'none'}} disabled={uploading}
                  accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.zip,.txt"
                  onChange={handleFileChange} />
              </label>
              {fileName && <span style={{fontSize:'0.82rem',color:'#16a34a'}}>✅ {fileName}</span>}
            </div>
            {preview && (
              <div style={{marginTop:'0.75rem',position:'relative',display:'inline-block'}}>
                <img src={preview} alt="preview"
                  style={{maxWidth:'220px',maxHeight:'160px',borderRadius:'8px',
                          objectFit:'cover',border:'1px solid var(--border-color)'}} />
                <button type="button"
                  onClick={()=>{setPreview(null);setFileName('');setForm(f=>({...f,file_url:'',file_name:'',file_type:''}));}}
                  style={{position:'absolute',top:'-8px',right:'-8px',background:'#dc2626',
                          color:'#fff',border:'none',borderRadius:'50%',width:'22px',height:'22px',
                          cursor:'pointer',fontSize:'0.75rem'}}>✕</button>
              </div>
            )}
          </div>
          <div className="form-group">
            <label>🔗 Tashqi havola (ixtiyoriy)</label>
            <input type="url"
              value={(form.file_url&&!form.file_url.startsWith('/'))?form.file_url:''}
              onChange={e=>setForm({...form,file_url:e.target.value})}
              placeholder="https://github.com/..." />
          </div>
          <div className="form-group">
            <label>🏷️ Teglar <small style={{color:'var(--text-secondary)'}}>(vergul bilan)</small></label>
            <input type="text" value={tagsStr}
              onChange={e=>setForm({...form,tags:e.target.value})}
              placeholder="python, web, olimpiada, ielts" />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>Bekor qilish</button>
            <button type="submit" className="btn btn-primary" disabled={uploading}>💾 Saqlash</button>
          </div>
        </form>
      </div>
    </div>
  );
};


// ─── Main Portfolio Page ───────────────────────────────────────
const Portfolio = () => {
  const { user } = useAuth();
  const [items,        setItems]        = useState([]);
  const [stats,        setStats]        = useState(null);
  const [achievements, setAchievements] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [filter,       setFilter]       = useState('all');
  const [showForm,     setShowForm]     = useState(false);
  const [editItem,     setEditItem]     = useState(null);
  const [viewItem,     setViewItem]     = useState(null);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [pRes, sRes] = await Promise.all([
        api.get('/portfolio'),
        api.get(`/statistics/user/${user.id}`).catch(()=>({data:{}}))
      ]);
      setItems(Array.isArray(pRes.data) ? pRes.data : []);
      setStats(sRes.data);
      setAchievements(sRes.data?.achievements || []);
    } catch(err) { console.error(err); setItems([]); }
    finally { setLoading(false); }
  };

  const handleSave = async (form) => {
    try {
      if (editItem) await api.put(`/portfolio/${editItem.id}`, form);
      else await api.post('/portfolio', form);
      setShowForm(false); setEditItem(null); fetchAll();
    } catch(err) { alert('Xatolik: '+(err.response?.data?.error||err.message)); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Bu elementni o'chirishni tasdiqlaysizmi?")) return;
    try { await api.delete(`/portfolio/${id}`); fetchAll(); }
    catch(err) { alert(err.response?.data?.error||"O'chirishda xatolik"); }
  };

  const handleTogglePublic = async (item) => {
    try { await api.put(`/portfolio/${item.id}`, {is_public:!item.is_public}); fetchAll(); }
    catch(err) { alert(err.message); }
  };

  const openEdit = (item) => { setViewItem(null); setEditItem(item); setShowForm(true); };

  const levelLabel = (LEVEL_COLORS[user.level-1]||'bronze').toUpperCase();
  const filtered = filter==='all' ? items : items.filter(i=>i.item_type===filter);

  if (loading) return <div className="loading-container"><div className="spinner"/><p>Yuklanmoqda...</p></div>;

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>💼 Mening Portfoliom</h1>
          <p className="subtitle">Yutuqlarim, sertifikatlarim va ishlarim</p>
        </div>
        <button onClick={()=>{setEditItem(null);setShowForm(true);}} className="btn btn-primary">
          ➕ Element qo'shish
        </button>
      </div>

      {/* Statistika */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:'1rem',marginBottom:'2rem'}}>
        {[
          {icon:'🏅', val:`Daraja ${user.level}`, label:levelLabel, gradient:'linear-gradient(135deg,#667eea,#764ba2)', white:true},
          {icon:'📊', val:`${user.mastery_percent || 0}%`, label:'O\'zlashtirish'},
          {icon:'📁', val:items.length,           label:'Portfolio elementlari'},
          {icon:'📊', val:stats?.totalAttempts||0, label:'Topshirilgan testlar'},
        ].map((s,i)=>(
          <div key={i} className="stat-card" style={s.gradient?{background:s.gradient,color:'#fff'}:{}}>
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-content">
              <h3 style={s.white?{color:'#fff'}:{}}>{s.val}</h3>
              <p style={s.white?{color:'rgba(255,255,255,0.85)'}:{}}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Yutuqlar */}
      {achievements.length > 0 && (
        <div className="section" style={{marginBottom:'2rem'}}>
          <h2>🏆 Yutuqlar</h2>
          <div className="achievements-grid">
            {achievements.map(a=>(
              <div key={a.id} className="achievement-card">
                <div className="achievement-icon-large">{a.icon||'🏆'}</div>
                <h3>{a.title}</h3><p>{a.description}</p>
                <div className="achievement-date">{new Date(a.earned_at).toLocaleDateString('uz-UZ')}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div style={{display:'flex',gap:'0.4rem',marginBottom:'1.5rem',borderBottom:'2px solid var(--border-color)',paddingBottom:0,overflowX:'auto'}}>
        {[
          {id:'all',        label:`Barchasi (${items.length})`},
          {id:'project',    label:'💻 Loyihalar'},
          {id:'certificate',label:'🏆 Sertifikatlar'},
          {id:'achievement',label:'⭐ Yutuqlar'},
          {id:'test_result',label:'📊 Testlar'},
        ].map(t=>(
          <button key={t.id} onClick={()=>setFilter(t.id)} style={{
            padding:'0.5rem 1rem', border:'none', cursor:'pointer', background:'transparent',
            borderBottom: filter===t.id?'3px solid var(--primary-color)':'3px solid transparent',
            color: filter===t.id?'var(--primary-color)':'var(--text-secondary)',
            fontWeight: filter===t.id?700:400, fontSize:'0.85rem',
            marginBottom:'-2px', transition:'all 0.2s', whiteSpace:'nowrap'
          }}>{t.label}</button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length===0 ? (
        <div className="empty-state">
          <div className="empty-icon">💼</div>
          <h3>{filter==='all'?"Portfolio bo'sh":"Bu kategoriyada elementlar yo'q"}</h3>
          <p>Sertifikat, loyiha, yutuqlaringizni qo'shing!</p>
          <button onClick={()=>{setEditItem(null);setShowForm(true);}} className="btn btn-primary" style={{marginTop:'1rem'}}>
            ➕ Birinchisini qo'shish
          </button>
        </div>
      ) : (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:'1.25rem'}}>
          {filtered.map(item=>(
            <PortfolioCard key={item.id} item={item}
              onView={setViewItem} onDelete={handleDelete} onTogglePublic={handleTogglePublic} />
          ))}
        </div>
      )}

      {showForm && <PortfolioForm initial={editItem} onSave={handleSave} onClose={()=>{setShowForm(false);setEditItem(null);}} />}
      {viewItem && <DetailModal item={viewItem} onClose={()=>setViewItem(null)} onDelete={handleDelete} onEdit={openEdit} />}
    </div>
  );
};

export default Portfolio;
