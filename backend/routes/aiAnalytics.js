const express = require('express');
const { chat, chatMessages } = require('../utils/ai');
const database = require('../config/database');
const User = require('../models/User');
const { authenticateToken, isTeacherOrAdmin } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Helper: xavfsiz query
async function safeAll(sql, params = []) {
  try { return await database.all(sql, params); }
  catch (e) { console.error('AI Analytics safeAll:', e.message); return []; }
}
async function safeGet(sql, params = []) {
  try { return await database.get(sql, params); }
  catch (e) { console.error('AI Analytics safeGet:', e.message); return null; }
}


// ─── GET /api/ai-analytics/data — Ma'lumotlarni yig'ish ─────
router.get('/data', authenticateToken, isTeacherOrAdmin, async (req, res) => {
  try {
    const teacherId = req.user.id;
    const teacher = await User.findById(teacherId);

    // O'qituvchining darslari
    const lessons = await safeAll(
      `SELECT id, title, grade, subject FROM lessons WHERE created_by = ? ORDER BY created_at DESC`,
      [teacherId]
    );

    // Har bir dars uchun test natijalari
    const lessonAnalytics = [];

    for (const lesson of lessons) {
      // Dars testlari
      const tests = await safeAll(`
        SELECT t.id, t.title, t.subject,
          (SELECT COUNT(*) FROM questions WHERE test_id = t.id) AS questions_count
        FROM tests t WHERE t.lesson_id = ? AND t.is_published = TRUE
      `, [lesson.id]);


      // Har test uchun savol-javob statistikasi
      const testStats = [];
      for (const test of tests) {
        // Barcha natijalar
        const results = await safeAll(`
          SELECT r.user_id, r.correct_answers, r.total_questions,
                 r.percentage, r.answers, r.passed,
                 u.full_name, u.class_name
          FROM results r
          JOIN users u ON r.user_id = u.id
          WHERE r.test_id = ?
          ORDER BY r.percentage ASC
        `, [test.id]);

        // Savol bo'yicha xatolik tahlili
        const questionErrors = [];
        const questions = await safeAll(
          `SELECT id, question_text, question_type, correct_answer
           FROM questions WHERE test_id = ? ORDER BY order_number ASC, id ASC`,
          [test.id]
        );


        // Har bir savol uchun nechta o'quvchi xato qilganini hisoblash
        for (const q of questions) {
          let wrongCount = 0;
          let totalAttempts = 0;
          const wrongStudents = [];

          for (const r of results) {
            totalAttempts++;
            let detailed = [];
            try {
              detailed = typeof r.answers === 'string' ? JSON.parse(r.answers) : (r.answers || []);
            } catch { detailed = []; }

            const answer = detailed.find(a => a.question_id === q.id);
            if (answer && !answer.is_correct) {
              wrongCount++;
              wrongStudents.push({ name: r.full_name, class_name: r.class_name });
            }
          }

          if (totalAttempts > 0) {
            questionErrors.push({
              question_id: q.id,
              question_text: q.question_text,
              error_rate: Math.round((wrongCount / totalAttempts) * 100),
              wrong_count: wrongCount,
              total_attempts: totalAttempts,
              wrong_students: wrongStudents
            });
          }
        }


        // Kam ball olgan o'quvchilar
        const weakStudents = results
          .filter(r => r.percentage < 60)
          .map(r => ({
            name: r.full_name,
            class_name: r.class_name,
            percentage: r.percentage,
            correct: r.correct_answers,
            total: r.total_questions
          }));

        testStats.push({
          test_id: test.id,
          test_title: test.title,
          questions_count: test.questions_count,
          total_attempts: results.length,
          average_score: results.length > 0
            ? Math.round(results.reduce((s, r) => s + r.percentage, 0) / results.length)
            : 0,
          pass_rate: results.length > 0
            ? Math.round((results.filter(r => r.passed).length / results.length) * 100)
            : 0,
          question_errors: questionErrors.sort((a, b) => b.error_rate - a.error_rate),
          weak_students: weakStudents
        });
      }


      // Amaliy topshiriqlar tahlili
      const assignments = await safeAll(`
        SELECT a.id, a.title, a.task_type, a.max_score,
          (SELECT COUNT(*) FROM assignment_submissions WHERE assignment_id = a.id) AS total_subs,
          (SELECT COUNT(*) FROM assignment_submissions WHERE assignment_id = a.id AND status = 'graded') AS graded_subs,
          (SELECT AVG(score) FROM assignment_submissions WHERE assignment_id = a.id AND status = 'graded') AS avg_score
        FROM assignments a
        WHERE a.lesson_id = ?
        ORDER BY a.created_at DESC
      `, [lesson.id]);

      // Amaliy topshiriqlarda kam ball olganlar
      const weakInAssignments = await safeAll(`
        SELECT s.score, a.max_score, a.title AS assignment_title, a.task_type,
               u.full_name, u.class_name
        FROM assignment_submissions s
        JOIN assignments a ON s.assignment_id = a.id
        JOIN users u ON s.student_id = u.id
        WHERE a.lesson_id = ? AND s.status = 'graded'
          AND (s.score::REAL / GREATEST(a.max_score, 1)) < 0.5
        ORDER BY (s.score::REAL / GREATEST(a.max_score, 1)) ASC
      `, [lesson.id]);


      // Dars progressi
      const progressStats = await safeGet(`
        SELECT
          COUNT(*) AS total_students,
          COUNT(CASE WHEN grade = 5 THEN 1 END) AS grade5,
          COUNT(CASE WHEN grade = 4 THEN 1 END) AS grade4,
          COUNT(CASE WHEN grade = 3 THEN 1 END) AS grade3,
          COUNT(CASE WHEN grade = 2 THEN 1 END) AS grade2,
          COALESCE(AVG(percent), 0) AS avg_percent
        FROM lesson_progress
        WHERE lesson_id = ?
      `, [lesson.id]);

      lessonAnalytics.push({
        lesson_id: lesson.id,
        lesson_title: lesson.title,
        grade: lesson.grade,
        subject: lesson.subject,
        test_stats: testStats,
        assignments: assignments,
        weak_in_assignments: weakInAssignments,
        progress: progressStats
      });
    }


    // Umumiy sinf statistikasi
    const teachingClasses = (teacher.teaching_classes || '')
      .split(',').map(c => c.trim()).filter(Boolean);

    const classStats = [];
    for (const className of teachingClasses) {
      const students = await safeAll(`
        SELECT u.id, u.full_name, u.points, u.level,
          (SELECT COUNT(*) FROM results WHERE user_id = u.id) AS tests_taken,
          (SELECT COALESCE(AVG(percentage), 0) FROM results WHERE user_id = u.id) AS avg_score
        FROM users u
        WHERE u.role = 'student' AND u.district = ? AND u.school_number = ? AND u.class_name = ?
        ORDER BY u.full_name
      `, [teacher.district, teacher.school_number, className]);

      classStats.push({
        class_name: className,
        total_students: students.length,
        students: students.map(s => ({
          ...s,
          avg_score: Math.round(parseFloat(s.avg_score) || 0)
        }))
      });
    }

    res.json({
      teacher: {
        full_name: teacher.full_name,
        district: teacher.district,
        school_number: teacher.school_number,
        teaching_classes: teachingClasses
      },
      lessons: lessonAnalytics,
      class_stats: classStats
    });
  } catch (err) {
    console.error('AI Analytics data error:', err);
    res.status(500).json({ error: 'Ma\'lumotlarni olishda xatolik: ' + err.message });
  }
});


