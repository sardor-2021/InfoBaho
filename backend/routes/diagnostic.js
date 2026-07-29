/**
 * Diagnostik test — tajriba boshidagi pre-test
 * O'qituvchi yaratadi (Excel yoki qo'lda), o'quvchi 1 marta topshiradi
 */

const express = require('express');
const multer = require('multer');
const database = require('../config/database');
const { authenticateToken, isTeacherOrAdmin } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ═══════════════════════════════════════════════════════════════
// DIAGNOSTIK TESTLAR CRUD
// ═══════════════════════════════════════════════════════════════

// GET /api/diagnostic/tests — barcha diagnostik testlar
router.get('/tests', authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT dt.*,
        u.full_name AS creator_name,
        (SELECT COUNT(*) FROM diagnostic_questions WHERE test_id = dt.id) AS questions_count,
        (SELECT COUNT(DISTINCT user_id) FROM diagnostic_results WHERE test_id = dt.id) AS attempts_count
      FROM diagnostic_tests dt
      JOIN users u ON dt.created_by = u.id
    `;
    const params = [];

    if (req.user.role === 'student') {
      query += ' WHERE dt.is_active = TRUE';
    } else if (req.user.role === 'teacher') {
      query += ' WHERE dt.created_by = ?';
      params.push(req.user.id);
    }

    query += ' ORDER BY dt.created_at ASC';
    const tests = await database.all(query, params);
    res.json(tests);
  } catch (err) {
    res.status(500).json({ error: 'Xatolik: ' + err.message });
  }
});

// POST /api/diagnostic/tests — yangi diagnostik test yaratish
router.post('/tests', authenticateToken, isTeacherOrAdmin, async (req, res) => {
  try {
    const { title, description, duration, grade } = req.body;
    if (!title) return res.status(400).json({ error: 'Test nomi kerak' });

    const result = await database.run(`
      INSERT INTO diagnostic_tests (title, description, duration, grade, created_by)
      VALUES (?, ?, ?, ?, ?)
    `, [title, description || '', duration || 45, grade || 9, req.user.id]);

    const test = await database.get('SELECT * FROM diagnostic_tests WHERE id = ?', [result.id]);
    res.status(201).json({ message: 'Diagnostik test yaratildi', test });
  } catch (err) {
    res.status(500).json({ error: 'Yaratishda xatolik: ' + err.message });
  }
});

// PUT /api/diagnostic/tests/:id — tahrirlash
router.put('/tests/:id', authenticateToken, isTeacherOrAdmin, async (req, res) => {
  try {
    const { title, description, duration, is_active } = req.body;
    await database.run(`
      UPDATE diagnostic_tests SET title=COALESCE(?,title), description=COALESCE(?,description),
        duration=COALESCE(?,duration), is_active=COALESCE(?,is_active) WHERE id=?
    `, [title, description, duration, is_active, req.params.id]);
    res.json({ message: 'Yangilandi' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/diagnostic/tests/:id
router.delete('/tests/:id', authenticateToken, isTeacherOrAdmin, async (req, res) => {
  try {
    await database.run('DELETE FROM diagnostic_tests WHERE id = ?', [req.params.id]);
    res.json({ message: 'O\'chirildi' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// DIAGNOSTIK SAVOLLAR
// ═══════════════════════════════════════════════════════════════

// GET /api/diagnostic/tests/:id/questions
router.get('/tests/:id/questions', authenticateToken, async (req, res) => {
  try {
    const includeAnswers = req.user.role !== 'student';
    const fields = includeAnswers
      ? '*'
      : 'id, test_id, question_text, question_type, options, points, order_number';
    const questions = await database.all(
      `SELECT ${fields} FROM diagnostic_questions WHERE test_id = ? ORDER BY order_number ASC, id ASC`,
      [req.params.id]
    );
    questions.forEach(q => {
      if (q.options && typeof q.options === 'string') {
        try { q.options = JSON.parse(q.options); } catch {}
      }
    });
    res.json(questions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/diagnostic/tests/:id/questions — savol qo'shish
router.post('/tests/:id/questions', authenticateToken, isTeacherOrAdmin, async (req, res) => {
  try {
    const { question_text, question_type, options, correct_answer, points, explanation } = req.body;
    if (!question_text || !correct_answer) {
      return res.status(400).json({ error: 'Savol matni va to\'g\'ri javob kerak' });
    }

    const result = await database.run(`
      INSERT INTO diagnostic_questions (test_id, question_text, question_type, options, correct_answer, points, explanation)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [req.params.id, question_text, question_type || 'single_choice',
        options ? (typeof options === 'string' ? options : JSON.stringify(options)) : null,
        correct_answer, points || 1, explanation || null]);

    res.status(201).json({ message: 'Savol qo\'shildi', id: result.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/diagnostic/questions/:id
router.delete('/questions/:id', authenticateToken, isTeacherOrAdmin, async (req, res) => {
  try {
    await database.run('DELETE FROM diagnostic_questions WHERE id = ?', [req.params.id]);
    res.json({ message: 'O\'chirildi' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/diagnostic/tests/:id/upload-excel — Excel'dan import
router.post('/tests/:id/upload-excel', authenticateToken, isTeacherOrAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Excel fayl yuklanmadi' });

    const XLSX = require('xlsx');
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Sarlavha qatorini topish
    let headerIdx = -1, headers = [];
    for (let i = 0; i < Math.min(rawRows.length, 5); i++) {
      if (rawRows[i] && rawRows[i].some(c => String(c||'').toLowerCase().includes('savol'))) {
        headerIdx = i;
        headers = rawRows[i].map(h => String(h || '').trim());
        break;
      }
    }
    if (headerIdx === -1) {
      return res.status(400).json({ error: '"Savol" ustuni topilmadi', hint: 'Ustunlar: Savol, A, B, C, D, To\'g\'ri javob, Ball' });
    }

    const findCol = (...names) => {
      for (const n of names) {
        const idx = headers.findIndex(h => h && h.toLowerCase() === n.toLowerCase());
        if (idx !== -1) return idx;
      }
      for (const n of names) {
        const idx = headers.findIndex(h => h && h.toLowerCase().includes(n.toLowerCase()));
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const cS = findCol('Savol','Question');
    const cA = findCol('A','Variant A');
    const cB = findCol('B','Variant B');
    const cC = findCol('C','Variant C');
    const cD = findCol('D','Variant D');
    const cJ = findCol("To'g'ri javob",'Javob','Answer');
    const cP = findCol('Ball','Points');

    if (cS === -1) return res.status(400).json({ error: '"Savol" ustuni topilmadi' });

    const dataRows = rawRows.slice(headerIdx + 1);
    let imported = 0;

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (!row || row.every(c => !c)) continue;

      const text = String(row[cS] || '').trim();
      if (!text) continue;

      const optA = cA !== -1 ? String(row[cA] || '').trim() : '';
      const optB = cB !== -1 ? String(row[cB] || '').trim() : '';
      const optC = cC !== -1 ? String(row[cC] || '').trim() : '';
      const optD = cD !== -1 ? String(row[cD] || '').trim() : '';
      const options = [optA, optB, optC, optD].filter(o => o);

      let correct = cJ !== -1 ? String(row[cJ] || '').trim() : '';
      if (['A','B','C','D'].includes(correct.toUpperCase())) {
        const idx = correct.toUpperCase().charCodeAt(0) - 65;
        correct = options[idx] || correct;
      }

      const points = cP !== -1 ? (parseInt(row[cP]) || 1) : 1;

      await database.run(`
        INSERT INTO diagnostic_questions (test_id, question_text, question_type, options, correct_answer, points, order_number)
        VALUES (?, ?, 'single_choice', ?, ?, ?, ?)
      `, [req.params.id, text, JSON.stringify(options), correct, points, i + 1]);
      imported++;
    }

    res.json({ message: `${imported} ta savol import qilindi!`, imported });
  } catch (err) {
    res.status(500).json({ error: 'Excel import xatolik: ' + err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// DIAGNOSTIK TEST TOPSHIRISH
// ═══════════════════════════════════════════════════════════════

// GET /api/diagnostic/tests/:id/my-result — avval topshirganmi
router.get('/tests/:id/my-result', authenticateToken, async (req, res) => {
  try {
    const result = await database.get(
      'SELECT * FROM diagnostic_results WHERE test_id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    res.json({ submitted: !!result, result: result || null });
  } catch (err) {
    res.json({ submitted: false });
  }
});

// POST /api/diagnostic/tests/:id/submit — natijani yuborish
router.post('/tests/:id/submit', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Faqat o\'quvchilar topshiradi' });
    }

    // Avval topshirganmi
    const existing = await database.get(
      'SELECT id FROM diagnostic_results WHERE test_id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (existing) {
      return res.status(400).json({ error: 'Siz bu testni allaqachon topshirgansiz' });
    }

    const { answers, time_taken } = req.body;
    if (!answers) return res.status(400).json({ error: 'Javoblar kerak' });

    // Savollarni olish (javoblar bilan)
    const questions = await database.all(
      'SELECT * FROM diagnostic_questions WHERE test_id = ? ORDER BY order_number ASC, id ASC',
      [req.params.id]
    );

    // Tekshirish
    let correctCount = 0;
    let totalPoints = 0;
    let earnedPoints = 0;
    const detailed = [];

    for (const q of questions) {
      const userAnswer = answers[q.id];
      totalPoints += q.points;

      let isCorrect = false;
      const correctAns = q.correct_answer;

      if (userAnswer && String(userAnswer).trim().toLowerCase() === String(correctAns).trim().toLowerCase()) {
        isCorrect = true;
      }
      // Options orqali tekshirish
      if (!isCorrect && userAnswer !== undefined) {
        let opts = [];
        try { opts = typeof q.options === 'string' ? JSON.parse(q.options) : (q.options || []); } catch {}
        if (opts[userAnswer] && opts[userAnswer].trim().toLowerCase() === String(correctAns).trim().toLowerCase()) {
          isCorrect = true;
        }
      }

      if (isCorrect) {
        correctCount++;
        earnedPoints += q.points;
      }

      detailed.push({
        question_id: q.id,
        user_answer: userAnswer,
        correct_answer: correctAns,
        is_correct: isCorrect,
        points: q.points
      });
    }

    const percentage = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;

    // Natijani saqlash
    await database.run(`
      INSERT INTO diagnostic_results (test_id, user_id, score, percentage, correct_answers, total_questions, time_taken, answers)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [req.params.id, req.user.id, earnedPoints, percentage, correctCount, questions.length, time_taken || 0, JSON.stringify(detailed)]);

    res.json({
      message: 'Diagnostik test topshirildi',
      score: earnedPoints,
      percentage: Math.round(percentage * 10) / 10,
      correct_answers: correctCount,
      total_questions: questions.length
    });
  } catch (err) {
    console.error('Diagnostic submit error:', err);
    res.status(500).json({ error: 'Topshirishda xatolik: ' + err.message });
  }
});

// GET /api/diagnostic/tests/:id/results — barcha natijalar (admin/teacher)
router.get('/tests/:id/results', authenticateToken, isTeacherOrAdmin, async (req, res) => {
  try {
    const results = await database.all(`
      SELECT dr.*, u.full_name, u.class_name, u.district, u.school_number
      FROM diagnostic_results dr
      JOIN users u ON dr.user_id = u.id
      WHERE dr.test_id = ?
      ORDER BY u.class_name ASC, dr.percentage DESC
    `, [req.params.id]);

    const scores = results.map(r => r.percentage);
    const avg = scores.length > 0 ? scores.reduce((s,v) => s+v, 0) / scores.length : 0;

    // Sinf bo'yicha guruhlash
    const byClass = {};
    for (const r of results) {
      const cls = r.class_name || 'Nomalum';
      if (!byClass[cls]) byClass[cls] = { students: [], scores: [] };
      byClass[cls].students.push(r);
      byClass[cls].scores.push(r.percentage);
    }

    // Har sinf uchun statistika
    const classStats = Object.entries(byClass).map(([cls, data]) => ({
      class_name: cls,
      count: data.students.length,
      average: Math.round((data.scores.reduce((s,v) => s+v, 0) / data.scores.length) * 10) / 10,
      max: Math.round(Math.max(...data.scores) * 10) / 10,
      min: Math.round(Math.min(...data.scores) * 10) / 10,
      passed_60: data.scores.filter(s => s >= 60).length,
      passed_percent: Math.round((data.scores.filter(s => s >= 60).length / data.scores.length) * 100),
      students: data.students
    }));

    res.json({
      total: results.length,
      average: Math.round(avg * 10) / 10,
      class_stats: classStats,
      results
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
