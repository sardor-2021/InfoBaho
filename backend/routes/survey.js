/**
 * So'rovnoma tizimi
 * O'quvchilar javob beradi, admin natijalarni ko'radi
 */

const express = require('express');
const database = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// So'rovnoma savollari (static)
const SURVEY_QUESTIONS = [
  {
    id: 1,
    text: 'Informatika faniga qiziqishingiz qanday?',
    options: ['Juda qiziqaman', 'Qiziqaman', 'O\'rtacha', 'Kam qiziqaman', 'Umuman qiziqmayman']
  },
  {
    id: 2,
    text: 'Informatika darslarida o\'rganishingiz qanchalik qiyin?',
    options: ['Juda oson', 'Oson', 'O\'rtacha', 'Qiyin', 'Juda qiyin']
  },
  {
    id: 3,
    text: 'Axborot texnologiyalari asosida baholash (kompyuterli test, elektron portfolio) sizga yoqdimi?',
    options: ['Juda yoqdi', 'Yoqdi', 'O\'rtacha', 'Yoqmadi', 'Umuman yoqmadi']
  },
  {
    id: 4,
    text: 'Tezkor qayta aloqa (darhol natija va izoh olish) foydali deb hisoblaysizmi?',
    options: ['Juda foydali', 'Foydali', 'O\'rtacha', 'Kam foydali', 'Foydasiz']
  },
  {
    id: 5,
    text: 'O\'z rivojlanishingizni ko\'rish (grafik, portfolio) sizga yordam beradimi?',
    options: ['Katta yordam beradi', 'Yordam beradi', 'O\'rtacha', 'Kam yordam beradi', 'Yordam bermaydi']
  },
  {
    id: 6,
    text: 'Gamifikatsiya elementlari (ball, daraja, mukofotlar) sizning motivatsiyangizni oshiradimi?',
    options: ['Katta oshiradi', 'Oshiradi', 'O\'rtacha ta\'sir', 'Kam ta\'sir', 'Ta\'sir qilmaydi']
  },
  {
    id: 7,
    text: 'Platformadan (InfoBaho) foydalanish qanchalik qulay?',
    options: ['Juda qulay', 'Qulay', 'O\'rtacha', 'Noqulay', 'Juda noqulay']
  },
  {
    id: 8,
    text: 'Dasturlashni yaxshiroq tushunyapsizmi?',
    options: ['Ancha yaxshi tushunaman', 'Yaxshiroq tushunaman', 'O\'zgarish yo\'q', 'Yomonroq bo\'ldi', 'Ancha yomonroq']
  },
  {
    id: 9,
    text: 'Informatika fanini kelajakda qo\'llashni xohlaysizmi?',
    options: ['Albatta xohlayman', 'Xohlayman', 'Bilmayman', 'Xohlamayman', 'Umuman xohlamayman']
  },
  {
    id: 10,
    text: 'An\'anaviy baholash (og\'zaki so\'rov, yozma ish) va axborot texnologiyalari asosida baholashni taqqoslasangiz?',
    options: ['AKT baholash ancha yaxshi', 'AKT baholash yaxshiroq', 'Farqi yo\'q', 'An\'anaviy yaxshiroq', 'An\'anaviy ancha yaxshi']
  }
];



// GET /api/survey/questions — savollani olish
router.get('/questions', authenticateToken, (req, res) => {
  res.json(SURVEY_QUESTIONS);
});

// GET /api/survey/my-response — o'quvchi avval javob berganmi
router.get('/my-response', authenticateToken, async (req, res) => {
  try {
    const existing = await database.get(
      'SELECT id, created_at FROM survey_responses WHERE user_id = ?',
      [req.user.id]
    );
    res.json({ submitted: !!existing, submitted_at: existing?.created_at || null });
  } catch (err) {
    res.json({ submitted: false });
  }
});

// POST /api/survey/submit — javob yuborish
router.post('/submit', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Faqat o\'quvchilar so\'rovnomada qatnashadi' });
    }

    const { answers, open_answer } = req.body;

    if (!answers || Object.keys(answers).length < 10) {
      return res.status(400).json({ error: 'Barcha 10 ta savolga javob bering' });
    }

    // Avval javob berganmi
    const existing = await database.get(
      'SELECT id FROM survey_responses WHERE user_id = ?',
      [req.user.id]
    );

    if (existing) {
      return res.status(400).json({ error: 'Siz allaqachon so\'rovnomada qatnashgansiz' });
    }

    // Javoblarni saqlash
    await database.run(`
      INSERT INTO survey_responses (user_id, answers, open_answer)
      VALUES (?, ?, ?)
    `, [req.user.id, JSON.stringify(answers), open_answer || '']);

    res.json({ message: 'Javoblaringiz qabul qilindi. Rahmat!' });
  } catch (err) {
    console.error('Survey submit error:', err);
    res.status(500).json({ error: 'Javob saqlashda xatolik' });
  }
});

