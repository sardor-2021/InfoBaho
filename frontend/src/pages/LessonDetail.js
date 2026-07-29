import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import AdaptiveTestReviewPanel from '../components/AdaptiveTestReviewPanel';
import AdaptiveTestStudentView from '../components/AdaptiveTestStudentView';
import '../assets/css/Pages.css';

const LessonDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Lesson state
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [error, setError] = useState('');

  // Test management state
  const [selectedTest, setSelectedTest] = useState(null);
  const [testQuestions, setTestQuestions] = useState([]);
  const [testStats, setTestStats] = useState(null);
  const [loadingTest, setLoadingTest] = useState(false);

  // Modals
  const [showCreateTestModal, setShowCreateTestModal] = useState(false);
  const [showAddQuestionModal, setShowAddQuestionModal] = useState(false);
  const [showEditQuestionModal, setShowEditQuestionModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  // ─── Assignment state ─────────────────────────────────────────
  const [assignments, setAssignments] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [assignmentSubmissions, setAssignmentSubmissions] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);

  // ─── Lesson progress state (faqat o'quvchi uchun) ────────────
  const [lessonProgress, setLessonProgress] = useState(null);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [submittingFile, setSubmittingFile] = useState(false);
  const [gradingId, setGradingId] = useState(null);
  const [showCreateAssignModal, setShowCreateAssignModal] = useState(false);
  const [showAIAssignModal, setShowAIAssignModal] = useState(false);
  const [aiAssignLoading, setAiAssignLoading] = useState(false);
  const [showEditAssignModal, setShowEditAssignModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [showEditLessonModal, setShowEditLessonModal] = useState(false);
  const [editLesson, setEditLesson] = useState({ title: '', description: '', subject: '', content: '' });
  const [pdfViewer, setPdfViewer] = useState(null);
  const [newAssignment, setNewAssignment] = useState({
    title: '', description: '', task_type: 'python',
    instructions: '', max_score: 100, deadline: ''
  });
  const [aiAssignPrompt, setAiAssignPrompt] = useState({
    task_type: 'python', topic: '', grade: 10, level: 'medium'
  });
  const [manualScore, setManualScore] = useState({});
  const [manualFeedback, setManualFeedback] = useState({});

  // Kod editor state (python, html, js, css)
  const CODE_TYPES = ['python', 'html', 'javascript', 'css'];
  const [codeInput, setCodeInput] = useState({});      // { [assignmentId]: "kod matni" }
  const [codeResult, setCodeResult] = useState({});    // { [assignmentId]: { score, feedback, ... } }
  const [submittingCode, setSubmittingCode] = useState(false);

  // ─── Adaptive test state ───────────────────────────────────
  const [adaptiveTest, setAdaptiveTest] = useState(null);
  const [generatingAdaptive, setGeneratingAdaptive] = useState(false);
  const [adaptiveExpanded, setAdaptiveExpanded] = useState(false);
  const [testsExpanded, setTestsExpanded] = useState(false);
  const [assignmentsExpanded, setAssignmentsExpanded] = useState(false);

  // New test form
  const [newTest, setNewTest] = useState({
    title: '',
    description: '',
    subject: '',
    duration: 30,
    difficulty: 'medium',
    passing_score: 60,
    max_score: 20
  });

  // New question form
  const [newQuestion, setNewQuestion] = useState({
    question_text: '',
    question_type: 'single_choice',
    options: ['', '', '', ''],
    correct_answer: '',
    points: 1,
    explanation: ''
  });

  // AI prompt
  const [aiPrompt, setAiPrompt] = useState({
    topic: '',
    count: 5,
    difficulty: 'medium',
    questionType: 'single_choice'
  });


  useEffect(() => {
    fetchLesson();
    fetchAssignments();
    fetchAdaptiveTest();
    if (user?.role === 'student') fetchProgress();
  }, [id]);

  const fetchProgress = async () => {
    try {
      const res = await api.get(`/lesson-progress/${id}`);
      setLessonProgress(res.data);
    } catch (err) {
      // progress yo'q bo'lsa ham davom etadi
    }
  };

  const fetchLesson = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/lessons/${id}`);
      setLesson(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Darsni olishda xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignments = async () => {
    try {
      setLoadingAssignments(true);
      const res = await api.get(`/assignments/lesson/${id}`);
      setAssignments(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Assignments fetch error:', err);
      setAssignments([]);
    } finally {
      setLoadingAssignments(false);
    }
  };

  const fetchSubmissions = async (assignmentId) => {
    try {
      setLoadingSubmissions(true);
      const res = await api.get(`/assignments/${assignmentId}/submissions`);
      setAssignmentSubmissions(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Submissions fetch error:', err);
      setAssignmentSubmissions([]);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  // ─── Adaptive test funksiyalari ─────────────────────────────
  const fetchAdaptiveTest = async () => {
    try {
      const res = await api.get(`/lessons/${id}/adaptive-test`);
      setAdaptiveTest(res.data);
    } catch (err) {
      // 404 — test yo'q, normal holat
      setAdaptiveTest(null);
    }
  };

  const handleGenerateAdaptiveTest = async (confirmOverwrite = false) => {
    if (!confirmOverwrite && !window.confirm('AI 20 ta savol yaratadi. Davom etsinmi?')) return;
    try {
      setGeneratingAdaptive(true);
      const res = await api.post(`/lessons/${id}/adaptive-test/generate`, { confirm_overwrite: confirmOverwrite });
      setAdaptiveTest(res.data.adaptiveTest ? { ...res.data.adaptiveTest, questions: res.data.questions || [] } : res.data);
      await fetchAdaptiveTest();
      alert(`✅ ${res.data.totalQuestions || 20} ta savol yaratildi! Tekshirib, e'lon qiling.`);
    } catch (err) {
      // 409 — natijalarni o'chirish uchun tasdiqlash kerak
      if (err.response?.status === 409 && err.response?.data?.requiresConfirmation) {
        if (window.confirm(err.response.data.error + '\n\nDavom etsinmi?')) {
          return handleGenerateAdaptiveTest(true);
        }
      } else {
        alert('Adaptiv test yaratishda xatolik: ' + (err.response?.data?.error || err.message));
      }
    } finally {
      setGeneratingAdaptive(false);
    }
  };

  const handlePublishAdaptive = async () => {
    await fetchAdaptiveTest();
  };

  const fetchTestDetails = async (testId) => {
    try {
      setLoadingTest(true);
      // O'quvchi statistika so'rashga ruxsati yo'q (403), faqat savollarni oling
      const questionsRes = await api.get(`/questions/test/${testId}`).catch(() => ({ data: [] }));
      setTestQuestions(Array.isArray(questionsRes.data) ? questionsRes.data : []);

      // Statistikani faqat o'qituvchi/admin ko'radi
      if (user.role !== 'student') {
        const statsRes = await api.get(`/tests/${testId}/statistics`).catch(() => ({ data: null }));
        setTestStats(statsRes.data);
      } else {
        setTestStats(null);
      }
    } catch (err) {
      console.error('Error fetching test details:', err);
      setTestQuestions([]);
      setTestStats(null);
    } finally {
      setLoadingTest(false);
    }
  };

  const handleSelectTest = async (test) => {
    setSelectedTest(test);
    await fetchTestDetails(test.id);
  };

  // ─── File upload ──────────────────────────────────────────────
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { alert('Fayl hajmi 50MB dan oshmasligi kerak!'); return; }
    const allowedTypes = ['pdf','ppt','pptx','doc','docx','xls','xlsx','txt','jpg','jpeg','png'];
    const fileExt = file.name.split('.').pop().toLowerCase();
    if (!allowedTypes.includes(fileExt)) { alert('Ruxsat etilmagan fayl turi!'); return; }
    const formData = new FormData();
    formData.append('file', file);
    try {
      setUploadingFile(true);
      await api.post(`/lessons/${id}/materials`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      fetchLesson();
      e.target.value = '';
    } catch (err) {
      alert(err.response?.data?.error || 'Materialni yuklashda xatolik');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleDeleteMaterial = async (materialId) => {
    if (!window.confirm("Materialni o'chirishni tasdiqlaysizmi?")) return;
    try {
      await api.delete(`/lessons/${id}/materials/${materialId}`);
      fetchLesson();
    } catch (err) {
      alert(err.response?.data?.error || "Materialni o'chirishda xatolik");
    }
  };



  // ─── Test CRUD ────────────────────────────────────────────────
  const handleCreateTest = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/tests', {
        ...newTest,
        lesson_id: parseInt(id),
        subject: newTest.subject || lesson.subject
      });
      setNewTest({ title: '', description: '', subject: '', duration: 30, difficulty: 'medium', passing_score: 60, max_score: 20 });
      setShowCreateTestModal(false);
      await fetchLesson();
      // Auto-select newly created test
      if (response.data.test) {
        setSelectedTest(response.data.test);
        await fetchTestDetails(response.data.test.id);
      }
    } catch (err) {
      alert('Test yaratishda xatolik: ' + (err.response?.data?.error || err.message));
    }
  };

  const handlePublishTest = async (testId, isPublished) => {
    try {
      if (isPublished) {
        await api.put(`/tests/${testId}/unpublish`);
      } else {
        await api.put(`/tests/${testId}/publish`);
      }
      await fetchLesson();
      // Refresh selected test info
      const updatedTest = lesson.tests?.find(t => t.id === testId);
      if (updatedTest) {
        const res = await api.get(`/tests/${testId}`);
        setSelectedTest(res.data);
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Testni nashr qilishda xatolik');
    }
  };

  const handleDeleteTest = async (testId) => {
    if (!window.confirm("Testni o'chirishni tasdiqlaysizmi?")) return;
    try {
      await api.delete(`/tests/${testId}`);
      setSelectedTest(null);
      setTestQuestions([]);
      await fetchLesson();
    } catch (err) {
      alert(err.response?.data?.error || "Testni o'chirishda xatolik");
    }
  };

  // ─── Assignment handlers ──────────────────────────────────────
  const TASK_TYPES = {
    word:       { label: 'Word',       icon: '📝', ext: '.docx/.doc' },
    excel:      { label: 'Excel',      icon: '📊', ext: '.xlsx/.xls' },
    powerpoint: { label: 'PowerPoint', icon: '📽️', ext: '.pptx/.ppt' },
    access:     { label: 'Access',     icon: '🗄️', ext: '.accdb/.mdb' },
    paint:      { label: 'Paint',      icon: '🖌️', ext: '.png/.jpg' },
    python:     { label: 'Python',     icon: '🐍', ext: '.py' },
    scratch:    { label: 'Scratch',    icon: '🐱', ext: '.sb3' },
    html:       { label: 'HTML',       icon: '🌐', ext: '.html' },
    javascript: { label: 'JavaScript', icon: '💛', ext: '.js' },
    css:        { label: 'CSS',        icon: '🎨', ext: '.css' },
    other:      { label: 'Boshqa',     icon: '📁', ext: '*' }
  };

  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    try {
      await api.post('/assignments', { ...newAssignment, lesson_id: parseInt(id) });
      setShowCreateAssignModal(false);
      setNewAssignment({ title:'', description:'', task_type:'python', instructions:'', max_score:100, deadline:'' });
      await fetchAssignments();
    } catch (err) {
      alert('Topshiriq yaratishda xatolik: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleAICreateAssignment = async (e) => {
    e.preventDefault();
    setAiAssignLoading(true);
    try {
      const res = await api.post('/assignments/ai-generate', {
        ...aiAssignPrompt,
        grade: lesson.grade,   // darsning sinfini avtomatik olish
        lesson_id: parseInt(id),
        save: true
      });
      alert(`✅ AI topshiriq yaratildi: "${res.data.assignment.title}"`);
      setShowAIAssignModal(false);
      setAiAssignPrompt({ task_type:'python', topic:'', level:'medium' });
      await fetchAssignments();
    } catch (err) {
      alert('AI topshiriq yaratishda xatolik: ' + (err.response?.data?.error || err.message));
    } finally {
      setAiAssignLoading(false);
    }
  };

  const handleDeleteAssignment = async (assignId) => {
    if (!window.confirm("Topshiriqni o'chirishni tasdiqlaysizmi?")) return;
    try {
      await api.delete(`/assignments/${assignId}`);
      if (selectedAssignment?.id === assignId) setSelectedAssignment(null);
      await fetchAssignments();
    } catch (err) {
      alert(err.response?.data?.error || "O'chirishda xatolik");
    }
  };

  const handleEditAssignment = (assignment) => {
    setEditingAssignment({
      id: assignment.id,
      title: assignment.title,
      description: assignment.description || '',
      task_type: assignment.task_type,
      instructions: assignment.instructions,
      max_score: assignment.max_score,
      deadline: assignment.deadline
        ? new Date(assignment.deadline).toISOString().slice(0, 16)
        : ''
    });
    setShowEditAssignModal(true);
  };

  const handleUpdateAssignment = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/assignments/${editingAssignment.id}`, {
        title:        editingAssignment.title,
        description:  editingAssignment.description,
        task_type:    editingAssignment.task_type,
        instructions: editingAssignment.instructions,
        max_score:    editingAssignment.max_score,
        deadline:     editingAssignment.deadline || null
      });
      setShowEditAssignModal(false);
      setEditingAssignment(null);
      await fetchAssignments();
      // selectedAssignment ham yangilansin
      const updated = await api.get(`/assignments/${editingAssignment.id}`);
      setSelectedAssignment(updated.data);
    } catch (err) {
      alert('Topshiriqni yangilashda xatolik: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleSelectAssignment = async (assignment) => {
    setSelectedAssignment(assignment);
    setAssignmentSubmissions([]);
    if (user.role !== 'student') {
      await fetchSubmissions(assignment.id);
    }
  };

  const handleSubmitCode = async (assignmentId) => {
    const code = codeInput[assignmentId];
    if (!code || !code.trim()) {
      alert('Kod bo\'sh bo\'lishi mumkin emas!');
      return;
    }
    try {
      setSubmittingCode(true);
      const res = await api.post(`/assignments/${assignmentId}/submit-code`, { code });
      const aiResult = res.data.ai_result;
      if (aiResult) {
        setCodeResult(r => ({ ...r, [assignmentId]: aiResult }));
        await fetchAssignments();
        await fetchProgress();
      } else {
        alert('✅ Kod yuborildi! O\'qituvchi tez orada baholaydi.');
        await fetchAssignments();
      }
    } catch (err) {
      alert('Kod yuborishda xatolik: ' + (err.response?.data?.error || err.message));
    } finally {
      setSubmittingCode(false);
    }
  };

  const handleSubmitFile = async (assignmentId, e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      setSubmittingFile(true);
      await api.post(`/assignments/${assignmentId}/submit`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert('✅ Topshiriq muvaffaqiyatli yuklandi!');
      await fetchAssignments();
      await fetchProgress();
      e.target.value = '';
    } catch (err) {
      alert('Fayl yuklashda xatolik: ' + (err.response?.data?.error || err.message));
    } finally {
      setSubmittingFile(false);
    }
  };

  const handleManualGrade = async (subId, maxScore) => {
    const score = parseInt(manualScore[subId]);
    if (isNaN(score) || score < 0 || score > maxScore) {
      alert(`Ball 0 dan ${maxScore} gacha bo'lishi kerak`);
      return;
    }
    try {
      setGradingId(subId);
      await api.post(`/assignments/submissions/${subId}/grade`, {
        score, feedback: manualFeedback[subId] || ''
      });
      alert('✅ Ball qo\'yildi!');
      await fetchSubmissions(selectedAssignment.id);
      setManualScore(s => ({ ...s, [subId]: '' }));
      setManualFeedback(s => ({ ...s, [subId]: '' }));
    } catch (err) {
      alert(err.response?.data?.error || 'Baholashda xatolik');
    } finally {
      setGradingId(null);
    }
  };

  const handleAIGrade = async (subId) => {
    if (!window.confirm('AI orqali baholash amalga oshirilsinmi?')) return;
    try {
      setGradingId(subId);
      const res = await api.post(`/assignments/submissions/${subId}/ai-grade`);
      alert(`🤖 AI baholadi: ${res.data.score} ball\n\n${res.data.feedback}`);
      await fetchSubmissions(selectedAssignment.id);
    } catch (err) {
      alert('AI baholashda xatolik: ' + (err.response?.data?.error || err.message));
    } finally {
      setGradingId(null);
    }
  };

  // ─── Question CRUD ────────────────────────────────────────────
  const handleAddQuestion = async (e) => {
    e.preventDefault();
    try {
      await api.post('/questions', {
        test_id: selectedTest.id,
        question_text: newQuestion.question_text,
        question_type: newQuestion.question_type,
        options: JSON.stringify(newQuestion.options),
        correct_answer: newQuestion.correct_answer,
        points: newQuestion.points,
        explanation: newQuestion.explanation
      });
      setNewQuestion({ question_text: '', question_type: 'single_choice', options: ['','','',''], correct_answer: '', points: 1, explanation: '' });
      setShowAddQuestionModal(false);
      await fetchTestDetails(selectedTest.id);
      await fetchLesson();
    } catch (err) {
      alert("Savol qo'shishda xatolik: " + (err.response?.data?.error || err.message));
    }
  };

  const handleEditQuestion = (question) => {
    let options = ['', '', '', ''];
    if (question.options) {
      options = Array.isArray(question.options) ? [...question.options]
        : (() => { try { return JSON.parse(question.options); } catch { return options; } })();
    }
    setEditingQuestion({ ...question, options });
    setShowEditQuestionModal(true);
  };

  const handleUpdateQuestion = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/questions/${editingQuestion.id}`, {
        question_text: editingQuestion.question_text,
        question_type: editingQuestion.question_type,
        options: JSON.stringify(editingQuestion.options),
        correct_answer: editingQuestion.correct_answer,
        points: editingQuestion.points,
        explanation: editingQuestion.explanation
      });
      setShowEditQuestionModal(false);
      setEditingQuestion(null);
      await fetchTestDetails(selectedTest.id);
    } catch (err) {
      alert('Savolni yangilashda xatolik: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteQuestion = async (questionId) => {
    if (!window.confirm("Savolni o'chirishni tasdiqlaysizmi?")) return;
    try {
      await api.delete(`/questions/${questionId}`);
      setShowEditQuestionModal(false);
      setEditingQuestion(null);
      await fetchTestDetails(selectedTest.id);
      await fetchLesson();
    } catch (err) {
      alert("Savolni o'chirishda xatolik: " + (err.response?.data?.error || err.message));
    }
  };

  const handleGenerateAI = async (e) => {
    e.preventDefault();
    setAiLoading(true);
    try {
      const response = await api.post('/questions/generate-ai', {
        test_id: selectedTest.id,
        topic: aiPrompt.topic || selectedTest.subject,
        count: aiPrompt.count,
        difficulty: aiPrompt.difficulty,
        question_type: aiPrompt.questionType
      });
      alert(`${response.data.count} ta savol muvaffaqiyatli yaratildi!`);
      setShowAIModal(false);
      setAiPrompt({ topic: '', count: 5, difficulty: 'medium', questionType: 'single_choice' });
      await fetchTestDetails(selectedTest.id);
      await fetchLesson();
    } catch (err) {
      alert('AI savol yaratishda xatolik: ' + (err.response?.data?.error || err.message));
    } finally {
      setAiLoading(false);
    }
  };



  // ─── Helpers ──────────────────────────────────────────────────
  const getFileIcon = (fileName) => {
    const ext = fileName.split('.').pop().toLowerCase();
    return { pdf:'📄', ppt:'📊', pptx:'📊', doc:'📝', docx:'📝', xls:'📊', xlsx:'📊', txt:'📃', jpg:'🖼️', jpeg:'🖼️', png:'🖼️' }[ext] || '📎';
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getQuestionTypeLabel = (type) => ({
    single_choice: 'Bir tanlovli',
    multiple_choice: "Ko'p tanlovli",
    true_false: "To'g'ri/Noto'g'ri",
    short_answer: 'Qisqa javob',
    code_writing: 'Kod yozish',
    matching: 'Moslashtirish'
  }[type] || type);

  const getDifficultyLabel = (d) => ({ easy: 'Oson', medium: "O'rta", hard: 'Qiyin' }[d] || d);
  const getDifficultyColor = (d) => ({ easy: 'badge-success', medium: 'badge-warning', hard: 'badge-danger' }[d] || 'badge-secondary');

  const getCodePlaceholder = (task_type) => {
    const ph = {
      python: `# Bu yerga Python kodingizni yozing\n# Masalan:\n\nname = input("Ismingizni kiriting: ")\nprint(f"Salom, {name}!")`,
      html: `<!DOCTYPE html>\n<html lang="uz">\n<head>\n    <meta charset="UTF-8">\n    <title>Mening sahifam</title>\n</head>\n<body>\n    <!-- Bu yerga HTML kodingizni yozing -->\n    <h1>Salom!</h1>\n</body>\n</html>`,
      javascript: `// Bu yerga JavaScript kodingizni yozing\n// Masalan:\n\nfunction salom(ism) {\n    return \`Salom, \${ism}!\`;\n}\n\nconsole.log(salom("Akmal"));`,
      css: `/* Bu yerga CSS kodingizni yozing */\n/* Masalan: */\n\nbody {\n    font-family: Arial, sans-serif;\n    background-color: #f0f0f0;\n}\n\nh1 {\n    color: #333;\n    text-align: center;\n}`
    };
    return ph[task_type] || '// Kodingizni bu yerga yozing...';
  };

  const isOwner = user && lesson && (user.id === lesson.created_by || user.role === 'admin');

  // ─── Loading / Error states ───────────────────────────────────
  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Yuklanmoqda...</p>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <div className="empty-icon">❌</div>
          <h3>Xatolik yuz berdi</h3>
          <p>{error || 'Dars topilmadi'}</p>
          <button onClick={() => navigate('/lessons')} className="btn btn-primary">
            Darslar ro'yxatiga qaytish
          </button>
        </div>
      </div>
    );
  }



  return (
    <div className="page-container">

      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <button onClick={() => navigate('/lessons')} className="btn btn-outline" style={{ marginBottom: '0.5rem' }}>
            ← Darslar ro'yxati
          </button>
          <h1>{lesson.title}</h1>
          <p className="subtitle">
            {lesson.grade}-sinf • {lesson.subject} • {lesson.creator?.full_name || "Noma'lum o'qituvchi"}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.75rem' }}>
          {isOwner && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setShowEditLessonModal(true)} className="btn btn-outline">✏️ Tahrirlash</button>
              {lesson.taught_at ? (
                <button
                  onClick={async () => {
                    if (!window.confirm("Bu darsni 'o'tilmagan' holatiga qaytarasizmi? O'quvchilarning shu darsdagi natijasi Daraja hisobidan chiqib ketadi.")) return;
                    try {
                      await api.patch(`/lessons/${id}/mark-taught`);
                      fetchLesson();
                    } catch (err) {
                      alert('Xatolik: ' + (err.response?.data?.error || err.message));
                    }
                  }}
                  className="btn btn-outline"
                  style={{ borderColor: 'rgba(34,197,94,0.4)', color: '#16a34a', background: 'rgba(34,197,94,0.08)' }}
                >
                  ✓ O'tilgan (bekor qilish uchun bos)
                </button>
              ) : (
                <button
                  onClick={async () => {
                    if (!window.confirm("Darsni o'tilgan deb belgilaysizmi? Bu barcha o'quvchilar darajasini qayta hisoblaydi va keyingi darsni ochadi.")) return;
                    try {
                      await api.patch(`/lessons/${id}/mark-taught`);
                      fetchLesson();
                      alert("✅ Dars o'tilgan deb belgilandi! Keyingi dars o'quvchilarga ochildi.");
                    } catch (err) {
                      alert('Xatolik: ' + (err.response?.data?.error || err.message));
                    }
                  }}
                  className="btn btn-success"
                >
                  📋 Dars o'tildi deb belgilash
                </button>
              )}
            </div>
          )}
          {/* ── O'quvchi uchun o'zlashtirish ko'rsatkichi ── */}
          {user?.role === 'student' && lessonProgress && lessonProgress.total_possible > 0 && (
            <div style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: '14px',
              padding: '1rem 1.25rem',
              minWidth: '220px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
            }}>
              {/* Baho va medal */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.6rem' }}>
                    {lessonProgress.medal || '📊'}
                  </span>
                  <div>
                    <div style={{
                      fontSize: '1.1rem',
                      fontWeight: 800,
                      color: lessonProgress.grade >= 5 ? '#f59e0b'
                           : lessonProgress.grade === 4 ? '#6366f1'
                           : lessonProgress.grade === 3 ? '#92400e'
                           : lessonProgress.grade >= 1 ? '#dc2626' : 'var(--text-secondary)'
                    }}>
                      {lessonProgress.grade > 0 ? `${lessonProgress.grade} baho` : "Hali baholanmagan"}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                      {lessonProgress.medal_label}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--primary-color)' }}>
                    {lessonProgress.percent}%
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    {lessonProgress.earned_score} / {lessonProgress.total_possible} ball
                  </div>
                </div>
              </div>
              {/* Progress bar */}
              <div style={{ background: 'var(--bg-secondary)', borderRadius: '99px', height: '7px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  borderRadius: '99px',
                  width: `${Math.min(lessonProgress.percent, 100)}%`,
                  background: lessonProgress.percent >= 81 ? 'linear-gradient(90deg,#f59e0b,#fbbf24)'
                             : lessonProgress.percent >= 60 ? 'linear-gradient(90deg,#6366f1,#818cf8)'
                             : lessonProgress.percent >= 40 ? 'linear-gradient(90deg,#92400e,#b45309)'
                             : 'linear-gradient(90deg,#dc2626,#f87171)',
                  transition: 'width 0.6s ease'
                }} />
              </div>
              {/* Batafsil */}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                <span>📝 Test: {lessonProgress.test_score || 0} ball</span>
                <span>🖥️ Topshiriq: {lessonProgress.assign_score || 0} ball</span>
              </div>
            </div>
          )}
          {/* Progress yo'q — dars boshlanmagan */}
          {user?.role === 'student' && (!lessonProgress || lessonProgress.total_possible === 0) && (
            <div style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: '14px',
              padding: '0.75rem 1rem',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              textAlign: 'center'
            }}>
              📊 Hali testlar / topshiriqlar bajarilmagan
            </div>
          )}
        </div>
      </div>

      {/* ── Description ── */}
      {lesson.description && (
        <div className="profile-section" style={{ marginBottom: '2rem' }}>
          <h3>📋 Tavsif</h3>
          <p style={{ marginTop: '1rem', lineHeight: '1.7' }}>{lesson.description}</p>
        </div>
      )}

      {/* ── Content ── */}
      {lesson.content && (
        <div className="profile-section" style={{ marginBottom: '2rem' }}>
          <h3>📖 Dars tarkibi</h3>
          <div style={{ marginTop: '1rem', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>{lesson.content}</div>
        </div>
      )}

      {/* ── Materials ── */}
      <div className="profile-section" style={{ marginBottom: '2rem' }}>
        <div className="section-header">
          <h3>📎 Materiallar ({lesson.materials?.length || 0})</h3>
          {isOwner && (
            <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
              {uploadingFile ? 'Yuklanmoqda...' : '➕ Material yuklash'}
              <input type="file" onChange={handleFileUpload} style={{ display: 'none' }}
                disabled={uploadingFile}
                accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png" />
            </label>
          )}
        </div>
        {lesson.materials && lesson.materials.length > 0 ? (
          <div className="materials-list" style={{ marginTop: '1.5rem' }}>
            {lesson.materials.map((material) => {
              const fileUrl = material.file_path && material.file_path.startsWith('http') ? material.file_path : material.file_path ? `${process.env.REACT_APP_API_URL?.replace('/api', '')}${material.file_path}` : '#';
              const isPdf = material.file_name?.toLowerCase().endsWith('.pdf');
              
              return (
              <div key={material.id}>
                <div className="material-item">
                  <div className="material-info">
                    <span className="material-icon">{getFileIcon(material.file_name)}</span>
                    <div>
                      <h4>{material.file_name}</h4>
                      <p className="material-meta">
                        {formatFileSize(material.file_size)} • {new Date(material.uploaded_at).toLocaleDateString('uz-UZ')}
                      </p>
                    </div>
                  </div>
                  <div className="material-actions">
                    {isPdf && (
                      <button
                        onClick={() => setPdfViewer(pdfViewer === material.id ? null : material.id)}
                        className="btn btn-sm btn-primary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                      >
                        {pdfViewer === material.id ? '✕ Yopish' : '👁️ Ko\'rish'}
                      </button>
                    )}
                    <a href={fileUrl}
                      target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline">
                      ⬇️ Yuklab olish
                    </a>
                    {isOwner && (
                      <button onClick={() => handleDeleteMaterial(material.id)} className="btn btn-sm btn-danger">
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
                {/* PDF Viewer — inline */}
                {isPdf && pdfViewer === material.id && (
                  <div style={{
                    marginTop: '0.75rem', marginBottom: '0.75rem',
                    borderRadius: '12px', overflow: 'hidden',
                    border: '1px solid var(--border-color)',
                    background: '#1e293b'
                  }}>
                    <iframe
                      src={`${fileUrl}#toolbar=1&navpanes=1`}
                      title={material.file_name}
                      style={{ width: '100%', height: '600px', border: 'none' }}
                    />
                  </div>
                )}
              </div>
              );
            })}
          </div>
        ) : (
          <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Hozircha materiallar yuklanmagan</p>
        )}
      </div>



      {/* ── Adaptive Test section (collapsible) ── */}
      <div className="profile-section" style={{ marginBottom: '2rem' }}>
        <div
          className="section-header"
          onClick={() => setAdaptiveExpanded(!adaptiveExpanded)}
          style={{ cursor: 'pointer', userSelect: 'none' }}
        >
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{
              display: 'inline-flex', transition: 'transform 0.3s',
              transform: adaptiveExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
            }}>▶</span>
            🎯 Adaptiv test
            {adaptiveTest && (
              <span style={{
                fontSize: '0.72rem', padding: '2px 8px', borderRadius: '10px', marginLeft: '0.5rem',
                background: adaptiveTest.status === 'published' ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)',
                color: adaptiveTest.status === 'published' ? '#16a34a' : '#d97706'
              }}>
                {adaptiveTest.status === 'published' ? '✅ E\'lon qilingan' : '📝 Qoralama'}
              </span>
            )}
          </h3>
          {isOwner && (
            <button
              onClick={(e) => { e.stopPropagation(); handleGenerateAdaptiveTest(); }}
              className="btn btn-primary"
              disabled={generatingAdaptive}
            >
              {generatingAdaptive ? '⏳ Yaratilmoqda...' : '✨ Adaptiv testni shakllantirish'}
            </button>
          )}
        </div>

        {adaptiveExpanded && (
          <div style={{ marginTop: '1rem', animation: 'fadeIn 0.3s ease' }}>
            {!adaptiveTest ? (
              <div className="empty-state" style={{ padding: '2rem 0' }}>
                <div className="empty-icon">🎯</div>
                <p>{isOwner ? "Bu darsga hali adaptiv test yaratilmagan. AI 20 ta savol yaratadi." : "Adaptiv test hali tayyor emas"}</p>
              </div>
            ) : isOwner ? (
              /* O'qituvchi/admin — doim savollar ko'rinadi, tahrirlash mumkin */
              <AdaptiveTestReviewPanel
                adaptiveTest={adaptiveTest}
                onPublish={handlePublishAdaptive}
                onRefresh={fetchAdaptiveTest}
              />
            ) : adaptiveTest.status === 'published' ? (
              /* O'quvchi — faqat e'lon qilingan testni yechadi */
              <AdaptiveTestStudentView adaptiveTest={adaptiveTest} />
            ) : (
              <p style={{ padding: '1rem 0', color: 'var(--text-secondary)' }}>Adaptiv test hali o'qituvchi tomonidan e'lon qilinmagan</p>
            )}
          </div>
        )}
      </div>

      {/* ── Tests section (collapsible) ── */}
      <div className="profile-section">
        <div
          className="section-header"
          onClick={() => setTestsExpanded(!testsExpanded)}
          style={{ cursor: 'pointer', userSelect: 'none' }}
        >
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{
              display: 'inline-flex', transition: 'transform 0.3s',
              transform: testsExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
            }}>▶</span>
            📝 Testlar ({lesson.tests?.length || 0})
          </h3>
          {isOwner && (
            <button onClick={(e) => { e.stopPropagation(); setShowCreateTestModal(true); }} className="btn btn-primary">
              ➕ Yangi test
            </button>
          )}
        </div>

        {testsExpanded && (
        <div style={{ marginTop: '1rem' }}>
        {(!lesson.tests || lesson.tests.length === 0) ? (
          <div className="empty-state" style={{ padding: '2rem 0' }}>
            <div className="empty-icon">📝</div>
            <p>{isOwner ? "Bu darsga hali test yaratilmagan. Yuqoridagi tugmani bosing!" : "Bu darsga oid testlar hali yaratilmagan"}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>

            {/* Test list (left column) */}
            <div style={{ flex: '0 0 280px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {lesson.tests.map((test) => (
                <div
                  key={test.id}
                  onClick={() => handleSelectTest(test)}
                  className={`test-item${selectedTest?.id === test.id ? ' selected-test-item' : ''}`}
                  style={{
                    cursor: 'pointer',
                    padding: '1rem',
                    borderRadius: '12px',
                    border: selectedTest?.id === test.id
                      ? '2px solid var(--primary-color)'
                      : '2px solid var(--border-color)',
                    background: selectedTest?.id === test.id
                      ? 'linear-gradient(135deg, rgba(102,126,234,0.1), rgba(118,75,162,0.1))'
                      : 'var(--card-bg)',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.3' }}>{test.title}</h4>
                    <span className={`badge ${test.is_published ? 'badge-success' : 'badge-secondary'}`} style={{ whiteSpace: 'nowrap', fontSize: '0.7rem' }}>
                      {test.is_published ? 'Nashr' : 'Qoralama'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    <span>❓ {test.questions_count || 0} savol</span>
                    <span>⏱️ {test.time_limit || test.duration} daq</span>
                  </div>
                  {/* O'quvchi uchun topshirilgan holati */}
                  {user.role === 'student' && test.already_attempted && (
                    <div style={{ marginTop: '0.4rem', fontSize: '0.73rem', color: '#16a34a', fontWeight: 600 }}>
                      ✅ {Number(test.my_attempt?.percentage || 0).toFixed(0)}%
                      {test.my_attempt?.correct_answers != null && (
                        <span style={{ color: '#6366f1', marginLeft: '0.3rem' }}>
                          · {test.my_attempt.correct_answers * 2} ball
                        </span>
                      )}
                    </div>
                  )}
                  {user.role === 'student' && !test.already_attempted && test.is_published && (
                    <div style={{ marginTop: '0.4rem', fontSize: '0.73rem', color: '#6366f1', fontWeight: 500 }}>
                      ▶ Topshirilmagan
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Test detail (right column) */}
            {selectedTest && (
              <div style={{ flex: 1, minWidth: 0 }}>
                {loadingTest ? (
                  <div className="loading-container" style={{ padding: '2rem' }}>
                    <div className="spinner"></div>
                    <p>Yuklanmoqda...</p>
                  </div>
                ) : (
                  <div style={{ background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>

                    {/* Test header */}
                    <div style={{ padding: '1.25rem 1.5rem', background: 'linear-gradient(135deg, var(--primary-color), var(--secondary-color))', color: '#fff' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                        <div>
                          <h3 style={{ margin: 0, color: '#fff' }}>{selectedTest.title}</h3>
                          <p style={{ margin: '0.25rem 0 0', opacity: 0.85, fontSize: '0.85rem' }}>
                            {testQuestions.length} savol • {selectedTest.time_limit || selectedTest.duration} daqiqa • O'tish: {selectedTest.passing_score}%
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          {user.role === 'student' && selectedTest.is_published && (
                            selectedTest.already_attempted ? (
                              <div style={{
                                display: 'flex', alignItems: 'center', gap: '0.4rem',
                                background: 'rgba(255,255,255,0.15)',
                                borderRadius: '8px', padding: '0.3rem 0.75rem',
                                fontSize: '0.82rem', color: '#fff', fontWeight: 600
                              }}>
                                ✅ Topshirildi
                                {selectedTest.my_attempt && (
                                  <span style={{ opacity: 0.9 }}>
                                    · {Number(selectedTest.my_attempt.percentage || 0).toFixed(0)}%
                                    {selectedTest.my_attempt.correct_answers != null && (
                                      <span> · {selectedTest.my_attempt.correct_answers * 2} ball</span>
                                    )}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <Link to={`/tests/${selectedTest.id}`} className="btn btn-sm" style={{ background: '#fff', color: 'var(--primary-color)', fontWeight: 600 }}>
                                🚀 Testni boshlash
                              </Link>
                            )
                          )}
                          {isOwner && (
                            <>
                              <button
                                onClick={() => handlePublishTest(selectedTest.id, selectedTest.is_published)}
                                className="btn btn-sm"
                                style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.5)' }}
                              >
                                {selectedTest.is_published ? '🔒 Yashirish' : '📢 Nashr qilish'}
                              </button>
                              <button
                                onClick={() => handleDeleteTest(selectedTest.id)}
                                className="btn btn-sm"
                                style={{ background: 'rgba(255,80,80,0.3)', color: '#fff', border: '1px solid rgba(255,80,80,0.5)' }}
                              >
                                🗑️
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>



                    {/* Stats bar */}
                    {testStats && (
                      <div style={{ display: 'flex', gap: '1rem', padding: '0.75rem 1.5rem', borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>📊 {testStats.totalAttempts || 0} urinish</span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>⌀ {testStats.averageScore ? testStats.averageScore.toFixed(1) + '%' : '0%'} o'rtacha</span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>🏆 {testStats.highestScore || 0}% eng yuqori</span>
                      </div>
                    )}

                    {/* Questions list */}
                    <div style={{ padding: '1.25rem 1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <h4 style={{ margin: 0 }}>Savollar ({testQuestions.length})</h4>
                        {isOwner && (
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <button onClick={() => setShowAddQuestionModal(true)} className="btn btn-sm btn-primary">
                              ➕ Savol qo'shish
                            </button>
                            <label className="btn btn-sm btn-outline" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                              📊 Excel'dan
                              <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
                                onChange={async (e) => {
                                  const file = e.target.files[0];
                                  if (!file) return;
                                  const formData = new FormData();
                                  formData.append('file', file);
                                  formData.append('test_id', selectedTest.id);
                                  try {
                                    const res = await api.post('/questions/upload-excel-file', formData, {
                                      headers: { 'Content-Type': 'multipart/form-data' }
                                    });
                                    alert(`✅ ${res.data.imported} ta savol import qilindi!${res.data.errors ? '\n\n⚠️ Xatoliklar:\n' + res.data.errors.join('\n') : ''}`);
                                    await fetchTestDetails(selectedTest.id);
                                    await fetchLesson();
                                  } catch (err) {
                                    alert('❌ Excel import xatolik: ' + (err.response?.data?.error || err.message) + (err.response?.data?.hint ? '\n\n💡 ' + err.response?.data?.hint : ''));
                                  }
                                  e.target.value = '';
                                }}
                              />
                            </label>
                            <button onClick={() => setShowAIModal(true)} className="btn btn-sm btn-success">
                              🤖 AI bilan
                            </button>
                          </div>
                        )}
                      </div>

                      {testQuestions.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)' }}>
                          <p>Hali savollar qo'shilmagan</p>
                          {isOwner && (
                            <button onClick={() => setShowAddQuestionModal(true)} className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
                              ➕ Birinchi savolni qo'shish
                            </button>
                          )}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          {testQuestions.map((question, index) => {
                            // Parse options safely
                            let parsedOptions = [];
                            if (question.options) {
                              try {
                                parsedOptions = typeof question.options === 'string'
                                  ? JSON.parse(question.options)
                                  : question.options;
                              } catch { parsedOptions = []; }
                            }
                            const isChoiceType = question.question_type === 'single_choice' || question.question_type === 'multiple_choice';

                            return (
                            <div key={question.id} style={{ background: 'var(--bg-secondary)', borderRadius: '10px', padding: '1rem', border: '1px solid var(--border-color)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                                <div style={{ display: 'flex', gap: '0.75rem', flex: 1 }}>
                                  <span style={{ background: 'var(--primary-color)', color: '#fff', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0, marginTop: '2px' }}>
                                    {index + 1}
                                  </span>
                                  <div style={{ flex: 1 }}>
                                    <p style={{ margin: 0, fontWeight: 600, lineHeight: '1.4', marginBottom: '0.6rem' }}>{question.question_text}</p>

                                    {/* Javob variantlari */}
                                    {isChoiceType && parsedOptions.length > 0 && (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '0.5rem' }}>
                                        {parsedOptions.map((option, idx) => {
                                          const letter = String.fromCharCode(65 + idx);
                                          const isCorrect =
                                            String(question.correct_answer) === String(idx) ||
                                            question.correct_answer === option ||
                                            question.correct_answer === letter;
                                          return (
                                            <div key={idx} style={{
                                              display: 'flex', alignItems: 'center', gap: '0.5rem',
                                              padding: '0.35rem 0.6rem', borderRadius: '6px',
                                              background: isCorrect ? 'rgba(34,197,94,0.12)' : 'transparent',
                                              border: isCorrect ? '1px solid rgba(34,197,94,0.4)' : '1px solid transparent',
                                              fontSize: '0.875rem'
                                            }}>
                                              <span style={{
                                                width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '0.7rem', fontWeight: 700,
                                                background: isCorrect ? '#22c55e' : 'var(--border-color)',
                                                color: isCorrect ? '#fff' : 'var(--text-secondary)'
                                              }}>{letter}</span>
                                              <span style={{ color: isCorrect ? '#16a34a' : 'var(--text-primary)', fontWeight: isCorrect ? 600 : 400 }}>
                                                {option}
                                              </span>
                                              {isCorrect && <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>✓ To'g'ri</span>}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}

                                    {/* True/False uchun */}
                                    {question.question_type === 'true_false' && (
                                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                        {['true', 'false'].map(val => {
                                          const isCorrect = String(question.correct_answer).toLowerCase() === val;
                                          return (
                                            <span key={val} style={{
                                              padding: '0.25rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem',
                                              background: isCorrect ? 'rgba(34,197,94,0.12)' : 'var(--border-color)',
                                              color: isCorrect ? '#16a34a' : 'var(--text-secondary)',
                                              border: isCorrect ? '1px solid rgba(34,197,94,0.4)' : '1px solid transparent',
                                              fontWeight: isCorrect ? 600 : 400
                                            }}>
                                              {val === 'true' ? "✓ To'g'ri" : "✗ Noto'g'ri"}
                                            </span>
                                          );
                                        })}
                                      </div>
                                    )}

                                    {/* Short answer / code uchun */}
                                    {(question.question_type === 'short_answer' || question.question_type === 'code_writing') && (
                                      <div style={{ marginBottom: '0.5rem', padding: '0.4rem 0.75rem', background: 'rgba(34,197,94,0.08)', borderRadius: '6px', border: '1px solid rgba(34,197,94,0.3)', fontSize: '0.85rem', color: '#16a34a' }}>
                                        ✓ <strong>Javob:</strong> {question.correct_answer}
                                      </div>
                                    )}

                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                      <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>{getQuestionTypeLabel(question.question_type)}</span>
                                      <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>{question.points} ball</span>
                                      {question.explanation && (
                                        <span className="badge" style={{ fontSize: '0.7rem', background: 'rgba(251,191,36,0.2)', color: '#d97706' }}>💡 Tushuntirish bor</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                {isOwner && (
                                  <button onClick={() => handleEditQuestion(question)} className="btn btn-sm btn-outline" title="Tahrirlash">
                                    ✏️
                                  </button>
                                )}
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </div>
            )}

          </div>
        )}
        </div>
        )}
      </div>



      {/* ═══════════════ AMALIY TOPSHIRIQLAR (collapsible) ═══════════════════ */}
      <div className="profile-section" style={{ marginTop: '2rem' }}>
        <div
          className="section-header"
          onClick={() => setAssignmentsExpanded(!assignmentsExpanded)}
          style={{ cursor: 'pointer', userSelect: 'none' }}
        >
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{
              display: 'inline-flex', transition: 'transform 0.3s',
              transform: assignmentsExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
            }}>▶</span>
            🖥️ Amaliy Topshiriqlar ({assignments.length})
          </h3>
          {isOwner && (
            <div style={{ display: 'flex', gap: '0.5rem' }} onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setShowCreateAssignModal(true)} className="btn btn-primary">➕ Topshiriq</button>
              <label className="btn btn-outline" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                📊 Excel'dan
                <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('lesson_id', id);
                    try {
                      const res = await api.post('/assignments/upload-excel', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                      });
                      alert(`✅ ${res.data.imported} ta topshiriq import qilindi!${res.data.errors ? '\n\n⚠️ Xatoliklar:\n' + res.data.errors.join('\n') : ''}`);
                      await fetchAssignments();
                    } catch (err) {
                      alert('❌ ' + (err.response?.data?.error || err.message) + (err.response?.data?.hint ? '\n\n💡 ' + err.response?.data?.hint : ''));
                    }
                    e.target.value = '';
                  }}
                />
              </label>
              <button onClick={() => setShowAIAssignModal(true)} className="btn btn-success">🤖 AI bilan</button>
            </div>
          )}
        </div>

        {assignmentsExpanded && (
        <div style={{ marginTop: '1rem' }}>
        {loadingAssignments ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Yuklanmoqda...</div>
        ) : assignments.length === 0 ? (
          <div className="empty-state" style={{ padding: '2rem 0' }}>
            <div className="empty-icon">🖥️</div>
            <p>{isOwner ? 'Hali amaliy topshiriq yaratilmagan.' : 'Hozircha amaliy topshiriqlar yo\'q.'}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>

            {/* Left: assignment list */}
            <div style={{ flex: '0 0 280px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {assignments.map((a, idx) => (
                <div key={a.id} onClick={() => handleSelectAssignment(a)}
                  style={{
                    cursor: 'pointer', padding: '1rem', borderRadius: '12px',
                    border: selectedAssignment?.id === a.id ? '2px solid var(--primary-color)' : '2px solid var(--border-color)',
                    background: selectedAssignment?.id === a.id ? 'linear-gradient(135deg,rgba(102,126,234,0.1),rgba(118,75,162,0.1))' : 'var(--card-bg)',
                    transition: 'all 0.2s'
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary-light)', minWidth: '20px' }}>{idx + 1}.</span>
                      <span style={{ fontSize: '1.3rem' }}>{TASK_TYPES[a.task_type]?.icon || '📁'}</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', lineHeight: 1.3 }}>{a.title}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {TASK_TYPES[a.task_type]?.label} • {a.max_score} ball
                        </div>
                      </div>
                    </div>
                    {a.ai_generated && <span style={{ fontSize: '0.65rem', background: 'rgba(168,85,247,0.15)', color: '#9333ea', padding: '2px 6px', borderRadius: '10px' }}>AI</span>}
                    {isOwner && !a.is_published && <span style={{ fontSize: '0.65rem', background: 'rgba(245,158,11,0.15)', color: '#d97706', padding: '2px 6px', borderRadius: '10px' }}>📝 Qoralama</span>}
                  </div>
                  {/* Student submission status */}
                  {user.role === 'student' && a.my_submission && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>
                      {a.my_submission.status === 'graded'
                        ? <span style={{ color: '#16a34a', fontWeight: 600 }}>✅ Baholandi: {a.my_submission.score} ball</span>
                        : <span style={{ color: '#d97706' }}>⏳ Topshirildi, tekshirilmoqda</span>}
                    </div>
                  )}
                  {/* Teacher submission count */}
                  {user.role !== 'student' && (
                    <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      📨 {a.submissions_count || 0} topshirma • ✅ {a.graded_count || 0} baholangan
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Right: assignment detail */}
            {selectedAssignment && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>

                  {/* Header */}
                  <div style={{ padding: '1.25rem 1.5rem', background: 'linear-gradient(135deg,#7c3aed,#2563eb)', color: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <span style={{ fontSize: '1.5rem' }}>{TASK_TYPES[selectedAssignment.task_type]?.icon}</span>
                          <h3 style={{ margin: 0, color: '#fff' }}>{selectedAssignment.title}</h3>
                        </div>
                        <p style={{ margin: '0.3rem 0 0', opacity: 0.85, fontSize: '0.85rem' }}>
                          {TASK_TYPES[selectedAssignment.task_type]?.label} • {selectedAssignment.max_score} ball
                          {selectedAssignment.deadline && ` • Muddat: ${new Date(selectedAssignment.deadline).toLocaleDateString('uz-UZ')}`}
                        </p>
                      </div>
                      {isOwner && (
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button onClick={async () => {
                            try {
                              await api.patch(`/assignments/${selectedAssignment.id}/publish`);
                              await fetchAssignments();
                              const updated = await api.get(`/assignments/${selectedAssignment.id}`);
                              setSelectedAssignment(updated.data);
                            } catch (err) { alert(err.response?.data?.error || 'Xatolik'); }
                          }}
                            className="btn btn-sm"
                            style={{ background: selectedAssignment.is_published ? 'rgba(245,158,11,0.3)' : 'rgba(34,197,94,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.5)' }}
                            title={selectedAssignment.is_published ? 'Qoralamaga qaytarish' : "E'lon qilish"}>
                            {selectedAssignment.is_published ? '📝' : '📢'}
                          </button>
                          <button onClick={() => handleEditAssignment(selectedAssignment)}
                            className="btn btn-sm"
                            style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.5)' }}
                            title="Tahrirlash">
                            ✏️
                          </button>
                          <button onClick={() => handleDeleteAssignment(selectedAssignment.id)}
                            className="btn btn-sm"
                            style={{ background: 'rgba(255,80,80,0.3)', color: '#fff', border: '1px solid rgba(255,80,80,0.5)' }}
                            title="O'chirish">
                            🗑️
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ padding: '1.5rem' }}>
                    {/* Description */}
                    {selectedAssignment.description && (
                      <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.6 }}>
                        {selectedAssignment.description}
                      </p>
                    )}

                    {/* Instructions */}
                    <div style={{ background: 'var(--bg-secondary)', borderRadius: '10px', padding: '1rem', marginBottom: '1.5rem', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        📋 Bajarish ko'rsatmalari
                        {selectedAssignment.ai_generated && <span style={{ fontSize: '0.7rem', background: 'rgba(168,85,247,0.15)', color: '#9333ea', padding: '2px 8px', borderRadius: '10px' }}>🤖 AI yaratgan</span>}
                      </div>
                      <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, fontSize: '0.9rem' }}>
                        {selectedAssignment.instructions}
                      </div>
                    </div>

                    {/* ── STUDENT: kod editor yoki fayl yuklash ── */}
                    {user.role === 'student' && (
                      <div>
                        {CODE_TYPES.includes(selectedAssignment.task_type) ? (
                          /* ── Dasturlash: kod yozish maydoni ── */
                          <div style={{ background: 'rgba(99,102,241,0.05)', borderRadius: '12px', padding: '1.25rem', border: '1px solid rgba(99,102,241,0.2)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                              <h4 style={{ margin: 0, color: '#4f46e5' }}>
                                {TASK_TYPES[selectedAssignment.task_type]?.icon} {TASK_TYPES[selectedAssignment.task_type]?.label} kodini yozing
                              </h4>
                              {selectedAssignment.my_submission?.status === 'graded' && (
                                <span style={{ fontSize: '0.8rem', background: 'rgba(34,197,94,0.15)', color: '#16a34a', padding: '3px 10px', borderRadius: '20px', fontWeight: 600 }}>
                                  ✅ {selectedAssignment.my_submission.score} / {selectedAssignment.max_score} ball
                                </span>
                              )}
                            </div>

                            {/* Avvalgi natija */}
                            {(codeResult[selectedAssignment.id] || (selectedAssignment.my_submission?.status === 'graded')) && (
                              <div style={{ marginBottom: '1rem', padding: '0.9rem 1rem', background: 'var(--card-bg)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                                {(() => {
                                  const r = codeResult[selectedAssignment.id];
                                  const sub = selectedAssignment.my_submission;
                                  const score = r?.score ?? sub?.score;
                                  const feedback = r?.feedback ?? sub?.feedback;
                                  const maxScore = selectedAssignment.max_score;
                                  const pct = r?.score_percent ?? (score != null ? Math.round(score / maxScore * 100) : null);
                                  const scoreColor = pct >= 85 ? '#16a34a' : pct >= 60 ? '#d97706' : '#dc2626';
                                  return (
                                    <div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '1.5rem', fontWeight: 800, color: scoreColor }}>{score} / {maxScore}</span>
                                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: scoreColor }}>{pct}%</span>
                                        <span style={{ fontSize: '0.75rem', color: '#9333ea', background: 'rgba(168,85,247,0.1)', padding: '2px 8px', borderRadius: '10px' }}>🤖 AI baho</span>
                                      </div>
                                      {feedback && <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{feedback}</p>}
                                      {r?.strengths && (
                                        <div style={{ marginTop: '0.5rem', fontSize: '0.82rem' }}>
                                          <span style={{ color: '#16a34a' }}>✅ {r.strengths}</span>
                                        </div>
                                      )}
                                      {r?.improvements && (
                                        <div style={{ marginTop: '0.3rem', fontSize: '0.82rem' }}>
                                          <span style={{ color: '#dc2626' }}>💡 {r.improvements}</span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            )}

                            {/* Kod yozish maydoni */}
                            <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
                              <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                background: '#1e1e2e', padding: '0.5rem 0.75rem',
                                borderRadius: '8px 8px 0 0',
                                borderBottom: '1px solid rgba(255,255,255,0.1)'
                              }}>
                                <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace' }}>
                                  {TASK_TYPES[selectedAssignment.task_type]?.icon} {selectedAssignment.task_type === 'python' ? 'python' : selectedAssignment.task_type === 'html' ? 'html' : selectedAssignment.task_type === 'javascript' ? 'javascript' : 'css'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setCodeInput(c => ({ ...c, [selectedAssignment.id]: '' }))}
                                  style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '0.75rem' }}
                                >
                                  🗑️ Tozalash
                                </button>
                              </div>
                              <textarea
                                value={codeInput[selectedAssignment.id] || ''}
                                onChange={e => setCodeInput(c => ({ ...c, [selectedAssignment.id]: e.target.value }))}
                                placeholder={getCodePlaceholder(selectedAssignment.task_type)}
                                spellCheck={false}
                                style={{
                                  width: '100%',
                                  minHeight: '280px',
                                  background: '#1e1e2e',
                                  color: '#cdd6f4',
                                  fontFamily: '"Fira Code", "Cascadia Code", "Consolas", monospace',
                                  fontSize: '0.88rem',
                                  lineHeight: '1.6',
                                  padding: '1rem',
                                  border: 'none',
                                  borderRadius: '0 0 8px 8px',
                                  resize: 'vertical',
                                  outline: 'none',
                                  boxSizing: 'border-box',
                                  tabSize: 4,
                                }}
                                onKeyDown={e => {
                                  // Tab tugmasi 4 bo'sh joy kiritsin
                                  if (e.key === 'Tab') {
                                    e.preventDefault();
                                    const start = e.target.selectionStart;
                                    const end = e.target.selectionEnd;
                                    const val = e.target.value;
                                    const newVal = val.substring(0, start) + '    ' + val.substring(end);
                                    setCodeInput(c => ({ ...c, [selectedAssignment.id]: newVal }));
                                    setTimeout(() => { e.target.selectionStart = e.target.selectionEnd = start + 4; }, 0);
                                  }
                                }}
                              />
                            </div>

                            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                              <button
                                onClick={() => handleSubmitCode(selectedAssignment.id)}
                                disabled={submittingCode || !codeInput[selectedAssignment.id]?.trim()}
                                className="btn btn-primary"
                                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                              >
                                {submittingCode ? '⏳ Yuklanmoqda...' : '🚀 Yuborish va baholash'}
                              </button>
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                🤖 Yuborilgandan so'ng AI avtomatik baholaydi
                              </span>
                            </div>
                          </div>
                        ) : (
                          /* ── Fayl yuklash (Word, Excel, Access, Scratch) ── */
                          <div style={{ background: 'rgba(34,197,94,0.06)', borderRadius: '10px', padding: '1.25rem', border: '1px solid rgba(34,197,94,0.2)' }}>
                            <h4 style={{ margin: '0 0 0.75rem', color: '#16a34a' }}>📤 Topshiriqni yuklash</h4>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                              Qabul qilinadigan fayl: <strong>{TASK_TYPES[selectedAssignment.task_type]?.ext}</strong>
                            </p>
                            {selectedAssignment.my_submission && (
                              <div style={{ marginBottom: '0.75rem', padding: '0.6rem 0.9rem', background: 'var(--card-bg)', borderRadius: '8px', fontSize: '0.85rem', border: '1px solid var(--border-color)' }}>
                                {selectedAssignment.my_submission.status === 'graded' ? (
                                  <div>
                                    <div style={{ color: '#16a34a', fontWeight: 600, marginBottom: '0.25rem' }}>
                                      ✅ Ball: {selectedAssignment.my_submission.score} / {selectedAssignment.max_score}
                                    </div>
                                    {selectedAssignment.my_submission.feedback && (
                                      <div style={{ color: 'var(--text-secondary)' }}>💬 {selectedAssignment.my_submission.feedback}</div>
                                    )}
                                  </div>
                                ) : (
                                  <span style={{ color: '#d97706' }}>
                                    ⏳ "{selectedAssignment.my_submission.file_name}" yuklangan, tekshirilmoqda...
                                  </span>
                                )}
                              </div>
                            )}
                            <label className="btn btn-primary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                              {submittingFile ? '⏳ Yuklanmoqda...' : (selectedAssignment.my_submission ? '🔄 Qayta yuklash' : '📎 Fayl tanlash va yuklash')}
                              <input type="file" style={{ display: 'none' }} disabled={submittingFile}
                                onChange={(e) => handleSubmitFile(selectedAssignment.id, e)} />
                            </label>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── TEACHER: submissions list ── */}
                    {isOwner && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                          <h4 style={{ margin: 0 }}>📨 Topshirmalar ({assignmentSubmissions.length})</h4>
                          <button onClick={() => fetchSubmissions(selectedAssignment.id)} className="btn btn-sm btn-outline">🔄 Yangilash</button>
                        </div>

                        {loadingSubmissions ? (
                          <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)' }}>Yuklanmoqda...</div>
                        ) : assignmentSubmissions.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', borderRadius: '10px' }}>
                            Hali hech kim topshirmadi
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {assignmentSubmissions.map(sub => (
                              <div key={sub.id} style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '1rem', border: '1px solid var(--border-color)' }}>
                                {/* Student info */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                  <div>
                                    <span style={{ fontWeight: 600 }}>{sub.student_name}</span>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>{sub.class_name}</span>
                                  </div>
                                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    {sub.status === 'graded'
                                      ? <span style={{ background: 'rgba(34,197,94,0.15)', color: '#16a34a', padding: '2px 10px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 600 }}>✅ {sub.score} ball</span>
                                      : <span style={{ background: 'rgba(245,158,11,0.15)', color: '#d97706', padding: '2px 10px', borderRadius: '10px', fontSize: '0.8rem' }}>⏳ Kutilmoqda</span>
                                    }
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                      {new Date(sub.submitted_at).toLocaleDateString('uz-UZ')}
                                    </span>
                                  </div>
                                </div>

                                {/* File download / Code view */}
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                                  {sub.code_content ? (
                                    <details style={{ width: '100%' }}>
                                      <summary className="btn btn-sm btn-outline" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                                        👁️ Kodni ko'rish ({sub.file_name})
                                      </summary>
                                      <pre style={{
                                        marginTop: '0.5rem', padding: '1rem', background: '#1e1e2e',
                                        color: '#cdd6f4', borderRadius: '8px', fontSize: '0.82rem',
                                        fontFamily: 'monospace', overflow: 'auto', maxHeight: '300px',
                                        border: '1px solid var(--border-color)', whiteSpace: 'pre-wrap'
                                      }}>{sub.code_content}</pre>
                                    </details>
                                  ) : sub.file_path && sub.file_path.startsWith('http') ? (
                                    <a href={sub.file_path}
                                      target="_blank" rel="noopener noreferrer"
                                      className="btn btn-sm btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                                      ⬇️ {sub.file_name}
                                    </a>
                                  ) : (
                                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                      📎 {sub.file_name}
                                    </span>
                                  )}
                                  {sub.graded_by === 'ai' && <span style={{ fontSize: '0.75rem', color: '#9333ea' }}>🤖 AI baholagan</span>}
                                  {sub.graded_by === 'teacher' && <span style={{ fontSize: '0.75rem', color: '#2563eb' }}>👨‍🏫 O'qituvchi baholagan</span>}
                                </div>

                                {/* Previous feedback */}
                                {sub.feedback && (
                                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', padding: '0.5rem', background: 'var(--card-bg)', borderRadius: '6px', borderLeft: '3px solid var(--primary-color)' }}>
                                    💬 {sub.feedback}
                                  </div>
                                )}

                                {/* Grading panel */}
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                  <div>
                                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>
                                      Ball (0–{selectedAssignment.max_score})
                                    </label>
                                    <input type="number" min="0" max={selectedAssignment.max_score}
                                      value={manualScore[sub.id] ?? (sub.score ?? '')}
                                      onChange={e => setManualScore(s => ({ ...s, [sub.id]: e.target.value }))}
                                      style={{ width: '70px', padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: '0.9rem' }} />
                                  </div>
                                  <div style={{ flex: 1, minWidth: '160px' }}>
                                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>Izoh</label>
                                    <input type="text" placeholder="Izoh (ixtiyoriy)"
                                      value={manualFeedback[sub.id] ?? (sub.feedback ?? '')}
                                      onChange={e => setManualFeedback(s => ({ ...s, [sub.id]: e.target.value }))}
                                      style={{ width: '100%', padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: '0.85rem' }} />
                                  </div>
                                  <button onClick={() => handleManualGrade(sub.id, selectedAssignment.max_score)}
                                    disabled={gradingId === sub.id}
                                    className="btn btn-sm btn-primary">
                                    {gradingId === sub.id ? '⏳' : '✅ Ball qo\'y'}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        </div>
        )}
      </div>

      {/* ════════════════════════ MODALS ════════════════════════ */}

      {/* Create Test Modal */}
      {showCreateTestModal && (
        <div className="modal-overlay" onClick={() => setShowCreateTestModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📝 Yangi test yaratish</h2>
              <button className="close-btn" onClick={() => setShowCreateTestModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateTest} className="modal-form">
              <div className="form-group">
                <label>Test nomi *</label>
                <input type="text" value={newTest.title}
                  onChange={(e) => setNewTest({ ...newTest, title: e.target.value })}
                  placeholder="Masalan: 1-mavzu bo'yicha test" required />
              </div>
              <div className="form-group">
                <label>Tavsif</label>
                <textarea value={newTest.description}
                  onChange={(e) => setNewTest({ ...newTest, description: e.target.value })}
                  placeholder="Test haqida qisqacha..." rows="2" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Vaqt (daqiqa) *</label>
                  <input type="number" value={newTest.duration} min="1" max="180"
                    onChange={(e) => setNewTest({ ...newTest, duration: parseInt(e.target.value) })} required />
                </div>
                <div className="form-group">
                  <label>Qiyinlik</label>
                  <select value={newTest.difficulty} onChange={(e) => setNewTest({ ...newTest, difficulty: e.target.value })}>
                    <option value="easy">Oson</option>
                    <option value="medium">O'rta</option>
                    <option value="hard">Qiyin</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>O'tish bali (%)</label>
                  <input type="number" value={newTest.passing_score} min="1" max="100"
                    onChange={(e) => setNewTest({ ...newTest, passing_score: parseInt(e.target.value) })} />
                </div>
                <div className="form-group">
                  <label>Maksimal ball</label>
                  <input type="number" value={newTest.max_score || 20} min="1" max="100"
                    onChange={(e) => setNewTest({ ...newTest, max_score: parseInt(e.target.value) })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Fan</label>
                  <input type="text" value={newTest.subject || lesson.subject}
                    onChange={(e) => setNewTest({ ...newTest, subject: e.target.value })}
                    placeholder={lesson.subject} />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowCreateTestModal(false)}>Bekor qilish</button>
                <button type="submit" className="btn btn-primary">✅ Yaratish</button>
              </div>
            </form>
          </div>
        </div>
      )}



      {/* Add Question Modal */}
      {showAddQuestionModal && selectedTest && (
        <div className="modal-overlay" onClick={() => setShowAddQuestionModal(false)}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>➕ Savol qo'shish</h2>
              <button className="close-btn" onClick={() => setShowAddQuestionModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddQuestion} className="modal-form">
              <div className="form-group">
                <label>Savol matni *</label>
                <textarea value={newQuestion.question_text}
                  onChange={(e) => setNewQuestion({ ...newQuestion, question_text: e.target.value })}
                  placeholder="Savolingizni kiriting..." rows="3" required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Savol turi</label>
                  <select value={newQuestion.question_type}
                    onChange={(e) => setNewQuestion({ ...newQuestion, question_type: e.target.value })}>
                    <option value="single_choice">Bir tanlovli</option>
                    <option value="multiple_choice">Ko'p tanlovli</option>
                    <option value="true_false">To'g'ri/Noto'g'ri</option>
                    <option value="short_answer">Qisqa javob</option>
                    <option value="code_writing">Kod yozish</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Ballar</label>
                  <input type="number" value={newQuestion.points} min="1" max="10"
                    onChange={(e) => setNewQuestion({ ...newQuestion, points: parseInt(e.target.value) })} />
                </div>
              </div>
              {(newQuestion.question_type === 'single_choice' || newQuestion.question_type === 'multiple_choice') && (
                <div className="form-group">
                  <label>Javob variantlari *</label>
                  {newQuestion.options.map((option, index) => (
                    <input key={index} type="text" value={option}
                      onChange={(e) => {
                        const opts = [...newQuestion.options];
                        opts[index] = e.target.value;
                        setNewQuestion({ ...newQuestion, options: opts });
                      }}
                      placeholder={`Variant ${index + 1}`} required style={{ marginBottom: '8px' }} />
                  ))}
                </div>
              )}
              <div className="form-group">
                <label>To'g'ri javob *</label>
                <input type="text" value={newQuestion.correct_answer}
                  onChange={(e) => setNewQuestion({ ...newQuestion, correct_answer: e.target.value })}
                  placeholder={newQuestion.question_type === 'true_false' ? "true yoki false" : "To'g'ri javobni kiriting"} required />
              </div>
              <div className="form-group">
                <label>Tushuntirish (ixtiyoriy)</label>
                <textarea value={newQuestion.explanation}
                  onChange={(e) => setNewQuestion({ ...newQuestion, explanation: e.target.value })}
                  placeholder="Javob haqida tushuntirish..." rows="2" />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowAddQuestionModal(false)}>Bekor qilish</button>
                <button type="submit" className="btn btn-primary">➕ Qo'shish</button>
              </div>
            </form>
          </div>
        </div>
      )}



      {/* Edit Question Modal */}
      {showEditQuestionModal && editingQuestion && (
        <div className="modal-overlay" onClick={() => setShowEditQuestionModal(false)}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>✏️ Savolni tahrirlash</h2>
              <button className="close-btn" onClick={() => setShowEditQuestionModal(false)}>✕</button>
            </div>
            <form onSubmit={handleUpdateQuestion} className="modal-form">
              <div className="form-group">
                <label>Savol matni *</label>
                <textarea value={editingQuestion.question_text}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, question_text: e.target.value })}
                  rows="3" required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Savol turi</label>
                  <select value={editingQuestion.question_type}
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, question_type: e.target.value })}>
                    <option value="single_choice">Bir tanlovli</option>
                    <option value="multiple_choice">Ko'p tanlovli</option>
                    <option value="true_false">To'g'ri/Noto'g'ri</option>
                    <option value="short_answer">Qisqa javob</option>
                    <option value="code_writing">Kod yozish</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Ballar</label>
                  <input type="number" value={editingQuestion.points} min="1" max="10"
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, points: parseInt(e.target.value) })} />
                </div>
              </div>
              {(editingQuestion.question_type === 'single_choice' || editingQuestion.question_type === 'multiple_choice') && (
                <div className="form-group">
                  <label>Javob variantlari *</label>
                  {editingQuestion.options.map((option, index) => (
                    <input key={index} type="text" value={option}
                      onChange={(e) => {
                        const opts = [...editingQuestion.options];
                        opts[index] = e.target.value;
                        setEditingQuestion({ ...editingQuestion, options: opts });
                      }}
                      placeholder={`Variant ${index + 1}`} required style={{ marginBottom: '8px' }} />
                  ))}
                </div>
              )}
              <div className="form-group">
                <label>To'g'ri javob *</label>
                <input type="text" value={editingQuestion.correct_answer}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, correct_answer: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Tushuntirish</label>
                <textarea value={editingQuestion.explanation || ''}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, explanation: e.target.value })}
                  rows="2" />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-danger"
                  onClick={() => handleDeleteQuestion(editingQuestion.id)}>
                  🗑️ O'chirish
                </button>
                <div style={{ flex: 1 }}></div>
                <button type="button" className="btn btn-outline" onClick={() => setShowEditQuestionModal(false)}>Bekor qilish</button>
                <button type="submit" className="btn btn-primary">💾 Saqlash</button>
              </div>
            </form>
          </div>
        </div>
      )}



      {/* AI Generate Modal */}
      {showAIModal && selectedTest && (
        <div className="modal-overlay" onClick={() => setShowAIModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🤖 AI bilan savol yaratish</h2>
              <button className="close-btn" onClick={() => setShowAIModal(false)}>✕</button>
            </div>
            <form onSubmit={handleGenerateAI} className="modal-form">
              <div className="form-group">
                <label>Mavzu *</label>
                <input type="text" value={aiPrompt.topic}
                  onChange={(e) => setAiPrompt({ ...aiPrompt, topic: e.target.value })}
                  placeholder={`Masalan: ${selectedTest.subject || lesson.subject}`} required />
                <small>AI ushbu mavzu bo'yicha savollar yaratadi</small>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Savollar soni</label>
                  <input type="number" value={aiPrompt.count} min="1" max="20"
                    onChange={(e) => setAiPrompt({ ...aiPrompt, count: parseInt(e.target.value) })} />
                </div>
                <div className="form-group">
                  <label>Qiyinlik</label>
                  <select value={aiPrompt.difficulty}
                    onChange={(e) => setAiPrompt({ ...aiPrompt, difficulty: e.target.value })}>
                    <option value="easy">Oson</option>
                    <option value="medium">O'rta</option>
                    <option value="hard">Qiyin</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Savol turi</label>
                <select value={aiPrompt.questionType}
                  onChange={(e) => setAiPrompt({ ...aiPrompt, questionType: e.target.value })}>
                  <option value="single_choice">Bir tanlovli</option>
                  <option value="multiple_choice">Ko'p tanlovli</option>
                  <option value="true_false">To'g'ri/Noto'g'ri</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowAIModal(false)} disabled={aiLoading}>Bekor qilish</button>
                <button type="submit" className="btn btn-success" disabled={aiLoading}>
                  {aiLoading ? '⏳ Yaratilmoqda...' : '🤖 Yaratish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Assignment Modal */}
      {showCreateAssignModal && (
        <div className="modal-overlay" onClick={() => setShowCreateAssignModal(false)}>
          <div className="modal-content modal-large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🖥️ Amaliy topshiriq yaratish</h2>
              <button className="close-btn" onClick={() => setShowCreateAssignModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateAssignment} className="modal-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Topshiriq turi *</label>
                  <select value={newAssignment.task_type} onChange={e => setNewAssignment({...newAssignment, task_type: e.target.value})} required>
                    {Object.entries(TASK_TYPES).map(([k, v]) => (
                      <option key={k} value={k}>{v.icon} {v.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Maksimal ball</label>
                  <input type="number" min="1" max="100" value={newAssignment.max_score}
                    onChange={e => setNewAssignment({...newAssignment, max_score: parseInt(e.target.value)})} />
                </div>
              </div>
              <div className="form-group">
                <label>Topshiriq nomi *</label>
                <input type="text" value={newAssignment.title} required
                  onChange={e => setNewAssignment({...newAssignment, title: e.target.value})}
                  placeholder={`Masalan: ${TASK_TYPES[newAssignment.task_type]?.label} da hujjat tayyorlash`} />
              </div>
              <div className="form-group">
                <label>Qisqacha tavsif</label>
                <textarea rows="2" value={newAssignment.description}
                  onChange={e => setNewAssignment({...newAssignment, description: e.target.value})}
                  placeholder="Topshiriq haqida qisqacha..." />
              </div>
              <div className="form-group">
                <label>Bajarish ko'rsatmalari * <small style={{color:'var(--text-secondary)'}}>(nima qilish kerak, qanday, qanday talablar)</small></label>
                <textarea rows="7" value={newAssignment.instructions} required
                  onChange={e => setNewAssignment({...newAssignment, instructions: e.target.value})}
                  placeholder={`${TASK_TYPES[newAssignment.task_type]?.label} da bajarish kerak bo'lgan vazifalarni batafsil yozing...`} />
              </div>
              <div className="form-group">
                <label>Topshirish muddati (ixtiyoriy)</label>
                <input type="datetime-local" value={newAssignment.deadline}
                  onChange={e => setNewAssignment({...newAssignment, deadline: e.target.value})} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowCreateAssignModal(false)}>Bekor qilish</button>
                <button type="submit" className="btn btn-primary">✅ Yaratish</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Assignment Modal */}
      {showAIAssignModal && (
        <div className="modal-overlay" onClick={() => setShowAIAssignModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🤖 AI bilan topshiriq yaratish</h2>
              <button className="close-btn" onClick={() => setShowAIAssignModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAICreateAssignment} className="modal-form">
              <div className="form-group">
                <label>Topshiriq turi *</label>
                <select value={aiAssignPrompt.task_type}
                  onChange={e => setAiAssignPrompt({...aiAssignPrompt, task_type: e.target.value})}>
                  {Object.entries(TASK_TYPES).map(([k, v]) => (
                    <option key={k} value={k}>{v.icon} {v.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Mavzu *</label>
                <input type="text" required value={aiAssignPrompt.topic}
                  onChange={e => setAiAssignPrompt({...aiAssignPrompt, topic: e.target.value})}
                  placeholder={`Masalan: ${ {python:"Ro'yxatlar bilan ishlash", html:'Shaxsiy sahifa', excel:'Ish haqi hisobi', word:'Rezyume tayyorlash'}[aiAssignPrompt.task_type] || 'Mavzu nomi'}`} />
              </div>
              <div className="form-group">
                <label>Qiyinlik</label>
                <select value={aiAssignPrompt.level}
                  onChange={e => setAiAssignPrompt({...aiAssignPrompt, level: e.target.value})}>
                  <option value="easy">Oson</option>
                  <option value="medium">O'rta</option>
                  <option value="hard">Qiyin</option>
                </select>
              </div>
              <div style={{ background: 'rgba(168,85,247,0.08)', borderRadius: '8px', padding: '0.75rem', fontSize: '0.85rem', color: '#9333ea', marginBottom: '0.5rem' }}>
                🤖 AI <strong>{lesson?.grade}-sinf</strong> uchun, mavzu va qiyinlik asosida to'liq ko'rsatmalar bilan topshiriq yaratadi
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowAIAssignModal(false)} disabled={aiAssignLoading}>Bekor qilish</button>
                <button type="submit" className="btn btn-success" disabled={aiAssignLoading}>
                  {aiAssignLoading ? '⏳ Yaratilmoqda...' : '🤖 AI yaratsin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Assignment Modal */}
      {showEditAssignModal && editingAssignment && (
        <div className="modal-overlay" onClick={() => setShowEditAssignModal(false)}>
          <div className="modal-content modal-large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>✏️ Topshiriqni tahrirlash</h2>
              <button className="close-btn" onClick={() => setShowEditAssignModal(false)}>✕</button>
            </div>
            <form onSubmit={handleUpdateAssignment} className="modal-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Topshiriq turi *</label>
                  <select value={editingAssignment.task_type}
                    onChange={e => setEditingAssignment({...editingAssignment, task_type: e.target.value})} required>
                    {Object.entries(TASK_TYPES).map(([k, v]) => (
                      <option key={k} value={k}>{v.icon} {v.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Maksimal ball</label>
                  <input type="number" min="1" max="100"
                    value={editingAssignment.max_score}
                    onChange={e => setEditingAssignment({...editingAssignment, max_score: parseInt(e.target.value)})} />
                </div>
              </div>
              <div className="form-group">
                <label>Topshiriq nomi *</label>
                <input type="text" required value={editingAssignment.title}
                  onChange={e => setEditingAssignment({...editingAssignment, title: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Qisqacha tavsif</label>
                <textarea rows="2" value={editingAssignment.description}
                  onChange={e => setEditingAssignment({...editingAssignment, description: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Bajarish ko'rsatmalari *</label>
                <textarea rows="8" required value={editingAssignment.instructions}
                  onChange={e => setEditingAssignment({...editingAssignment, instructions: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Topshirish muddati (ixtiyoriy)</label>
                <input type="datetime-local" value={editingAssignment.deadline || ''}
                  onChange={e => setEditingAssignment({...editingAssignment, deadline: e.target.value})} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowEditAssignModal(false)}>
                  Bekor qilish
                </button>
                <button type="submit" className="btn btn-primary">💾 Saqlash</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Lesson Modal */}
      {showEditLessonModal && (
        <div className="modal-overlay" onClick={() => setShowEditLessonModal(false)}>
          <div className="modal-content modal-large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>✏️ Darsni tahrirlash</h2>
              <button className="close-btn" onClick={() => setShowEditLessonModal(false)}>✕</button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api.put(`/lessons/${id}`, {
                  title: editLesson.title || lesson.title,
                  description: editLesson.description,
                  subject: editLesson.subject || lesson.subject,
                  content: editLesson.content
                });
                setShowEditLessonModal(false);
                fetchLesson();
                alert('✅ Dars yangilandi!');
              } catch (err) {
                alert('Xatolik: ' + (err.response?.data?.error || err.message));
              }
            }} className="modal-form">
              <div className="form-group">
                <label>Dars nomi *</label>
                <input type="text" required
                  defaultValue={lesson.title}
                  onChange={e => setEditLesson({...editLesson, title: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Fan</label>
                <input type="text"
                  defaultValue={lesson.subject}
                  onChange={e => setEditLesson({...editLesson, subject: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Tavsif</label>
                <textarea rows="3"
                  defaultValue={lesson.description}
                  onChange={e => setEditLesson({...editLesson, description: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Dars tarkibi</label>
                <textarea rows="8"
                  defaultValue={lesson.content}
                  onChange={e => setEditLesson({...editLesson, content: e.target.value})} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowEditLessonModal(false)}>Bekor qilish</button>
                <button type="submit" className="btn btn-primary">💾 Saqlash</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default LessonDetail;
