import React, { useState, useMemo } from 'react';
import DOMPurify from 'dompurify';
import api from '../services/api';

/**
 * AdaptiveTestStudentView — O'quvchi uchun adaptiv test (mashq rejimi)
 * Zinapoya algoritmi: to'g'ri → qiyinroq, noto'g'ri → osonroq
 * Qayta yechish mumkin, natijalar saqlanadi
 */
const AdaptiveTestStudentView = ({ adaptiveTest }) => {
  // Agar myResults mavjud bo'lsa — to'g'ridan-to'g'ri natija ko'rsatiladi
  const [stage, setStage] = useState(adaptiveTest.myResults ? 'finished' : 'intro');
  const [attemptId, setAttemptId] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [lastAnswer, setLastAnswer] = useState(null); // { isCorrect, correctOption }
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(adaptiveTest.myResults || null);
  const [bonusMessage, setBonusMessage] = useState(null);
  const [currentDifficulty, setCurrentDifficulty] = useState(3);

  const totalQuestions = 15;

  // Variantlar aralashtirilgan (Fisher-Yates) — hooks shartli bo'lmasligi uchun tepada
  const shuffledOptions = useMemo(() => {
    if (!currentQuestion) return [];
    const opts = [
      { letter: 'a', text: currentQuestion.option_a },
      { letter: 'b', text: currentQuestion.option_b },
      { letter: 'c', text: currentQuestion.option_c },
      { letter: 'd', text: currentQuestion.option_d },
    ];
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }
    return opts;
  }, [currentQuestion?.id]);

  // Testni boshlash
  const handleStart = async () => {
    try {
      setLoading(true);
      const res = await api.post(`/adaptive-tests/${adaptiveTest.id}/start`);
      setAttemptId(res.data.attemptId);
      setCurrentQuestion(res.data.question);
      setQuestionNumber(1);
      setCurrentDifficulty(res.data.currentDifficulty || 3);
      setStage('testing');
    } catch (err) {
      alert('Testni boshlashda xatolik: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Javob yuborish
  const handleAnswer = async () => {
    if (!selectedOption) return;
    try {
      setSubmitting(true);
      const res = await api.post(`/adaptive-attempts/${attemptId}/answer`, {
        questionId: currentQuestion.id,
        selectedOption
      });

      setLastAnswer({ isCorrect: res.data.isCorrect, correctOption: res.data.correctOption });

      if (res.data.finished) {
        // Test tugadi — natijani olish
        setTimeout(() => handleFinish(), 1500);
      } else {
        setTimeout(() => {
          setCurrentQuestion(res.data.nextQuestion);
          setQuestionNumber(res.data.questionNumber);
          setCurrentDifficulty(res.data.currentDifficulty);
          setSelectedOption(null);
          setLastAnswer(null);
        }, 1500);
      }
    } catch (err) {
      alert('Javob yuborishda xatolik: ' + (err.response?.data?.error || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  // Natijani olish
  const handleFinish = async () => {
    try {
      setLoading(true);
      const res = await api.post(`/adaptive-attempts/${attemptId}/finish`);
      setResults(res.data);
      if (res.data.bonusMessage) setBonusMessage(res.data.bonusMessage);
      setStage('finished');
    } catch (err) {
      alert('Natijani olishda xatolik: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  // ─── INTRO ─────────────────────────────────────────────────
  if (stage === 'intro') {
    // Oldingi urinish bormi?
    const hasAttempt = adaptiveTest.myAttempt && adaptiveTest.myAttempt.status === 'completed';

    // Agar allaqachon yechilgan bo'lsa — natijani ko'rsatish tugmasi
    if (hasAttempt) {
      return (
        <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
          <h3 style={{ margin: '0 0 0.75rem', color: 'var(--text-primary)' }}>Adaptiv test yechilgan</h3>
          <div style={{
            background: 'rgba(34,197,94,0.08)', borderRadius: '12px', padding: '1.25rem',
            maxWidth: '400px', margin: '0 auto 1.5rem',
            border: '1px solid rgba(34,197,94,0.2)'
          }}>
            <div style={{ fontWeight: 600, color: '#16a34a', marginBottom: '0.5rem', fontSize: '1.1rem' }}>
              ✅ Siz bu testni muvaffaqiyatli yechdingiz
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
              Adaptiv testni faqat 1 marta yechish mumkin. Natijangizni ko'rish uchun quyidagi tugmani bosing.
            </p>
          </div>
          <button
            onClick={async () => {
              try {
                setLoading(true);
                const res = await api.post(`/adaptive-attempts/${adaptiveTest.myAttempt.id}/finish`);
                setResults(res.data);
                setStage('finished');
              } catch (err) {
                alert('Natijani olishda xatolik: ' + (err.response?.data?.error || err.message));
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
            className="btn btn-primary"
            style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}
          >
            {loading ? '⏳ Yuklanmoqda...' : '📊 Natijani ko\'rish'}
          </button>
        </div>
      );
    }

    return (
      <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎯</div>
        <h3 style={{ margin: '0 0 0.75rem', color: 'var(--text-primary)' }}>Adaptiv test</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', maxWidth: '500px', margin: '0 auto 1rem', lineHeight: 1.6 }}>
          Bu test sizning bilim darajangizga moslashadi. To'g'ri javob bersangiz — savollar qiyinlashadi,
          noto'g'ri bo'lsa — osonlashadi. Jami <strong>15 ta savol</strong>dan iborat.
          <br /><span style={{ color: '#16a34a' }}>Har safar mashq qilishingiz mumkin. 86%+ natija uchun bonus ball!</span>
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <span style={{ fontSize: '0.82rem', padding: '0.4rem 0.75rem', borderRadius: '20px', background: 'rgba(99,102,241,0.1)', color: '#4f46e5' }}>
            15 savol
          </span>
          <span style={{ fontSize: '0.82rem', padding: '0.4rem 0.75rem', borderRadius: '20px', background: 'rgba(34,197,94,0.1)', color: '#16a34a' }}>
            4 variant
          </span>
          <span style={{ fontSize: '0.82rem', padding: '0.4rem 0.75rem', borderRadius: '20px', background: 'rgba(245,158,11,0.1)', color: '#d97706' }}>
            Mashq rejimi
          </span>
        </div>

        <button onClick={handleStart} disabled={loading} className="btn btn-primary" style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}>
          {loading ? '⏳ Yuklanmoqda...' : '▶ Testni boshlash'}
        </button>
      </div>
    );
  }

  // ─── TESTING ───────────────────────────────────────────────
  if (stage === 'testing') {
    if (!currentQuestion) {
      return (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div className="spinner"></div>
          <p>Savol yuklanmoqda...</p>
        </div>
      );
    }

    const options = shuffledOptions;

    const progressPercent = ((questionNumber - 1) / totalQuestions) * 100;

    return (
      <div style={{ maxWidth: '700px', margin: '0 auto' }}>
        {/* Progress bar */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            <span>Savol {questionNumber}/{totalQuestions}</span>
            <span style={{
              padding: '2px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 600,
              background: currentDifficulty <= 2 ? 'rgba(34,197,94,0.12)' : currentDifficulty === 3 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
              color: currentDifficulty <= 2 ? '#16a34a' : currentDifficulty === 3 ? '#d97706' : '#dc2626'
            }}>
              Daraja: {currentDifficulty}/5
            </span>
          </div>
          <div style={{ background: 'var(--bg-secondary)', borderRadius: '99px', height: '8px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: '99px',
              width: `${progressPercent}%`,
              background: 'linear-gradient(90deg, var(--primary-color), var(--secondary-color))',
              transition: 'width 0.4s ease'
            }} />
          </div>
        </div>

        {/* Savol */}
        <div style={{
          background: 'var(--card-bg)', borderRadius: '16px', padding: '1.5rem',
          border: '1px solid var(--border-color)', marginBottom: '1.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <span style={{
              background: 'var(--primary-color)', color: '#fff', borderRadius: '50%',
              width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.85rem', fontWeight: 700, flexShrink: 0
            }}>
              {questionNumber}
            </span>
            <p style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, lineHeight: 1.5 }}>
              {currentQuestion.question_text}
            </p>
          </div>

          {/* Variantlar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {options.map(opt => {
              let optStyle = {
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.9rem 1rem', borderRadius: '10px',
                border: '2px solid',
                cursor: lastAnswer ? 'default' : 'pointer',
                transition: 'all 0.2s',
                fontSize: '0.92rem'
              };

              // Rang logikasi
              if (lastAnswer) {
                if (opt.letter === lastAnswer.correctOption) {
                  optStyle.borderColor = '#22c55e';
                  optStyle.background = 'rgba(34,197,94,0.12)';
                } else if (opt.letter === selectedOption && !lastAnswer.isCorrect) {
                  optStyle.borderColor = '#ef4444';
                  optStyle.background = 'rgba(239,68,68,0.08)';
                } else {
                  optStyle.borderColor = 'var(--border-color)';
                  optStyle.background = 'transparent';
                }
              } else if (opt.letter === selectedOption) {
                optStyle.borderColor = 'var(--primary-color)';
                optStyle.background = 'rgba(99,102,241,0.08)';
              } else {
                optStyle.borderColor = 'var(--border-color)';
                optStyle.background = 'transparent';
              }

              return (
                <div
                  key={opt.letter}
                  onClick={() => { if (!lastAnswer && !submitting) setSelectedOption(opt.letter); }}
                  style={optStyle}
                >
                  <span style={{
                    width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.8rem', fontWeight: 700,
                    background: opt.letter === selectedOption ? 'var(--primary-color)' : 'var(--bg-secondary)',
                    color: opt.letter === selectedOption ? '#fff' : 'var(--text-secondary)'
                  }}>
                    {opt.letter.toUpperCase()}
                  </span>
                  <span style={{ flex: 1 }}>{opt.text}</span>
                  {lastAnswer && opt.letter === lastAnswer.correctOption && (
                    <span style={{ color: '#16a34a', fontWeight: 700 }}>✓</span>
                  )}
                  {lastAnswer && opt.letter === selectedOption && !lastAnswer.isCorrect && opt.letter !== lastAnswer.correctOption && (
                    <span style={{ color: '#ef4444', fontWeight: 700 }}>✗</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Natija indikatori */}
        {lastAnswer && (
          <div style={{
            textAlign: 'center', padding: '0.75rem', borderRadius: '10px', marginBottom: '1rem',
            background: lastAnswer.isCorrect ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            border: lastAnswer.isCorrect ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(239,68,68,0.3)',
            color: lastAnswer.isCorrect ? '#16a34a' : '#dc2626',
            fontWeight: 600, fontSize: '0.95rem'
          }}>
            {lastAnswer.isCorrect ? '✅ To\'g\'ri!' : '❌ Noto\'g\'ri'}
            {questionNumber >= totalQuestions && ' — Test tugadi, natija hisoblanmoqda...'}
          </div>
        )}

        {/* Javob berish tugmasi */}
        {!lastAnswer && (
          <div style={{ textAlign: 'center' }}>
            <button
              onClick={handleAnswer}
              disabled={!selectedOption || submitting}
              className="btn btn-primary"
              style={{ padding: '0.7rem 2.5rem', fontSize: '1rem' }}
            >
              {submitting ? '⏳ Tekshirilmoqda...' : 'Javob berish →'}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ─── FINISHED — Natija sahifasi ────────────────────────────
  if (stage === 'finished' && results) {
    const scoreColor = results.totalScore >= 81 ? '#16a34a' : results.totalScore >= 60 ? '#d97706' : '#dc2626';

    return (
      <div style={{ maxWidth: '750px', margin: '0 auto' }}>
        {/* Umumiy natija */}
        <div style={{
          textAlign: 'center', padding: '2rem', marginBottom: '2rem',
          background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--border-color)'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>
            {results.totalScore >= 81 ? '🏆' : results.totalScore >= 60 ? '👍' : '📚'}
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: scoreColor, marginBottom: '0.25rem' }}>
            {results.totalScore}%
          </div>
          <p style={{ color: 'var(--text-secondary)', margin: '0 0 1rem' }}>
            {results.totalCorrect} / {results.totalQuestions} to'g'ri javob
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <span style={{ padding: '0.4rem 0.75rem', borderRadius: '20px', fontSize: '0.82rem', background: 'rgba(99,102,241,0.1)', color: '#4f46e5' }}>
              {results.totalScore >= 81 ? 'A\'lo' : results.totalScore >= 60 ? 'Yaxshi' : results.totalScore >= 40 ? 'Qoniqarli' : 'Qoniqarsiz'}
            </span>
          </div>
        </div>

        {/* Tushunchalar bo'yicha natija */}
        {results.conceptScores && Object.keys(results.conceptScores).length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <h4 style={{ margin: '0 0 1rem', color: 'var(--text-primary)' }}>📊 Tushunchalar bo'yicha natija</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {Object.entries(results.conceptScores).map(([concept, data]) => {
                const percent = data.percent;
                const barColor = percent >= 60 ? '#22c55e' : '#ef4444';
                return (
                  <div key={concept} style={{
                    background: 'var(--bg-secondary)', borderRadius: '10px', padding: '0.75rem 1rem',
                    border: '1px solid var(--border-color)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{concept}</span>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: barColor }}>
                        {data.correct}/{data.total} ({percent}%)
                      </span>
                    </div>
                    <div style={{ background: 'var(--border-color)', borderRadius: '99px', height: '6px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: '99px',
                        width: `${percent}%`,
                        background: barColor,
                        transition: 'width 0.5s ease'
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Noto'g'ri javob berilgan tushunchalar va tushuntirishlar */}
        {results.weakConcepts && results.weakConcepts.length > 0 && (
          <div>
            <h4 style={{ margin: '0 0 1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              📖 Tushuntirishlar ({results.weakConcepts.length} ta tushuncha)
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {results.weakConcepts.map((weak, idx) => {
                const borderColor = weak.score < 50 ? 'rgba(239,68,68,0.3)' : weak.score < 80 ? 'rgba(245,158,11,0.3)' : 'rgba(34,197,94,0.3)';
                const bgColor = weak.score < 50 ? 'rgba(239,68,68,0.06)' : weak.score < 80 ? 'rgba(245,158,11,0.06)' : 'rgba(34,197,94,0.06)';
                const textColor = weak.score < 50 ? '#dc2626' : weak.score < 80 ? '#d97706' : '#16a34a';
                const icon = weak.score < 50 ? '❌' : weak.score < 80 ? '⚠️' : '📝';

                return (
                <div key={idx} style={{
                  background: 'var(--card-bg)', borderRadius: '14px', overflow: 'hidden',
                  border: `1px solid ${borderColor}`
                }}>
                  {/* Sarlavha */}
                  <div style={{
                    padding: '0.75rem 1.25rem',
                    background: bgColor,
                    borderBottom: `1px solid ${borderColor}`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}>
                    <span style={{ fontWeight: 700, color: textColor }}>{icon} {weak.concept}</span>
                    <span style={{ fontSize: '0.8rem', color: textColor, fontWeight: 600 }}>{weak.score}%</span>
                  </div>

                  <div style={{ padding: '1.25rem' }}>
                    {/* O'qituvchi tushuntirishlari (savol bo'yicha) */}
                    {weak.teacherExplanations && weak.teacherExplanations.length > 0 && (
                      <div style={{ marginBottom: '1rem' }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#2563eb', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          👨‍🏫 O'qituvchi tushuntirishi:
                        </div>
                        {weak.teacherExplanations.map((te, i) => (
                          <div key={i} style={{
                            padding: '0.6rem 0.75rem', marginBottom: '0.4rem',
                            background: 'rgba(37,99,235,0.05)', borderRadius: '8px',
                            borderLeft: '3px solid rgba(37,99,235,0.4)',
                            fontSize: '0.85rem', lineHeight: 1.6
                          }}>
                            <div style={{ fontWeight: 600, marginBottom: '0.2rem', color: 'var(--text-primary)' }}>
                              {te.question}
                            </div>
                            <div style={{ color: '#16a34a', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                              ✓ To'g'ri javob: {te.correctAnswer}
                            </div>
                            <div style={{ color: 'var(--text-secondary)' }}>
                              💡 {te.explanation}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* AI batafsil tushuntirish */}
                    {weak.aiExplanation && (
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#7c3aed', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          🤖 AI batafsil tushuntirish:
                        </div>
                        <div
                          style={{ lineHeight: 1.7, fontSize: '0.9rem', color: 'var(--text-primary)', padding: '0.75rem', background: 'rgba(124,58,237,0.03)', borderRadius: '8px', border: '1px solid rgba(124,58,237,0.1)' }}
                          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(weak.aiExplanation) }}
                        />
                      </div>
                    )}

                    {/* Eski format bilan backward compatibility */}
                    {!weak.aiExplanation && weak.explanation && (
                      <div
                        style={{ lineHeight: 1.7, fontSize: '0.9rem', color: 'var(--text-primary)' }}
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(weak.explanation) }}
                      />
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        )}

        {results.weakConcepts && results.weakConcepts.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '1.5rem', background: 'rgba(34,197,94,0.06)',
            borderRadius: '12px', border: '1px solid rgba(34,197,94,0.2)'
          }}>
            <span style={{ fontSize: '1.5rem' }}>🎉</span>
            <p style={{ margin: '0.5rem 0 0', fontWeight: 600, color: '#16a34a' }}>
              Barcha tushunchalar yaxshi o'zlashtirilgan!
            </p>
          </div>
        )}

        {/* Bonus xabari */}
        {bonusMessage && (
          <div style={{
            textAlign: 'center', padding: '1rem', marginBottom: '1.5rem',
            background: 'rgba(245,158,11,0.1)', borderRadius: '12px',
            border: '1px solid rgba(245,158,11,0.3)', color: '#d97706', fontWeight: 600
          }}>
            {bonusMessage}
          </div>
        )}

        {/* Qayta yechish */}
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <button
            onClick={() => { setStage('intro'); setResults(null); setAttemptId(null); setBonusMessage(null); }}
            className="btn btn-primary"
            style={{ padding: '0.7rem 2rem', fontSize: '1rem' }}
          >
            🔄 Qayta yechish
          </button>
          <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Savollar aralashtirilib beriladi. Har safar mashq qilish mumkin.
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <div className="spinner"></div>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Yuklanmoqda...</p>
      </div>
    );
  }

  return null;
};

export default AdaptiveTestStudentView;
