import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import '../assets/css/Forum.css';

const NewPost = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    category_id: '',
    title: '',
    content: '',
    tags: '',
    image_url: ''
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/forum/categories').then(res => {
      setCategories(Array.isArray(res.data) ? res.data : []);
    }).catch(() => {});
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Rasm 5MB dan katta bo\'lmasligi kerak');
      return;
    }

    try {
      setUploading(true);
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/portfolio/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setForm({ ...form, image_url: res.data.file_url });
      setPreview(res.data.file_url);
    } catch (err) {
      alert('Rasm yuklashda xatolik');
    } finally {
      setUploading(false);
    }
  };

  const insertCodeBlock = () => {
    const codeTemplate = '\n```python\n# Kodingizni shu yerga yozing\n\n```\n';
    setForm({ ...form, content: form.content + codeTemplate });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.category_id) {
      setError('Kategoriya tanlang');
      return;
    }
    if (form.title.length < 5) {
      setError('Sarlavha kamida 5 belgidan iborat bo\'lishi kerak');
      return;
    }
    if (form.content.length < 10) {
      setError('Matn kamida 10 belgidan iborat bo\'lishi kerak');
      return;
    }

    try {
      setLoading(true);
      const res = await api.post('/forum/posts', form);
      navigate(`/forum/post/${res.data.post.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Post yaratishda xatolik');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="new-post-container">
      <div className="new-post-header">
        <button className="back-link" onClick={() => navigate('/forum')}>← Forumga qaytish</button>
        <h1>✍️ Yangi mavzu ochish</h1>
        <p className="subtitle">Savol bering yoki fikringizni baham ko'ring (+1 ball)</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSubmit} className="new-post-form">
        {/* Kategoriya */}
        <div className="form-group">
          <label>📂 Kategoriya *</label>
          <div className="category-select-grid">
            {categories.map(cat => (
              <button
                type="button"
                key={cat.id}
                className={`cat-select-btn ${form.category_id == cat.id ? 'selected' : ''}`}
                onClick={() => setForm({ ...form, category_id: cat.id })}
              >
                <span className="cat-icon">{cat.icon}</span>
                <span className="cat-label">{cat.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Sarlavha */}
        <div className="form-group">
          <label>📝 Sarlavha *</label>
          <input
            type="text"
            name="title"
            value={form.title}
            onChange={handleChange}
            placeholder="Masalan: Python'da list va tuple farqi nima?"
            required
            minLength={5}
          />
        </div>

        {/* Content (Matn + Kod) */}
        <div className="form-group">
          <label>💬 Matn *</label>
          <div className="editor-toolbar">
            <button type="button" className="toolbar-btn" onClick={insertCodeBlock}
              title="Kod bloki qo'shish">
              {'</>'}  Kod
            </button>
            <button type="button" className="toolbar-btn"
              onClick={() => setForm({...form, content: form.content + '\n**qalin matn**'})}>
              <strong>B</strong>
            </button>
            <span className="toolbar-hint">
              Kod uchun: ``` va ``` orasiga yozing
            </span>
          </div>
          <textarea
            name="content"
            value={form.content}
            onChange={handleChange}
            placeholder={`Savolingizni batafsil yozing...

Kod yozish uchun:
\`\`\`python
print("Salom dunyo")
\`\`\`

Yoki oddiy matn yozing.`}
            rows={12}
            required
            minLength={10}
          />
          <span className="char-count">{form.content.length} belgi</span>
        </div>

        {/* Rasm yuklash */}
        <div className="form-group">
          <label>🖼️ Rasm (ixtiyoriy)</label>
          <div className="image-upload-area">
            <label className="upload-btn">
              {uploading ? '⏳ Yuklanmoqda...' : '📎 Rasm tanlash'}
              <input type="file" accept="image/*" onChange={handleImageUpload}
                style={{ display: 'none' }} disabled={uploading} />
            </label>
            {preview && (
              <div className="image-preview">
                <img src={preview} alt="preview" />
                <button type="button" className="remove-img"
                  onClick={() => { setPreview(null); setForm({...form, image_url: ''}); }}>✕</button>
              </div>
            )}
          </div>
        </div>

        {/* Teglar */}
        <div className="form-group">
          <label>🏷️ Teglar (vergul bilan ajrating)</label>
          <input
            type="text"
            name="tags"
            value={form.tags}
            onChange={handleChange}
            placeholder="python, algoritm, 10sinf, massiv"
          />
          {form.tags && (
            <div className="tags-preview">
              {form.tags.split(',').filter(t => t.trim()).map((t, i) => (
                <span key={i} className="tag">#{t.trim()}</span>
              ))}
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="form-actions-row">
          <button type="button" className="btn btn-outline" onClick={() => navigate('/forum')}>
            Bekor qilish
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? '⏳ Yaratilmoqda...' : '📤 Mavzu ochish (+1 ball)'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewPost;
