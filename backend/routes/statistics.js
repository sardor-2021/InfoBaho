const express = require('express');
const database = require('../config/database');
const User = require('../models/User');
const LessonProgress = require('../models/LessonProgress');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Xavfsiz query — xato chiqsa default qaytaradi
async function safeGet(sql, params = [], defaultVal = null) {
  try { return await database.get(sql, params); }
  catch (e) { console.error('safeGet error:', e.message, '|', sql.slice(0,80)); return defaultVal; }
}
async function safeAll(sql, params = [], defaultVal = []) {
  try { return await database.all(sql, params); }
  catch (e) { console.error('safeAll error:', e.message, '|', sql.slice(0,80)); return defaultVal; }
}
const toInt   = (v) => parseInt(v  || 0) || 0;
const toFloat = (v) => parseFloat((parseFloat(v || 0)).toFixed(2)) || 0;

// ─── GET /api/statistics/user/:userId ────────────────────────
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    if (req.user.id !== parseInt(userId) && req.user.role === 'student') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Har query mustaqil — biri xato bersa boshqalarga ta'sir qilmaydi
    const stats = await safeGet('SELECT * FROM statistics WHERE user_id = ?', [userId]);
    const user  = await User.findById(userId).catch(() => null);

    const achievements = await safeAll(`
      SELECT a.*, ua.earned_at
      FROM user_achievements ua
      LEFT JOIN achievements a ON ua.achievement_id = a.id
      WHERE ua.user_id = ?
      ORDER BY ua.earned_at DESC
    `, [userId]);

    const recentResults = await safeAll(`
      SELECT r.*, t.title as test_title, t.subject
      FROM results r
      LEFT JOIN tests t ON r.test_id = t.id
      WHERE r.user_id = ?
      ORDER BY r.created_at DESC LIMIT 5
    `, [userId]);

    const subjectStats = await safeAll(`
      SELECT t.subject,
             COUNT(r.id) as tests_taken,
             AVG(r.percentage) as average_score,
             SUM(CASE WHEN r.passed = TRUE THEN 1 ELSE 0 END) as tests_passed
      FROM results r
      LEFT JOIN tests t ON r.test_id = t.id
      WHERE r.user_id = ?
      GROUP BY t.subject
    `, [userId]);

    // Amaliy topshiriqlar — sodda versiya (SPLIT_PART yo'q)
    const assignStats = await safeGet(`
      SELECT
        COUNT(DISTINCT a.id)                                           AS total_assignments,
        COUNT(DISTINCT s.id)                                           AS submitted_assignments,
        COUNT(DISTINCT CASE WHEN s.status='graded' THEN s.id END)     AS graded_assignments,
        COALESCE(AVG(CASE WHEN s.status='graded'
          THEN (s.score::REAL / GREATEST(a.max_score,1)) * 100 END),0) AS avg_assignment_pct
      FROM assignments a
      LEFT JOIN assignment_submissions s
             ON s.assignment_id = a.id AND s.student_id = ?
    `, [userId]);

    // Dars o'zlashtirish statistikasi
    const lessonStats = await safeGet(`
      SELECT
        COUNT(*)                                  AS total_lessons,
        COUNT(CASE WHEN grade > 0 THEN 1 END)    AS graded_lessons,
        COALESCE(AVG(CASE WHEN grade > 0 THEN percent END), 0) AS avg_lesson_pct,
        COUNT(CASE WHEN grade = 5 THEN 1 END)    AS grade5_count,
        COUNT(CASE WHEN grade = 4 THEN 1 END)    AS grade4_count,
        COUNT(CASE WHEN grade = 3 THEN 1 END)    AS grade3_count,
        COUNT(CASE WHEN grade = 2 THEN 1 END)    AS grade2_count
      FROM lesson_progress
      WHERE student_id = ?
    `, [userId]);

    // Mastery ball hisoblash (jonli — daraja hisobi uchun)
    let masteryEarned = 0;
    let masteryPossible = 0;
    if (user) {
      const gradeNum = parseInt((user.class_name || '').match(/\d+/)?.[0]) || null;
      if (gradeNum) {
        const masteryStats = await LessonProgress.getMasteryStats(user.id, gradeNum, user.district, user.school_number);
        masteryPossible = masteryStats.totalPossible;
        masteryEarned = masteryStats.totalEarned + (user.bonus_points || 0);
      }
    }

    res.json({
      totalAttempts:       toInt(stats?.total_tests_taken),
      totalPassed:         toInt(stats?.total_tests_passed),
      averageScore:        toFloat(stats?.average_score),

      totalAssignments:    toInt(assignStats?.total_assignments),
      submittedAssignments:toInt(assignStats?.submitted_assignments),
      gradedAssignments:   toInt(assignStats?.graded_assignments),
      avgAssignmentPct:    toFloat(assignStats?.avg_assignment_pct),

      totalLessons:        toInt(lessonStats?.total_lessons),
      gradedLessons:       toInt(lessonStats?.graded_lessons),
      avgLessonPct:        toFloat(lessonStats?.avg_lesson_pct),
      medalCounts: {
        gold:   toInt(lessonStats?.grade5_count),
        silver: toInt(lessonStats?.grade4_count),
        bronze: toInt(lessonStats?.grade3_count),
        red:    toInt(lessonStats?.grade2_count),
      },

      user: user ? {
        id: user.id, username: user.username,
        full_name: user.full_name, points: user.points,
        level: user.level, mastery_percent: user.mastery_percent,
        mastery_earned: masteryEarned,
        mastery_possible: masteryPossible,
        avatar: user.avatar
      } : null,

      statistics:    stats     || {},
      achievements:  achievements,
      recent_results:recentResults,
      subject_stats: subjectStats
    });
  } catch (error) {
    console.error('Get user statistics error:', error);
    res.status(500).json({ error: 'Failed to get statistics: ' + error.message });
  }
});

