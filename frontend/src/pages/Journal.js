import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import '../assets/css/Pages.css';

// ─── Helpers ─────────────────────────────────────────────────
const getMedal   = (g) => ({ 5:'🥇', 4:'🥈', 3:'🥉', 2:'😢' }[g] || '—');
const gradeColor = (g) => ({ 5:'#f59e0b', 4:'#6366f1', 3:'#92400e', 2:'#dc2626' }[g] || '#9ca3af');
const gradeBg    = (g) => ({
  5:'rgba(245,158,11,0.12)', 4:'rgba(99,102,241,0.12)',
  3:'rgba(146,64,14,0.12)',  2:'rgba(220,38,38,0.12)'
}[g] || 'transparent');

const gradeStats = (students) => {
  const graded = students.filter(s => s.grade > 0);
  const avg    = graded.length
    ? (graded.reduce((a, s) => a + s.grade, 0) / graded.length).toFixed(1)
    : '—';
  const counts = [5,4,3,2].map(g => ({ grade:g, count: students.filter(s => s.grade === g).length }));
  return { total: students.length, graded: graded.length, avg, counts };
};

const Journal = () => {
  const { user } = useAuth();

  const [teacher,      setTeacher]      = useState(null);
  const [byClass,      setByClass]      = useState({});   // { '10-A': [lessons...] }
  const [loading,      setLoading]      = useState(true);
  const [activeClass,  setActiveClass]  = useState(null); // aktiv sinf tab
  const [activeLesson, setActiveLesson] = useState(null); // aktiv dars
  const [search,       setSearch]       = useState('');

  useEffect(() => { fetchJournal(); }, []);

  const fetchJournal = async () => {
    try {
      setLoading(true);
      const res  = await api.get('/lesson-progress/journal/teacher');
      const bc   = res.data.by_class || {};
      setTeacher(res.data.teacher || null);
      setByClass(bc);

      // Birinchi sinf va darsni tanlash
      const firstClass = Object.keys(bc)[0];
      if (firstClass) {
        setActiveClass(firstClass);
        const firstLesson = bc[firstClass][0];
        if (firstLesson) setActiveLesson(firstLesson.id);
      }
    } catch (err) {
      console.error('Journal fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <p>Jurnal yuklanmoqda...</p>
      </div>
    );
  }

  const classes      = Object.keys(byClass).sort();
  const classLessons = byClass[activeClass] || [];
  const activeLessonData = classLessons.find(l => l.id === activeLesson);

  // Filterlangan o'quvchilar
  const filteredStudents = (activeLessonData?.students || []).filter(s =>
    !search ||
    s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.username?.toLowerCase().includes(search.toLowerCase())
  );

  // Sinf o'zgarganda birinchi darsni tanlash
  const handleClassChange = (cls) => {
    setActiveClass(cls);
    setSearch('');
    const first = byClass[cls]?.[0];
    setActiveLesson(first?.id || null);
  };

  return (
    <div className="page-container">

      {/* ── Sarlavha ── */}
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1>📒 Jurnal</h1>
          <p className="subtitle">
            {teacher
              ? `${teacher.district} · ${teacher.school_number}-maktab · ${teacher.teaching_classes?.join(', ') || ''}`
              : "O'quvchilarning darslar bo'yicha bahosi"}
          </p>
        </div>
      </div>

      {classes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📒</div>
          <h3>Hali darslar yaratilmagan</h3>
          <p>Darslar yarating va o'quvchilar testlar topshirganda jurnal to'ldiriladi</p>
          <Link to="/lessons" className="btn btn-primary" style={{ marginTop:'1rem' }}>
            Darslarga o'tish
          </Link>
        </div>
      ) : (
        <>
          {/* ══ SINF VKЛАДKALARI (tab bar) ══ */}
          <div style={{
            display: 'flex', gap: '0.25rem', marginBottom: '1.5rem',
            borderBottom: '2px solid var(--border-color)',
            overflowX: 'auto', paddingBottom: 0
          }}>
            {classes.map(cls => {
              const clsLessons  = byClass[cls] || [];
              const allStudents = clsLessons.flatMap(l => l.students);
              const graded      = allStudents.filter(s => s.grade > 0).length;
              const total       = allStudents.length;
              const isActive    = activeClass === cls;

              return (
                <button key={cls} onClick={() => handleClassChange(cls)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    padding: '0.6rem 1.4rem', border: 'none', cursor: 'pointer',
                    background: 'transparent', whiteSpace: 'nowrap',
                    borderBottom: isActive ? '3px solid var(--primary-color)' : '3px solid transparent',
                    marginBottom: '-2px', transition: 'all 0.2s',
                    minWidth: '90px'
                  }}>
                  <span style={{
                    fontSize: '1rem', fontWeight: 700,
                    color: isActive ? 'var(--primary-color)' : 'var(--text-primary)'
                  }}>
                    {cls}
                  </span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                    {graded}/{total} baholandi
                  </span>
                </button>
              );
            })}
          </div>

          {/* ══ SINF TANLANGAN — Kontent ══ */}
          {activeClass && (
            <div style={{ display:'flex', gap:'1.5rem', alignItems:'flex-start', flexWrap:'wrap' }}>

              {/* ── Chap: darslar ro'yxati ── */}
              <div style={{ flex:'0 0 210px', display:'flex', flexDirection:'column', gap:'0.5rem' }}>
                <div style={{
                  fontSize:'0.72rem', fontWeight:700, color:'var(--text-secondary)',
                  textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.25rem',
                  paddingLeft:'0.5rem'
                }}>
                  📚 {activeClass} — Darslar
                </div>
                {classLessons.length === 0 ? (
                  <div style={{ fontSize:'0.82rem', color:'var(--text-secondary)', padding:'0.75rem 0.5rem' }}>
                    Bu sinf uchun darslar yo'q
                  </div>
                ) : classLessons.map((lesson, idx) => {
                  const st = gradeStats(lesson.students);
                  const isAct = activeLesson === lesson.id;
                  return (
                    <button key={lesson.id}
                      onClick={() => { setActiveLesson(lesson.id); setSearch(''); }}
                      style={{
                        textAlign:'left', padding:'0.8rem 0.9rem',
                        borderRadius:'10px', border:'none', cursor:'pointer',
                        background: isAct
                          ? 'linear-gradient(135deg,rgba(102,126,234,0.15),rgba(118,75,162,0.15))'
                          : 'var(--card-bg)',
                        borderLeft: isAct ? '3px solid var(--primary-color)' : '3px solid transparent',
                        boxShadow: isAct ? '0 2px 8px rgba(0,0,0,0.07)' : 'none',
                        transition:'all 0.2s'
                      }}>
                      <div style={{ fontWeight:700, fontSize:'0.82rem', color:'var(--text-primary)' }}>
                        {idx+1}-Dars
                      </div>
                      <div style={{
                        fontSize:'0.72rem', color:'var(--text-secondary)', marginTop:'0.15rem',
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'165px'
                      }}>
                        {lesson.title}
                      </div>
                      <div style={{ fontSize:'0.68rem', color:'var(--text-secondary)', marginTop:'0.2rem', display:'flex', gap:'0.5rem' }}>
                        <span>👥 {st.graded}/{st.total}</span>
                        {st.graded > 0 && (
                          <span style={{ color:'var(--primary-color)', fontWeight:600 }}>ø{st.avg}</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* ── O'ng: jurnal jadvali ── */}
              {activeLessonData ? (
                <div style={{ flex:1, minWidth:0 }}>

                  {/* Dars sarlavhasi */}
                  <div style={{
                    background:'linear-gradient(135deg,var(--primary-color),var(--secondary-color))',
                    borderRadius:'14px', padding:'1rem 1.5rem', color:'#fff',
                    marginBottom:'1rem', display:'flex', justifyContent:'space-between',
                    alignItems:'center', flexWrap:'wrap', gap:'0.75rem'
                  }}>
                    <div>
                      <div style={{ fontSize:'0.75rem', opacity:0.8 }}>
                        {activeClass} · {classLessons.indexOf(activeLessonData)+1}-Dars
                      </div>
                      <h3 style={{ margin:'0.1rem 0 0', color:'#fff', fontSize:'1.05rem' }}>
                        {activeLessonData.title}
                      </h3>
                      <div style={{ fontSize:'0.78rem', opacity:0.85 }}>
                        {activeLessonData.grade}-sinf · {activeLessonData.subject}
                      </div>
                    </div>
                    {/* Statistika */}
                    {(() => {
                      const st = gradeStats(activeLessonData.students);
                      return (
                        <div style={{ display:'flex', gap:'1.25rem', flexWrap:'wrap', alignItems:'center' }}>
                          {st.counts.map(({ grade, count }) => count > 0 && (
                            <div key={grade} style={{ textAlign:'center' }}>
                              <div style={{ fontSize:'1.2rem' }}>
                                {{ 5:'🥇', 4:'🥈', 3:'🥉', 2:'😢' }[grade]}
                              </div>
                              <div style={{ fontSize:'0.82rem', fontWeight:700, color:'#fff' }}>
                                {grade} — {count} ta
                              </div>
                            </div>
                          ))}
                          <div style={{ textAlign:'center', borderLeft:'1px solid rgba(255,255,255,0.3)', paddingLeft:'1rem' }}>
                            <div style={{ fontSize:'1.5rem', fontWeight:800 }}>ø{st.avg}</div>
                            <div style={{ fontSize:'0.68rem', opacity:0.85 }}>o'rtacha</div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Qidiruv */}
                  <div style={{ marginBottom:'0.85rem' }}>
                    <input
                      type="text"
                      placeholder="🔍 O'quvchi ismi yoki login..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      style={{
                        width:'100%', padding:'0.5rem 0.85rem', boxSizing:'border-box',
                        borderRadius:'8px', border:'1px solid var(--border-color)',
                        background:'var(--card-bg)', color:'var(--text-primary)', fontSize:'0.88rem'
                      }}
                    />
                  </div>

                  {/* Jadval */}
                  {filteredStudents.length === 0 ? (
                    <div style={{
                      textAlign:'center', padding:'2.5rem', color:'var(--text-secondary)',
                      background:'var(--card-bg)', borderRadius:'12px', border:'1px solid var(--border-color)'
                    }}>
                      {activeLessonData.students.length === 0
                        ? `${activeClass} sinfidan hali hech bir o'quvchi bu darsni bajarmagan`
                        : 'Qidiruv bo\'yicha natijalar topilmadi'}
                    </div>
                  ) : (
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.88rem' }}>
                        <thead>
                          <tr style={{ background:'var(--bg-secondary)' }}>
                            {['#', "O'quvchi", 'Ball', 'Foiz', 'Baho', "O'rtacha", 'Sana'].map(h => (
                              <th key={h} style={{
                                padding:'0.65rem 0.9rem', textAlign:'left', fontWeight:700,
                                color:'var(--text-secondary)', borderBottom:'2px solid var(--border-color)',
                                fontSize:'0.75rem', textTransform:'uppercase', letterSpacing:'0.04em',
                                whiteSpace:'nowrap'
                              }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredStudents.map((s, idx) => (
                            <tr key={s.student_id}
                              style={{ borderBottom:'1px solid var(--border-color)', transition:'background 0.15s' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>

                              <td style={{ padding:'0.7rem 0.9rem', color:'var(--text-secondary)', fontWeight:500 }}>
                                {idx+1}
                              </td>

                              <td style={{ padding:'0.7rem 0.9rem' }}>
                                <div style={{ fontWeight:600 }}>{s.full_name}</div>
                                <div style={{ fontSize:'0.7rem', color:'var(--text-secondary)' }}>
                                  @{s.username} · {s.class_name}
                                </div>
                              </td>

                              <td style={{ padding:'0.7rem 0.9rem', fontWeight:600, whiteSpace:'nowrap' }}>
                                {s.grade > 0
                                  ? `${s.earned_score} / ${s.total_possible}`
                                  : <span style={{ color:'var(--text-secondary)', fontWeight:400, fontSize:'0.82rem' }}>—</span>
                                }
                              </td>

                              <td style={{ padding:'0.7rem 0.9rem' }}>
                                {s.grade > 0 ? (
                                  <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                                    <div style={{
                                      width:'55px', height:'6px', borderRadius:'99px',
                                      background:'var(--bg-secondary)', overflow:'hidden', flexShrink:0
                                    }}>
                                      <div style={{
                                        height:'100%', borderRadius:'99px',
                                        width:`${Math.min(s.percent || 0, 100)}%`,
                                        background: s.percent >= 81 ? '#f59e0b'
                                                   : s.percent >= 60 ? '#6366f1'
                                                   : s.percent >= 40 ? '#92400e' : '#dc2626'
                                      }}/>
                                    </div>
                                    <span style={{ fontWeight:500, fontSize:'0.85rem' }}>{s.percent||0}%</span>
                                  </div>
                                ) : (
                                  <span style={{ color:'var(--text-secondary)', fontSize:'0.82rem' }}>—</span>
                                )}
                              </td>

                              <td style={{ padding:'0.7rem 0.9rem' }}>
                                {s.grade > 0 ? (
                                  <div style={{
                                    display:'inline-flex', alignItems:'center', gap:'0.35rem',
                                    background:gradeBg(s.grade), borderRadius:'20px',
                                    padding:'0.2rem 0.7rem', fontWeight:700
                                  }}>
                                    <span style={{ fontSize:'1rem' }}>{getMedal(s.grade)}</span>
                                    <span style={{ color:gradeColor(s.grade) }}>{s.grade}</span>
                                  </div>
                                ) : (
                                  <span style={{
                                    fontSize:'0.78rem', color:'var(--text-secondary)',
                                    background:'var(--bg-secondary)', borderRadius:'20px',
                                    padding:'0.2rem 0.6rem', display:'inline-block'
                                  }}>
                                    Baholanmagan
                                  </span>
                                )}
                              </td>

                              {/* O'rtacha baho (barcha darslar bo'yicha) */}
                              <td style={{ padding:'0.7rem 0.9rem' }}>
                                {(() => {
                                  // Shu o'quvchining barcha darslardagi baholarini topish
                                  const allGrades = classLessons
                                    .flatMap(l => l.students)
                                    .filter(st => st.student_id === s.student_id && st.grade > 0)
                                    .map(st => st.grade);
                                  if (allGrades.length === 0) return <span style={{ color:'var(--text-secondary)', fontSize:'0.82rem' }}>—</span>;
                                  const avg = (allGrades.reduce((a,v) => a+v, 0) / allGrades.length).toFixed(1);
                                  return (
                                    <span style={{
                                      fontWeight: 700, fontSize: '0.9rem',
                                      color: avg >= 4.5 ? '#f59e0b' : avg >= 3.5 ? '#6366f1' : avg >= 2.5 ? '#92400e' : '#dc2626'
                                    }}>
                                      {avg} <span style={{ fontSize:'0.68rem', color:'var(--text-light)', fontWeight:400 }}>({allGrades.length} dars)</span>
                                    </span>
                                  );
                                })()}
                              </td>

                              <td style={{ padding:'0.7rem 0.9rem', color:'var(--text-secondary)', fontSize:'0.78rem', whiteSpace:'nowrap' }}>
                                {s.updated_at
                                  ? new Date(s.updated_at).toLocaleDateString('uz-UZ')
                                  : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Footer statistika */}
                      <div style={{
                        marginTop:'0.75rem', padding:'0.5rem 0.9rem',
                        display:'flex', gap:'1.5rem', fontSize:'0.78rem',
                        color:'var(--text-secondary)', flexWrap:'wrap'
                      }}>
                        <span>👥 Jami: {filteredStudents.length} ta</span>
                        <span style={{ color:'#16a34a' }}>
                          ✅ Baholangan: {filteredStudents.filter(s => s.grade > 0).length} ta
                        </span>
                        <span style={{ color:'#d97706' }}>
                          ⏳ Baholanmagan: {filteredStudents.filter(s => !s.grade).length} ta
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center',
                  padding:'3rem', color:'var(--text-secondary)' }}>
                  ← Chap tomondagi darsni tanlang
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Journal;
