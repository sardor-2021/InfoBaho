import React, { useState } from 'react';
import api from '../services/api';

/**
 * AdaptiveTestReviewPanel — O'qituvchi uchun adaptiv test savollarini ko'rish va tahrirlash
 */
const AdaptiveTestReviewPanel = ({ adaptiveTest, onPublish, onRefresh }) => {
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const questions = adaptiveTest?.questions || [];

  const getDifficultyLabel = (level) => {
    const labels = { 1: 'Juda oson', 2: 'Oson', 3: "O'rta", 4: 'Qiyin', 5: 'Juda qiyin' };
    return labels[level] || level;
  };

  const getDifficultyColor = (level) => {
    if (level <= 2) return '#16a34a';
    if (level === 3) return '#d97706';
    return '#dc2626';
  };

  const handleEdit = (q) => {
    setEditingId(q.id);
    setEditForm({
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_option: q.correct_option,
      concept: q.concept,
      difficulty_level: q.difficulty_level,
      explanation: q.explanation || ''
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put(`/adaptive-questions/${editingId}`, editForm);
      setEditingId(null);
      setEditForm({});
      if (onRefresh) onRefresh();
    } catch (err) {
      alert('Saqlashda xatolik: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (qId) => {
    if (!window.confirm("Savolni o'chirishni tasdiqlaysizmi?")) return;
    try {
      await api.delete(`/adaptive-questions/${qId}`);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert("O'chirishda xatolik: " + (err.response?.data?.error || err.message));
    }
  };

  const handlePublish = async () => {
    if (!window.confirm("Testni e'lon qilishni tasdiqlaysizmi? O'quvchilar ko'ra oladi.")) return;
    try {
      setPublishing(true);
      await api.post(`/adaptive-tests/${adaptiveTest.id}/publish`);
      if (onPublish) onPublish();
    } catch (err) {
      alert("E'lon qilishda xatolik: " + (err.response?.data?.error || err.message));
    } finally {
      setPublishing(false);
    }
  };

  const optionLetters = ['a', 'b', 'c', 'd'];

  return (
    <div>
      {/* Statistika */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ background: 'rgba(99,102,241,0.08)', padding: '0.6rem 1rem', borderRadius: '10px', fontSize: '0.85rem' }}>
          <strong>{questions.length}</strong> ta savol
        </div>
        <div style={{ background: 'rgba(34,197,94,0.08)', padding: '0.6rem 1rem', borderRadius: '10px', fontSize: '0.85rem' }}>
          <strong>{questions.filter(q => q.difficulty_level <= 2).length}</strong> oson
        </div>
        <div style={{ background: 'rgba(245,158,11,0.08)', padding: '0.6rem 1rem', borderRadius: '10px', fontSize: '0.85rem' }}>
          <strong>{questions.filter(q => q.difficulty_level === 3).length}</strong> o'rta
        </div>
        <div style={{ background: 'rgba(239,68,68,0.08)', padding: '0.6rem 1rem', borderRadius: '10px', fontSize: '0.85rem' }}>
          <strong>{questions.filter(q => q.difficulty_level >= 4).length}</strong> qiyin
        </div>
        {adaptiveTest.generated_from && (
          <div style={{ background: 'rgba(168,85,247,0.08)', padding: '0.6rem 1rem', borderRadius: '10px', fontSize: '0.85rem', color: '#7c3aed' }}>
            {adaptiveTest.generated_from === 'material' ? '📎 Materialdan' : '🧠 Mavzudan'}
          </div>
        )}
      </div>

      {/* Savollar ro'yxati */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {questions.map((q, index) => (
          <div key={q.id} style={{
            background: 'var(--bg-secondary)',
            borderRadius: '12px',
            padding: '1.25rem',
            border: editingId === q.id ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
            transition: 'all 0.2s'
          }}>
            {editingId === q.id ? (
              /* ── Tahrirlash rejimi ── */
              <div>
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>Savol matni</label>
                  <textarea
                    value={editForm.question_text}
                    onChange={e => setEditForm({ ...editForm, question_text: e.target.value })}
                    rows="2"
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: '0.9rem', resize: 'vertical' }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  {['a', 'b', 'c', 'd'].map(letter => (
                    <div key={letter}>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Variant {letter.toUpperCase()}</label>
                      <input
                        type="text"
                        value={editForm[`option_${letter}`]}
                        onChange={e => setEditForm({ ...editForm, [`option_${letter}`]: e.target.value })}
                        style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                      />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block' }}>To'g'ri javob</label>
                    <select
                      value={editForm.correct_option}
                      onChange={e => setEditForm({ ...editForm, correct_option: e.target.value })}
                      style={{ padding: '0.4rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-primary)' }}
                    >
                      <option value="a">A</option>
                      <option value="b">B</option>
                      <option value="c">C</option>
                      <option value="d">D</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block' }}>Tushuncha</label>
                    <input
                      type="text"
                      value={editForm.concept}
                      onChange={e => setEditForm({ ...editForm, concept: e.target.value })}
                      style={{ padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: '0.85rem', width: '150px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block' }}>Qiyinlik</label>
                    <select
                      value={editForm.difficulty_level}
                      onChange={e => setEditForm({ ...editForm, difficulty_level: parseInt(e.target.value) })}
                      style={{ padding: '0.4rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-primary)' }}
                    >
                      {[1,2,3,4,5].map(n => <option key={n} value={n}>{getDifficultyLabel(n)}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>💡 Tushuntirish (noto'g'ri javobda o'quvchiga ko'rsatiladi)</label>
                  <textarea
                    value={editForm.explanation}
                    onChange={e => setEditForm({ ...editForm, explanation: e.target.value })}
                    rows="2"
                    placeholder="Nima uchun to'g'ri javob aynan shu? Qisqa tushuntirish yozing..."
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: '0.85rem', resize: 'vertical' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={handleSave} disabled={saving} className="btn btn-sm btn-primary">
                    {saving ? '⏳' : '💾'} Saqlash
                  </button>
                  <button onClick={() => setEditingId(null)} className="btn btn-sm btn-outline">Bekor qilish</button>
                </div>
              </div>
            ) : (
              /* ── Ko'rish rejimi ── */
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', flex: 1 }}>
                    <span style={{
                      background: 'var(--primary-color)', color: '#fff', borderRadius: '50%',
                      width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.75rem', fontWeight: 700, flexShrink: 0
                    }}>
                      {index + 1}
                    </span>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: '0 0 0.6rem', fontWeight: 600, lineHeight: 1.4, fontSize: '0.92rem' }}>
                        {q.question_text}
                      </p>
                      {/* Variantlar */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '0.6rem' }}>
                        {optionLetters.map(letter => {
                          const isCorrect = q.correct_option === letter;
                          return (
                            <div key={letter} style={{
                              display: 'flex', alignItems: 'center', gap: '0.5rem',
                              padding: '0.3rem 0.6rem', borderRadius: '6px',
                              background: isCorrect ? 'rgba(34,197,94,0.12)' : 'transparent',
                              border: isCorrect ? '1px solid rgba(34,197,94,0.4)' : '1px solid transparent',
                              fontSize: '0.85rem'
                            }}>
                              <span style={{
                                width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.7rem', fontWeight: 700,
                                background: isCorrect ? '#22c55e' : 'var(--border-color)',
                                color: isCorrect ? '#fff' : 'var(--text-secondary)'
                              }}>
                                {letter.toUpperCase()}
                              </span>
                              <span style={{ color: isCorrect ? '#16a34a' : 'var(--text-primary)', fontWeight: isCorrect ? 600 : 400 }}>
                                {q[`option_${letter}`]}
                              </span>
                              {isCorrect && <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#16a34a', fontWeight: 600 }}>✓ To'g'ri</span>}
                            </div>
                          );
                        })}
                      </div>
                      {/* Meta */}
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{
                          fontSize: '0.72rem', padding: '2px 8px', borderRadius: '10px',
                          background: `${getDifficultyColor(q.difficulty_level)}15`,
                          color: getDifficultyColor(q.difficulty_level),
                          fontWeight: 600
                        }}>
                          {getDifficultyLabel(q.difficulty_level)}
                        </span>
                        <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(99,102,241,0.1)', color: '#4f46e5' }}>
                          {q.concept}
                        </span>
                        {q.edited_by_teacher && (
                          <span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '8px', background: 'rgba(245,158,11,0.12)', color: '#d97706' }}>
                            ✏️ Tahrirlangan
                          </span>
                        )}
                      </div>
                      {/* Tushuntirish */}
                      {q.explanation && (
                        <div style={{
                          marginTop: '0.5rem', padding: '0.5rem 0.75rem',
                          background: 'rgba(99,102,241,0.06)', borderRadius: '8px',
                          borderLeft: '3px solid rgba(99,102,241,0.4)',
                          fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5
                        }}>
                          💡 <strong>Tushuntirish:</strong> {q.explanation}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Amallar */}
                  <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                    <button onClick={() => handleEdit(q)} className="btn btn-sm btn-outline" title="Tahrirlash">✏️</button>
                    <button onClick={() => handleDelete(q.id)} className="btn btn-sm btn-outline" title="O'chirish" style={{ color: '#dc2626' }}>🗑️</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* E'lon qilish tugmasi */}
      {questions.length >= 10 && (
        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="btn btn-primary"
            style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}
          >
            {publishing ? '⏳ E\'lon qilinmoqda...' : '✅ E\'lon qilish (o\'quvchilarga ko\'rsatish)'}
          </button>
          <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            E'lon qilgandan keyin o'quvchilar testni yecha oladi
          </p>
        </div>
      )}

      {questions.length < 10 && questions.length > 0 && (
        <div style={{ marginTop: '1rem', textAlign: 'center', padding: '1rem', background: 'rgba(245,158,11,0.08)', borderRadius: '10px', color: '#d97706', fontSize: '0.85rem' }}>
          E'lon qilish uchun kamida 10 ta savol kerak (hozir: {questions.length})
        </div>
      )}
    </div>
  );
};

export default AdaptiveTestReviewPanel;