// ─── GET /api/statistics/leaderboard ─────────────────────────
router.get('/leaderboard', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const leaderboard = await User.getLeaderboard(limit);
    res.json({ leaderboard });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// ─── GET /api/statistics/overall ─────────────────────────────
router.get('/overall', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'student') {
      return res.status(403).json({ error: "Faqat o'qituvchi va administrator ko'ra oladi" });
    }

    if (req.user.role === 'admin') {
      // Admin: hamma narsa
      const users       = await safeGet("SELECT COUNT(*) AS count FROM users WHERE role='student'");
      const tests       = await safeGet('SELECT COUNT(*) AS count FROM tests');
      const lessons     = await safeGet('SELECT COUNT(*) AS count FROM lessons');
      const assignments = await safeGet('SELECT COUNT(*) AS count FROM assignments');
      const results     = await safeGet('SELECT COUNT(*) AS count FROM results');
      const avgScore    = await safeGet('SELECT AVG(percentage) AS avg FROM results');
      const gradedA     = await safeGet("SELECT COUNT(*) AS count FROM assignment_submissions WHERE status='graded'");
      const recentAct   = await safeAll(`
        SELECT r.created_at, u.full_name, t.title AS test_title, r.percentage
        FROM results r
        LEFT JOIN users u ON r.user_id = u.id
        LEFT JOIN tests t ON r.test_id = t.id
        ORDER BY r.created_at DESC LIMIT 10
      `);

      return res.json({
        totalStudents:     toInt(users?.count),
        totalTests:        toInt(tests?.count),
        totalLessons:      toInt(lessons?.count),
        totalAssignments:  toInt(assignments?.count),
        totalAttempts:     toInt(results?.count),
        gradedAssignments: toInt(gradedA?.count),
        averageScore:      toFloat(avgScore?.avg),
        totalUsers:        toInt(users?.count),
        recent_activity:   recentAct
      });
    }

    // ── Teacher ──
    const teacher = await User.findById(req.user.id).catch(() => ({}));
    const classes = (teacher?.teaching_classes || '')
      .split(',').map(c => c.trim()).filter(Boolean);
    const placeholders = classes.length
      ? classes.map(() => '?').join(',')
      : "''";

    // O'quvchilar soni
    const students = classes.length
      ? await safeGet(
          `SELECT COUNT(*) AS count FROM users
           WHERE role='student' AND district=? AND school_number=?
           AND class_name IN (${placeholders})`,
          [teacher.district, teacher.school_number, ...classes]
        )
      : { count: 0 };

    // Barcha qolgan querylar — mustaqil
    const tests    = await safeGet('SELECT COUNT(*) AS count FROM tests WHERE created_by=?',    [req.user.id]);
    const lessons  = await safeGet('SELECT COUNT(*) AS count FROM lessons WHERE created_by=?',  [req.user.id]);
    const results  = await safeGet(`
      SELECT COUNT(*) AS count FROM results
      WHERE test_id IN (SELECT id FROM tests WHERE created_by=?)
    `, [req.user.id]);
    const avgScore = await safeGet(`
      SELECT AVG(percentage) AS avg FROM results
      WHERE test_id IN (SELECT id FROM tests WHERE created_by=?)
    `, [req.user.id]);

    // Amaliy topshiriqlar
    const assignments = await safeGet(`
      SELECT COUNT(*) AS count
      FROM assignments a
      JOIN lessons l ON a.lesson_id = l.id
      WHERE l.created_by = ?
    `, [req.user.id]);

    const submittedA = await safeGet(`
      SELECT COUNT(*) AS count
      FROM assignment_submissions s
      JOIN assignments a ON s.assignment_id = a.id
      JOIN lessons l ON a.lesson_id = l.id
      WHERE l.created_by = ?
    `, [req.user.id]);

    const gradedA = await safeGet(`
      SELECT COUNT(*) AS count
      FROM assignment_submissions s
      JOIN assignments a ON s.assignment_id = a.id
      JOIN lessons l ON a.lesson_id = l.id
      WHERE l.created_by = ? AND s.status = 'graded'
    `, [req.user.id]);

    // Dars o'zlashtirish
    const lpStats = await safeGet(`
      SELECT
        COALESCE(AVG(lp.percent), 0)              AS avg_pct,
        COUNT(lp.id)                              AS total_progress,
        COUNT(CASE WHEN lp.grade=5 THEN 1 END)   AS g5,
        COUNT(CASE WHEN lp.grade=4 THEN 1 END)   AS g4,
        COUNT(CASE WHEN lp.grade=3 THEN 1 END)   AS g3,
        COUNT(CASE WHEN lp.grade=2 THEN 1 END)   AS g2
      FROM lesson_progress lp
      JOIN lessons l ON lp.lesson_id = l.id
      WHERE l.created_by = ?
    `, [req.user.id]);

    const recentAct = await safeAll(`
      SELECT r.created_at, u.full_name, t.title AS test_title, r.percentage
      FROM results r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN tests t ON r.test_id = t.id
      WHERE t.created_by = ?
      ORDER BY r.created_at DESC LIMIT 10
    `, [req.user.id]);

    return res.json({
      totalStudents:     toInt(students?.count),
      totalUsers:        toInt(students?.count),
      totalTests:        toInt(tests?.count),
      totalLessons:      toInt(lessons?.count),
      totalAssignments:  toInt(assignments?.count),
      totalAttempts:     toInt(results?.count),
      submittedAssigns:  toInt(submittedA?.count),
      gradedAssignments: toInt(gradedA?.count),
      averageScore:      toFloat(avgScore?.avg),
      avgLessonPct:      toFloat(lpStats?.avg_pct),
      totalProgress:     toInt(lpStats?.total_progress),
      gradeCounts: {
        5: toInt(lpStats?.g5),
        4: toInt(lpStats?.g4),
        3: toInt(lpStats?.g3),
        2: toInt(lpStats?.g2),
      },
      recent_activity: recentAct
    });

  } catch (error) {
    console.error('Get overall statistics error:', error);
    res.status(500).json({ error: 'Failed to get statistics: ' + error.message });
  }
});

// ─── GET /api/statistics/progress/:userId ────────────────────
router.get('/progress/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    if (req.user.id !== parseInt(userId) && req.user.role === 'student') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const progress = await safeAll(`
      SELECT DATE(created_at::timestamp) AS date,
             COUNT(*) AS tests_taken,
             AVG(percentage) AS average_score,
             SUM(CASE WHEN passed = TRUE THEN 1 ELSE 0 END) AS tests_passed
      FROM results
      WHERE user_id = ?
      GROUP BY DATE(created_at::timestamp)
      ORDER BY date ASC
    `, [userId]);

    res.json({ progress });
  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({ error: 'Failed to get progress' });
  }
});

module.exports = router;
