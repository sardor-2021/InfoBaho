const express = require('express');
const Test = require('../models/Test');
const Question = require('../models/Question');
const { authenticateToken, isTeacherOrAdmin } = require('../middleware/auth');

const router = express.Router();

// Get all tests
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { subject, difficulty, published } = req.query;
    const User = require('../models/User');
    
    // Get current user with school info
    const currentUser = await User.findById(req.user.id);
    
    const filters = {};
    if (subject) filters.subject = subject;
    if (difficulty) filters.difficulty = difficulty;
    
    // Students can only see published tests from their school
    // Teachers/admins can see all tests they created
    if (req.user.role === 'student') {
      filters.is_published = true;
      // Add school filtering for students
      filters.student_district = currentUser.district;
      filters.student_school = currentUser.school_number;
      filters.student_class = currentUser.class_name;
    } else if (req.user.role === 'teacher') {
      // If published param is provided, use it, otherwise show all their tests
      if (published !== undefined) {
        filters.is_published = published === 'true';
      }
      filters.created_by = req.user.id;
    }
    // Admins can see everything
    
    const tests = await Test.getAll(filters);
    
    // Return array directly for frontend compatibility
    res.json(tests);
  } catch (error) {
    console.error('Get tests error:', error);
    res.status(500).json({ error: 'Failed to get tests' });
  }
});

// Get test by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const test = await Test.findById(id);
    const User = require('../models/User');
    
    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }
    
    // Check permissions
    if (req.user.role === 'student' && !test.is_published) {
      return res.status(403).json({ error: 'This test is not published yet' });
    }
    
    // Check school/class access for students
    if (req.user.role === 'student') {
      const currentUser = await User.findById(req.user.id);
      const testCreator = await User.findById(test.created_by);
      
      // Check if student is from same school
      if (testCreator.district !== currentUser.district || 
          testCreator.school_number !== currentUser.school_number) {
        return res.status(403).json({ error: 'Bu test sizning maktabingiz uchun emas' });
      }
      
      // Check if student's class is in teacher's teaching classes
      if (testCreator.teaching_classes) {
        const teacherClasses = testCreator.teaching_classes.split(',').map(c => c.trim());
        if (!teacherClasses.includes(currentUser.class_name)) {
          return res.status(403).json({ error: 'Bu test sizning sinfingiz uchun emas' });
        }
      }
    }
    
    if (req.user.role === 'teacher' && test.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json(test); // Return test directly
  } catch (error) {
    console.error('Get test error:', error);
    res.status(500).json({ error: 'Failed to get test' });
  }
});

// Get test with questions
router.get('/:id/full', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const test = await Test.findById(id);
    const User = require('../models/User');
    
    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }
    
    // Check permissions
    if (req.user.role === 'student' && !test.is_published) {
      return res.status(403).json({ error: 'This test is not published yet' });
    }
    
    // Check school/class access for students
    if (req.user.role === 'student') {
      const currentUser = await User.findById(req.user.id);
      const testCreator = await User.findById(test.created_by);
      
      // Check if student is from same school
      if (testCreator.district !== currentUser.district || 
          testCreator.school_number !== currentUser.school_number) {
        return res.status(403).json({ error: 'Bu test sizning maktabingiz uchun emas' });
      }
      
      // Check if student's class is in teacher's teaching classes
      if (testCreator.teaching_classes) {
        const teacherClasses = testCreator.teaching_classes.split(',').map(c => c.trim());
        if (!teacherClasses.includes(currentUser.class_name)) {
          return res.status(403).json({ error: 'Bu test sizning sinfingiz uchun emas' });
        }
      }
    }
    
    if (req.user.role === 'teacher' && test.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Get questions (hide correct answers for students taking test)
    const includeAnswers = req.user.role !== 'student' || req.query.review === 'true';
    const questions = await Question.getByTestId(id, includeAnswers);
    
    res.json({ 
      test,
      questions 
    });
  } catch (error) {
    console.error('Get test with questions error:', error);
    res.status(500).json({ error: 'Failed to get test' });
  }
});

// Create new test (teacher/admin only)
router.post('/', authenticateToken, isTeacherOrAdmin, async (req, res) => {
  try {
    const { 
      title, 
      description, 
      subject, 
      lesson_id,
      duration, 
      difficulty, 
      passing_score 
    } = req.body;
    
    // Validation
    if (!title || !subject || !duration) {
      return res.status(400).json({ 
        error: 'Title, subject, and duration are required' 
      });
    }
    
    if (duration < 1) {
      return res.status(400).json({ error: 'Duration must be at least 1 minute' });
    }
    
    const testId = await Test.create({
      title,
      description,
      subject,
      lesson_id: lesson_id || null,
      duration,
      difficulty: difficulty || 'medium',
      passing_score: passing_score || 60,
      created_by: req.user.id
    });
    
    const test = await Test.findById(testId);
    
    res.status(201).json({ 
      message: 'Test created successfully',
      test 
    });
  } catch (error) {
    console.error('Create test error:', error);
    res.status(500).json({ error: 'Failed to create test' });
  }
});

