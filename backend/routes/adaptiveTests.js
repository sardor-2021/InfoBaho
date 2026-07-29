/**
 * Adaptiv test route'lari
 * Zinapoya (staircase) algoritmiga asoslangan adaptiv test tizimi
 */
const express = require('express');
const router = express.Router();
const database = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimiter');
const { readFileForAI } = require('../utils/fileReader');
const { chat } = require('../utils/ai');

// ─── HELPER: Keyingi savolni zinapoya algoritmi bilan tanlash ───
async function getNextQuestion(adaptiveTestId, targetDifficulty, excludeIds) {
  for (let offset = 0; offset <= 4; offset++) {
    for (const level of [targetDifficulty, targetDifficulty - offset, targetDifficulty + offset]) {
      if (level < 1 || level > 5) continue;
      if (offset === 0 && level !== targetDifficulty) continue;
      const q = await database.get(
        `SELECT id, question_text, option_a, option_b, option_c, option_d, concept, difficulty_level, order_number
         FROM adaptive_questions
         WHERE adaptive_test_id = $1 AND difficulty_level = $2 AND id != ALL($3::int[])
         ORDER BY RANDOM() LIMIT 1`,
        [adaptiveTestId, level, excludeIds.length ? excludeIds : [0]]
      );
      if (q) return q;
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
// Endpoint 1: AI bilan 20 ta savol generatsiya qilish
// POST /api/lessons/:lessonId/adaptive-test/generate
// ═══════════════════════════════════════════════════════════════
router.post('/lessons/:lessonId/adaptive-test/generate', authenticateToken, requireRole(['teacher', 'admin']), aiLimiter, async (req, res) => {
  try {
    const lessonId = parseInt(req.params.lessonId);

    // Dars mavjudligini tekshirish
    const lesson = await database.get('SELECT * FROM lessons WHERE id = $1', [lessonId]);
    if (!lesson) return res.status(404).json({ error: 'Dars topilmadi' });

    // Materiallarni olish
    const materials = await database.all(
      'SELECT * FROM lesson_materials WHERE lesson_id = $1',
      [lessonId]
    );

    let sourceContent = '';
    let generatedFrom = 'topic_only';

    if (materials && materials.length > 0) {
      generatedFrom = 'material';
      // Har bir materialni o'qish
      for (const mat of materials) {
        try {
          const fileData = await readFileForAI(mat.file_path, mat.file_name);
          if (fileData && fileData.content && fileData.type === 'text') {
            sourceContent += `\n--- ${mat.file_name} ---\n${fileData.content}\n`;
          }
        } catch (e) {
          console.error(`Material o'qishda xato: ${mat.file_name}`, e.message);
        }
      }
      // 12000 belgigacha cheklash
      sourceContent = sourceContent.slice(0, 12000);
    }

    // AI prompt
    let prompt;
    if (generatedFrom === 'material' && sourceContent.trim()) {
      prompt = `Mavzu: "${lesson.title}"
Quyidagi dars materialiga QATTIQ asoslanib, aynan 20 ta test savoli tuzing (4 variantli, faqat bitta to'g'ri javob).

⚠️ MUHIM QOIDA: Savollar FAQAT quyida berilgan material tarkibidagi ma'lumotlardan bo'lsin! Materialda yo'q mavzularga, boshqa fanlarga yoki umumiy bilim savollariga O'TMAGIN. Agar material qisqa bo'lsa, bir tushunchadan bir nechta burchakda savol tuz.

MATERIAL:
${sourceContent}

Har bir savol uchun:
- "concept": qaysi tor tushunchaga tegishli (2-3 so'zda, o'zbek tilida, FAQAT materialdagi tushuncha)
- "difficulty": qiyinlik darajasi (1-5)
- "explanation": noto'g'ri javob bergan o'quvchiga tushuntirish — nima uchun to'g'ri javob aynan shu, qisqa va aniq (2-3 gap, o'zbek tilida)

Qiyinlik taqsimoti: 5 ta oson (1-2), 10 ta o'rta (3), 5 ta qiyin (4-5).

Faqat JSON qaytaring, boshqa hech narsa yozmang:
[{"question":"...","a":"...","b":"...","c":"...","d":"...","correct":"a","concept":"...","difficulty":3,"explanation":"..."}, ...]`;
    } else {
      prompt = `Mavzu: "${lesson.title}"
Bu mavzu bo'yicha material yuklanmagan. FAQAT berilgan mavzu doirasida (boshqa fanlarga o'tmasdan!) aynan 20 ta test savoli tuzing (4 variantli, faqat bitta to'g'ri javob).

⚠️ MUHIM: Savollar faqat "${lesson.title}" mavzusiga tegishli bo'lsin. Boshqa mavzularga, fanlarga o'tmagin.

Har bir savol uchun:
- "concept": qaysi tor tushunchaga tegishli (2-3 so'zda, o'zbek tilida)
- "difficulty": qiyinlik darajasi (1-5)
- "explanation": noto'g'ri javob bergan o'quvchiga tushuntirish — nima uchun to'g'ri javob aynan shu, qisqa va aniq (2-3 gap, o'zbek tilida)

Qiyinlik taqsimoti: 5 ta oson (1-2), 10 ta o'rta (3), 5 ta qiyin (4-5).

Faqat JSON qaytaring:
[{"question":"...","a":"...","b":"...","c":"...","d":"...","correct":"a","concept":"...","difficulty":3,"explanation":"..."}, ...]`;
    }

    // AI chaqirish
    const raw = await chat(prompt, { max_tokens: 8000, effort: 'low' });

    // JSON parse — himoyalangan
    let questions;
    try {
      const jsonStr = raw.match(/\[[\s\S]*\]/)?.[0] || raw;
      questions = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error('AI JSON parse xato:', parseErr.message, '\nRaw:', raw.slice(0, 200));
      return res.status(500).json({
        error: 'AI javobini o\'qib bo\'lmadi. Qayta urinib ko\'ring.',
        details: parseErr.message
      });
    }

    if (!Array.isArray(questions) || questions.length < 5) {
      return res.status(500).json({ error: 'AI yetarli savol yaratmadi. Qayta urinib ko\'ring.' });
    }

    // Agar mavjud adaptive_test bo'lsa — tekshirish va o'chirish (qayta generatsiya)
    const existing = await database.get(
      'SELECT id FROM adaptive_tests WHERE lesson_id = $1',
      [lessonId]
    );
    if (existing) {
      const completedCount = await database.get(
        `SELECT COUNT(*) as cnt FROM adaptive_attempts
         WHERE adaptive_test_id = $1 AND status = 'completed'`,
        [existing.id]
      );
      if (parseInt(completedCount.cnt) > 0 && !req.body.confirm_overwrite) {
        return res.status(409).json({
          error: `Diqqat: ${completedCount.cnt} ta o'quvchi bu testni allaqachon yechgan. Qayta generatsiya ularning barcha natijalarini butunlay o'chirib yuboradi.`,
          requiresConfirmation: true,
          affectedStudents: parseInt(completedCount.cnt)
        });
      }
      await database.run('DELETE FROM adaptive_tests WHERE id = $1', [existing.id]);
    }

    // Yangi adaptive_test yaratish
    const testResult = await database.run(
      `INSERT INTO adaptive_tests (lesson_id, status, generated_from, created_by)
       VALUES ($1, 'draft', $2, $3)`,
      [lessonId, generatedFrom, req.user.id]
    );
    const adaptiveTestId = testResult.id;

    // Savollarni saqlash
    const savedQuestions = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const correctOption = (q.correct || 'a').toLowerCase();
      const difficulty = Math.max(1, Math.min(5, parseInt(q.difficulty) || 3));
      const explanation = q.explanation || '';

      const qResult = await database.run(
        `INSERT INTO adaptive_questions
         (adaptive_test_id, question_text, option_a, option_b, option_c, option_d, correct_option, concept, difficulty_level, explanation, order_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [adaptiveTestId, q.question, q.a, q.b, q.c, q.d, correctOption, q.concept || 'Umumiy', difficulty, explanation, i + 1]
      );
      savedQuestions.push({ id: qResult.id, question_text: q.question, concept: q.concept, difficulty_level: difficulty, explanation });
    }

    res.json({
      adaptiveTest: { id: adaptiveTestId, lesson_id: lessonId, status: 'draft', generated_from: generatedFrom },
      questions: savedQuestions,
      totalQuestions: savedQuestions.length,
      status: 'draft'
    });

  } catch (err) {
    console.error('Adaptive test generate error:', err);
    res.status(500).json({ error: 'Adaptiv test yaratishda xatolik: ' + err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// Endpoint 2: Bitta savolni tahrirlash
// PUT /api/adaptive-questions/:id
// ═══════════════════════════════════════════════════════════════
router.put('/adaptive-questions/:id', authenticateToken, requireRole(['teacher', 'admin']), async (req, res) => {
  try {
    const { question_text, option_a, option_b, option_c, option_d, correct_option, concept, difficulty_level, explanation } = req.body;

    const question = await database.get('SELECT * FROM adaptive_questions WHERE id = $1', [req.params.id]);
    if (!question) return res.status(404).json({ error: 'Savol topilmadi' });

    await database.run(
      `UPDATE adaptive_questions SET
        question_text = COALESCE($1, question_text),
        option_a = COALESCE($2, option_a),
        option_b = COALESCE($3, option_b),
        option_c = COALESCE($4, option_c),
        option_d = COALESCE($5, option_d),
        correct_option = COALESCE($6, correct_option),
        concept = COALESCE($7, concept),
        difficulty_level = COALESCE($8, difficulty_level),
        explanation = COALESCE($9, explanation),
        edited_by_teacher = TRUE
       WHERE id = $10`,
      [question_text, option_a, option_b, option_c, option_d, correct_option, concept, difficulty_level, explanation, req.params.id]
    );

    const updated = await database.get('SELECT * FROM adaptive_questions WHERE id = $1', [req.params.id]);
    res.json(updated);
  } catch (err) {
    console.error('Adaptive question update error:', err);
    res.status(500).json({ error: 'Savolni yangilashda xatolik' });
  }
});

// ═══════════════════════════════════════════════════════════════
// Endpoint 3: E'lon qilish
// POST /api/adaptive-tests/:id/publish
// ═══════════════════════════════════════════════════════════════
router.post('/adaptive-tests/:id/publish', authenticateToken, requireRole(['teacher', 'admin']), async (req, res) => {
  try {
    const test = await database.get('SELECT * FROM adaptive_tests WHERE id = $1', [req.params.id]);
    if (!test) return res.status(404).json({ error: 'Adaptiv test topilmadi' });

    // Savollar sonini tekshirish
    const countResult = await database.get(
      'SELECT COUNT(*) AS cnt FROM adaptive_questions WHERE adaptive_test_id = $1',
      [req.params.id]
    );
    if (parseInt(countResult.cnt) < 10) {
      return res.status(400).json({ error: 'E\'lon qilish uchun kamida 10 ta savol bo\'lishi kerak' });
    }

    await database.run(
      `UPDATE adaptive_tests SET status = 'published', updated_at = NOW() WHERE id = $1`,
      [req.params.id]
    );

    res.json({ message: 'Adaptiv test muvaffaqiyatli e\'lon qilindi!', status: 'published' });
  } catch (err) {
    console.error('Adaptive test publish error:', err);
    res.status(500).json({ error: 'E\'lon qilishda xatolik' });
  }
});

// ═══════════════════════════════════════════════════════════════
// Endpoint 4: Test ma'lumotini olish
// GET /api/lessons/:lessonId/adaptive-test
// ═══════════════════════════════════════════════════════════════
router.get('/lessons/:lessonId/adaptive-test', authenticateToken, async (req, res) => {
  try {
    const lessonId = parseInt(req.params.lessonId);
    const test = await database.get('SELECT * FROM adaptive_tests WHERE lesson_id = $1', [lessonId]);

    if (!test) return res.status(404).json({ error: 'Adaptiv test topilmadi' });

    // Agar draft va student bo'lsa — ko'rsatmasin
    if (test.status === 'draft' && req.user.role === 'student') {
      return res.status(404).json({ error: 'Adaptiv test hali e\'lon qilinmagan' });
    }

    // Savollarni olish
    const questions = await database.all(
      'SELECT * FROM adaptive_questions WHERE adaptive_test_id = $1 ORDER BY order_number, id',
      [test.id]
    );

    // O'quvchi uchun correct_option ni yashirish
    let safeQuestions = questions;
    if (req.user.role === 'student') {
      safeQuestions = questions.map(q => ({
        id: q.id,
        question_text: q.question_text,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        concept: q.concept,
        difficulty_level: q.difficulty_level,
        order_number: q.order_number
      }));
    }

    // O'quvchining mavjud attempt'ini tekshirish
    let myAttempt = null;
    let myResults = null;
    if (req.user.role === 'student') {
      myAttempt = await database.get(
        `SELECT * FROM adaptive_attempts 
         WHERE user_id = $1 AND adaptive_test_id = $2
         ORDER BY started_at DESC LIMIT 1`,
        [req.user.id, test.id]
      );
      if (myAttempt && myAttempt.status === 'completed') {
        myResults = await computeAdaptiveResults(myAttempt);
      }
    }

    res.json({
      ...test,
      questions: safeQuestions,
      totalQuestions: questions.length,
      myAttempt: myAttempt || null,
      myResults: myResults || null
    });
  } catch (err) {
    console.error('Get adaptive test error:', err);
    res.status(500).json({ error: 'Adaptiv testni olishda xatolik' });
  }
});

// ═══════════════════════════════════════════════════════════════
// Endpoint 5: Testni boshlash
// POST /api/adaptive-tests/:id/start
// ═══════════════════════════════════════════════════════════════
router.post('/adaptive-tests/:id/start', authenticateToken, async (req, res) => {
  try {
    const test = await database.get('SELECT * FROM adaptive_tests WHERE id = $1', [req.params.id]);
    if (!test) return res.status(404).json({ error: 'Adaptiv test topilmadi' });
    if (test.status !== 'published') return res.status(400).json({ error: 'Test hali e\'lon qilinmagan' });

    // Tugallanmagan attempt bormi? — davom ettirish
    const inProgressAttempt = await database.get(
      `SELECT * FROM adaptive_attempts 
       WHERE user_id = $1 AND adaptive_test_id = $2 AND status = 'in_progress'`,
      [req.user.id, test.id]
    );
    if (inProgressAttempt) {
      // Davom ettirish — keyingi savolni berish
      const askedIds = inProgressAttempt.asked_question_ids || [];
      const nextQ = await getNextQuestion(test.id, inProgressAttempt.current_difficulty, askedIds);
      return res.json({
        attemptId: inProgressAttempt.id,
        question: nextQ,
        questionNumber: askedIds.length + 1,
        totalQuestions: 15,
        currentDifficulty: inProgressAttempt.current_difficulty,
        resumed: true
      });
    }

    // Yangi attempt yaratish
    const attemptResult = await database.run(
      `INSERT INTO adaptive_attempts (user_id, adaptive_test_id, current_difficulty)
       VALUES ($1, $2, 3)`,
      [req.user.id, test.id]
    );

    // Birinchi savol (difficulty = 3 dan boshlanadi)
    const firstQuestion = await getNextQuestion(test.id, 3, []);
    if (!firstQuestion) {
      return res.status(500).json({ error: 'Savollar topilmadi' });
    }

    res.json({
      attemptId: attemptResult.id,
      question: firstQuestion,
      questionNumber: 1,
      totalQuestions: 15,
      currentDifficulty: 3
    });
  } catch (err) {
    console.error('Adaptive test start error:', err);
    res.status(500).json({ error: 'Testni boshlashda xatolik' });
  }
});

// ═══════════════════════════════════════════════════════════════
// Endpoint 6: Javobni yuborish
// POST /api/adaptive-attempts/:attemptId/answer
// ═══════════════════════════════════════════════════════════════
router.post('/adaptive-attempts/:attemptId/answer', authenticateToken, async (req, res) => {
  try {
    const { questionId, selectedOption } = req.body;
    const attemptId = parseInt(req.params.attemptId);

    const attempt = await database.get(
      'SELECT * FROM adaptive_attempts WHERE id = $1 AND user_id = $2',
      [attemptId, req.user.id]
    );
    if (!attempt) return res.status(404).json({ error: 'Urinish topilmadi' });
    if (attempt.status === 'completed') return res.status(400).json({ error: 'Test allaqachon tugatilgan' });

    // To'g'ri javobni tekshirish
    const question = await database.get(
      'SELECT * FROM adaptive_questions WHERE id = $1',
      [questionId]
    );
    if (!question) return res.status(404).json({ error: 'Savol topilmadi' });

    const isCorrect = selectedOption.toLowerCase() === question.correct_option;

    // current_difficulty ni yangilash (+1/-1, 1-5 chegarasida)
    let newDifficulty = attempt.current_difficulty + (isCorrect ? 1 : -1);
    newDifficulty = Math.max(1, Math.min(5, newDifficulty));

    // concept_scores yangilash
    const conceptScores = attempt.concept_scores || {};
    if (!conceptScores[question.concept]) {
      conceptScores[question.concept] = { correct: 0, total: 0 };
    }
    conceptScores[question.concept].total += 1;
    if (isCorrect) conceptScores[question.concept].correct += 1;

    // answers massivini yangilash
    const answers = attempt.answers || [];
    answers.push({
      questionId: question.id,
      selectedOption: selectedOption.toLowerCase(),
      correctOption: question.correct_option,
      isCorrect,
      concept: question.concept,
      difficulty: question.difficulty_level
    });

    // asked_question_ids yangilash
    const askedIds = attempt.asked_question_ids || [];
    askedIds.push(questionId);

    // DB yangilash
    await database.run(
      `UPDATE adaptive_attempts SET
        current_difficulty = $1,
        asked_question_ids = $2::int[],
        concept_scores = $3::jsonb,
        answers = $4::jsonb
       WHERE id = $5`,
      [newDifficulty, askedIds, JSON.stringify(conceptScores), JSON.stringify(answers), attemptId]
    );

    // 15 ta savoldan keyin tugatish
    if (askedIds.length >= 15) {
      await database.run(
        `UPDATE adaptive_attempts SET status = 'completed', completed_at = NOW() WHERE id = $1`,
        [attemptId]
      );
      return res.json({
        finished: true,
        attemptId,
        isCorrect,
        correctOption: question.correct_option,
        explanation: !isCorrect ? (question.explanation || '') : '',
        questionNumber: askedIds.length,
        totalAnswered: askedIds.length
      });
    }

    // Keyingi savol
    const nextQuestion = await getNextQuestion(attempt.adaptive_test_id, newDifficulty, askedIds);
    if (!nextQuestion) {
      // Savol qolmadi — tugatish
      await database.run(
        `UPDATE adaptive_attempts SET status = 'completed', completed_at = NOW() WHERE id = $1`,
        [attemptId]
      );
      return res.json({
        finished: true,
        attemptId,
        isCorrect,
        correctOption: question.correct_option,
        explanation: !isCorrect ? (question.explanation || '') : '',
        questionNumber: askedIds.length,
        totalAnswered: askedIds.length
      });
    }

    res.json({
      finished: false,
      isCorrect,
      correctOption: question.correct_option,
      explanation: !isCorrect ? (question.explanation || '') : '',
      nextQuestion,
      questionNumber: askedIds.length + 1,
      totalQuestions: 15,
      currentDifficulty: newDifficulty
    });
  } catch (err) {
    console.error('Adaptive answer error:', err);
    res.status(500).json({ error: 'Javobni yuborishda xatolik' });
  }
});

// ═══════════════════════════════════════════════════════════════
// HELPER: Adaptiv test natijalarini hisoblash (keshdan — AI chaqirilMAYDI)
// ═══════════════════════════════════════════════════════════════
async function computeAdaptiveResults(attempt) {
  const conceptScores = attempt.concept_scores || {};
  const answers = attempt.answers || [];
  const totalCorrect = answers.filter(a => a.isCorrect).length;
  const totalScore = answers.length > 0 ? Math.round((totalCorrect / answers.length) * 100) : 0;

  const weakConcepts = [];
  for (const [concept, data] of Object.entries(conceptScores)) {
    const percent = Math.round((data.correct / data.total) * 100);
    if (percent < 100) weakConcepts.push({ concept, score: percent, correct: data.correct, total: data.total });
  }
  weakConcepts.sort((a, b) => a.score - b.score);

  const wrongQuestionIds = answers.filter(a => !a.isCorrect).map(a => a.questionId);
  let questionExplanations = [];
  if (wrongQuestionIds.length > 0) {
    questionExplanations = await database.all(
      `SELECT id, question_text, correct_option, option_a, option_b, option_c, option_d, concept, explanation
       FROM adaptive_questions WHERE id = ANY($1::int[])`,
      [wrongQuestionIds]
    );
  }

  const explanations = [];
  for (const weak of weakConcepts) {
    const relatedQuestions = questionExplanations.filter(q => q.concept === weak.concept);
    const teacherExplanations = relatedQuestions
      .filter(q => q.explanation && q.explanation.trim())
      .map(q => ({
        question: q.question_text,
        correctAnswer: q[`option_${q.correct_option}`],
        explanation: q.explanation
      }));

    const cached = await database.get(
      'SELECT * FROM concept_explanations WHERE adaptive_test_id = $1 AND concept = $2',
      [attempt.adaptive_test_id, weak.concept]
    );

    explanations.push({
      concept: weak.concept,
      score: weak.score,
      teacherExplanations,
      aiExplanation: cached ? cached.explanation_html : null
    });
  }

  const allConceptScores = {};
  for (const [concept, data] of Object.entries(conceptScores)) {
    allConceptScores[concept] = { correct: data.correct, total: data.total, percent: Math.round((data.correct / data.total) * 100) };
  }

  return { totalScore, totalCorrect, totalQuestions: answers.length, conceptScores: allConceptScores, weakConcepts: explanations, answers };
}

// ═══════════════════════════════════════════════════════════════
// Endpoint 7: Testni tugatish va tushuntirish olish
// POST /api/adaptive-attempts/:attemptId/finish
// ═══════════════════════════════════════════════════════════════
router.post('/adaptive-attempts/:attemptId/finish', authenticateToken, async (req, res) => {
  try {
    const attemptId = parseInt(req.params.attemptId);
    const attempt = await database.get(
      'SELECT * FROM adaptive_attempts WHERE id = $1 AND user_id = $2',
      [attemptId, req.user.id]
    );
    if (!attempt) return res.status(404).json({ error: 'Urinish topilmadi' });

    // Avval — kerakli tushunchalar uchun AI tushuntirish yo'q bo'lsa yarat
    const conceptScores = attempt.concept_scores || {};
    const answers = attempt.answers || [];
    const wrongQuestionIds = answers.filter(a => !a.isCorrect).map(a => a.questionId);
    let questionExplanations = [];
    if (wrongQuestionIds.length > 0) {
      questionExplanations = await database.all(
        `SELECT id, concept, explanation FROM adaptive_questions WHERE id = ANY($1::int[])`,
        [wrongQuestionIds]
      );
    }

    for (const [concept, data] of Object.entries(conceptScores)) {
      const percent = Math.round((data.correct / data.total) * 100);
      if (percent >= 100) continue;

      // Keshda bormi?
      const cached = await database.get(
        'SELECT id FROM concept_explanations WHERE adaptive_test_id = $1 AND concept = $2',
        [attempt.adaptive_test_id, concept]
      );
      if (cached) continue;

      // AI tushuntirish yaratish
      try {
        const relatedQuestions = questionExplanations.filter(q => q.concept === concept);
        const teacherExps = relatedQuestions.filter(q => q.explanation && q.explanation.trim()).map(q => q.explanation);

        const test = await database.get('SELECT lesson_id FROM adaptive_tests WHERE id = $1', [attempt.adaptive_test_id]);
        const lesson = test ? await database.get('SELECT title FROM lessons WHERE id = $1', [test.lesson_id]) : null;

        let materialContext = '';
        if (test && test.lesson_id) {
          const materials = await database.all('SELECT file_path, file_name FROM lesson_materials WHERE lesson_id = $1 LIMIT 2', [test.lesson_id]);
          for (const mat of materials) {
            try {
              const fileData = await readFileForAI(mat.file_path, mat.file_name);
              if (fileData && fileData.content && fileData.type === 'text') materialContext += fileData.content.slice(0, 3000) + '\n';
            } catch (e) { /* skip */ }
          }
        }

        const explainPrompt = `O'quvchi "${concept}" tushunchasini yaxshi tushunmadi (${data.correct}/${data.total} to'g'ri).
${lesson ? `Mavzu: "${lesson.title}"` : ''}
${materialContext ? `\nDars materialidan tegishli qism:\n${materialContext.slice(0, 4000)}\n` : ''}
${teacherExps.length > 0 ? `\nO'qituvchi tushuntirishi: ${teacherExps.join('; ')}\n` : ''}
9-10 sinf o'quvchisi tushunadigan tilda, oddiy va aniq misol bilan BATAFSIL tushuntiring.
Faqat HTML qaytaring (h4, p, ul, li, code, pre, strong teglaridan foydalaning).`;

        const aiHtml = await chat(explainPrompt, { max_tokens: 1500 });
        await database.run(
          `INSERT INTO concept_explanations (adaptive_test_id, concept, explanation_html)
           VALUES ($1, $2, $3)
           ON CONFLICT (adaptive_test_id, concept) DO UPDATE SET explanation_html = $3`,
          [attempt.adaptive_test_id, concept, aiHtml.trim()]
        );
      } catch (aiErr) {
        console.error(`Concept explanation AI error (${concept}):`, aiErr.message);
      }
    }

    // Natijani hisoblash (keshdan)
    const result = await computeAdaptiveResults(attempt);

    // 86%+ uchun bir martalik 5 ball bonus
    let bonusMessage = null;
    if (result.totalScore >= 81) {
      const alreadyBonused = await database.get(
        `SELECT COUNT(*) as cnt FROM adaptive_attempts
         WHERE user_id = $1 AND adaptive_test_id = $2 AND bonus_awarded = TRUE`,
        [req.user.id, attempt.adaptive_test_id]
      );
      if (parseInt(alreadyBonused.cnt) === 0) {
        await database.run(
          'UPDATE users SET points = points + 5, bonus_points = bonus_points + 5 WHERE id = $1',
          [req.user.id]
        );
        await database.run(
          'UPDATE adaptive_attempts SET bonus_awarded = TRUE WHERE id = $1',
          [attemptId]
        );
        const User = require('../models/User');
        await User.updateMasteryLevel(req.user.id);
        bonusMessage = "Siz darsni yaxshi o'zlashtirdingiz, sizga 5 ball bonus berildi! \uD83C\uDF89";
      }
    }

    res.json({ ...result, bonusMessage });
  } catch (err) {
    console.error('Adaptive finish error:', err);
    res.status(500).json({ error: 'Natijani hisoblashda xatolik' });
  }
});

// ═══════════════════════════════════════════════════════════════
// Qo'shimcha: Savolni o'chirish
// DELETE /api/adaptive-questions/:id
// ═══════════════════════════════════════════════════════════════
router.delete('/adaptive-questions/:id', authenticateToken, requireRole(['teacher', 'admin']), async (req, res) => {
  try {
    const question = await database.get('SELECT * FROM adaptive_questions WHERE id = $1', [req.params.id]);
    if (!question) return res.status(404).json({ error: 'Savol topilmadi' });

    await database.run('DELETE FROM adaptive_questions WHERE id = $1', [req.params.id]);
    res.json({ message: 'Savol o\'chirildi' });
  } catch (err) {
    console.error('Delete adaptive question error:', err);
    res.status(500).json({ error: 'Savolni o\'chirishda xatolik' });
  }
});

// ═══════════════════════════════════════════════════════════════
// Qo'shimcha: Adaptiv testni o'chirish
// DELETE /api/adaptive-tests/:id
// ═══════════════════════════════════════════════════════════════
router.delete('/adaptive-tests/:id', authenticateToken, requireRole(['teacher', 'admin']), async (req, res) => {
  try {
    const test = await database.get('SELECT * FROM adaptive_tests WHERE id = $1', [req.params.id]);
    if (!test) return res.status(404).json({ error: 'Adaptiv test topilmadi' });

    await database.run('DELETE FROM adaptive_tests WHERE id = $1', [req.params.id]);
    res.json({ message: 'Adaptiv test o\'chirildi' });
  } catch (err) {
    console.error('Delete adaptive test error:', err);
    res.status(500).json({ error: 'Testni o\'chirishda xatolik' });
  }
});

module.exports = router;
