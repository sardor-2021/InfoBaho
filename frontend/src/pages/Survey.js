import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const Survey = () => {
  const { user } = useAuth();
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [openAnswer, setOpenAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [qRes, myRes] = await Promise.all([
        api.get('/survey/questions'),
        api.get('/survey/my-response')
      ]);
      setQuestions(qRes.data || []);
      setSubmitted(myRes.data?.submitted || false);

      // Admin/teacher: natijalarni olish
      if (user.role === 'admin' || user.role === 'teacher') {
        const resRes = await api.get('/survey/results').catch(() => ({ data: null }));
        setResults(resRes.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (Object.keys(answers).length < 10) {
      setError('Iltimos, barcha 10 ta savolga javob bering');
      return;
    }

    try {
      setSubmitting(true);
      await api.post('/survey/submit', { answers, open_answer: openAnswer });
      setSuccess('Javoblaringiz qabul qilindi. Rahmat!');
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Xatolik yuz berdi');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="loading-container"><div className="spinner"/><p>Yuklanmoqda...</p></div>;

  // ═══════ ADMIN/TEACHER: Natijalar ═══════
  if ((user.role === 'admin' || user.role === 'teacher') && results) {
    return (
      <div className="page-container" style={{ paddingTop: '90px', maxWidth: '1000px' }}>
        <h1 style={{ background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', textAlign: 'center', marginBottom: '0.5rem' }}>
          📋 So'rovnoma natijalari
        </h1>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '2rem' }}>
          Jami: <strong>{results.total}</strong> ta javob |
          O'rtacha Likert: <strong>{results.overall_avg_likert}/5</strong> |
          Ijobiy: <strong>{results.overall_positive_percent}%</strong>
          {results.cronbach_alpha && (
            <span> | Cronbach's α: <strong>{results.cronbach_alpha.alpha}</strong> ({results.cronbach_alpha.interpretation})</span>
          )}
        </p>

        {results.total === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3>Hali so'rovnomaga hech kim javob bermagan</h3>
          </div>
        ) : (
          <>
            {/* Har savol natijasi */}
            {results.questions?.map((q, i) => (
              <div key={q.id} style={{
                background: 'var(--glass-bg)', backdropFilter: 'var(--glass-blur)',
                border: '1px solid var(--border-color)', borderRadius: '14px',
                padding: '1.5rem', marginBottom: '1rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-primary)', flex: 1 }}>
                    {i + 1}. {q.text}
                  </h4>
                  <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                    <span style={{ background: 'rgba(6,182,212,0.1)', color: 'var(--primary-light)', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>
                      ⭐ {q.avg_likert}/5
                    </span>
                    <span style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>
                      👍 {q.positive_percent}%
                    </span>
                  </div>
                </div>

                {/* Bar chart */}
                {q.options.map((opt, oi) => (
                  <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                    <span style={{ width: '180px', fontSize: '0.8rem', color: 'var(--text-secondary)', flexShrink: 0 }}>{opt}</span>
                    <div style={{ flex: 1, height: '20px', background: 'var(--bg-primary)', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                      <div style={{
                        height: '100%', borderRadius: '4px',
                        width: `${q.percentages[oi]}%`,
                        background: oi === 0 ? 'linear-gradient(90deg,#10b981,#06b6d4)' :
                                   oi === 1 ? 'linear-gradient(90deg,#06b6d4,#3b82f6)' :
                                   oi === 2 ? 'linear-gradient(90deg,#f59e0b,#d97706)' :
                                   oi === 3 ? 'linear-gradient(90deg,#f97316,#ef4444)' :
                                              'linear-gradient(90deg,#ef4444,#dc2626)',
                        transition: 'width 0.5s'
                      }} />
                    </div>
                    <span style={{ width: '60px', textAlign: 'right', fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      {q.counts[oi]} ({q.percentages[oi]}%)
                    </span>
                  </div>
                ))}
              </div>
            ))}

            {/* Sinf/maktab bo'yicha */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.25rem' }}>
                <h4 style={{ margin: '0 0 0.75rem', color: 'var(--primary-light)' }}>🏫 Sinf bo'yicha</h4>
                {Object.entries(results.by_class || {}).map(([cls, info]) => (
                  <div key={cls} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid rgba(148,163,184,0.06)', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-primary)' }}>{cls}</span>
                    <span style={{ color: 'var(--primary-light)', fontWeight: 700 }}>{info.count} ta</span>
                  </div>
                ))}
              </div>
              <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.25rem' }}>
                <h4 style={{ margin: '0 0 0.75rem', color: 'var(--primary-light)' }}>🏫 Maktab bo'yicha</h4>
                {Object.entries(results.by_school || {}).map(([school, count]) => (
                  <div key={school} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid rgba(148,163,184,0.06)', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-primary)' }}>{school}</span>
                    <span style={{ color: 'var(--primary-light)', fontWeight: 700 }}>{count} ta</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Ochiq javoblar */}
            {results.open_answers?.length > 0 && (
              <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.5rem' }}>
                <h4 style={{ margin: '0 0 1rem', color: 'var(--primary-light)' }}>💬 Ochiq javoblar ({results.open_answers.length})</h4>
                {results.open_answers.map((a, i) => (
                  <div key={i} style={{ padding: '0.75rem', background: 'var(--bg-primary)', borderRadius: '8px', marginBottom: '0.5rem', border: '1px solid var(--border-color)' }}>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>"{a.text}"</p>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>{a.class_name}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ═══════ O'QUVCHI: So'rovnoma to'ldirish ═══════
  if (submitted) {
    return (
      <div className="page-container" style={{ paddingTop: '90px', maxWidth: '700px', textAlign: 'center' }}>
        <div style={{ background: 'var(--glass-bg)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '20px', padding: '3rem 2rem' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
          <h2 style={{ color: '#34d399', marginBottom: '0.5rem' }}>Rahmat!</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Siz allaqachon so'rovnomada qatnashgansiz. Javoblaringiz qabul qilindi.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ paddingTop: '90px', maxWidth: '750px' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 style={{ background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontSize: '1.75rem' }}>
          📋 So'rovnoma
        </h1>
        <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: '0.5rem' }}>
          Informatika faniga munosabat va baholash tizimidan qoniqish
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6 }}>
          Hurmatli o'quvchi! Ushbu so'rovnoma sizning informatika faniga munosabatingiz va
          baholash tizimidan qoniqish darajangizni aniqlash uchun o'tkazilmoqda.
          So'rovnoma anonim, natijalar faqat ilmiy tadqiqotda ishlatiladi.
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <form onSubmit={handleSubmit}>
        {questions.map((q, i) => (
          <div key={q.id} style={{
            background: 'var(--glass-bg)', backdropFilter: 'var(--glass-blur)',
            border: answers[q.id] !== undefined ? '1px solid rgba(6,182,212,0.3)' : '1px solid var(--border-color)',
            borderRadius: '14px', padding: '1.5rem', marginBottom: '1rem',
            transition: 'border-color 0.2s'
          }}>
            <h4 style={{ margin: '0 0 1rem', color: 'var(--text-primary)', fontSize: '0.95rem', lineHeight: 1.5 }}>
              <span style={{ color: 'var(--primary-light)', fontWeight: 700 }}>{i + 1}.</span> {q.text}
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {q.options.map((opt, oi) => (
                <label key={oi} style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.7rem 1rem', borderRadius: '8px', cursor: 'pointer',
                  border: answers[q.id] === oi ? '1.5px solid var(--primary-color)' : '1.5px solid var(--border-color)',
                  background: answers[q.id] === oi ? 'rgba(6,182,212,0.08)' : 'var(--bg-primary)',
                  transition: 'all 0.15s'
                }}>
                  <input
                    type="radio"
                    name={`q_${q.id}`}
                    checked={answers[q.id] === oi}
                    onChange={() => setAnswers({ ...answers, [q.id]: oi })}
                    style={{ accentColor: 'var(--primary-color)', width: '16px', height: '16px' }}
                  />
                  <span style={{ fontSize: '0.9rem', color: answers[q.id] === oi ? 'var(--primary-light)' : 'var(--text-primary)' }}>{opt}</span>
                </label>
              ))}
            </div>
          </div>
        ))}

        {/* Ochiq savol */}
        <div style={{
          background: 'var(--glass-bg)', border: '1px solid var(--border-color)',
          borderRadius: '14px', padding: '1.5rem', marginBottom: '1.5rem'
        }}>
          <h4 style={{ margin: '0 0 0.75rem', color: 'var(--text-primary)', fontSize: '0.95rem' }}>
            💬 Ochiq savol: Baholash tizimini yanada yaxshilash uchun nima qilish kerak?
          </h4>
          <textarea
            value={openAnswer}
            onChange={(e) => setOpenAnswer(e.target.value)}
            placeholder="Fikringizni yozing (ixtiyoriy)..."
            rows={3}
            style={{
              width: '100%', padding: '0.75rem', borderRadius: '8px',
              border: '1.5px solid var(--border-color)', background: 'var(--bg-primary)',
              color: 'var(--text-primary)', fontSize: '0.9rem', resize: 'vertical'
            }}
          />
        </div>

        {/* Progress */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {Object.keys(answers).length} / 10 savolga javob berildi
          </span>
          <div style={{ width: '200px', height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px' }}>
            <div style={{
              height: '100%', borderRadius: '3px',
              width: `${(Object.keys(answers).length / 10) * 100}%`,
              background: 'var(--gradient-primary)', transition: 'width 0.3s'
            }} />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting || Object.keys(answers).length < 10}
          className="btn btn-primary btn-block"
          style={{ padding: '1rem', fontSize: '1.05rem' }}
        >
          {submitting ? '⏳ Yuborilmoqda...' : '📤 Javoblarni yuborish'}
        </button>
      </form>
    </div>
  );
};

export default Survey;