// Update test (teacher/admin only)
router.put('/:id', authenticateToken, isTeacherOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const test = await Test.findById(id);
    
    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }
    
    // Check ownership (teachers can only edit their own tests)
    if (req.user.role === 'teacher' && test.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const updates = {};
    const allowedFields = [
      'title', 'description', 'subject', 'duration',
      'difficulty', 'passing_score', 'is_published'
    ];
    
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    await Test.update(id, updates);
    const updatedTest = await Test.findById(id);
    
    res.json({ 
      message: 'Test updated successfully',
      test: updatedTest 
    });
  } catch (error) {
    console.error('Update test error:', error);
    res.status(500).json({ error: 'Failed to update test' });
  }
});

// Publish/Unpublish test
router.patch('/:id/publish', authenticateToken, isTeacherOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { publish } = req.body; // true or false
    
    const test = await Test.findById(id);
    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }
    
    // Check ownership
    if (req.user.role === 'teacher' && test.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Check if test has questions
    const questions = await Question.getByTestId(id);
    if (questions.length === 0 && publish) {
      return res.status(400).json({ 
        error: 'Cannot publish test without questions' 
      });
    }
    
    if (publish) {
      await Test.publish(id);
    } else {
      await Test.unpublish(id);
    }
    
    const updatedTest = await Test.findById(id);
    
    res.json({ 
      message: `Test ${publish ? 'published' : 'unpublished'} successfully`,
      test: updatedTest 
    });
  } catch (error) {
    console.error('Publish test error:', error);
    res.status(500).json({ error: 'Failed to publish test' });
  }
});

// Delete test (teacher/admin only)
router.delete('/:id', authenticateToken, isTeacherOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const test = await Test.findById(id);
    
    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }
    
    // Check ownership
    if (req.user.role === 'teacher' && test.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await Test.delete(id);
    
    res.json({ message: 'Test deleted successfully' });
  } catch (error) {
    console.error('Delete test error:', error);
    res.status(500).json({ error: 'Failed to delete test' });
  }
});

// Publish test
router.put('/:id/publish', authenticateToken, isTeacherOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const test = await Test.findById(id);
    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }
    
    // Check ownership
    if (req.user.role === 'teacher' && test.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Check if test has questions
    const questions = await Question.getByTestId(id);
    if (questions.length === 0) {
      return res.status(400).json({ 
        error: 'Testda savollar yo\'q. Kamida 1 ta savol qo\'shing.' 
      });
    }
    
    await Test.publish(id);
    const updatedTest = await Test.findById(id);
    
    res.json({ 
      message: 'Test nashr qilindi',
      test: updatedTest 
    });
  } catch (error) {
    console.error('Publish test error:', error);
    res.status(500).json({ error: 'Failed to publish test' });
  }
});

// Unpublish test
router.put('/:id/unpublish', authenticateToken, isTeacherOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const test = await Test.findById(id);
    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }
    
    // Check ownership
    if (req.user.role === 'teacher' && test.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await Test.unpublish(id);
    const updatedTest = await Test.findById(id);
    
    res.json({ 
      message: 'Test yashirildi',
      test: updatedTest 
    });
  } catch (error) {
    console.error('Unpublish test error:', error);
    res.status(500).json({ error: 'Failed to unpublish test' });
  }
});

// Get test statistics
router.get('/:id/statistics', authenticateToken, isTeacherOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const test = await Test.findById(id);
    
    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }
    
    // Allow: test creator, admin, or teacher who owns the lesson
    if (req.user.role === 'teacher' && test.created_by !== req.user.id) {
      // Check if this teacher owns the lesson containing this test
      let allowed = false;
      if (test.lesson_id) {
        const Lesson = require('../models/Lesson');
        const lesson = await Lesson.findById(test.lesson_id);
        if (lesson && lesson.created_by === req.user.id) {
          allowed = true;
        }
      }
      if (!allowed) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }
    
    const statistics = await Test.getStatistics(id);
    const recentAttempts = await Test.getRecentAttempts(id, 5);
    
    // Return flat object with all stats
    res.json({ 
      totalAttempts: statistics?.total_attempts || 0,
      averageScore: statistics?.average_score || 0,
      highestScore: statistics?.highest_score || 0,
      lowestScore: statistics?.lowest_score || 0,
      passRate: statistics?.pass_rate || 0,
      recentAttempts: recentAttempts || []
    });
  } catch (error) {
    console.error('Get test statistics error:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

module.exports = router;
