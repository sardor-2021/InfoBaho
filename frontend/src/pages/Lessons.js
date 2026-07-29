import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import '../assets/css/Pages.css';

const Lessons = () => {
  const { user } = useAuth();
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ grade: '', subject: '', search: '' });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newLesson, setNewLesson] = useState({
    title: '',
    description: '',
    grade: '',
    subject: '',
    content: ''
  });
  const [error, setError] = useState('');

  useEffect(() => {
    fetchLessons();
  }, [filter]);

  const fetchLessons = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filter.grade) params.grade = filter.grade;
      if (filter.subject) params.subject = filter.subject;
      if (filter.search) params.search = filter.search;

      const response = await api.get('/lessons', { params });
      setLessons(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching lessons:', error);
      setLessons([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLesson = async (e) => {
    e.preventDefault();
    setError('');

    if (!newLesson.title || !newLesson.grade || !newLesson.subject) {
      setError('Dars nomi, sinf va fan kiritilishi shart!');
      return;
    }

    try {
      await api.post('/lessons', newLesson);
      setShowCreateModal(false);
      setNewLesson({ title: '', description: '', grade: '', subject: '', content: '' });
      fetchLessons();
    } catch (error) {
      setError(error.response?.data?.error || 'Dars yaratishda xatolik yuz berdi');
    }
  };

  const handleDelete = async (lessonId) => {
    if (!window.confirm("Darsni o'chirishni tasdiqlaysizmi?")) {
      return;
    }

    try {
      await api.delete(`/lessons/${lessonId}`);
      fetchLessons();
    } catch (error) {
      alert(error.response?.data?.error || "Darsni o'chirishda xatolik yuz berdi");
    }
  };

  const filteredLessons = lessons;

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Yuklanmoqda...</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>📚 Darslar</h1>
          <p className="subtitle">
            {user.role === 'student' 
              ? "Sinfingiz uchun tayorlangan darslarni ko'ring"
              : "Darslarni boshqaring va materiallar qo'shing"}
          </p>
        </div>
        {(user.role === 'teacher' || user.role === 'admin') && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
              ➕ Yangi dars
            </button>
            {user.role === 'admin' && (
              <button
                onClick={async () => {
                  if (!window.confirm("⚠️ DIQQAT! Yangi o'quv yilini boshlaysizmi?\n\nBu barcha darslarni 'o'tilmagan' holatiga qaytaradi va o'quvchilar darajasini 1 ga tushiradi.\n\nDars mazmuni, testlar, topshiriqlar SAQLANIB QOLADI.\n\nBu amalni qaytarib bo'lmaydi!")) return;
                  try {
                    await api.post('/lessons/reset-year');
                    alert("✅ Yangi o'quv yili boshlandi! Barcha darslar va darajalar tozalandi.");
                    window.location.reload();
                  } catch (err) {
                    alert('Xatolik: ' + (err.response?.data?.error || err.message));
                  }
                }}
                className="btn btn-outline"
                style={{ borderColor: 'rgba(239,68,68,0.4)', color: '#dc2626' }}
              >
                🔄 Yangi o'quv yili
              </button>
            )}
          </div>
        )}
      </div>

      <div className="filters-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="Darslarni qidirish..."
            value={filter.search}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
            className="search-input"
          />
        </div>

        {user.role !== 'student' && (
          <div className="filter-tabs">
            <button
              className={`filter-tab ${filter.grade === '' ? 'active' : ''}`}
              onClick={() => setFilter({ ...filter, grade: '' })}
            >
              Barchasi
            </button>
            <button
              className={`filter-tab ${filter.grade === '9' ? 'active' : ''}`}
              onClick={() => setFilter({ ...filter, grade: '9' })}
            >
              9-sinf
            </button>
            <button
              className={`filter-tab ${filter.grade === '10' ? 'active' : ''}`}
              onClick={() => setFilter({ ...filter, grade: '10' })}
            >
              10-sinf
            </button>
          </div>
        )}
      </div>

      {filteredLessons.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📚</div>
          <h3>Darslar topilmadi</h3>
          <p>
            {filter.search 
              ? "Qidiruv bo'yicha natijalar topilmadi" 
              : user.role === 'student'
                ? "Hozircha hech qanday dars yaratilmagan"
                : "Hozircha hech qanday dars yaratilmagan"}
          </p>
        </div>
      ) : (
        <div className="tests-grid">
          {filteredLessons.map((lesson, index) => (
            <div key={lesson.id} className="test-card lesson-card">
              <div className="test-card-header">
                <h3><span style={{ color: 'var(--primary-light)', marginRight: '0.5rem', fontWeight: 800 }}>{index + 1}.</span>{lesson.title}</h3>
                <span className="badge badge-success">
                  {lesson.grade}-sinf
                </span>
              </div>

              <p className="test-description">{lesson.description || "Ta'rif kiritilmagan"}</p>

              <div className="test-meta">
                <div className="meta-item">
                  <span className="meta-icon">📖</span>
                  <span>{lesson.subject}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-icon">📎</span>
                  <span>{lesson.materials_count || 0} material</span>
                </div>
                <div className="meta-item">
                  <span className="meta-icon">📝</span>
                  <span>{lesson.tests_count || 0} test</span>
                </div>
              </div>

              {lesson.creator_name && (
                <div className="lesson-creator">
                  <span className="meta-icon">👤</span>
                  <span>{lesson.creator_name}</span>
                </div>
              )}

              <div className="test-actions">
                <Link to={`/lessons/${lesson.id}`} className="btn btn-primary">
                  Ko'rish
                </Link>
                {(user.role === 'teacher' || user.role === 'admin') && lesson.created_by === user.id && (
                  <>
                    <Link to={`/lessons/${lesson.id}/edit`} className="btn btn-outline">
                      Tahrirlash
                    </Link>
                    <button
                      onClick={() => handleDelete(lesson.id)}
                      className="btn btn-danger"
                    >
                      O'chirish
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}

          {/* O'quvchi uchun: keyingi dars hali ochilmagan */}
          {user.role === 'student' && filteredLessons.length > 0 && (
            <div className="test-card lesson-card" style={{
              opacity: 0.5, cursor: 'not-allowed',
              background: 'var(--bg-secondary)',
              border: '2px dashed var(--border-color)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              padding: '2rem', textAlign: 'center', minHeight: '180px'
            }}>
              <span style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🔒</span>
              <h3 style={{ margin: '0 0 0.5rem', color: 'var(--text-secondary)' }}>Keyingi dars hali ochilmagan</h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                O'qituvchingiz joriy darsni yakunlagach ochiladi
              </p>
            </div>
          )}
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Yangi dars yaratish</h2>
              <button className="close-btn" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>
            {error && (
              <div className="alert alert-error">
                {error}
              </div>
            )}
            <form onSubmit={handleCreateLesson} className="modal-form">
              <div className="form-group">
                <label htmlFor="title">Dars nomi *</label>
                <input
                  type="text"
                  id="title"
                  value={newLesson.title}
                  onChange={(e) => setNewLesson({...newLesson, title: e.target.value})}
                  placeholder="Masalan: Python asoslari"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">Tavsif</label>
                <textarea
                  id="description"
                  value={newLesson.description}
                  onChange={(e) => setNewLesson({...newLesson, description: e.target.value})}
                  placeholder="Dars haqida qisqacha ma'lumot..."
                  rows="3"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="grade">Sinf *</label>
                  <select
                    id="grade"
                    value={newLesson.grade}
                    onChange={(e) => setNewLesson({...newLesson, grade: e.target.value})}
                    required
                  >
                    <option value="">Sinfni tanlang</option>
                    <option value="9">9-sinf</option>
                    <option value="10">10-sinf</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="subject">Fan *</label>
                  <input
                    type="text"
                    id="subject"
                    value={newLesson.subject}
                    onChange={(e) => setNewLesson({...newLesson, subject: e.target.value})}
                    placeholder="Informatika"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="content">Dars tarkibi</label>
                <textarea
                  id="content"
                  value={newLesson.content}
                  onChange={(e) => setNewLesson({...newLesson, content: e.target.value})}
                  placeholder="Dars mavzulari, maqsadlari va boshqa ma'lumotlar..."
                  rows="5"
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowCreateModal(false)}>
                  Bekor qilish
                </button>
                <button type="submit" className="btn btn-primary">
                  Yaratish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Lessons;