// ─── GET /api/ai-analytics/last-analysis — Oxirgi saqlangan tahlil ───
router.get('/last-analysis', authenticateToken, isTeacherOrAdmin, async (req, res) => {
  try {
    const cached = await database.get(
      'SELECT * FROM ai_analysis_cache WHERE teacher_id = ?',
      [req.user.id]
    );

    if (!cached) {
      return res.json({ exists: false });
    }

    res.json({
      exists: true,
      analysis: JSON.parse(cached.analysis_json || '{}'),
      raw_data: JSON.parse(cached.raw_data || '{}'),
      hard_topics: JSON.parse(cached.hard_topics || '[]'),
      weak_students: JSON.parse(cached.weak_students || '[]'),
      generated_at: cached.generated_at
    });
  } catch (err) {
    console.error('Get last analysis error:', err);
    res.status(500).json({ error: 'Oxirgi tahlilni olishda xatolik' });
  }
});

// ─── POST /api/ai-analytics/analyze — OpenAI bilan tahlil ───
router.post('/analyze', authenticateToken, isTeacherOrAdmin, aiLimiter, async (req, res) => {
  try {
    const teacherId = req.user.id;
    const teacher = await User.findById(teacherId);

    // Ma'lumotlarni yig'ish (yuqoridagi /data endpoint logikasi)
    const lessons = await safeAll(
      `SELECT id, title, grade, subject FROM lessons WHERE created_by = ? ORDER BY created_at DESC`,
      [teacherId]
    );

    // Qisqacha statistika yig'ish
    const summary = { lessons: [], overall: {} };
    let totalStudents = 0, totalTests = 0, totalWeak = 0;
    const allWeakStudents = [];
    const allHardTopics = [];


    for (const lesson of lessons) {
      const tests = await safeAll(`
        SELECT t.id, t.title FROM tests t
        WHERE t.lesson_id = ? AND t.is_published = TRUE
      `, [lesson.id]);

      let lessonAvg = 0, lessonAttempts = 0;
      const lessonWeakStudents = [];
      const hardQuestions = [];

      for (const test of tests) {
        totalTests++;
        const results = await safeAll(`
          SELECT r.user_id, r.percentage, r.answers, r.passed,
                 u.full_name, u.class_name
          FROM results r
          JOIN users u ON r.user_id = u.id
          WHERE r.test_id = ?
        `, [test.id]);

        lessonAttempts += results.length;
        lessonAvg += results.reduce((s, r) => s + r.percentage, 0);

        // Kam ball olganlar
        for (const r of results) {
          if (r.percentage < 50) {
            lessonWeakStudents.push({
              name: r.full_name, class_name: r.class_name,
              score: Math.round(r.percentage)
            });
          }
        }


        // Eng ko'p xato qilingan savollar
        const questions = await safeAll(
          `SELECT id, question_text FROM questions WHERE test_id = ?`, [test.id]
        );

        for (const q of questions) {
          let wrongCount = 0;
          for (const r of results) {
            let detailed = [];
            try {
              detailed = typeof r.answers === 'string' ? JSON.parse(r.answers) : (r.answers || []);
            } catch { detailed = []; }
            const ans = detailed.find(a => a.question_id === q.id);
            if (ans && !ans.is_correct) wrongCount++;
          }
          if (results.length > 0 && (wrongCount / results.length) > 0.4) {
            hardQuestions.push({
              question: q.question_text.substring(0, 100),
              error_rate: Math.round((wrongCount / results.length) * 100),
              lesson_title: lesson.title
            });
          }
        }
      }


      // Amaliy topshiriqlar tahlili
      const weakAssign = await safeAll(`
        SELECT s.score, a.max_score, a.title AS assign_title, a.task_type,
               u.full_name, u.class_name
        FROM assignment_submissions s
        JOIN assignments a ON s.assignment_id = a.id
        JOIN users u ON s.student_id = u.id
        WHERE a.lesson_id = ? AND s.status = 'graded'
          AND (s.score::REAL / GREATEST(a.max_score, 1)) < 0.5
      `, [lesson.id]);

      for (const wa of weakAssign) {
        allWeakStudents.push({
          name: wa.full_name, class_name: wa.class_name,
          topic: `${lesson.title} - ${wa.assign_title}`,
          score: `${wa.score}/${wa.max_score}`,
          type: 'assignment'
        });
      }

      const avgPct = lessonAttempts > 0 ? Math.round(lessonAvg / lessonAttempts) : 0;
      totalStudents += lessonAttempts;
      totalWeak += lessonWeakStudents.length;
      allWeakStudents.push(...lessonWeakStudents.map(s => ({
        ...s, topic: lesson.title, type: 'test'
      })));
      allHardTopics.push(...hardQuestions);

      summary.lessons.push({
        title: lesson.title,
        grade: lesson.grade,
        subject: lesson.subject,
        avg_score: avgPct,
        attempts: lessonAttempts,
        weak_count: lessonWeakStudents.length,
        hard_questions_count: hardQuestions.length
      });
    }


    summary.overall = { totalStudents, totalTests, totalWeak };

    // ── OpenAI bilan tahlil ──────────────────────────────────
    // AI uchun kontekst tayyorlash
    const contextForAI = `
Sen informatika o'qituvchisining AI yordamchisisisan. Quyidagi ma'lumotlar asosida chuqur tahlil ber.

O'QITUVCHI: ${teacher.full_name}
MAKTAB: ${teacher.district}, ${teacher.school_number}-maktab
SINFLAR: ${teacher.teaching_classes}

DARSLAR STATISTIKASI:
${summary.lessons.map(l => `- "${l.title}" (${l.grade}-sinf, ${l.subject}): o'rtacha ${l.avg_score}%, ${l.attempts} ta urinish, ${l.weak_count} ta zaif o'quvchi, ${l.hard_questions_count} ta qiyin savol`).join('\n')}

ENG QIYIN SAVOLLAR (40%+ o'quvchilar xato qilgan):
${allHardTopics.slice(0, 15).map(q => `- "${q.question}" — ${q.error_rate}% xato (${q.lesson_title})`).join('\n') || 'Ma\'lumot yetarli emas'}

QIYINCHILIK BILAN DUCH KELGAN O'QUVCHILAR:
${[...new Map(allWeakStudents.map(s => [s.name, s])).values()].slice(0, 20).map(s => `- ${s.name} (${s.class_name}): ${s.topic} — ${s.type === 'test' ? s.score + '%' : s.score}`).join('\n') || 'Ma\'lumot yetarli emas'}
`;


    const prompt = contextForAI + `
VAZIFA: Quyidagi bo'limlar bo'yicha batafsil tahlil va tavsiyalar ber. Javobni FAQAT JSON formatda qaytar.

{
  "overall_summary": "Umumiy holat haqida 2-3 jumla",
  "difficult_topics": [
    {
      "topic": "Mavzu nomi",
      "lesson": "Dars nomi",
      "error_rate": 65,
      "reason": "Nima uchun qiyin — taxminiy sabab",
      "suggestion": "Qanday tushuntirish kerak"
    }
  ],
  "students_need_help": [
    {
      "name": "O'quvchi ismi",
      "class_name": "Sinfi",
      "weak_areas": "Qaysi mavzularda zaif",
      "recommendation": "Nima qilish kerak"
    }
  ],
  "teaching_recommendations": [
    {
      "priority": "high/medium/low",
      "category": "methodology/content/assessment/individual",
      "title": "Qisqa sarlavha",
      "description": "Batafsil tavsiya",
      "affected_students_percent": 60
    }
  ],
  "strengths": [
    "O'quvchilar yaxshi o'zlashtirayotgan tomonlar"
  ],
  "weekly_focus": {
    "topic": "Bu hafta nima ustida ishlash kerak",
    "reason": "Sababi",
    "activities": ["Tavsiya qilinadigan mashqlar"]
  },
  "class_comparison": [
    {
      "class_name": "10-A",
      "avg_score": 72,
      "status": "yaxshi/o'rta/zaif",
      "note": "Izoh"
    }
  ],
  "motivation_tips": [
    "O'quvchilarni rag'batlantirish uchun maslahatlar"
  ]
}

MUHIM: Faqat JSON qaytar, boshqa matn yozma. Ma'lumotlar yetarli bo'lmasa, umumiy informatika o'qitish bo'yicha tavsiyalar ber.`;


    const raw = await chatMessages([
        { role: 'user', content: prompt }
      ], {
        system: 'Sen tajribali informatika metodisti va AI tahlilchisisisan. O\'zbek tilida javob ber. Faqat JSON formatda javob qaytar.',
        temperature: 0.4,
        max_tokens: 3000
      });

    let analysis;
    try {
      const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0] || raw;
      analysis = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error('AI response parse error:', parseErr);
      analysis = {
        overall_summary: 'AI tahlilni amalga oshirib bo\'lmadi. Iltimos qaytadan urinib ko\'ring.',
        difficult_topics: [],
        students_need_help: [],
        teaching_recommendations: [],
        strengths: [],
        weekly_focus: null,
        class_comparison: [],
        motivation_tips: []
      };
    }

    res.json({
      analysis,
      raw_data: summary,
      hard_topics: allHardTopics.slice(0, 10),
      weak_students: [...new Map(allWeakStudents.map(s => [s.name, s])).values()].slice(0, 15),
      generated_at: new Date().toISOString()
    });

    // Tahlilni DB ga saqlash (keyingi safar uchun kesh)
    try {
      await database.run(`
        INSERT INTO ai_analysis_cache (teacher_id, analysis_json, raw_data, hard_topics, weak_students, generated_at)
        VALUES (?, ?, ?, ?, ?, NOW())
        ON CONFLICT (teacher_id) DO UPDATE SET
          analysis_json = EXCLUDED.analysis_json,
          raw_data = EXCLUDED.raw_data,
          hard_topics = EXCLUDED.hard_topics,
          weak_students = EXCLUDED.weak_students,
          generated_at = NOW()
      `, [
        teacherId,
        JSON.stringify(analysis),
        JSON.stringify(summary),
        JSON.stringify(allHardTopics.slice(0, 10)),
        JSON.stringify([...new Map(allWeakStudents.map(s => [s.name, s])).values()].slice(0, 15))
      ]);
    } catch (cacheErr) {
      console.error('AI analysis cache save error (non-fatal):', cacheErr.message);
    }
  } catch (err) {
    console.error('AI Analytics analyze error:', err);
    res.status(500).json({ error: 'AI tahlilda xatolik: ' + err.message });
  }
});


// ─── POST /api/ai-analytics/ask — O'qituvchi savol beradi ───
router.post('/ask', authenticateToken, isTeacherOrAdmin, aiLimiter, async (req, res) => {
  try {
    const { question, context_data } = req.body;
    if (!question) {
      return res.status(400).json({ error: 'Savol kiritilishi shart' });
    }

    const teacher = await User.findById(req.user.id);

    const systemPrompt = `Sen informatika o'qituvchisining AI yordamchisisisan.
O'qituvchi: ${teacher.full_name}, ${teacher.district}, ${teacher.school_number}-maktab.
O'zbek tilida javob ber. Aniq, foydali va amaliy maslahatlar ber.
${context_data ? 'Kontekst: ' + JSON.stringify(context_data).substring(0, 2000) : ''}`;

    const answer = await chatMessages([
        { role: 'user', content: question }
      ], {
        system: systemPrompt,
        temperature: 0.5,
        max_tokens: 1500
      });

    res.json({
      answer: answer,
      question: question
    });
  } catch (err) {
    console.error('AI ask error:', err);
    res.status(500).json({ error: 'AI javob berishda xatolik: ' + err.message });
  }
});

module.exports = router;
