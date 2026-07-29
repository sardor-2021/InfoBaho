import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import '../assets/css/Pages.css';

const Tests = () => {
  const { user } = useAuth();
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTest, setNewTest] = useState({
    title: '',
    description: '',
    subject: '',
    duration: 30,
    difficulty: 'medium',
    passing_score: 60
  });

  useEffect(() => {
    fetchTests();
  }, [filter]);

  const fetchTests = async () => {
    try {
      setLoading(true);
      const response = await api.get('/tests');
      let filteredTests = Array.isArray(response.data) ? response.data : [];

      if (user.role === 'student') {
        filteredTests = filteredTests.filter(test => test.is_published);
      } else if (filter === 'published') {
        filteredTests = filteredTests.filter(test => test.is_published);
      } else if (filter === 'draft') {
        filteredTests = filteredTests.filter(test => !test.is_published);
      }

      setTests(filteredTests);
    } catch (error) {
      console.error('Error fetching tests:', error);
      setTests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (testId) => {
    if (!window.confirm("Testni o'chirishni tasdiqlaysizmi?")) {
      return;
    }

    try {
      await api.delete(`/tests/${testId}`);
      fetchTests();
    } catch (error) {
      alert("Testni o'chirishda xatolik yuz berdi");
    }
  };

  const handlePublish = async (testId, currentStatus) => {
    try {
      if (currentStatus) {
        await api.put(`/tests/${testId}/unpublish`);
      } else {
        await api.put(`/tests/${testId}/publish`);
      }
      fetchTests();
    } catch (error) {
      alert("Testni nashr qilishda xatolik yuz berdi");
    }
  };

  const handleCreateTest = async (e) => {
    e.preventDefault();
    
    try {
      await api.post('/tests', newTest);
      alert('Test muvaffaqiyatli yaratildi!');
      setShowCreateModal(false);
      setNewTest({
        title: '',
        description: '',
        subject: '',
        duration: 30,
        difficulty: 'medium',
        passing_score: 60
      });
      fetchTests();
    } catch (error) {
      alert("Test yaratishda xatolik: " + (error.response?.data?.error || error.message));
    }
  };

  const filteredTests = tests.filter(test =>
    test.title.toLowerCase().includes(search.toLowerCase()) ||
    test.description?.toLowerCase().includes(search.toLowerCase())
  );

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
          <h1>Testlar</h1>
          <p className="subtitle">
            {user.role === 'student' 
              ? "Mavjud testlarni toping va topshiring" 
              : "Testlarni boshqaring va yangilarini yarating"}
          </p>
        </div>
        {(user.role === 'teacher' || user.role === 'admin') && (
          <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
            ➕ Yangi test
          </button>
        )}
      </div>

      <div className="filters-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="Testlarni qidirish..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
        </div>

        {user.role !== 'student' && (
          <div className="filter-tabs">
            <button
              className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              Barchasi ({tests.length})
            </button>
            <button
              className={`filter-tab ${filter === 'published' ? 'active' : ''}`}
              onClick={() => setFilter('published')}
            >
              Nashr qilingan ({tests.filter(t => t.is_published).length})
            </button>
            <button
              className={`filter-tab ${filter === 'draft' ? 'active' : ''}`}
              onClick={() => setFilter('draft')}
            >
              Qoralama ({tests.filter(t => !t.is_published).length})
            </button>
          </div>
        )}
      </div>

      {filteredTests.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📝</div>
          <h3>Testlar topilmadi</h3>
          <p>
            {search 
              ? "Qidiruv bo'yicha natijalar topilmadi" 
              : user.role === 'student'
                ? "Hozircha hech qanday test nashr qilinmagan"
                : "Hozircha hech qanday test yaratilmagan"}
          </p>
        </div>
      ) : (
        <div className="tests-grid">
          {filteredTests.map((test) => (
            <div key={test.id} className="test-card">
              <div className="test-card-header">
                <h3>{test.title}</h3>
                <span className={`badge ${test.is_published ? 'badge-success' : 'badge-secondary'}`}>
                  {test.is_published ? 'Nashr qilingan' : 'Qoralama'}
                </span>
              </div>

              <p className="test-description">{test.description || "Ta'rif kiritilmagan"}</p>

              <div className="test-meta">
                <div className="meta-item">
                  <span className="meta-icon">❓</span>
                  <span>{test.questions_count || 0} savol</span>
                </div>
                <div className="meta-item">
                  <span className="meta-icon">⏱️</span>
                  <span>{test.time_limit} daqiqa</span>
                </div>
                <div className="meta-item">
                  <span className="meta-icon">📊</span>
                  <span>{test.attempts_count || 0} ta urinish</span>
                </div>
              </div>

              {test.passing_score && (
                <div className="passing-score">
                  O'tish bali: <strong>{test.passing_score}%</strong>
                </div>
              )}

              <div className="test-actions">
                {user.role === 'student' ? (
                  <Link to={`/tests/${test.id}`} className="btn btn-primary btn-block">
                    Testni boshlash
                  </Link>
                ) : (
                  <>
                    <Link to={`/tests/${test.id}`} className="btn btn-outline">
                      Ko'rish
                    </Link>
                    <button
                      onClick={() => handlePublish(test.id, test.is_published)}
                      className={`btn ${test.is_published ? 'btn-warning' : 'btn-success'}`}
                    >
                      {test.is_published ? 'Yashirish' : 'Nashr qilish'}
                    </button>
                    <button
                      onClick={() => handleDelete(test.id)}
                      className="btn btn-danger"
                    >
                      O'chirish
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Yangi test yaratish</h2>
              <button className="close-btn" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateTest} className="modal-form">
              <div className="form-group">
                <label htmlFor="title">Test nomi *</label>
                <input
                  type="text"
                  id="title"
                  value={newTest.title}
                  onChange={(e) => setNewTest({...newTest, title: e.target.value})}
                  placeholder="Masalan: Python dasturlash asoslari"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">Tavsif</label>
                <textarea
                  id="description"
                  value={newTest.description}
                  onChange={(e) => setNewTest({...newTest, description: e.target.value})}
                  placeholder="Test haqida qisqacha ma'lumot..."
                  rows="3"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="subject">Fan *</label>
                  <input
                    type="text"
                    id="subject"
                    value={newTest.subject}
                    onChange={(e) => setNewTest({...newTest, subject: e.target.value})}
                    placeholder="Informatika"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="duration">Vaqt (daqiqa) *</label>
                  <input
                    type="number"
                    id="duration"
                    value={newTest.duration}
                    onChange={(e) => setNewTest({...newTest, duration: parseInt(e.target.value)})}
                    min="1"
                    max="300"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="difficulty">Qiyinlik darajasi</label>
                  <select
                    id="difficulty"
                    value={newTest.difficulty}
                    onChange={(e) => setNewTest({...newTest, difficulty: e.target.value})}
                  >
                    <option value="easy">Oson</option>
                    <option value="medium">O'rta</option>
                    <option value="hard">Qiyin</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="passing_score">O'tish bali (%)</label>
                  <input
                    type="number"
                    id="passing_score"
                    value={newTest.passing_score}
                    onChange={(e) => setNewTest({...newTest, passing_score: parseInt(e.target.value)})}
                    min="0"
                    max="100"
                  />
                </div>
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

export default Tests;
