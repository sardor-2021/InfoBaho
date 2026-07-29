import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import '../assets/css/AIAnalytics.css';

const AIAnalytics = () => {
  const { user } = useAuth();
  const [analysis, setAnalysis] = useState(null);
  const [rawData, setRawData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [askQuestion, setAskQuestion] = useState('');
  const [askAnswer, setAskAnswer] = useState('');
  const [askLoading, setAskLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [lastAnalysisDate, setLastAnalysisDate] = useState(null);


  useEffect(() => {
    fetchData();
    fetchLastAnalysis();
  }, []);

  const fetchData = async () => {
    try {
      setDataLoading(true);
      const res = await api.get('/ai-analytics/data');
      setRawData(res.data);
    } catch (err) {
      console.error('Data fetch error:', err);
      setError('Ma\'lumotlarni yuklashda xatolik');
    } finally {
      setDataLoading(false);
    }
  };

  const fetchLastAnalysis = async () => {
    try {
      const res = await api.get('/ai-analytics/last-analysis');
      if (res.data.exists) {
        setAnalysis(res.data);
        setLastAnalysisDate(res.data.generated_at);
      }
    } catch (err) {
      console.error('Last analysis fetch error:', err);
    }
  };

  const runAnalysis = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.post('/ai-analytics/analyze');
      setAnalysis(res.data);
      setLastAnalysisDate(res.data.generated_at);
      setActiveTab('overview');
    } catch (err) {
      console.error('Analysis error:', err);
      setError('AI tahlilda xatolik: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };


  const handleAsk = async (e) => {
    e.preventDefault();
    if (!askQuestion.trim()) return;

    try {
      setAskLoading(true);
      const res = await api.post('/ai-analytics/ask', {
        question: askQuestion,
        context_data: rawData ? {
          lessons_count: rawData.lessons?.length,
          classes: rawData.teacher?.teaching_classes
        } : null
      });

      setChatHistory(prev => [...prev, {
        question: askQuestion,
        answer: res.data.answer,
        time: new Date().toLocaleTimeString('uz-UZ')
      }]);
      setAskQuestion('');
    } catch (err) {
      console.error('Ask error:', err);
      setChatHistory(prev => [...prev, {
        question: askQuestion,
        answer: 'Xatolik yuz berdi. Qaytadan urinib ko\'ring.',
        time: new Date().toLocaleTimeString('uz-UZ'),
        isError: true
      }]);
    } finally {
      setAskLoading(false);
    }
  };


  const getPriorityColor = (priority) => {
    switch(priority) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getPriorityLabel = (priority) => {
    switch(priority) {
      case 'high': return 'Yuqori';
      case 'medium': return 'O\'rta';
      case 'low': return 'Past';
      default: return priority;
    }
  };

  const getCategoryIcon = (category) => {
    switch(category) {
      case 'methodology': return '📖';
      case 'content': return '📝';
      case 'assessment': return '📊';
      case 'individual': return '👤';
      default: return '💡';
    }
  };

  if (dataLoading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Ma'lumotlar yuklanmoqda...</p>
      </div>
    );
  }


  return (
    <div className="ai-analytics-container">
      {/* Header */}
      <div className="ai-analytics-header">
        <div className="header-content">
          <div className="header-title">
            <h1>AI Tahlil</h1>
            <p className="subtitle">
              Sun'iy intellekt yordamida o'quvchilar natijalarini tahlil qiling
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
            <button
              className={`btn-analyze ${loading ? 'loading' : ''}`}
              onClick={runAnalysis}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="btn-spinner"></span>
                  Tahlil qilinmoqda...
                </>
              ) : (
                <>
                  <span className="btn-icon">🤖</span>
                  {lastAnalysisDate ? 'Qayta tahlil qilish' : 'AI Tahlil boshlash'}
                </>
              )}
            </button>
            {lastAnalysisDate && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Oxirgi tahlil: {new Date(lastAnalysisDate).toLocaleDateString('uz-UZ')} {new Date(lastAnalysisDate).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        {rawData && (
          <div className="quick-stats">
            <div className="quick-stat">
              <span className="stat-number">{rawData.lessons?.length || 0}</span>
              <span className="stat-label">Darslar</span>
            </div>
            <div className="quick-stat">
              <span className="stat-number">{rawData.class_stats?.reduce((s, c) => s + c.total_students, 0) || 0}</span>
              <span className="stat-label">O'quvchilar</span>
            </div>
            <div className="quick-stat">
              <span className="stat-number">
                {rawData.lessons?.reduce((s, l) => s + l.test_stats?.length, 0) || 0}
              </span>
              <span className="stat-label">Testlar</span>
            </div>
            <div className="quick-stat">
              <span className="stat-number">{rawData.teacher?.teaching_classes?.length || 0}</span>
              <span className="stat-label">Sinflar</span>
            </div>
          </div>
        )}
      </div>

      {error && <div className="ai-error">{error}</div>}


      {/* Tabs */}
      {analysis && (
        <div className="ai-tabs">
          <button
            className={`ai-tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <span>📊</span> Umumiy
          </button>
          <button
            className={`ai-tab ${activeTab === 'difficulties' ? 'active' : ''}`}
            onClick={() => setActiveTab('difficulties')}
          >
            <span>⚠️</span> Qiyinchiliklar
          </button>
          <button
            className={`ai-tab ${activeTab === 'students' ? 'active' : ''}`}
            onClick={() => setActiveTab('students')}
          >
            <span>👥</span> O'quvchilar
          </button>
          <button
            className={`ai-tab ${activeTab === 'recommendations' ? 'active' : ''}`}
            onClick={() => setActiveTab('recommendations')}
          >
            <span>💡</span> Tavsiyalar
          </button>
          <button
            className={`ai-tab ${activeTab === 'classes' ? 'active' : ''}`}
            onClick={() => setActiveTab('classes')}
          >
            <span>🏫</span> Sinflar
          </button>
          <button
            className={`ai-tab ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            <span>💬</span> AI Savol
          </button>
        </div>
      )}

      {/* No analysis yet */}
      {!analysis && !loading && (
        <div className="no-analysis">
          <div className="no-analysis-icon">🧠</div>
          <h2>AI Tahlilni boshlang</h2>
          <p>
            "AI Tahlil boshlash" tugmasini bosing. Sun'iy intellekt sizning barcha 
            darslar, testlar va topshiriqlar natijalarini tahlil qilib, batafsil 
            hisobot va tavsiyalar beradi.
          </p>
          <div className="features-grid">
            <div className="feature-item">
              <span className="feature-icon">📈</span>
              <span>Qiyin mavzularni aniqlash</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">👤</span>
              <span>Zaif o'quvchilarni aniqlash</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">💡</span>
              <span>O'qitish tavsiyalari</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">🏫</span>
              <span>Sinflar solishtiruvi</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">🎯</span>
              <span>Haftalik rejalar</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">💬</span>
              <span>AI bilan suhbat</span>
            </div>
          </div>
        </div>
      )}


      {/* Overview Tab */}
      {analysis && activeTab === 'overview' && (
        <div className="ai-content">
          {/* Summary Card */}
          <div className="ai-card ai-summary-card">
            <div className="card-header">
              <h2>📋 Umumiy xulosa</h2>
              <span className="generated-time">
                {new Date(analysis.generated_at).toLocaleString('uz-UZ')}
              </span>
            </div>
            <p className="summary-text">{analysis.analysis?.overall_summary}</p>
          </div>

          {/* Strengths */}
          {analysis.analysis?.strengths?.length > 0 && (
            <div className="ai-card strengths-card">
              <div className="card-header">
                <h2>✅ Kuchli tomonlar</h2>
              </div>
              <ul className="strengths-list">
                {analysis.analysis.strengths.map((s, i) => (
                  <li key={i}><span className="strength-icon">🌟</span>{s}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Weekly Focus */}
          {analysis.analysis?.weekly_focus && (
            <div className="ai-card weekly-card">
              <div className="card-header">
                <h2>🎯 Bu hafta uchun</h2>
              </div>
              <div className="weekly-content">
                <h3>{analysis.analysis.weekly_focus.topic}</h3>
                <p className="weekly-reason">{analysis.analysis.weekly_focus.reason}</p>
                {analysis.analysis.weekly_focus.activities?.length > 0 && (
                  <div className="weekly-activities">
                    <h4>Tavsiya etilgan mashqlar:</h4>
                    <ul>
                      {analysis.analysis.weekly_focus.activities.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Motivation Tips */}
          {analysis.analysis?.motivation_tips?.length > 0 && (
            <div className="ai-card motivation-card">
              <div className="card-header">
                <h2>🚀 Motivatsiya maslahatlari</h2>
              </div>
              <div className="tips-grid">
                {analysis.analysis.motivation_tips.map((tip, i) => (
                  <div key={i} className="tip-item">
                    <span className="tip-number">{i + 1}</span>
                    <span className="tip-text">{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}


      {/* Difficulties Tab */}
      {analysis && activeTab === 'difficulties' && (
        <div className="ai-content">
          <div className="ai-card">
            <div className="card-header">
              <h2>⚠️ Qiyinchilik tug'dirgan mavzular</h2>
              <span className="card-badge">
                {analysis.analysis?.difficult_topics?.length || 0} ta mavzu
              </span>
            </div>

            {analysis.analysis?.difficult_topics?.length > 0 ? (
              <div className="difficulties-list">
                {analysis.analysis.difficult_topics.map((topic, i) => (
                  <div key={i} className="difficulty-item">
                    <div className="difficulty-header">
                      <div className="difficulty-title">
                        <span className="difficulty-rank">#{i + 1}</span>
                        <div>
                          <h3>{topic.topic}</h3>
                          <span className="difficulty-lesson">{topic.lesson}</span>
                        </div>
                      </div>
                      <div className="error-rate-badge" style={{
                        backgroundColor: topic.error_rate > 70 ? '#fef2f2' : topic.error_rate > 50 ? '#fffbeb' : '#f0fdf4',
                        color: topic.error_rate > 70 ? '#dc2626' : topic.error_rate > 50 ? '#d97706' : '#16a34a'
                      }}>
                        {topic.error_rate}% xato
                      </div>
                    </div>
                    <div className="difficulty-details">
                      <div className="detail-row">
                        <span className="detail-label">❓ Sabab:</span>
                        <span>{topic.reason}</span>
                      </div>
                      <div className="detail-row suggestion">
                        <span className="detail-label">💡 Tavsiya:</span>
                        <span>{topic.suggestion}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state-small">
                <p>Hozircha qiyin mavzular aniqlanmadi</p>
              </div>
            )}
          </div>

          {/* Raw hard topics from data */}
          {analysis.hard_topics?.length > 0 && (
            <div className="ai-card">
              <div className="card-header">
                <h2>📊 Eng ko'p xato qilingan savollar</h2>
              </div>
              <div className="hard-questions-list">
                {analysis.hard_topics.map((q, i) => (
                  <div key={i} className="hard-question-item">
                    <div className="hq-content">
                      <span className="hq-text">{q.question}</span>
                      <span className="hq-lesson">{q.lesson_title}</span>
                    </div>
                    <div className="hq-rate">{q.error_rate}%</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}


      {/* Students Tab */}
      {analysis && activeTab === 'students' && (
        <div className="ai-content">
          <div className="ai-card">
            <div className="card-header">
              <h2>👥 Qo'shimcha yordam kerak bo'lgan o'quvchilar</h2>
              <span className="card-badge">
                {analysis.analysis?.students_need_help?.length || 0} ta o'quvchi
              </span>
            </div>

            {analysis.analysis?.students_need_help?.length > 0 ? (
              <div className="students-help-list">
                {analysis.analysis.students_need_help.map((student, i) => (
                  <div key={i} className="student-help-item">
                    <div className="student-avatar">
                      {student.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="student-info">
                      <div className="student-name-row">
                        <h3>{student.name}</h3>
                        <span className="class-badge">{student.class_name}</span>
                      </div>
                      <div className="student-weak-areas">
                        <span className="weak-label">Zaif tomonlar:</span>
                        <span>{student.weak_areas}</span>
                      </div>
                      <div className="student-recommendation">
                        <span className="rec-label">💡 Tavsiya:</span>
                        <span>{student.recommendation}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state-small">
                <p>Hozircha ma'lumot yetarli emas</p>
              </div>
            )}
          </div>

          {/* Weak students raw data */}
          {analysis.weak_students?.length > 0 && (
            <div className="ai-card">
              <div className="card-header">
                <h2>📉 Kam ball olgan o'quvchilar (ma'lumot)</h2>
              </div>
              <div className="weak-students-table">
                <table>
                  <thead>
                    <tr>
                      <th>Ism</th>
                      <th>Sinf</th>
                      <th>Mavzu</th>
                      <th>Ball</th>
                      <th>Turi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.weak_students.map((s, i) => (
                      <tr key={i}>
                        <td><strong>{s.name}</strong></td>
                        <td>{s.class_name}</td>
                        <td>{s.topic}</td>
                        <td className="score-cell">
                          {s.type === 'test' ? `${s.score}%` : s.score}
                        </td>
                        <td>
                          <span className={`type-badge ${s.type}`}>
                            {s.type === 'test' ? '📝 Test' : '🖥️ Amaliy'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}


      {/* Recommendations Tab */}
      {analysis && activeTab === 'recommendations' && (
        <div className="ai-content">
          <div className="ai-card">
            <div className="card-header">
              <h2>💡 O'qituvchiga tavsiyalar</h2>
              <span className="card-badge">
                {analysis.analysis?.teaching_recommendations?.length || 0} ta tavsiya
              </span>
            </div>

            {analysis.analysis?.teaching_recommendations?.length > 0 ? (
              <div className="recommendations-list">
                {analysis.analysis.teaching_recommendations.map((rec, i) => (
                  <div key={i} className="recommendation-item">
                    <div className="rec-header">
                      <div className="rec-left">
                        <span className="rec-icon">{getCategoryIcon(rec.category)}</span>
                        <div>
                          <h3>{rec.title}</h3>
                          <span className="rec-category">{rec.category}</span>
                        </div>
                      </div>
                      <span className="priority-badge" style={{
                        backgroundColor: getPriorityColor(rec.priority) + '20',
                        color: getPriorityColor(rec.priority)
                      }}>
                        {getPriorityLabel(rec.priority)}
                      </span>
                    </div>
                    <p className="rec-description">{rec.description}</p>
                    {rec.affected_students_percent > 0 && (
                      <div className="rec-affected">
                        <div className="affected-bar">
                          <div
                            className="affected-fill"
                            style={{ width: `${rec.affected_students_percent}%` }}
                          ></div>
                        </div>
                        <span>{rec.affected_students_percent}% o'quvchilarga tegishli</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state-small">
                <p>Tavsiyalar mavjud emas</p>
              </div>
            )}
          </div>
        </div>
      )}


      {/* Classes Tab */}
      {analysis && activeTab === 'classes' && (
        <div className="ai-content">
          <div className="ai-card">
            <div className="card-header">
              <h2>🏫 Sinflar solishtiruvi</h2>
            </div>

            {analysis.analysis?.class_comparison?.length > 0 ? (
              <div className="classes-grid">
                {analysis.analysis.class_comparison.map((cls, i) => (
                  <div key={i} className={`class-card status-${cls.status}`}>
                    <div className="class-card-header">
                      <h3>{cls.class_name}</h3>
                      <span className={`status-badge ${cls.status}`}>
                        {cls.status === 'yaxshi' ? '🟢' : cls.status === 'o\'rta' ? '🟡' : '🔴'}
                        {cls.status}
                      </span>
                    </div>
                    <div className="class-score">
                      <div className="score-circle">
                        <span className="score-value">{cls.avg_score}%</span>
                      </div>
                    </div>
                    <p className="class-note">{cls.note}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state-small">
                <p>Sinf solishtiruvi uchun yetarli ma'lumot yo'q</p>
              </div>
            )}
          </div>

          {/* Raw class data */}
          {rawData?.class_stats?.length > 0 && (
            <div className="ai-card">
              <div className="card-header">
                <h2>📊 Sinf statistikasi (joriy)</h2>
              </div>
              <div className="class-stats-list">
                {rawData.class_stats.map((cls, i) => (
                  <div key={i} className="class-stat-item">
                    <div className="class-stat-header">
                      <h3>{cls.class_name}</h3>
                      <span>{cls.total_students} o'quvchi</span>
                    </div>
                    {cls.students?.length > 0 && (
                      <div className="class-students-mini">
                        {cls.students.slice(0, 5).map((s, j) => (
                          <div key={j} className="mini-student">
                            <span>{s.full_name}</span>
                            <span className="mini-score">
                              {s.avg_score}% | {s.points} ball
                            </span>
                          </div>
                        ))}
                        {cls.students.length > 5 && (
                          <p className="more-students">
                            +{cls.students.length - 5} ta boshqa o'quvchi
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}


      {/* Chat Tab */}
      {activeTab === 'chat' && (
        <div className="ai-content">
          <div className="ai-card chat-card">
            <div className="card-header">
              <h2>💬 AI Yordamchi bilan suhbat</h2>
              <span className="card-subtitle">
                O'qitish jarayoni haqida savol bering
              </span>
            </div>

            <div className="chat-container">
              {chatHistory.length === 0 && (
                <div className="chat-welcome">
                  <div className="chat-welcome-icon">🤖</div>
                  <h3>AI Yordamchiga savol bering!</h3>
                  <p>Masalan:</p>
                  <div className="example-questions">
                    <button onClick={() => setAskQuestion('10-A sinfidagi zaif o\'quvchilarga qanday yondashuv kerak?')}>
                      10-A sinfidagi zaif o'quvchilarga qanday yondashuv kerak?
                    </button>
                    <button onClick={() => setAskQuestion('Algoritmlar mavzusini qiziqarli qilish uchun nima qilsam bo\'ladi?')}>
                      Algoritmlar mavzusini qiziqarli qilish uchun nima qilsam bo'ladi?
                    </button>
                    <button onClick={() => setAskQuestion('Test natijalarini ota-onalarga qanday tushuntirish kerak?')}>
                      Test natijalarini ota-onalarga qanday tushuntirish kerak?
                    </button>
                    <button onClick={() => setAskQuestion('Python dasturlash darsini yanada samarali o\'tish uchun tavsiyalar bering')}>
                      Python dasturlash darsini samarali o'tish uchun tavsiyalar
                    </button>
                  </div>
                </div>
              )}

              {chatHistory.length > 0 && (
                <div className="chat-messages">
                  {chatHistory.map((msg, i) => (
                    <div key={i} className="chat-message-group">
                      <div className="chat-message user-message">
                        <div className="message-avatar user-avatar">👤</div>
                        <div className="message-content">
                          <p>{msg.question}</p>
                          <span className="message-time">{msg.time}</span>
                        </div>
                      </div>
                      <div className={`chat-message ai-message ${msg.isError ? 'error' : ''}`}>
                        <div className="message-avatar ai-avatar">🤖</div>
                        <div className="message-content">
                          <p style={{ whiteSpace: 'pre-wrap' }}>{msg.answer}</p>
                          <span className="message-time">{msg.time}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>


            <form onSubmit={handleAsk} className="chat-input-form">
              <input
                type="text"
                value={askQuestion}
                onChange={(e) => setAskQuestion(e.target.value)}
                placeholder="Savolingizni yozing..."
                disabled={askLoading}
                className="chat-input"
              />
              <button
                type="submit"
                disabled={askLoading || !askQuestion.trim()}
                className="chat-send-btn"
              >
                {askLoading ? <span className="btn-spinner"></span> : '➤'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {loading && (
        <div className="analysis-loading">
          <div className="loading-content">
            <div className="ai-loading-animation">
              <span>🧠</span>
              <div className="loading-dots">
                <div className="dot"></div>
                <div className="dot"></div>
                <div className="dot"></div>
              </div>
            </div>
            <h3>AI tahlil qilmoqda...</h3>
            <p>Sun'iy intellekt ma'lumotlarni o'rganib, tavsiyalar tayyorlamoqda</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIAnalytics;
