import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const DiagnosticTest = () => {
  const { user } = useAuth();
  const [tests, setTests] = useState([]);
  const [selectedTest, setSelectedTest] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [myResult, setMyResult] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newTest, setNewTest] = useState({ title: '', description: '', duration: 45, grade: 9 });
  const [timeLeft, setTimeLeft] = useState(0);
  const [testStarted, setTestStarted] = useState(false);

  useEffect(() => { fetchTests(); }, []);

  useEffect(() => {
    if (timeLeft <= 0 || !testStarted) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { handleSubmit(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, testStarted]);

  const fetchTests = async () => {
    try {
      setLoading(true);
      const res = await api.get('/diagnostic/tests');
      setTests(res.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const selectTest = async (test) => {
    setSelectedTest(test);
    setAnswers({});
    setTestStarted(false);
    try {
      const [qRes, rRes] = await Promise.all([
        api.get(`/diagnostic/tests/${test.id}/questions`),
        api.get(`/diagnostic/tests/${test.id}/my-result`)
      ]);
      setQuestions(qRes.data || []);
      setMyResult(rRes.data?.result || null);

      if (user.role !== 'student') {
        const resRes = await api.get(`/diagnostic/tests/${test.id}/results`).catch(() => ({ data: null }));
        setResults(resRes.data);
      }
    } catch (err) { console.error(err); }
  };

  const startTest = () => {
    setTestStarted(true);
    setTimeLeft(selectedTest.duration * 60);
  };

  const handleSubmit = async () => {
    if (!window.confirm('Testni tugatishni tasdiqlaysizmi?')) return;
    try {
      setSubmitting(true);
      const timeTaken = (selectedTest.duration * 60) - timeLeft;
      const res = await api.post(`/diagnostic/tests/${selectedTest.id}/submit`, {
        answers, time_taken: timeTaken
      });
      alert(`✅ Diagnostik test topshirildi!\n\nNatija: ${res.data.percentage}%\nTo'g'ri: ${res.data.correct_answers}/${res.data.total_questions}`);
      setTestStarted(false);
      selectTest(selectedTest);
    } catch (err) {
      alert(err.response?.data?.error || 'Xatolik');
    } finally { setSubmitting(false); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/diagnostic/tests', newTest);
      setShowCreate(false);
      setNewTest({ title: '', description: '', duration: 45, grade: 9 });
      fetchTests();
    } catch (err) { alert(err.response?.data?.error || 'Xatolik'); }
  };

  const handleExcelUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await api.post(`/diagnostic/tests/${selectedTest.id}/upload-excel`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert(`✅ ${res.data.imported} ta savol import qilindi!`);
      selectTest(selectedTest);
    } catch (err) {
      alert('❌ ' + (err.response?.data?.error || err.message));
    }
    e.target.value = '';
  };

  const handleAddQuestion = async (e) => {
    e.preventDefault();
    const form = e.target;
    const data = {
      question_text: form.question_text.value,
      options: JSON.stringify([form.optA.value, form.optB.value, form.optC.value, form.optD.value]),
      correct_answer: form.correct.value,
      points: parseInt(form.points.value) || 1
    };
    try {
      await api.post(`/diagnostic/tests/${selectedTest.id}/questions`, data);
      form.reset();
      selectTest(selectedTest);
    } catch (err) { alert(err.response?.data?.error || 'Xatolik'); }
  };

  const formatTime = (s) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;

  if (loading) return <div className="loading-container"><div className="spinner"/><p>Yuklanmoqda...</p></div>;

  return (
    <div className="page-container" style={{ paddingTop: '90px', maxWidth: '1100px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            🔬 Diagnostik test
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>Tajriba boshidagi bilim darajasini aniqlash (pre-test)</p>
        </div>
        {(user.role === 'teacher' || user.role === 'admin') && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>➕ Yangi test</button>
        )}
      </div>

      {/* Testlar ro'yxati */}
      {!selectedTest && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
          {tests.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">🔬</div><h3>Diagnostik testlar yo'q</h3></div>
          ) : tests.map(test => (
            <div key={test.id} onClick={() => selectTest(test)} style={{
              background: 'var(--glass-bg)', backdropFilter: 'var(--glass-blur)',
              border: '1px solid var(--border-color)', borderRadius: '16px',
              padding: '1.5rem', cursor: 'pointer', transition: 'all 0.2s'
            }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{test.title}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{test.description}</p>
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-light)' }}>
                <span>❓ {test.questions_count} savol</span>
                <span>⏱️ {test.duration} daqiqa</span>
                <span>👥 {test.attempts_count} topshirgan</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Test detail */}
      {selectedTest && !testStarted && (
        <div>
          <button onClick={() => { setSelectedTest(null); setMyResult(null); setResults(null); }} className="btn btn-outline" style={{ marginBottom: '1rem' }}>← Orqaga</button>

          <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '2rem', marginBottom: '1.5rem' }}>
            <h2 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{selectedTest.title}</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>{selectedTest.description}</p>
            <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              <span>❓ {questions.length} savol</span>
              <span>⏱️ {selectedTest.duration} daqiqa</span>
            </div>

            {/* O'quvchi: testni boshlash yoki natija */}
            {user.role === 'student' && (
              <div style={{ marginTop: '1.5rem' }}>
                {myResult ? (
                  <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '12px', padding: '1.25rem' }}>
                    <h3 style={{ color: '#34d399', margin: '0 0 0.5rem' }}>✅ Siz topshirgansiz</h3>
                    <p style={{ margin: 0, color: 'var(--text-primary)' }}>
                      Natija: <strong>{Math.round(myResult.percentage)}%</strong> — {myResult.correct_answers}/{myResult.total_questions} to'g'ri
                    </p>
                  </div>
                ) : questions.length > 0 ? (
                  <button onClick={startTest} className="btn btn-primary" style={{ padding: '1rem 2rem', fontSize: '1.1rem' }}>
                    🚀 Testni boshlash
                  </button>
                ) : (
                  <p style={{ color: 'var(--text-light)' }}>Hali savollar qo'shilmagan</p>
                )}
              </div>
            )}

            {/* O'qituvchi: savollar boshqaruvi */}
            {(user.role === 'teacher' || user.role === 'admin') && (
              <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <label className="btn btn-outline" style={{ cursor: 'pointer' }}>
                  📊 Excel'dan yuklash
                  <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleExcelUpload} />
                </label>
                <button className="btn btn-outline" onClick={() => document.getElementById('addQForm').scrollIntoView({ behavior: 'smooth' })}>
                  ➕ Savol qo'shish
                </button>
              </div>
            )}
          </div>

          {/* O'qituvchi: natijalar */}
          {results && results.total > 0 && (
            <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '1.5rem', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: '0 0 1rem', color: 'var(--primary-light)' }}>📊 Natijalar ({results.total} ta o'quvchi, o'rtacha: {results.average}%)</h3>

              {/* Sinf kesimida statistika */}
              {results.class_stats && results.class_stats.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                  {results.class_stats.map((cls) => (
                    <div key={cls.class_name} style={{
                      background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
                      borderRadius: '12px', padding: '1.25rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <h4 style={{ margin: 0, color: 'var(--text-primary)' }}>🏫 {cls.class_name}</h4>
                        <span style={{ background: 'rgba(6,182,212,0.1)', color: 'var(--primary-light)', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>
                          {cls.count} ta o'quvchi
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.82rem' }}>
                        <div style={{ padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
                          <span style={{ color: 'var(--text-light)' }}>O'rtacha:</span>
                          <strong style={{ color: cls.average >= 60 ? '#34d399' : '#fb7185', marginLeft: '0.3rem' }}>{cls.average}%</strong>
                        </div>
                        <div style={{ padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
                          <span style={{ color: 'var(--text-light)' }}>60%+ o'tdi:</span>
                          <strong style={{ color: 'var(--primary-light)', marginLeft: '0.3rem' }}>{cls.passed_60}/{cls.count} ({cls.passed_percent}%)</strong>
                        </div>
                        <div style={{ padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
                          <span style={{ color: 'var(--text-light)' }}>Max:</span>
                          <strong style={{ color: '#34d399', marginLeft: '0.3rem' }}>{cls.max}%</strong>
                        </div>
                        <div style={{ padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
                          <span style={{ color: 'var(--text-light)' }}>Min:</span>
                          <strong style={{ color: '#fb7185', marginLeft: '0.3rem' }}>{cls.min}%</strong>
                        </div>
                      </div>

                      {/* Sinf o'quvchilari */}
                      <details style={{ marginTop: '0.75rem' }}>
                        <summary style={{ cursor: 'pointer', fontSize: '0.8rem', color: 'var(--primary-light)', fontWeight: 600 }}>
                          👥 O'quvchilar ro'yxati
                        </summary>
                        <div style={{ marginTop: '0.5rem' }}>
                          {cls.students.map((s, i) => (
                            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0.5rem', borderBottom: '1px solid rgba(148,163,184,0.06)', fontSize: '0.8rem' }}>
                              <span style={{ color: 'var(--text-primary)' }}>{i+1}. {s.full_name}</span>
                              <span style={{ fontWeight: 700, color: s.percentage >= 60 ? '#34d399' : '#fb7185' }}>{Math.round(s.percentage)}% ({s.correct_answers}/{s.total_questions})</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Savollar ro'yxati (o'qituvchi) */}
          {(user.role === 'teacher' || user.role === 'admin') && questions.length > 0 && (
            <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>❓ Savollar ({questions.length})</h3>
                <button
                  className={`btn btn-sm ${selectedTest.is_active ? 'btn-warning' : 'btn-success'}`}
                  onClick={async () => {
                    try {
                      await api.put(`/diagnostic/tests/${selectedTest.id}`, { is_active: !selectedTest.is_active });
                      alert(selectedTest.is_active ? '🔒 Test yashirildi' : '📢 Test nashr qilindi!');
                      fetchTests();
                      selectTest({ ...selectedTest, is_active: !selectedTest.is_active });
                    } catch (err) { alert(err.response?.data?.error || 'Xatolik'); }
                  }}
                >
                  {selectedTest.is_active ? '🔒 Yashirish' : '📢 Nashr qilish'}
                </button>
              </div>
              {questions.map((q, i) => {
                const opts = Array.isArray(q.options) ? q.options : (() => { try { return JSON.parse(q.options || '[]'); } catch { return []; } })();
                return (
                  <div key={q.id} style={{ padding: '1rem', background: 'var(--bg-primary)', borderRadius: '10px', marginBottom: '0.6rem', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
                        <span style={{ color: 'var(--primary-light)' }}>{i+1}.</span> {q.question_text}
                      </span>
                      <button onClick={async () => {
                        if (!window.confirm("O'chirish?")) return;
                        await api.delete(`/diagnostic/questions/${q.id}`);
                        selectTest(selectedTest);
                      }} style={{ background: 'none', border: 'none', color: '#fb7185', cursor: 'pointer', fontSize: '0.85rem' }}>🗑️</button>
                    </div>
                    {opts.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem', marginBottom: '0.4rem' }}>
                        {opts.map((opt, oi) => {
                          const letter = String.fromCharCode(65 + oi);
                          const isCorrect = q.correct_answer === opt || q.correct_answer === letter;
                          return (
                            <div key={oi} style={{
                              padding: '0.4rem 0.6rem', borderRadius: '6px', fontSize: '0.82rem',
                              background: isCorrect ? 'rgba(16,185,129,0.1)' : 'transparent',
                              border: isCorrect ? '1px solid rgba(16,185,129,0.3)' : '1px solid var(--border-color)',
                              color: isCorrect ? '#34d399' : 'var(--text-secondary)'
                            }}>
                              <strong>{letter}.</strong> {opt} {isCorrect && '✓'}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>{q.points} ball</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Savol qo'shish formasi (o'qituvchi) */}
          {(user.role === 'teacher' || user.role === 'admin') && (
            <div id="addQForm" style={{ background: 'var(--glass-bg)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '1.5rem' }}>
              <h3 style={{ margin: '0 0 1rem' }}>➕ Savol qo'shish</h3>
              <form onSubmit={handleAddQuestion}>
                <div className="form-group"><label>Savol *</label><textarea name="question_text" required rows={2} /></div>
                <div className="form-row">
                  <div className="form-group"><label>A</label><input name="optA" required /></div>
                  <div className="form-group"><label>B</label><input name="optB" required /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>C</label><input name="optC" /></div>
                  <div className="form-group"><label>D</label><input name="optD" /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>To'g'ri javob *</label><input name="correct" required placeholder="B yoki to'liq javob" /></div>
                  <div className="form-group"><label>Ball</label><input name="points" type="number" defaultValue={1} min={1} /></div>
                </div>
                <button type="submit" className="btn btn-primary">➕ Qo'shish</button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* TEST TOPSHIRISH */}
      {selectedTest && testStarted && !myResult && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', background: 'var(--glass-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem 1.5rem' }}>
            <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>{selectedTest.title}</h3>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: timeLeft < 300 ? '#fb7185' : 'var(--primary-light)', fontFamily: 'monospace' }}>
              ⏱️ {formatTime(timeLeft)}
            </div>
          </div>

          {questions.map((q, i) => {
            const opts = Array.isArray(q.options) ? q.options : (() => { try { return JSON.parse(q.options); } catch { return []; } })();
            return (
              <div key={q.id} style={{
                background: answers[q.id] !== undefined ? 'rgba(6,182,212,0.04)' : 'var(--glass-bg)',
                border: answers[q.id] !== undefined ? '1px solid rgba(6,182,212,0.3)' : '1px solid var(--border-color)',
                borderRadius: '12px', padding: '1.25rem', marginBottom: '0.75rem'
              }}>
                <h4 style={{ margin: '0 0 0.75rem', color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                  <span style={{ color: 'var(--primary-light)' }}>{i+1}.</span> {q.question_text}
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {opts.map((opt, oi) => (
                    <label key={oi} style={{
                      display: 'flex', alignItems: 'center', gap: '0.6rem',
                      padding: '0.6rem 0.85rem', borderRadius: '8px', cursor: 'pointer',
                      border: answers[q.id] === oi ? '1.5px solid var(--primary-color)' : '1.5px solid var(--border-color)',
                      background: answers[q.id] === oi ? 'rgba(6,182,212,0.08)' : 'var(--bg-primary)'
                    }}>
                      <input type="radio" name={`dq_${q.id}`} checked={answers[q.id] === oi}
                        onChange={() => setAnswers({...answers, [q.id]: oi})}
                        style={{ accentColor: 'var(--primary-color)' }} />
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>{Object.keys(answers).length}/{questions.length} javoblangan</span>
            <button onClick={handleSubmit} disabled={submitting} className="btn btn-primary" style={{ padding: '0.85rem 2rem' }}>
              {submitting ? '⏳...' : '📤 Testni tugatish'}
            </button>
          </div>
        </div>
      )}

      {/* Yaratish modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>🔬 Yangi diagnostik test</h2><button className="close-btn" onClick={() => setShowCreate(false)}>✕</button></div>
            <form onSubmit={handleCreate} className="modal-form">
              <div className="form-group"><label>Test nomi *</label><input value={newTest.title} onChange={e => setNewTest({...newTest, title: e.target.value})} required placeholder="Masalan: 9-sinf diagnostik test (pre-test)" /></div>
              <div className="form-group"><label>Tavsif</label><textarea value={newTest.description} onChange={e => setNewTest({...newTest, description: e.target.value})} rows={2} /></div>
              <div className="form-row">
                <div className="form-group"><label>Vaqt (daqiqa)</label><input type="number" value={newTest.duration} onChange={e => setNewTest({...newTest, duration: parseInt(e.target.value)})} /></div>
                <div className="form-group"><label>Sinf</label><select value={newTest.grade} onChange={e => setNewTest({...newTest, grade: parseInt(e.target.value)})}><option value={9}>9-sinf</option><option value={10}>10-sinf</option></select></div>
              </div>
              <div className="modal-actions"><button type="button" className="btn btn-outline" onClick={() => setShowCreate(false)}>Bekor</button><button type="submit" className="btn btn-primary">✅ Yaratish</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiagnosticTest;
