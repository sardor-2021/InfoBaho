/**
 * LessonProgress — dars bo'yicha o'quvchi o'zlashtirish tizimi
 *
 * YANGI TIZIM (foiz asosida):
 *   Test bali = (to'g'ri javoblar / umumiy savollar) × test.max_score
 *   Topshiriq bali = baholangan score (assignment_submissions.score)
 *   Darsning maksimal bali = SUM(tests.max_score) + SUM(assignments.max_score)
 *   Faqat taught_at to'ldirilgan darslar hisobga olinadi
 *
 * BAHOLAR (dars bo'yicha):
 *   0–39%  → 2 (qoniqarsiz)
 *   40–59% → 3 (qoniqarli)
 *   60–80% → 4 (yaxshi)
 *   81–100% → 5 (a'lo)
 *
 * MEDALLAR:
 *   5 → 🥇 oltin medal
 *   4 → 🥈 kumush medal
 *   3 → 🥉 bronza medal
 *   2 → 😢 qizil hafa stiker
 */
const database = require('../config/database');

class LessonProgress {
  // ─── Darsning maksimal balini hisoblash ───────────────────
  // Endi test.max_score + assignments.max_score ishlatiladi
  static async calcTotalPossible(lessonId) {
    // Dars o'tilganmi tekshirish
    const lesson = await database.get('SELECT taught_at FROM lessons WHERE id = ?', [lessonId]);
    if (!lesson || !lesson.taught_at) return 0; // hali o'tilmagan dars hisobga kirmaydi

    // Testlarning max_score yig'indisi
    const testRow = await database.get(`
      SELECT COALESCE(SUM(max_score), 0) AS total
      FROM tests WHERE lesson_id = ? AND is_published = TRUE
    `, [lessonId]);

    // Topshiriqlarning max_score yig'indisi (faqat e'lon qilinganlar)
    const aRow = await database.get(
      'SELECT COALESCE(SUM(max_score), 0) AS total FROM assignments WHERE lesson_id = ? AND is_published = TRUE',
      [lessonId]
    );

    return parseInt(testRow?.total || 0) + parseInt(aRow?.total || 0);
  }

  // ─── O'quvchining to'plagan balini hisoblash ─────────────
  // Test bali: (to'g'ri/umumiy) × test.max_score
  // Topshiriq bali: assignment_submissions.score (allaqachon max_score ga nisbatan hisoblangan)
  static async calcEarnedScore(lessonId, studentId) {
    // Dars o'tilganmi tekshirish — o'tilmagan bo'lsa 0 qaytarish
    const lesson = await database.get('SELECT taught_at FROM lessons WHERE id = ?', [lessonId]);
    if (!lesson || !lesson.taught_at) {
      return { testScore: 0, assignScore: 0, total: 0 };
    }

    // Testdan to'plangan ball — proportsional (to'g'ri javoblar nisbati × test.max_score)
    const testRow = await database.get(`
      SELECT COALESCE(SUM(best.earned), 0) AS test_score
      FROM (
        SELECT r.test_id,
               ROUND((MAX(r.correct_answers)::REAL / GREATEST(MAX(r.total_questions), 1)) * t.max_score) AS earned
        FROM results r
        JOIN tests t ON r.test_id = t.id
        WHERE t.lesson_id = ? AND r.user_id = ?
        GROUP BY r.test_id, t.max_score
      ) best
    `, [lessonId, studentId]);

    // Amaliy topshiriqlardan to'plangan ball (score to'g'ridan-to'g'ri)
    const assignRow = await database.get(`
      SELECT COALESCE(SUM(s.score), 0) AS assign_score
      FROM assignment_submissions s
      JOIN assignments a ON s.assignment_id = a.id
      WHERE a.lesson_id = ? AND s.student_id = ? AND s.status = 'graded'
    `, [lessonId, studentId]);

    return {
      testScore: parseInt(testRow?.test_score || 0),
      assignScore: parseInt(assignRow?.assign_score || 0),
      total: parseInt(testRow?.test_score || 0) + parseInt(assignRow?.assign_score || 0)
    };
  }

  // ─── O'quvchining BARCHA o'tilgan darslar bo'yicha umumiy statistikasi ───
  static async getMasteryStats(studentId, grade, district, schoolNumber) {
    let lessons;
    if (district && schoolNumber) {
      lessons = await database.all(
        `SELECT l.id FROM lessons l
         LEFT JOIN users u ON l.created_by = u.id
         WHERE l.grade = ? AND l.taught_at IS NOT NULL
           AND u.district = ? AND u.school_number = ?`,
        [grade, district, schoolNumber]
      );
    } else {
      lessons = await database.all(
        `SELECT id FROM lessons WHERE grade = ? AND taught_at IS NOT NULL`,
        [grade]
      );
    }

    let totalPossible = 0;
    let totalEarned = 0;
    for (const l of lessons) {
      totalPossible += await this.calcTotalPossible(l.id);
      const earned = await this.calcEarnedScore(l.id, studentId);
      totalEarned += earned.total;
    }

    return { totalPossible, totalEarned, lessonsCount: lessons.length };
  }

