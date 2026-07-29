import React, { useState, useEffect } from 'react';
import '../assets/css/Pages.css';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const Leaderboard = () => {
  const { user, refreshUser } = useAuth();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, level1, level2, etc.
  const [scope, setScope] = useState('class'); // 'class' | 'school'
  const [selectedClass, setSelectedClass] = useState(null);

  useEffect(() => {
    fetchLeaderboard();
    if (user.role === 'student') refreshUser();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const response = await api.get('/users/leaderboard/top?limit=200');
      setLeaderboard(response.data);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  // Mavjud sinflar (unique)
  const availableClasses = [...new Set(leaderboard.map(s => s.class_name).filter(Boolean))].sort();

  // O'qituvchi uchun birinchi sinfni tanlash
  useEffect(() => {
    if (user.role === 'teacher' && availableClasses.length > 0 && !selectedClass) {
      setSelectedClass(availableClasses[0]);
    }
    if (user.role === 'student' && !selectedClass) {
      setSelectedClass(user.class_name);
    }
  }, [leaderboard]);

  const getLevelColor = (level) => {
    if (!level || level === 0) return 'pending';
    const colors = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
    return colors[level - 1] || 'bronze';
  };

  const getLevelName = (level) => {
    if (!level || level === 0) return '⏳ Aniqlanmagan';
    const names = ['\u{1F949} Bronza', '\u{1F948} Kumush', '\u{1F947} Oltin', '\u{1F48E} Platina', '\u{1F4A0} Brilliant'];
    return names[level - 1] || '\u{1F949} Bronza';
  };

  // Sinf/maktab scope bo'yicha filtrlash
  const scopedLeaderboard = scope === 'school'
    ? leaderboard
    : leaderboard.filter(s => s.class_name === selectedClass);

  // Daraja filtri
  const filteredLeaderboard = filter === 'all'
    ? scopedLeaderboard
    : scopedLeaderboard.filter(u => u.level === parseInt(filter.replace('level', '')));

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
        <h1>🏆 Reyting jadvali</h1>
        <p className="subtitle">
          {scope === 'class' ? `${selectedClass || ''} sinfi reytingi` : 'Maktab bo\'yicha umumiy reyting'}
        </p>
      </div>

      {/* Sinf / Maktab toggle */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button
          className={`filter-btn ${scope === 'class' ? 'active' : ''}`}
          onClick={() => setScope('class')}
          style={{ padding: '0.5rem 1rem', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border-color)', background: scope === 'class' ? 'var(--primary-color)' : 'var(--bg-secondary)', color: scope === 'class' ? '#fff' : 'var(--text-secondary)', transition: 'all 0.2s' }}
        >
          🏫 Sinf bo'yicha
        </button>
        <button
          className={`filter-btn ${scope === 'school' ? 'active' : ''}`}
          onClick={() => setScope('school')}
          style={{ padding: '0.5rem 1rem', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border-color)', background: scope === 'school' ? 'var(--primary-color)' : 'var(--bg-secondary)', color: scope === 'school' ? '#fff' : 'var(--text-secondary)', transition: 'all 0.2s' }}
        >
          🏢 Maktab bo'yicha
        </button>
      </div>

      {/* O'qituvchi uchun sinf tanlash (scope === 'class' bo'lganda) */}
      {(user.role === 'teacher' || user.role === 'admin') && scope === 'class' && availableClasses.length > 0 && (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {availableClasses.map(cls => (
            <button
              key={cls}
              className={`filter-btn ${selectedClass === cls ? 'active' : ''}`}
              onClick={() => setSelectedClass(cls)}
              style={{ padding: '0.4rem 0.9rem', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border-color)', background: selectedClass === cls ? 'var(--primary-color)' : 'var(--bg-secondary)', color: selectedClass === cls ? '#fff' : 'var(--text-secondary)', transition: 'all 0.2s' }}
            >
              {cls} ({leaderboard.filter(s => s.class_name === cls).length})
            </button>
          ))}
        </div>
      )}

      {/* Daraja filtrlari */}
      <div className="leaderboard-filters">
        <button
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          Barchasi
        </button>
        {[1, 2, 3, 4, 5].map((level) => (
          <button
            key={level}
            className={`filter-btn level-${getLevelColor(level)} ${filter === `level${level}` ? 'active' : ''}`}
            onClick={() => setFilter(`level${level}`)}
          >
            {getLevelName(level)}
          </button>
        ))}
      </div>

      {filteredLeaderboard.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🏆</div>
          <h3>Reyting bo'sh</h3>
          <p>Hozircha hech kim yo'q</p>
        </div>
      ) : (
        <>
          {/* Top 3 Podium */}
          {filter === 'all' && filteredLeaderboard.length >= 3 && (
            <div className="podium">
              {/* Second Place */}
              <div className="podium-item podium-second">
                <div className="podium-rank">🥈</div>
                <div className="podium-avatar">
                  {filteredLeaderboard[1].full_name.charAt(0).toUpperCase()}
                </div>
                <h3 className="podium-name">{filteredLeaderboard[1].full_name}</h3>
                <div className={`level-badge level-${getLevelColor(filteredLeaderboard[1].level)}`}>
                  {getLevelName(filteredLeaderboard[1].level)}
                </div>
                <div className="podium-points">{filteredLeaderboard[1].mastery_percent || 0}%</div>
                <div className="podium-stand podium-stand-2">2</div>
              </div>

              {/* First Place */}
              <div className="podium-item podium-first">
                <div className="podium-rank">🥇</div>
                <div className="podium-crown">👑</div>
                <div className="podium-avatar">
                  {filteredLeaderboard[0].full_name.charAt(0).toUpperCase()}
                </div>
                <h3 className="podium-name">{filteredLeaderboard[0].full_name}</h3>
                <div className={`level-badge level-${getLevelColor(filteredLeaderboard[0].level)}`}>
                  {getLevelName(filteredLeaderboard[0].level)}
                </div>
                <div className="podium-points">{filteredLeaderboard[0].mastery_percent || 0}%</div>
                <div className="podium-stand podium-stand-1">1</div>
              </div>

              {/* Third Place */}
              <div className="podium-item podium-third">
                <div className="podium-rank">🥉</div>
                <div className="podium-avatar">
                  {filteredLeaderboard[2].full_name.charAt(0).toUpperCase()}
                </div>
                <h3 className="podium-name">{filteredLeaderboard[2].full_name}</h3>
                <div className={`level-badge level-${getLevelColor(filteredLeaderboard[2].level)}`}>
                  {getLevelName(filteredLeaderboard[2].level)}
                </div>
                <div className="podium-points">{filteredLeaderboard[2].mastery_percent || 0}%</div>
                <div className="podium-stand podium-stand-3">3</div>
              </div>
            </div>
          )}

          {/* Full Leaderboard Table */}
          <div className="leaderboard-table">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>O'quvchi</th>
                  <th>Sinf</th>
                  <th>Daraja</th>
                  <th>O'zlashtirish</th>
                  <th>Testlar</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeaderboard.map((student, index) => (
                  <tr
                    key={student.id}
                    className={student.id === user.id ? 'current-user' : ''}
                  >
                    <td className="rank-cell">
                      <div className={`rank-badge rank-${index + 1}`}>
                        {index === 0 && '🥇'}
                        {index === 1 && '🥈'}
                        {index === 2 && '🥉'}
                        {index > 2 && `#${index + 1}`}
                      </div>
                    </td>
                    <td className="student-cell">
                      <div className="student-info">
                        <div className="student-avatar">
                          {student.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="student-details">
                          <span className="student-name">
                            {student.full_name}
                            {student.id === user.id && (
                              <span className="badge badge-primary badge-sm">Siz</span>
                            )}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{student.class_name || '—'}</td>
                    <td>
                      <div className={`level-badge level-${getLevelColor(student.level)}`}>
                        {getLevelName(student.level)}
                      </div>
                    </td>
                    <td className="points-cell">
                      <strong>📊 {student.mastery_percent || 0}%</strong>
                    </td>
                    <td>{student.total_tests_taken || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Sizning pozitsiyangiz (agar ko'rinib turgan ro'yxatda bo'lmasa) */}
          {user.role === 'student' && !filteredLeaderboard.find(s => s.id === user.id) && (
            <div className="current-user-card">
              <h3>Sizning pozitsiyangiz</h3>
              {(() => {
                const idx = scopedLeaderboard.findIndex(s => s.id === user.id);
                if (idx === -1) return <p>Hali reytingda emassiz — dars boshlanishi bilan paydo bo'lasiz.</p>;
                return (
                  <div className="user-position">
                    <div className="position-rank">#{idx + 1}</div>
                    <div className="position-info">
                      <h4>{user.full_name}</h4>
                      <p>{user.mastery_percent || 0}% • {getLevelName(user.level)}</p>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Leaderboard;
