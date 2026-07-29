import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import '../assets/css/Pages.css';

const TakeTest = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [test, setTest] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTest();
  }, [id]);

  useEffect(() => {
    if (timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const fetchTest = async () => {
    try {
      setLoading(true);
      const [testRes, questionsRes] = await Promise.all([
        api.get(`/tests/${id}`),
        api.get(`/questions/test/${id}`)
      ]);

      setTest(testRes.data);
      setQuestions(questionsRes.data);
      setTimeLeft(testRes.data.time_limit * 60);

      // Avval topshirilganmi tekshirish
      try {
        const myResultsRes = await api.get('/results/my-results');
        const myResults = Array.isArray(myResultsRes.data) ? myResultsRes.data : [];
        const prev = myResults.find(r => r.test_id === parseInt(id) || r.test_id === id);
        if (prev) {
          const lessonId = testRes.data?.lesson_id;
          alert('Siz bu testni allaqachon topshirgansiz. Har bir test faqat bir marta topshiriladi.');
          navigate(lessonId ? `/lessons/${lessonId}` : '/lessons');
          return;
        }
      } catch { /* ignore */ }
    } catch (error) {
      console.error('Error fetching test:', error);
      alert('Testni yuklashda xatolik yuz berdi');
      navigate('/lessons');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId, value) => {
    setAnswers({
      ...answers,
      [questionId]: value
    });
  };

  const handleMultipleChoice = (questionId, optionIndex) => {
    const currentAnswers = answers[questionId] || [];
    const newAnswers = currentAnswers.includes(optionIndex)
      ? currentAnswers.filter(i => i !== optionIndex)
      : [...currentAnswers, optionIndex];
    
    setAnswers({
      ...answers,
      [questionId]: newAnswers
    });
  };

  const handleSubmit = async () => {
    if (!window.confirm("Testni tugatib, javoblarni yuborishni tasdiqlaysizmi?")) {
      return;
    }

    try {
      setSubmitting(true);
      
      // Calculate time taken
      const timeTaken = (test.time_limit * 60) - timeLeft;
      
      // Format answers as object (question_id: answer)
      const formattedAnswers = {};
      
      questions.forEach(q => {
        const answer = answers[q.id];
        
        if (answer !== undefined && answer !== null) {
          if (q.question_type === 'single_choice') {
            // Single choice: convert index to option text
            const options = Array.isArray(q.options) ? q.options : 
                           (typeof q.options === 'string' ? JSON.parse(q.options) : []);
            
            formattedAnswers[q.id] = options[answer] || String(answer);
          } else if (q.question_type === 'multiple_choice') {
            // Multiple choice: convert indexes to option texts, join with comma
            const options = Array.isArray(q.options) ? q.options : 
                           (typeof q.options === 'string' ? JSON.parse(q.options) : []);
            
            if (Array.isArray(answer)) {
              const selectedTexts = answer.map(idx => options[idx] || String(idx));
              formattedAnswers[q.id] = selectedTexts.join(',');
            } else {
              formattedAnswers[q.id] = '';
            }
          } else if (q.question_type === 'matching') {
            // Matching: stringify object
            formattedAnswers[q.id] = typeof answer === 'object' ? JSON.stringify(answer) : '';
          } else {
            // Other types: send as string
            formattedAnswers[q.id] = String(answer);
          }
        } else {
          // No answer provided
          formattedAnswers[q.id] = '';
        }
      });

      console.log('Submitting answers:', formattedAnswers);

      const response = await api.post('/results/submit', {
        test_id: parseInt(id),
        answers: formattedAnswers,
        time_taken: timeTaken
      });

      console.log('Submit response:', response.data);

      // Natijalar sahifasiga yo'naltirish
      navigate('/results', { 
        state: { 
          resultId: response.data.result?.attempt_id,
          showDetails: true,
          lessonId: test?.lesson_id
        } 
      });
    } catch (error) {
      console.error('Error submitting test:', error);
      // 403 — allaqachon topshirilgan
      if (error.response?.status === 403 || error.response?.data?.already_attempted) {
        alert('✅ Siz bu testni allaqachon topshirgansiz.\n\nHar bir test faqat bir marta topshiriladi.');
        const lessonId = test?.lesson_id;
        navigate(lessonId ? `/lessons/${lessonId}` : '/lessons');
      } else {
        alert('Javoblarni yuborishda xatolik yuz berdi: ' + (error.response?.data?.error || error.message));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgress = () => {
    const answeredCount = Object.keys(answers).length;
    return Math.round((answeredCount / questions.length) * 100);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Test yuklanmoqda...</p>
      </div>
    );
  }

  if (!test || questions.length === 0) {
    return (
      <div className="error-container">
        <h2>Test topilmadi</h2>
        <button onClick={() => navigate('/lessons')} className="btn btn-primary">
          Darslarga qaytish
        </button>
      </div>
    );
  }

  const question = questions[currentQuestion];

  return (
    <div className="take-test-container">
      <div className="test-header">
        <div className="test-info">
          <h2>{test.title}</h2>
          <div className="test-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${getProgress()}%` }}
              ></div>
            </div>
            <span className="progress-text">
              {Object.keys(answers).length} / {questions.length} javoblangan
            </span>
          </div>
        </div>
        
        <div className="test-timer">
          <div className={`timer ${timeLeft < 300 ? 'timer-warning' : ''}`}>
            ⏱️ {formatTime(timeLeft)}
          </div>
        </div>
      </div>

      <div className="test-body">
        <div className="question-navigation">
          <h3>Savollar</h3>
          <div className="question-grid">
            {questions.map((q, index) => (
              <button
                key={q.id}
                onClick={() => setCurrentQuestion(index)}
                className={`question-nav-btn ${
                  currentQuestion === index ? 'active' : ''
                } ${
                  answers[q.id] !== undefined ? 'answered' : ''
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>
          
          <button 
            onClick={handleSubmit} 
            className="btn btn-success btn-block"
            disabled={submitting}
          >
            {submitting ? 'Yuborilmoqda...' : 'Testni tugatish'}
          </button>
        </div>

        <div className="question-content">
          <div className="question-header">
            <span className="question-number">Savol {currentQuestion + 1} / {questions.length}</span>
            <span className="question-points">{question.points} ball</span>
          </div>

          <div className="question-text">
            <h3>{question.question_text}</h3>
          </div>

          <div className="answer-section">
            {question.question_type === 'single_choice' && (
              <div className="options-list">
                {(Array.isArray(question.options) ? question.options : JSON.parse(question.options || '[]')).map((option, index) => (
                  <label key={index} className="option-item">
                    <input
                      type="radio"
                      name={`question-${question.id}`}
                      value={index}
                      checked={answers[question.id] === index}
                      onChange={() => handleAnswerChange(question.id, index)}
                    />
                    <span className="option-text">{option}</span>
                  </label>
                ))}
              </div>
            )}

            {question.question_type === 'multiple_choice' && (
              <div className="options-list">
                {(Array.isArray(question.options) ? question.options : JSON.parse(question.options || '[]')).map((option, index) => (
                  <label key={index} className="option-item">
                    <input
                      type="checkbox"
                      value={index}
                      checked={(answers[question.id] || []).includes(index)}
                      onChange={() => handleMultipleChoice(question.id, index)}
                    />
                    <span className="option-text">{option}</span>
                  </label>
                ))}
              </div>
            )}

            {question.question_type === 'true_false' && (
              <div className="options-list">
                <label className="option-item">
                  <input
                    type="radio"
                    name={`question-${question.id}`}
                    value="true"
                    checked={answers[question.id] === 'true'}
                    onChange={() => handleAnswerChange(question.id, 'true')}
                  />
                  <span className="option-text">To'g'ri</span>
                </label>
                <label className="option-item">
                  <input
                    type="radio"
                    name={`question-${question.id}`}
                    value="false"
                    checked={answers[question.id] === 'false'}
                    onChange={() => handleAnswerChange(question.id, 'false')}
                  />
                  <span className="option-text">Noto'g'ri</span>
                </label>
              </div>
            )}

            {question.question_type === 'short_answer' && (
              <input
                type="text"
                className="answer-input"
                placeholder="Javobingizni kiriting..."
                value={answers[question.id] || ''}
                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
              />
            )}

            {question.question_type === 'code_writing' && (
              <textarea
                className="code-input"
                placeholder="Kodni kiriting..."
                rows={10}
                value={answers[question.id] || ''}
                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
              />
            )}

            {question.question_type === 'matching' && (
              <div className="matching-section">
                <p className="hint">Chap va o'ng ustunlarni moslang</p>
                {(Array.isArray(question.options) ? question.options.left : JSON.parse(question.options || '{"left":[],"right":[]}').left).map((leftItem, index) => (
                  <div key={index} className="matching-row">
                    <div className="matching-left">{leftItem}</div>
                    <select
                      className="matching-select"
                      value={answers[question.id]?.[index] || ''}
                      onChange={(e) => {
                        const newAnswers = { ...(answers[question.id] || {}) };
                        newAnswers[index] = e.target.value;
                        handleAnswerChange(question.id, newAnswers);
                      }}
                    >
                      <option value="">Tanlang...</option>
                      {(Array.isArray(question.options) ? question.options.right : JSON.parse(question.options || '{"left":[],"right":[]}').right).map((rightItem, idx) => (
                        <option key={idx} value={rightItem}>
                          {rightItem}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="question-navigation-buttons">
            <button
              onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
              disabled={currentQuestion === 0}
              className="btn btn-outline"
            >
              ← Oldingi
            </button>
            <button
              onClick={() => setCurrentQuestion(Math.min(questions.length - 1, currentQuestion + 1))}
              disabled={currentQuestion === questions.length - 1}
              className="btn btn-outline"
            >
              Keyingi →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TakeTest;
