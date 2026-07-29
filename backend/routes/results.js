const express = require('express');
const database = require('../config/database');
const Test = require('../models/Test');
const Question = require('../models/Question');
const User = require('../models/User');
const { authenticateToken, isTeacherOrAdmin } = require('../middleware/auth');

const router = express.Router();

// Submit test and get results
router.post('/submit', authenticateToken, async (req, res) => {
  try {
    const { test_id, answers, time_taken } = req.body;
    const user_id = req.user.id;
    
    // Validation
    if (!test_id || !answers) {
      return res.status(400).json({ error: 'test_id and answers are required' });
    }
    
    // Get test
    const test = await Test.findById(test_id);
    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }
    
    if (!test.is_published) {
      return res.status(400).json({ error: 'Test is not published' });
    }

    // O'quvchi bu testni avval topshirganmi tekshiruvi
    if (req.user.role === 'student') {
      const existingResult = await database.get(
        'SELECT id FROM results WHERE user_id = ? AND test_id = ?',
        [user_id, test_id]
      );
      if (existingResult) {
        return res.status(403).json({
          error: 'Siz bu testni allaqachon topshirgansiz. Har bir test faqat bir marta topshiriladi.',
          already_attempted: true
        });
      }
    }
    
    // Get all questions with correct answers
    const questions = await Question.getByTestId(test_id, true);
    
    if (questions.length === 0) {
      return res.status(400).json({ error: 'Test has no questions' });
    }
    
    // Check answers and calculate score
    let correctCount = 0;
    let totalPoints = 0;
    let earnedPoints = 0;
    
    const detailedAnswers = questions.map(question => {
      const userAnswer = answers[question.id];
      const isCorrect = Question.checkAnswer(question, userAnswer);
      
      totalPoints += question.points;
      if (isCorrect) {
        correctCount++;
        earnedPoints += question.points;
      }
      
      return {
        question_id: question.id,
        question_text: question.question_text, // Add question text for results display
        user_answer: userAnswer,
        correct_answer: question.correct_answer,
        is_correct: isCorrect,
        points: question.points,
        earned_points: isCorrect ? question.points : 0
      };
    });
    
    const percentage = (earnedPoints / totalPoints) * 100;
    const passed = percentage >= test.passing_score;
    
    // Create test attempt
    const attemptResult = await database.run(
      `INSERT INTO test_attempts (user_id, test_id, completed_at, status)
       VALUES (?, ?, CURRENT_TIMESTAMP, 'completed')`,
      [user_id, test_id]
    );
    
    const attempt_id = attemptResult.id;
    
    // Save result
    await database.run(
      `INSERT INTO results (
        attempt_id, user_id, test_id, score, percentage,
        total_questions, correct_answers, time_taken, answers, passed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        attempt_id,
        user_id,
        test_id,
        earnedPoints,
        percentage,
        questions.length,
        correctCount,
        time_taken || null,
        JSON.stringify(detailedAnswers),
        passed
      ]
    );
    
    // Update user statistics
    await database.run(
      `UPDATE statistics SET
        total_tests_taken = total_tests_taken + 1,
        total_tests_passed = total_tests_passed + ?,
        average_score = (
          SELECT AVG(percentage) FROM results WHERE user_id = ?
        ),
        last_activity = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ?`,
      [passed ? 1 : 0, user_id, user_id]
    );
    
    // Check for achievements
    await checkAndAwardAchievements(user_id);

    // ── Lesson progress yangilash ─────────────────────────────
    try {
      const LessonProgress = require('../models/LessonProgress');
      const User = require('../models/User');
      if (test.lesson_id) {
        await LessonProgress.recalculate(test.lesson_id, user_id);
      }
      // Mastery level yangilash
      await User.updateMasteryLevel(user_id);
    } catch (lpErr) {
      console.error('LessonProgress update error (non-fatal):', lpErr.message);
    }

    res.json({
      message: 'Test submitted successfully',
      result: {
        attempt_id,
        score: earnedPoints,
        total_points: totalPoints,
        percentage: percentage.toFixed(2),
        total_questions: questions.length,
        correct_answers: correctCount,
        passed,
        time_taken,
        points_awarded: pointsToAward,
        detailed_answers: detailedAnswers
      }
    });
    
  } catch (error) {
    console.error('Submit test error:', error);
    res.status(500).json({ error: 'Failed to submit test' });
  }
});

// Get current user's results
router.get('/my-results', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const sql = `
      SELECT 
        r.*,
        r.percentage as score_percentage,
        r.created_at as submitted_at,
        t.title as test_title,
        t.subject,
        t.difficulty
      FROM results r
      LEFT JOIN tests t ON r.test_id = t.id
      WHERE r.user_id = ?
      ORDER BY r.created_at DESC
    `;
    
    const results = await database.all(sql, [userId]);
    
    // Parse answers JSON and format for frontend
    const formattedResults = results.map(result => ({
      ...result,
      detailed_answers: result.answers,
      answers: undefined // Remove raw answers field
    }));
    
    // Return array directly for frontend compatibility
    res.json(formattedResults);
  } catch (error) {
    console.error('Get my results error:', error);
    res.status(500).json({ error: 'Failed to get results' });
  }
});

// Get user results
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Users can only see their own results unless they're teacher/admin
    if (req.user.id !== parseInt(userId) && req.user.role === 'student') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const sql = `
      SELECT 
        r.*,
        t.title as test_title,
        t.subject,
        t.difficulty
      FROM results r
      LEFT JOIN tests t ON r.test_id = t.id
      WHERE r.user_id = ?
      ORDER BY r.created_at DESC
    `;
    
    const results = await database.all(sql, [userId]);
    
    // Parse answers JSON
    results.forEach(result => {
      if (result.answers) {
        result.answers = JSON.parse(result.answers);
      }
    });
    
    res.json({ results, count: results.length });
  } catch (error) {
    console.error('Get user results error:', error);
    res.status(500).json({ error: 'Failed to get results' });
  }
});

// Get result details
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const sql = `
      SELECT 
        r.*,
        t.title as test_title,
        t.subject,
        t.difficulty,
        u.username,
        u.full_name
      FROM results r
      LEFT JOIN tests t ON r.test_id = t.id
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.id = ?
    `;
    
    const result = await database.get(sql, [id]);
    
    if (!result) {
      return res.status(404).json({ error: 'Result not found' });
    }
    
    // Check permissions
    if (req.user.id !== result.user_id && req.user.role === 'student') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Parse answers
    if (result.answers) {
      result.answers = JSON.parse(result.answers);
    }
    
    res.json({ result });
  } catch (error) {
    console.error('Get result details error:', error);
    res.status(500).json({ error: 'Failed to get result' });
  }
});

// Get test results (for teachers)
router.get('/test/:testId', authenticateToken, isTeacherOrAdmin, async (req, res) => {
  try {
    const { testId } = req.params;
    
    // Check test ownership
    const test = await Test.findById(testId);
    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }
    
    if (req.user.role === 'teacher' && test.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const sql = `
      SELECT 
        r.*,
        u.username,
        u.full_name,
        u.avatar
      FROM results r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.test_id = ?
      ORDER BY r.created_at DESC
    `;
    
    const results = await database.all(sql, [testId]);
    
    res.json({ results, count: results.length });
  } catch (error) {
    console.error('Get test results error:', error);
    res.status(500).json({ error: 'Failed to get test results' });
  }
});

// Helper function to check and award achievements
async function checkAndAwardAchievements(userId) {
  try {
    // Get user statistics
    const stats = await database.get(
      'SELECT * FROM statistics WHERE user_id = ?',
      [userId]
    );
    
    // Get all achievements
    const achievements = await database.all('SELECT * FROM achievements');
    
    for (const achievement of achievements) {
      // Check if user already has this achievement
      const hasAchievement = await database.get(
        'SELECT * FROM user_achievements WHERE user_id = ? AND achievement_id = ?',
        [userId, achievement.id]
      );
      
      if (!hasAchievement) {
        let shouldAward = false;
        
        // Simple criteria checking
        if (achievement.criteria.includes('first_test') && stats.total_tests_taken >= 1) {
          shouldAward = true;
        } else if (achievement.criteria.includes('10_tests') && stats.total_tests_taken >= 10) {
          shouldAward = true;
        } else if (achievement.criteria.includes('perfect_score') && stats.average_score >= 95) {
          shouldAward = true;
        }
        
        if (shouldAward) {
          // Award achievement
          await database.run(
            'INSERT INTO user_achievements (user_id, achievement_id) VALUES (?, ?)',
            [userId, achievement.id]
          );
          
          // Award points
          if (achievement.points_reward > 0) {
            await User.addPoints(userId, achievement.points_reward);
          }
        }
      }
    }
  } catch (error) {
    console.error('Check achievements error:', error);
    // Don't throw - this is not critical
  }
}

module.exports = router;
