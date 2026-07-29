import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import '../assets/css/Pages.css';

// ─── Helpers ─────────────────────────────────────────────────
const getMedal      = (g) => ({ 5:'🥇', 4:'🥈', 3:'🥉', 2:'😢' }[g] || '');
const getMedalLabel = (g) => ({ 5:'Oltin medal', 4:'Kumush medal', 3:'Bronza medal', 2:'Qizil stiker' }[g] || '');
const gradeColor    = (g) => ({ 5:'#f59e0b', 4:'#6366f1', 3:'#92400e', 2:'#dc2626' }[g] || '#6b7280');
const gradeBg       = (g) => ({ 5:'rgba(245,158,11,0.1)', 4:'rgba(99,102,241,0.1)', 3:'rgba(146,64,14,0.1)', 2:'rgba(220,38,38,0.1)' }[g] || 'transparent');
const barColor      = (pct) =>
  pct >= 81 ? 'linear-gradient(90deg,#f59e0b,#fbbf24)'
  : pct >= 60 ? 'linear-gradient(90deg,#6366f1,#818cf8)'
  : pct >= 40 ? 'linear-gradient(90deg,#92400e,#b45309)'
  : 'linear-gradient(90deg,#dc2626,#f87171)';

const taskTypeIcon = (t) =>
  ({ word:'📝', excel:'📊', access:'🗄️', python:'🐍', scratch:'🐱',
     html:'🌐', javascript:'💛', css:'🎨' }[t] || '📁');