  // ─── Baho hisoblash ───────────────────────────────────────
  static calcGrade(percent) {
    if (percent >= 81) return 5;
    if (percent >= 60) return 4;
    if (percent >= 40) return 3;
    return 2;
  }

  // ─── Medal/stiker ─────────────────────────────────────────
  static getMedal(grade) {
    return { 5: '🥇', 4: '🥈', 3: '🥉', 2: '😢' }[grade] || '😢';
  }

  static getMedalLabel(grade) {
    return {
      5: 'Oltin medal',
      4: 'Kumush medal',
      3: 'Bronza medal',
      2: 'Qizil stiker'
    }[grade] || '';
  }

  // ─── Progressni qayta hisoblash va saqlash ────────────────
  static async recalculate(lessonId, studentId) {
    const totalPossible = await this.calcTotalPossible(lessonId);
    const earned = await this.calcEarnedScore(lessonId, studentId);
    const earnedTotal = earned.total;

    const percent = totalPossible > 0
      ? Math.min(100, Math.round((earnedTotal / totalPossible) * 100 * 10) / 10)
      : 0;

    const grade = totalPossible > 0 ? this.calcGrade(percent) : 0;

    // Upsert
    const existing = await database.get(
      'SELECT id, grade, grade_awarded FROM lesson_progress WHERE lesson_id = ? AND student_id = ?',
      [lessonId, studentId]
    );

    if (existing) {
      await database.run(`
        UPDATE lesson_progress
        SET total_possible = ?, earned_score = ?, percent = ?, grade = ?, updated_at = NOW()
        WHERE lesson_id = ? AND student_id = ?
      `, [totalPossible, earnedTotal, percent, grade, lessonId, studentId]);

      // Agar baho ko'tarilgan bo'lsa va avval award qilinmagan bo'lsa — ball qo'sh
      if (!existing.grade_awarded && grade >= 2 && totalPossible > 0) {
        await this._awardGradePoints(studentId, grade, lessonId);
        await database.run(
          'UPDATE lesson_progress SET grade_awarded = TRUE WHERE lesson_id = ? AND student_id = ?',
          [lessonId, studentId]
        );
      }
    } else {
      await database.run(`
        INSERT INTO lesson_progress (lesson_id, student_id, total_possible, earned_score, percent, grade)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [lessonId, studentId, totalPossible, earnedTotal, percent, grade]);

      // Yangi yozuv bo'lsa va ball bor bo'lsa award qil
      if (grade >= 2 && totalPossible > 0) {
        await this._awardGradePoints(studentId, grade, lessonId);
        await database.run(
          'UPDATE lesson_progress SET grade_awarded = TRUE WHERE lesson_id = ? AND student_id = ?',
          [lessonId, studentId]
        );
      }
    }

    return { totalPossible, earnedScore: earnedTotal, percent, grade, ...earned };
  }

  // ─── Baho ballini users.points ga qo'shish ───────────────
  static async _awardGradePoints(studentId, grade, lessonId) {
    try {
      await database.run(
        'UPDATE users SET points = points + ? WHERE id = ?',
        [grade, studentId]
      );
      console.log(`✅ Lesson ${lessonId}: student ${studentId} → +${grade} points (grade ${grade})`);
    } catch (err) {
      console.error('Award points error:', err.message);
    }
  }

  // ─── O'quvchining dars progressini olish ─────────────────
  static async get(lessonId, studentId) {
    return await database.get(
      'SELECT * FROM lesson_progress WHERE lesson_id = ? AND student_id = ?',
      [lessonId, studentId]
    );
  }

  // ─── O'quvchining barcha darslar progressini olish ───────
  static async getAllForStudent(studentId) {
    return await database.all(`
      SELECT lp.*,
        l.title AS lesson_title,
        l.subject,
        l.grade AS lesson_grade
      FROM lesson_progress lp
      JOIN lessons l ON lp.lesson_id = l.id
      WHERE lp.student_id = ?
        AND l.taught_at IS NOT NULL
      ORDER BY lp.updated_at DESC
    `, [studentId]);
  }
}

module.exports = LessonProgress;
