import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import '../assets/css/Dashboard.css';

const getLevelColor = (level) =>
  ['bronze','silver','gold','platinum','diamond'][level - 1] || 'bronze';

const getLevelLabel = (level) =>
  ['🥉 Bronza','🥈 Kumush','🥇 Oltin','💎 Platina','💠 Brilliant'][level - 1] || '🥉 Bronza';

// ─── Kichik stat kartochkasi ──────────────────────────────────
const StatCard = ({ icon, value, label, sub, className }) => (
  <div className={`stat-card ${className || ''}`}>
    <div className="stat-icon">{icon}</div>
    <div className="stat-content">
      <h3>{value}</h3>
      <p>{label}</p>
      {sub && <span style={{ fontSize:'0.72rem', opacity:0.75 }}>{sub}</span>}
    </div>
  </div>
);

const Dashboard = () => {
  const { user, refreshUser } = useAuth();
  const [stats,       setStats]       = useState(null);
  const [recentTests, setRecentTests] = useState([]);
  const [recentAssign,setRecentAssign]= useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => { fetchDashboardData(); }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Statistika
      const endpoint = user.role === 'student'
        ? `/statistics/user/${user.id}`
        : '/statistics/overall';
      const statsRes = await api.get(endpoint).catch(() => ({ data: {} }));
      setStats(statsRes.data);

      // O'quvchi bo'lsa — daraja/ball har safar yangilansin
      if (user.role === 'student') {
        await refreshUser();
      }

      if (user.role === 'student') {
        // So'nggi test natijalari
        const resultsRes = await api.get('/results/my-results').catch(() => ({ data: [] }));
        setRecentTests((Array.isArray(resultsRes.data) ? resultsRes.data : []).slice(0, 4));

        // So'nggi amaliy topshiriqlar (lesson-progress dan)
        const lpRes = await api.get('/lesson-progress/student/all').catch(() => ({ data: { progresses: [] } }));
        const allAssign = (lpRes.data.progresses || []).flatMap(p =>
          (p.assignment_results || []).filter(a => a.submission_id).map(a => ({
            ...a,
            lesson_title: p.lesson_title
          }))
        );
        setRecentAssign(allAssign.slice(0, 4));

      } else {
        // O'qituvchi: so'nggi testlar
        const testsRes = await api.get('/tests').catch(() => ({ data: [] }));
        setRecentTests((Array.isArray(testsRes.data) ? testsRes.data : []).slice(0, 4));

        // O'qituvchi: so'nggi topshirilgan amaliy ish
        const lessonsRes = await api.get('/lessons').catch(() => ({ data: [] }));
        const lessons = Array.isArray(lessonsRes.data) ? lessonsRes.data : [];
        setRecentAssign(lessons.slice(0, 4));
      }

      // Reyting
      const lbRes = await api.get('/users/leaderboard/top').catch(() => ({ data: [] }));
      setLeaderboard((Array.isArray(lbRes.data) ? lbRes.data : []).slice(0, 5));

    } catch (err) {
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <p>Yuklanmoqda...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">

      {/* ── Sarlavha ── */}
      <div className="dashboard-header">
        <h1>Xush kelibsiz, {user.full_name}! 👋</h1>
        <p className="subtitle">
          {user.role === 'student' && "Bilimlaringizni sinab ko'ring va yutuqlarga erishing!"}
          {user.role === 'teacher' && "O'quvchilar natijalarini kuzating va darslar boshqaring"}
          {user.role === 'admin' && 'Platformani boshqaring va statistikalarni ko\'ring'}
        </p>
      </div>

      {/* ════════════ O'QUVCHI STATISTIKASI ════════════ */}
      {user.role === 'student' && stats && (
        <>
          {/* Asosiy 4 ta karta */}
          <div className="stats-grid">
            <StatCard
              icon="📝" className="stat-primary"
              value={stats.totalAttempts}
              label="Topshirilgan testlar"
              sub={stats.totalPassed > 0 ? `${stats.totalPassed} ta o'tdi` : null}
            />
            <StatCard
              icon="📊" className="stat-success"
              value={stats.averageScore ? `${stats.averageScore.toFixed(1)}%` : '0%'}
              label="O'rtacha test bali"
              sub={stats.totalAttempts > 0 ? `${stats.totalAttempts} ta testdan` : null}
            />
            <StatCard
              icon="🖥️" className="stat-info"
              value={`${stats.gradedAssignments || 0} / ${stats.totalAssignments || 0}`}
              label="Amaliy topshiriqlar"
              sub={stats.avgAssignmentPct > 0 ? `o'rtacha ${stats.avgAssignmentPct}%` : 'Baholanmagan'}
            />
            <StatCard
              icon="🎓" className="stat-purple"
              value={`${stats.gradedLessons || 0} / ${stats.totalLessons || 0}`}
              label="Darslar bajarildi"
              sub="Batafsil foiz — Daraja kartasida"
            />
          </div>

          {/* Ballar, daraja va medallar */}
          <div className="stats-grid" style={{ marginTop: '0.75rem' }}>
            <StatCard
              icon="⭐" className="stat-warning"
              value={stats.user?.mastery_possible > 0
                ? `${stats.user.mastery_earned} / ${stats.user.mastery_possible}`
                : '—'}
              label="Ball"
              sub={`⭐ ${user.points || 0} faollik balli`}
            />
            <StatCard
              icon="🏆" className={`stat-level level-${getLevelColor(user.level)}`}
              value={getLevelLabel(user.level)}
              label={`${user.mastery_percent || 0}% o'zlashtirish`}
            />
            {stats.medalCounts && (
              <>
                <div className="stat-card stat-gold">
                  <div className="stat-icon">🥇</div>
                  <div className="stat-content">
                    <h3>
                      {stats.medalCounts.gold}×🥇{' '}
                      {stats.medalCounts.silver}×🥈{' '}
                      {stats.medalCounts.bronze}×🥉{' '}
                      {stats.medalCounts.red}×😢
                    </h3>
                    <p>Medallar va stikerlar</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* ════════════ O'QITUVCHI / ADMIN STATISTIKASI ════════════ */}
      {(user.role === 'teacher' || user.role === 'admin') && stats && (
        <>
          {/* Birinchi qator */}
          <div className="stats-grid">
            <StatCard
              icon="👥" className="stat-primary"
              value={stats.totalStudents || stats.totalUsers || 0}
              label="O'quvchilar"
              sub={user.role === 'teacher' ? "Mening sinflarim" : "Jami platformada"}
            />
            <StatCard
              icon="📚" className="stat-info"
              value={stats.totalLessons || 0}
              label="Darslar"
              sub={user.role === 'teacher' ? "Men yaratganlar" : "Jami"}
            />
            <StatCard
              icon="📝" className="stat-success"
              value={stats.totalTests || 0}
              label="Testlar"
              sub={`${stats.totalAttempts || 0} ta urinish`}
            />
            <StatCard
              icon="📈" className="stat-warning"
              value={stats.averageScore ? `${stats.averageScore.toFixed(1)}%` : '0%'}
              label="O'rtacha test bali"
            />
          </div>

          {/* Ikkinchi qator — amaliy topshiriqlar */}
          <div className="stats-grid" style={{ marginTop: '0.75rem' }}>
            <StatCard
              icon="🖥️" className="stat-purple"
              value={stats.totalAssignments || 0}
              label="Amaliy topshiriqlar"
              sub="Jami yaratilgan"
            />
            <StatCard
              icon="📤" className="stat-info"
              value={stats.submittedAssigns || stats.gradedAssignments || 0}
              label="Topshirilgan ishlar"
              sub={`${stats.gradedAssignments || 0} ta baholangan`}
            />
            {user.role === 'teacher' && (
              <>
                <StatCard
                  icon="🎓" className="stat-success"
                  value={`${stats.avgLessonPct || 0}%`}
                  label="Dars o'zlashtirish"
                  sub={`${stats.totalProgress || 0} ta progress`}
                />
                <div className="stat-card stat-gold">
                  <div className="stat-icon">🏆</div>
                  <div className="stat-content">
                    <h3>
                      {(stats.gradeCounts?.[5] || 0)}×🥇{' '}
                      {(stats.gradeCounts?.[4] || 0)}×🥈{' '}
                      {(stats.gradeCounts?.[3] || 0)}×🥉{' '}
                      {(stats.gradeCounts?.[2] || 0)}×😢
                    </h3>
                    <p>O'quvchilar baholari</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* ── 2 ustunli qism ── */}
      <div className="dashboard-grid" style={{ marginTop: '1.5rem' }}>

        {/* So'nggi faoliyat */}
        <div className="dashboard-section">
          <div className="section-header">
            <h2>
              {user.role === 'student' ? "🕐 So'nggi testlar" : "🕐 So'nggi testlar"}
            </h2>
            <Link to={user.role === 'student' ? '/results' : '/lessons'} className="btn btn-sm btn-outline">
              Barchasi
            </Link>
          </div>
          <div className="items-list">
            {recentTests.length === 0 ? (
              <div className="empty-state">
                <p>{user.role === 'student' ? 'Hali test topshirilmagan' : 'Hali test yaratilmagan'}</p>
              </div>
            ) : recentTests.map(item => (
              <div key={item.id} className="list-item">
                <div className="item-content">
                  <h4>{item.test_title || item.title}</h4>
                  {user.role === 'student' ? (
                    <p className="item-meta">
                      <strong>{item.score_percentage?.toFixed(1)}%</strong>
                      {' · '}{item.correct_answers}/{item.total_questions} to'g'ri
                      {' · '}<strong style={{color:'#6366f1'}}>{(item.correct_answers||0) * 2} ball</strong>
                      {' · '}{new Date(item.submitted_at || item.created_at).toLocaleDateString('uz-UZ')}
                    </p>
                  ) : (
                    <p className="item-meta">
                      {item.questions_count || 0} savol
                      {' · '}{item.time_limit || item.duration} daqiqa
                      {' · '}<span className={`badge ${item.is_published ? 'badge-success' : 'badge-secondary'}`} style={{ fontSize:'0.7rem' }}>
                        {item.is_published ? 'Nashr' : 'Qoralama'}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* So'nggi amaliy / Reyting */}
        <div className="dashboard-section">
          {user.role === 'student' ? (
            <>
              <div className="section-header">
                <h2>🖥️ Amaliy topshiriqlar</h2>
                <Link to="/results" className="btn btn-sm btn-outline">Barchasi</Link>
              </div>
              <div className="items-list">
                {recentAssign.length === 0 ? (
                  <div className="empty-state">
                    <p>Hali amaliy topshiriq topshirilmagan</p>
                  </div>
                ) : recentAssign.map((a, idx) => (
                  <div key={idx} className="list-item">
                    <div className="item-content">
                      <h4>{a.assignment_title}</h4>
                      <p className="item-meta">
                        {a.lesson_title}
                        {' · '}
                        {a.status === 'graded'
                          ? <strong style={{ color:'#16a34a' }}>{a.score}/{a.max_score} ball</strong>
                          : <span style={{ color:'#d97706' }}>Tekshirilmoqda</span>
                        }
                        {a.graded_by === 'ai' && <span style={{ color:'#9333ea' }}> · 🤖</span>}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="section-header">
                <h2>🏆 Reyting</h2>
                <Link to="/leaderboard" className="btn btn-sm btn-outline">To'liq reyting</Link>
              </div>
              <div className="leaderboard-list">
                {leaderboard.map((leader, index) => (
                  <div key={leader.id} className="leaderboard-item">
                    <div className={`rank rank-${index + 1}`}>
                      {index === 0 && '🥇'}{index === 1 && '🥈'}{index === 2 && '🥉'}
                      {index > 2 && `#${index + 1}`}
                    </div>
                    <div className="leader-avatar">{leader.full_name.charAt(0).toUpperCase()}</div>
                    <div className="leader-info">
                      <h4>{leader.full_name}</h4>
                      <p>{leader.mastery_percent || 0}% · {getLevelLabel(leader.level)}</p>
                    </div>
                    <div className={`level-badge level-${getLevelColor(leader.level)}`}>
                      {getLevelLabel(leader.level)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Reyting (o'quvchi uchun alohida) ── */}
      {user.role === 'student' && (
        <div className="dashboard-section" style={{ marginTop: '1.5rem' }}>
          <div className="section-header">
            <h2>🏆 Reyting</h2>
            <Link to="/leaderboard" className="btn btn-sm btn-outline">To'liq reyting</Link>
          </div>
          <div className="leaderboard-list">
            {leaderboard.map((leader, index) => (
              <div key={leader.id} className={`leaderboard-item ${leader.id === user.id ? 'current-user' : ''}`}>
                <div className={`rank rank-${index + 1}`}>
                  {index === 0 && '🥇'}{index === 1 && '🥈'}{index === 2 && '🥉'}
                  {index > 2 && `#${index + 1}`}
                </div>
                <div className="leader-avatar">{leader.full_name.charAt(0).toUpperCase()}</div>
                <div className="leader-info">
                  <h4>{leader.full_name} {leader.id === user.id && <span style={{ color:'var(--primary-color)', fontSize:'0.75rem' }}>(Siz)</span>}</h4>
                  <p>{leader.points} ball · Daraja {leader.level}</p>
                </div>
                <div className={`level-badge level-${getLevelColor(leader.level)}`}>
                  {getLevelLabel(leader.level)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tezkor harakatlar ── */}
      <div className="quick-actions" style={{ marginTop: '1.5rem' }}>
        <h2>Tezkor harakatlar</h2>
        <div className="action-cards">
          {user.role === 'student' && (
            <>
              <Link to="/lessons" className="action-card">
                <span className="action-icon">📚</span>
                <h3>Darslar</h3>
                <p>Darslarni ko'rish va testlar topshirish</p>
              </Link>
              <Link to="/results" className="action-card">
                <span className="action-icon">📊</span>
                <h3>Natijalar</h3>
                <p>Darslar bo'yicha natijalarim</p>
              </Link>
              <Link to="/leaderboard" className="action-card">
                <span className="action-icon">🏆</span>
                <h3>Reyting</h3>
                <p>Sinfdoshlar reytingini ko'rish</p>
              </Link>
            </>
          )}
          {(user.role === 'teacher' || user.role === 'admin') && (
            <>
              <Link to="/lessons" className="action-card">
                <span className="action-icon">📚</span>
                <h3>Darslar</h3>
                <p>Darslar va testlar boshqaruvi</p>
              </Link>
              <Link to="/journal" className="action-card">
                <span className="action-icon">📒</span>
                <h3>Jurnal</h3>
                <p>O'quvchilar baholarini ko'rish</p>
              </Link>
              <Link to="/students" className="action-card">
                <span className="action-icon">👥</span>
                <h3>O'quvchilar</h3>
                <p>O'quvchilar portfoliosini ko'rish</p>
              </Link>
              <Link to="/leaderboard" className="action-card">
                <span className="action-icon">📈</span>
                <h3>Statistika</h3>
                <p>O'quvchilar reytingi</p>
              </Link>
            </>
          )}
        </div>
      </div>

    </div>
  );
};

export default Dashboard;