// GET /api/survey/results — admin natijalarni ko'radi
router.get('/results', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
      return res.status(403).json({ error: 'Ruxsat yo\'q' });
    }

    // Barcha javoblar
    const responses = await database.all(`
      SELECT sr.*, u.full_name, u.class_name, u.district, u.school_number
      FROM survey_responses sr
      JOIN users u ON sr.user_id = u.id
      ORDER BY sr.created_at DESC
    `);

    const total = responses.length;
    if (total === 0) {
      return res.json({ total: 0, questions: SURVEY_QUESTIONS, results: [], by_class: {}, open_answers: [] });
    }

    // Har savol uchun statistika
    const questionStats = SURVEY_QUESTIONS.map(q => {
      const counts = [0, 0, 0, 0, 0]; // 5 ta variant uchun
      let totalAnswered = 0;

      for (const r of responses) {
        try {
          const answers = typeof r.answers === 'string' ? JSON.parse(r.answers) : r.answers;
          const answer = answers[q.id];
          if (answer !== undefined && answer >= 0 && answer <= 4) {
            counts[answer]++;
            totalAnswered++;
          }
        } catch {}
      }

      // Likert shkalasi: 5=eng ijobiy, 1=eng salbiy
      const likertScores = counts.map((c, i) => c * (5 - i));
      const totalScore = likertScores.reduce((s, v) => s + v, 0);
      const avgScore = totalAnswered > 0 ? (totalScore / totalAnswered).toFixed(2) : 0;

      return {
        id: q.id,
        text: q.text,
        options: q.options,
        counts,
        percentages: counts.map(c => totalAnswered > 0 ? Math.round((c / totalAnswered) * 100) : 0),
        total_answered: totalAnswered,
        avg_likert: parseFloat(avgScore),
        positive_percent: totalAnswered > 0
          ? Math.round(((counts[0] + counts[1]) / totalAnswered) * 100)
          : 0
      };
    });

    // Sinf bo'yicha guruhlash
    const byClass = {};
    for (const r of responses) {
      const cls = r.class_name || 'Nomalum';
      if (!byClass[cls]) byClass[cls] = { count: 0, school: r.school_number, district: r.district };
      byClass[cls].count++;
    }

    // Maktab bo'yicha guruhlash
    const bySchool = {};
    for (const r of responses) {
      const school = `${r.district} — ${r.school_number}-maktab`;
      if (!bySchool[school]) bySchool[school] = 0;
      bySchool[school]++;
    }

    // Ochiq javoblar
    const openAnswers = responses
      .filter(r => r.open_answer && r.open_answer.trim())
      .map(r => ({
        text: r.open_answer,
        class_name: r.class_name,
        date: r.created_at
      }));

    // Umumiy o'rtacha (barcha savollar bo'yicha)
    const overallAvg = questionStats.reduce((s, q) => s + q.avg_likert, 0) / questionStats.length;
    const overallPositive = Math.round(
      questionStats.reduce((s, q) => s + q.positive_percent, 0) / questionStats.length
    );

    res.json({
      total,
      overall_avg_likert: parseFloat(overallAvg.toFixed(2)),
      overall_positive_percent: overallPositive,
      questions: questionStats,
      by_class: byClass,
      by_school: bySchool,
      open_answers: openAnswers,
      cronbach_alpha: calculateSurveyAlpha(responses)
    });
  } catch (err) {
    console.error('Survey results error:', err);
    res.status(500).json({ error: 'Natijalarni olishda xatolik' });
  }
});

// Cronbach's Alpha hisoblash (so'rovnoma uchun)
function calculateSurveyAlpha(responses) {
  try {
    if (responses.length < 5) return { alpha: 0, interpretation: "Yetarli ma'lumot yo'q" };

    const parsed = responses.map(r => {
      const answers = typeof r.answers === 'string' ? JSON.parse(r.answers) : r.answers;
      return SURVEY_QUESTIONS.map(q => 5 - (answers[q.id] || 0)); // Likert: 5=eng ijobiy
    });

    const k = 10; // savollar soni
    const n = parsed.length;

    // Har savol variansi
    const itemVariances = [];
    for (let q = 0; q < k; q++) {
      const scores = parsed.map(p => p[q]);
      const m = scores.reduce((s, v) => s + v, 0) / n;
      const v = scores.reduce((s, val) => s + Math.pow(val - m, 2), 0) / (n - 1);
      itemVariances.push(v);
    }
    const sumItemVar = itemVariances.reduce((s, v) => s + v, 0);

    // Umumiy ball variansi
    const totals = parsed.map(p => p.reduce((s, v) => s + v, 0));
    const totalMean = totals.reduce((s, v) => s + v, 0) / n;
    const totalVar = totals.reduce((s, v) => s + Math.pow(v - totalMean, 2), 0) / (n - 1);

    if (totalVar === 0) return { alpha: 0, interpretation: 'Variansiya 0' };

    const alpha = (k / (k - 1)) * (1 - sumItemVar / totalVar);

    let interpretation = '';
    if (alpha >= 0.9) interpretation = "A'lo (excellent)";
    else if (alpha >= 0.8) interpretation = 'Yaxshi (good)';
    else if (alpha >= 0.7) interpretation = "Qabul qilinarli (acceptable)";
    else if (alpha >= 0.6) interpretation = "So'roqli (questionable)";
    else interpretation = 'Past (poor)';

    return { alpha: parseFloat(alpha.toFixed(4)), interpretation };
  } catch {
    return { alpha: 0, interpretation: 'Hisoblash xatosi' };
  }
}

module.exports = router;