const Results = () => {
  const { user } = useAuth();
  const location  = useLocation();
  const fromLessonId = location.state?.lessonId;

  // Barcha o'quvchi ma'lumotlari
  const [progresses,   setProgresses]   = useState([]);   // darslar progressi + test/topshiriq natijalari
  const [summary,      setSummary]      = useState(null);
  const [allResults,   setAllResults]   = useState([]);   // /results/my-results (fallback)
  const [loading,      setLoading]      = useState(true);

  // Tanlangan dars
  const [activeLessonId, setActiveLessonId] = useState(null);
  // Har dars ichida faol tab
  const [lessonTab,  setLessonTab]  = useState('summary'); // 'summary' | 'tests' | 'assignments'
  // Test batafsil
  const [detailResult, setDetailResult] = useState(null);

  useEffect(() => {
    Promise.all([fetchProgresses(), fetchAllResults()])
      .finally(() => setLoading(false));
  }, []);

  // Test topshirilgandan keyin kelsa shu darsni ochish
  useEffect(() => {
    if (!location.state?.showDetails || progresses.length === 0) return;
    if (fromLessonId) {
      setActiveLessonId(fromLessonId);
      setLessonTab('tests');
    } else {
      setActiveLessonId(progresses[0]?.lesson_id);
    }
  }, [progresses, location]);

  const fetchProgresses = async () => {
    try {
      const res = await api.get('/lesson-progress/student/all');
      setProgresses(res.data.progresses || []);
      setSummary(res.data.summary || null);
    } catch { setProgresses([]); }
  };

  const fetchAllResults = async () => {
    try {
      const res = await api.get('/results/my-results');
      setAllResults(Array.isArray(res.data) ? res.data : []);
    } catch { setAllResults([]); }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Yuklanmoqda...</p>
      </div>
    );
  }

  // Aktiv dars
  const activeLp = progresses.find(p => p.lesson_id === activeLessonId) || progresses[0];
  const medals   = summary?.medals || { gold:0, silver:0, bronze:0, red:0 };
  const totalGradePoints = summary?.total_grade_points || 0;

  // Umumiy statistika
  const avgTestPct = allResults.length
    ? Math.round(allResults.reduce((s,r) => s + (r.score_percentage || 0), 0) / allResults.length)
    : 0;

  return (
    <div className="page-container">

      {/* ── Sarlavha ── */}
      <div className="page-header" style={{ marginBottom:'1.5rem' }}>
        <div>
          <h1>📊 Mening natijalarim</h1>
          <p className="subtitle">Darslar bo'yicha test va topshiriq natijalari</p>
        </div>
        {fromLessonId && (
          <Link to={`/lessons/${fromLessonId}`} className="btn btn-outline">
            ← Darsga qaytish
          </Link>
        )}
      </div>

      {/* ── Yillik statistika ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:'1rem', marginBottom:'1.5rem' }}>
        <StatCard value={summary?.total_earned || 0} label={`📊 ${summary?.total_earned || 0} / ${summary?.total_possible || 0} ball`} gradient="linear-gradient(135deg,#667eea,#764ba2)" />
        <StatCard value={progresses.length}       label="🎓 Bajarilgan darslar" gradient="linear-gradient(135deg,#11998e,#38ef7d)" />
        <StatCard value={allResults.length}       label="📝 Topshirilgan testlar" gradient="linear-gradient(135deg,#f093fb,#f5576c)" />
        <StatCard value={`${avgTestPct}%`}        label="📊 O'rtacha test bali"   gradient="linear-gradient(135deg,#4facfe,#00f2fe)" />
      </div>

      {/* ── Medal vitrinasi ── */}
      {(medals.gold + medals.silver + medals.bronze + medals.red) > 0 && (
        <div style={{ background:'var(--card-bg)', border:'1px solid var(--border-color)', borderRadius:'16px', padding:'1.25rem 1.5rem', marginBottom:'1.5rem' }}>
          <h3 style={{ margin:'0 0 1rem', fontSize:'1rem' }}>🏆 Medal vitrinasi</h3>
          <div style={{ display:'flex', gap:'1.5rem', flexWrap:'wrap', alignItems:'center' }}>
            {medals.gold   > 0 && <MedalBadge emoji="🥇" count={medals.gold}   color="#f59e0b" label="Oltin" />}
            {medals.silver > 0 && <MedalBadge emoji="🥈" count={medals.silver} color="#6366f1" label="Kumush" />}
            {medals.bronze > 0 && <MedalBadge emoji="🥉" count={medals.bronze} color="#92400e" label="Bronza" />}
            {medals.red    > 0 && <MedalBadge emoji="😢" count={medals.red}    color="#dc2626" label="Qizil" />}
            <div style={{ marginLeft:'auto', textAlign:'right' }}>
              <div style={{ fontSize:'1.4rem', fontWeight:800, color:'var(--primary-color)' }}>+{totalGradePoints}</div>
              <div style={{ fontSize:'0.72rem', color:'var(--text-secondary)' }}>darslardan qo'shilgan ball</div>
            </div>
          </div>
        </div>
      )}

      {progresses.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📚</div>
          <h3>Hali darslar bajarilmagan</h3>
          <p>Darslarga kiring, testlar topshing va topshiriqlarni bajaring!</p>
        </div>
      ) : (
        <div style={{ display:'flex', gap:'1.5rem', alignItems:'flex-start', flexWrap:'wrap' }}>

          {/* ══ Chap: darslar ro'yxati ══ */}
          <div style={{ flex:'0 0 220px', display:'flex', flexDirection:'column', gap:'0.6rem' }}>
            {progresses.map((lp, idx) => (
              <button key={lp.lesson_id}
                onClick={() => { setActiveLessonId(lp.lesson_id); setLessonTab('summary'); setDetailResult(null); }}
                style={{
                  textAlign:'left', padding:'0.85rem 1rem',
                  borderRadius:'12px', border:'none', cursor:'pointer',
                  background: activeLessonId === lp.lesson_id
                    ? 'linear-gradient(135deg,rgba(102,126,234,0.15),rgba(118,75,162,0.15))'
                    : 'var(--card-bg)',
                  borderLeft: activeLessonId === lp.lesson_id
                    ? '3px solid var(--primary-color)'
                    : '3px solid transparent',
                  boxShadow: activeLessonId === lp.lesson_id ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                  transition:'all 0.2s'
                }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontWeight:600, fontSize:'0.88rem', color:'var(--text-primary)' }}>
                    {idx + 1}-Dars
                  </span>
                  <span style={{ fontSize:'1rem' }}>{getMedal(lp.grade) || '—'}</span>
                </div>
                <div style={{ fontSize:'0.75rem', color:'var(--text-secondary)', marginTop:'0.2rem',
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'160px' }}>
                  {lp.lesson_title}
                </div>
                {lp.grade > 0 && (
                  <div style={{ fontSize:'0.72rem', fontWeight:700, color: gradeColor(lp.grade), marginTop:'0.2rem' }}>
                    {lp.grade} baho · {lp.percent}%
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* ══ O'ng: tanlangan dars detail ══ */}
          {activeLp && (
            <div style={{ flex:1, minWidth:0 }}>

              {/* Dars sarlavhasi + progress */}
              <div style={{
                background:'linear-gradient(135deg,var(--primary-color),var(--secondary-color))',
                borderRadius:'16px', padding:'1.25rem 1.5rem', color:'#fff', marginBottom:'1rem'
              }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'0.75rem' }}>
                  <div>
                    <div style={{ fontSize:'0.8rem', opacity:0.8, marginBottom:'0.2rem' }}>
                      {progresses.indexOf(activeLp) + 1}-Dars
                    </div>
                    <h3 style={{ margin:0, color:'#fff', fontSize:'1.1rem' }}>{activeLp.lesson_title}</h3>
                    <div style={{ fontSize:'0.8rem', opacity:0.85, marginTop:'0.2rem' }}>
                      {activeLp.lesson_grade}-sinf · {activeLp.subject}
                    </div>
                  </div>
                  {activeLp.grade > 0 && (
                    <div style={{ textAlign:'center', background:'rgba(255,255,255,0.15)', borderRadius:'10px', padding:'0.5rem 0.9rem' }}>
                      <div style={{ fontSize:'1.8rem' }}>{getMedal(activeLp.grade)}</div>
                      <div style={{ fontSize:'0.85rem', fontWeight:800, color:'#fff' }}>{activeLp.grade} baho</div>
                      <div style={{ fontSize:'0.65rem', opacity:0.8 }}>{getMedalLabel(activeLp.grade)}</div>
                    </div>
                  )}
                </div>
                {/* Progress bar */}
                <div style={{ marginTop:'1rem' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.78rem', opacity:0.9, marginBottom:'0.3rem' }}>
                    <span>{activeLp.earned_score} / {activeLp.total_possible} ball</span>
                    <span>{activeLp.total_possible > 0 ? Math.round((activeLp.earned_score / activeLp.total_possible) * 100) : 0}%</span>
                  </div>
                  <div style={{ background:'rgba(255,255,255,0.2)', borderRadius:'99px', height:'8px' }}>
                    <div style={{ height:'100%', borderRadius:'99px', width:`${Math.min(activeLp.percent,100)}%`,
                      background:'rgba(255,255,255,0.9)', transition:'width 0.6s ease' }} />
                  </div>
                </div>
              </div>

              {/* Tabs: Umumiy | Testlar | Amaliy */}
              <div style={{ display:'flex', gap:'0.25rem', marginBottom:'1rem',
                borderBottom:'2px solid var(--border-color)', paddingBottom:0 }}>
                {[
                  { id:'summary',     label:`📊 Umumiy` },
                  { id:'tests',       label:`📝 Testlar (${activeLp.test_results?.length || 0})` },
                  { id:'assignments', label:`🖥️ Amaliy (${activeLp.assignment_results?.length || 0})` },
                ].map(tab => (
                  <button key={tab.id} onClick={() => { setLessonTab(tab.id); setDetailResult(null); }}
                    style={{
                      padding:'0.5rem 1rem', border:'none', cursor:'pointer', background:'transparent',
                      borderBottom: lessonTab === tab.id ? '3px solid var(--primary-color)' : '3px solid transparent',
                      color: lessonTab === tab.id ? 'var(--primary-color)' : 'var(--text-secondary)',
                      fontWeight: lessonTab === tab.id ? 700 : 400,
                      fontSize:'0.85rem', marginBottom:'-2px', transition:'all 0.2s'
                    }}>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* ── Umumiy tab ── */}
              {lessonTab === 'summary' && (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:'1rem' }}>
                  <SummaryCard
                    icon="📝" title="Testlar"
                    value={`${activeLp.test_results?.filter(t => t.result_id).length || 0} / ${activeLp.test_results?.length || 0}`}
                    sub="topshirildi"
                    color="#6366f1"
                  />
                  <SummaryCard
                    icon="🖥️" title="Amaliy"
                    value={`${activeLp.assignment_results?.filter(a => a.submission_id).length || 0} / ${activeLp.assignment_results?.length || 0}`}
                    sub="topshirildi"
                    color="#10b981"
                  />
                  <SummaryCard
                    icon="📊" title="Test bali"
                    value={`${activeLp.test_score || 0}`}
                    sub="ball"
                    color="#f59e0b"
                  />
                  <SummaryCard
                    icon="🎯" title="Topshiriq bali"
                    value={`${activeLp.assign_score || 0}`}
                    sub="ball"
                    color="#ec4899"
                  />
                </div>
              )}

              {/* ── Testlar tab ── */}
              {lessonTab === 'tests' && (
                <div>
                  {!activeLp.test_results?.length ? (
                    <div className="empty-state" style={{ padding:'2rem 0' }}>
                      <p>Bu darsda nashr qilingan testlar yo'q</p>
                    </div>
                  ) : detailResult ? (
                    /* Batafsil test natijasi */
                    <TestDetailPanel result={detailResult} onBack={() => setDetailResult(null)} />
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
                      {activeLp.test_results.map((tr, idx) => (
                        <div key={tr.test_id} style={{
                          background:'var(--card-bg)', border:'1px solid var(--border-color)',
                          borderRadius:'12px', padding:'1rem 1.25rem',
                          display:'flex', justifyContent:'space-between', alignItems:'center', gap:'1rem', flexWrap:'wrap'
                        }}>
                          <div style={{ flex:1 }}>
                            <div style={{ fontWeight:600, marginBottom:'0.2rem' }}>
                              {idx + 1}. {tr.test_title}
                            </div>
                            {tr.result_id ? (
                              <div style={{ fontSize:'0.8rem', color:'var(--text-secondary)' }}>
                                ✅ {tr.correct_answers}/{tr.total_questions} to'g'ri ·{' '}
                                {Number(tr.percentage || 0).toFixed(1)}% ·{' '}
                                {tr.correct_answers * 2} ball ·{' '}
                                {new Date(tr.submitted_at).toLocaleDateString('uz-UZ')}
                              </div>
                            ) : (
                              <div style={{ fontSize:'0.8rem', color:'#d97706' }}>▶ Hali topshirilmagan</div>
                            )}
                          </div>
                          {tr.result_id ? (
                            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                              <span style={{
                                fontWeight:800, fontSize:'1.1rem',
                                color: tr.percentage >= 81 ? '#16a34a' : tr.percentage >= 60 ? '#6366f1' : '#dc2626'
                              }}>
                                {Number(tr.percentage || 0).toFixed(0)}%
                              </span>
                              <button
                                onClick={() => setDetailResult(tr)}
                                className="btn btn-sm btn-outline"
                              >
                                Batafsil
                              </button>
                            </div>
                          ) : (
                            <Link to={`/tests/${tr.test_id}`} className="btn btn-sm btn-primary">
                              Boshlash
                            </Link>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Amaliy tab ── */}
              {lessonTab === 'assignments' && (
                <div>
                  {!activeLp.assignment_results?.length ? (
                    <div className="empty-state" style={{ padding:'2rem 0' }}>
                      <p>Bu darsda amaliy topshiriqlar yo'q</p>
                    </div>
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
                      {activeLp.assignment_results.map((ar, idx) => (
                        <div key={ar.assignment_id} style={{
                          background:'var(--card-bg)', border:'1px solid var(--border-color)',
                          borderRadius:'12px', padding:'1rem 1.25rem',
                          display:'flex', justifyContent:'space-between', alignItems:'center', gap:'1rem', flexWrap:'wrap'
                        }}>
                          <div style={{ flex:1 }}>
                            <div style={{ fontWeight:600, marginBottom:'0.25rem', display:'flex', gap:'0.4rem', alignItems:'center' }}>
                              <span>{taskTypeIcon(ar.task_type)}</span>
                              {idx + 1}. {ar.assignment_title}
                            </div>
                            {ar.submission_id ? (
                              <div>
                                <div style={{ fontSize:'0.8rem', color:'var(--text-secondary)' }}>
                                  {ar.status === 'graded' ? (
                                    <>
                                      ✅ {ar.score}/{ar.max_score} ball ·{' '}
                                      {ar.graded_by === 'ai' ? '🤖 AI' : '👨‍🏫 O\'qituvchi'} baholadi ·{' '}
                                      {new Date(ar.submitted_at).toLocaleDateString('uz-UZ')}
                                    </>
                                  ) : (
                                    <>⏳ Topshirildi, tekshirilmoqda · {new Date(ar.submitted_at).toLocaleDateString('uz-UZ')}</>
                                  )}
                                </div>
                                {ar.feedback && (
                                  <div style={{ fontSize:'0.78rem', color:'var(--text-secondary)', marginTop:'0.25rem',
                                    borderLeft:'3px solid var(--primary-color)', paddingLeft:'0.5rem' }}>
                                    💬 {ar.feedback}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div style={{ fontSize:'0.8rem', color:'#d97706' }}>▶ Hali topshirilmagan</div>
                            )}
                          </div>
                          {ar.status === 'graded' && (
                            <div style={{
                              fontWeight:800, fontSize:'1.2rem',
                              color: (ar.score/ar.max_score) >= 0.81 ? '#16a34a'
                                   : (ar.score/ar.max_score) >= 0.60 ? '#6366f1' : '#dc2626'
                            }}>
                              {ar.score}/{ar.max_score}
                            </div>
                          )}
                          {!ar.submission_id && (
                            <Link to={`/lessons/${activeLp.lesson_id}`} className="btn btn-sm btn-primary">
                              Bajarish
                            </Link>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Kichik komponentlar ──────────────────────────────────────

const StatCard = ({ value, label, gradient }) => (
  <div style={{ background:gradient, borderRadius:'14px', padding:'1.1rem', color:'#fff', textAlign:'center' }}>
    <div style={{ fontSize:'1.8rem', fontWeight:800 }}>{value}</div>
    <div style={{ fontSize:'0.78rem', opacity:0.9, marginTop:'0.2rem' }}>{label}</div>
  </div>
);

const MedalBadge = ({ emoji, count, color, label }) => (
  <div style={{ textAlign:'center' }}>
    <div style={{ fontSize:'2.2rem' }}>{emoji}</div>
    <div style={{ fontWeight:700, fontSize:'1.1rem', color }}>×{count}</div>
    <div style={{ fontSize:'0.7rem', color:'var(--text-secondary)' }}>{label}</div>
  </div>
);

const SummaryCard = ({ icon, title, value, sub, color }) => (
  <div style={{ background:'var(--card-bg)', border:'1px solid var(--border-color)', borderRadius:'12px', padding:'1rem', textAlign:'center' }}>
    <div style={{ fontSize:'1.5rem', marginBottom:'0.3rem' }}>{icon}</div>
    <div style={{ fontSize:'0.8rem', color:'var(--text-secondary)', marginBottom:'0.25rem' }}>{title}</div>
    <div style={{ fontSize:'1.4rem', fontWeight:800, color }}>{value}</div>
    <div style={{ fontSize:'0.72rem', color:'var(--text-secondary)' }}>{sub}</div>
  </div>
);

// Batafsil test natijasi paneli
const TestDetailPanel = ({ result, onBack }) => {
  const [detailData, setDetailData] = useState(null);

  useEffect(() => {
    if (!result.result_id) return;
    api.get('/results/my-results').then(res => {
      const all = Array.isArray(res.data) ? res.data : [];
      const found = all.find(r => r.test_id === result.test_id);
      setDetailData(found || null);
    }).catch(() => {});
  }, [result]);

  return (
    <div>
      <button onClick={onBack} className="btn btn-outline btn-sm" style={{ marginBottom:'1rem' }}>
        ← Orqaga
      </button>
      <div style={{ background:'var(--card-bg)', border:'1px solid var(--border-color)', borderRadius:'12px', padding:'1.25rem' }}>
        <h4 style={{ margin:'0 0 0.75rem' }}>{result.test_title}</h4>
        <div style={{ display:'flex', gap:'1rem', marginBottom:'1rem', flexWrap:'wrap' }}>
          <span style={{ color:'#16a34a', fontWeight:700 }}>✅ {result.correct_answers}/{result.total_questions} to'g'ri</span>
          <span style={{ fontWeight:700 }}>{Number(result.percentage||0).toFixed(1)}%</span>
          <span style={{ color:'var(--text-secondary)' }}>{result.correct_answers * 2} ball</span>
        </div>
        {detailData?.detailed_answers && (() => {
          try {
            const answers = typeof detailData.detailed_answers === 'string'
              ? JSON.parse(detailData.detailed_answers) : detailData.detailed_answers;
            if (!Array.isArray(answers)) return null;
            return (
              <div>
                {answers.map((ans, i) => (
                  <div key={i} style={{
                    padding:'0.75rem', borderRadius:'8px', marginBottom:'0.5rem',
                    background: ans.is_correct ? 'rgba(34,197,94,0.06)' : 'rgba(220,38,38,0.06)',
                    border: `1px solid ${ans.is_correct ? 'rgba(34,197,94,0.2)' : 'rgba(220,38,38,0.2)'}`
                  }}>
                    <div style={{ display:'flex', gap:'0.5rem', alignItems:'flex-start' }}>
                      <span style={{ color: ans.is_correct ? '#16a34a' : '#dc2626', fontWeight:700, flexShrink:0 }}>
                        {ans.is_correct ? '✓' : '✗'} {i+1}.
                      </span>
                      <div>
                        <div style={{ fontWeight:500, fontSize:'0.88rem' }}>{ans.question_text}</div>
                        <div style={{ fontSize:'0.78rem', marginTop:'0.25rem', color:'var(--text-secondary)' }}>
                          Javob: <span style={{ color: ans.is_correct ? '#16a34a' : '#dc2626', fontWeight:600 }}>
                            {ans.user_answer != null ? String(ans.user_answer) : '(berilmagan)'}
                          </span>
                          {!ans.is_correct && ans.correct_answer && (
                            <> · To'g'ri: <span style={{ color:'#16a34a', fontWeight:600 }}>{ans.correct_answer}</span></>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          } catch { return null; }
        })()}
      </div>
    </div>
  );
};

export default Results;
