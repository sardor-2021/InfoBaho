const express = require('express');
const { chatMessages } = require('../utils/ai');
const Question = require('../models/Question');
const Test = require('../models/Test');
const { authenticateToken, isTeacherOrAdmin } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Get all questions for a test
router.get('/test/:testId', authenticateToken, async (req, res) => {
  try {
    const { testId } = req.params;
    const test = await Test.findById(testId);
    
    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }
    
    // Check permissions
    if (req.user.role === 'student' && !test.is_published) {
      return res.status(403).json({ error: 'Test is not published' });
    }
    
    // Teacher can see questions if: they created the test OR they own the lesson
    if (req.user.role === 'teacher' && test.created_by !== req.user.id) {
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
    
    // Hide correct answers for students
    const includeAnswers = req.user.role !== 'student';
    const questions = await Question.getByTestId(testId, includeAnswers);
    
    // Return array directly for frontend compatibility
    res.json(questions);
  } catch (error) {
    console.error('Get questions error:', error);
    res.status(500).json({ error: 'Failed to get questions' });
  }
});

// Get single question
router.get('/:id', authenticateToken, isTeacherOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const question = await Question.findById(id);
    
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }
    
    // Verify ownership
    const test = await Test.findById(question.test_id);
    if (req.user.role === 'teacher' && test.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json({ question });
  } catch (error) {
    console.error('Get question error:', error);
    res.status(500).json({ error: 'Failed to get question' });
  }
});

// Create new question (teacher/admin only)
router.post('/', authenticateToken, isTeacherOrAdmin, async (req, res) => {
  try {
    const {
      test_id,
      question_text,
      question_type,
      options,
      correct_answer,
      points,
      explanation,
      image_url,
      order_number
    } = req.body;
    
    // Validation
    if (!test_id || !question_text || !question_type || !correct_answer) {
      return res.status(400).json({ 
        error: 'test_id, question_text, question_type, and correct_answer are required' 
      });
    }
    
    // Verify test exists
    const test = await Test.findById(test_id);
    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }
    
    // Check ownership
    if (req.user.role === 'teacher' && test.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Validate question type
    const validTypes = [
      'single_choice', 'multiple_choice', 'true_false',
      'short_answer', 'code_writing', 'matching'
    ];
    
    if (!validTypes.includes(question_type)) {
      return res.status(400).json({ 
        error: 'Invalid question type',
        valid_types: validTypes
      });
    }
    
    // For choice questions, options are required
    if (['single_choice', 'multiple_choice'].includes(question_type) && !options) {
      return res.status(400).json({ error: 'Options are required for choice questions' });
    }
    
    const questionId = await Question.create({
      test_id,
      question_text,
      question_type,
      options,
      correct_answer,
      points: points || 1,
      explanation,
      image_url,
      order_number
    });
    
    // Update test question count
    await Test.updateQuestionCount(test_id);
    
    const question = await Question.findById(questionId);
    
    res.status(201).json({ 
      message: 'Question created successfully',
      question 
    });
  } catch (error) {
    console.error('Create question error:', error);
    res.status(500).json({ error: 'Failed to create question' });
  }
});

// Bulk create questions
router.post('/bulk', authenticateToken, isTeacherOrAdmin, async (req, res) => {
  try {
    const { test_id, questions } = req.body;
    
    if (!test_id || !questions || !Array.isArray(questions)) {
      return res.status(400).json({ error: 'test_id and questions array are required' });
    }
    
    // Verify test exists and check ownership
    const test = await Test.findById(test_id);
    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }
    
    if (req.user.role === 'teacher' && test.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const createdQuestions = [];
    
    for (const q of questions) {
      const questionId = await Question.create({
        test_id,
        ...q
      });
      createdQuestions.push(questionId);
    }
    
    // Update test question count
    await Test.updateQuestionCount(test_id);
    
    res.status(201).json({ 
      message: `${createdQuestions.length} questions created successfully`,
      question_ids: createdQuestions
    });
  } catch (error) {
    console.error('Bulk create questions error:', error);
    res.status(500).json({ error: 'Failed to create questions' });
  }
});

// Update question
router.put('/:id', authenticateToken, isTeacherOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const question = await Question.findById(id);
    
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }
    
    // Check ownership
    const test = await Test.findById(question.test_id);
    if (req.user.role === 'teacher' && test.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const updates = {};
    const allowedFields = [
      'question_text', 'question_type', 'options', 'correct_answer',
      'points', 'explanation', 'image_url', 'order_number'
    ];
    
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    await Question.update(id, updates);
    const updatedQuestion = await Question.findById(id);
    
    res.json({ 
      message: 'Question updated successfully',
      question: updatedQuestion 
    });
  } catch (error) {
    console.error('Update question error:', error);
    res.status(500).json({ error: 'Failed to update question' });
  }
});

// Delete question
router.delete('/:id', authenticateToken, isTeacherOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const question = await Question.findById(id);
    
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }
    
    // Check ownership
    const test = await Test.findById(question.test_id);
    if (req.user.role === 'teacher' && test.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const testId = question.test_id;
    await Question.delete(id);
    
    // Update test question count
    await Test.updateQuestionCount(testId);
    
    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    console.error('Delete question error:', error);
    res.status(500).json({ error: 'Failed to delete question' });
  }
});

// Reorder questions
router.post('/reorder', authenticateToken, isTeacherOrAdmin, async (req, res) => {
  try {
    const { test_id, question_orders } = req.body;
    
    if (!test_id || !question_orders || !Array.isArray(question_orders)) {
      return res.status(400).json({ 
        error: 'test_id and question_orders array are required' 
      });
    }
    
    // Check ownership
    const test = await Test.findById(test_id);
    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }
    
    if (req.user.role === 'teacher' && test.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await Question.reorder(test_id, question_orders);
    
    res.json({ message: 'Questions reordered successfully' });
  } catch (error) {
    console.error('Reorder questions error:', error);
    res.status(500).json({ error: 'Failed to reorder questions' });
  }
});

module.exports = router;



// Upload questions from Excel file
router.post('/upload-excel', authenticateToken, isTeacherOrAdmin, async (req, res) => {
  try {
    const multer = require('multer');
    const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

    // Bu endpoint'da multer middleware ishlatilmaydi — alohida route sifatida
    // Quyida /upload-excel-file endpoint'da ishlatiladi
    res.status(400).json({ error: 'Use /upload-excel-file endpoint with multipart/form-data' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Excel fayldan savollar import qilish
const multerExcel = require('multer')({ storage: require('multer').memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/upload-excel-file', authenticateToken, isTeacherOrAdmin, multerExcel.single('file'), async (req, res) => {
  try {
    const { test_id } = req.body;
    if (!test_id) return res.status(400).json({ error: 'test_id kerak' });
    if (!req.file) return res.status(400).json({ error: 'Excel fayl yuklanmadi' });

    // Test mavjudligini tekshirish
    const test = await Test.findById(test_id);
    if (!test) return res.status(404).json({ error: 'Test topilmadi' });
    if (req.user.role === 'teacher' && test.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Ruxsat yo\'q' });
    }

    // Excel o'qish
    const XLSX = require('xlsx');
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Raw data olish (header qatorini avtomatik topish)
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    // Sarlavha qatorini topish (Savol yoki savol so'zi bor qator)
    let headerRowIndex = -1;
    let headers = [];
    for (let i = 0; i < Math.min(rawRows.length, 5); i++) {
      const row = rawRows[i];
      if (row && row.some(cell => {
        const c = String(cell || '').toLowerCase().trim();
        return c === 'savol' || c === 'question' || c === 'savol matni';
      })) {
        headerRowIndex = i;
        headers = row.map(h => String(h || '').trim());
        break;
      }
    }

    if (headerRowIndex === -1) {
      return res.status(400).json({
        error: 'Excel formatida "Savol" ustuni topilmadi',
        hint: 'Excel ustunlari: Savol, A, B, C, D, Javob (yoki To\'g\'ri javob), Ball, Izoh'
      });
    }

    // Ustun indekslarini aniqlash (flexible)
    const findCol = (...names) => {
      for (const name of names) {
        const idx = headers.findIndex(h => h && h.toLowerCase() === name.toLowerCase());
        if (idx !== -1) return idx;
      }
      // Partial match
      for (const name of names) {
        const idx = headers.findIndex(h => h && h.toLowerCase().includes(name.toLowerCase()));
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const colSavol = findCol('Savol', 'Question', 'Savol matni');
    const colA = findCol('A', 'Variant A');
    const colB = findCol('B', 'Variant B');
    const colC = findCol('C', 'Variant C');
    const colD = findCol('D', 'Variant D');
    const colJavob = findCol("To'g'ri javob", 'Javob', 'Answer', 'Togri javob');
    const colBall = findCol('Ball', 'Points');
    const colIzoh = findCol('Izoh', 'Explanation');
    const colTuri = findCol('Turi', 'Type');

    if (colSavol === -1) {
      return res.status(400).json({ error: '"Savol" ustuni topilmadi. Ustun nomlari: ' + headers.join(', ') });
    }

    // Ma'lumot qatorlarini parse qilish
    const dataRows = rawRows.slice(headerRowIndex + 1);
    
    if (!dataRows.length) {
      return res.status(400).json({ error: 'Excel fayl bo\'sh — savollar topilmadi' });
    }

    // Savollarni parse qilish
    const questions = [];
    const errors = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (!row || row.every(cell => !cell)) continue; // Bo'sh qatorni o'tkazish
      
      const rowNum = headerRowIndex + i + 2; // Excel qator raqami

      const questionText = String(row[colSavol] || '').trim();
      const optionA = String(row[colA] || '').trim();
      const optionB = String(row[colB] || '').trim();
      const optionC = colC !== -1 ? String(row[colC] || '').trim() : '';
      const optionD = colD !== -1 ? String(row[colD] || '').trim() : '';
      const correctAnswer = colJavob !== -1 ? String(row[colJavob] || '').trim() : '';
      const points = colBall !== -1 ? (parseInt(row[colBall]) || 1) : 1;
      const explanation = colIzoh !== -1 ? String(row[colIzoh] || '').trim() : '';
      const questionType = colTuri !== -1 ? String(row[colTuri] || '').trim() : 'single_choice';

      if (!questionText.trim()) {
        errors.push(`${rowNum}-qator: Savol matni bo'sh`);
        continue;
      }

      // Javob turini aniqlash
      let type = 'single_choice';
      if (questionType.toLowerCase().includes('true') || questionType.toLowerCase().includes('mantiq')) {
        type = 'true_false';
      } else if (questionType.toLowerCase().includes('short') || questionType.toLowerCase().includes('qisqa')) {
        type = 'short_answer';
      } else if (questionType.toLowerCase().includes('multi') || questionType.toLowerCase().includes('ko\'p')) {
        type = 'multiple_choice';
      }

      // Variantlar
      const options = [optionA, optionB, optionC, optionD].filter(o => o.toString().trim());

      // To'g'ri javob
      let correct = correctAnswer.toString().trim();
      // Agar A, B, C, D formatida berilgan bo'lsa — variant matnga o'zgartirish
      if (['A', 'B', 'C', 'D'].includes(correct.toUpperCase()) && options.length > 0) {
        const idx = correct.toUpperCase().charCodeAt(0) - 65;
        correct = options[idx] || correct;
      }

      if (!correct) {
        errors.push(`${rowNum}-qator: To'g'ri javob ko'rsatilmagan`);
        continue;
      }

      questions.push({
        question_text: questionText.trim(),
        question_type: type,
        options: type === 'true_false' || type === 'short_answer' ? null : JSON.stringify(options),
        correct_answer: correct,
        points,
        explanation: explanation || null,
        order_number: i + 1
      });
    }

    if (questions.length === 0) {
      return res.status(400).json({
        error: 'Hech qanday savol import qilinmadi',
        errors,
        hint: 'Excel ustunlari: Savol, A, B, C, D, Javob, Ball, Izoh'
      });
    }

    // Savollarni bazaga saqlash
    const createdIds = [];
    for (const q of questions) {
      const questionId = await Question.create({ test_id: parseInt(test_id), ...q });
      createdIds.push(questionId);
    }

    // Test question count yangilash
    await Test.updateQuestionCount(parseInt(test_id));

    res.json({
      message: `${questions.length} ta savol muvaffaqiyatli import qilindi!`,
      imported: questions.length,
      errors: errors.length > 0 ? errors : undefined,
      question_ids: createdIds
    });
  } catch (err) {
    console.error('Excel import error:', err);
    res.status(500).json({ error: 'Excel import xatolik: ' + err.message });
  }
});

// Generate questions using AI (OpenAI GPT)
router.post('/generate-ai', authenticateToken, isTeacherOrAdmin, aiLimiter, async (req, res) => {
  try {
    const { test_id, topic, count = 5, difficulty = 'medium', question_type = 'single_choice' } = req.body;

    console.log('AI Generate request:', { test_id, topic, count, difficulty, question_type });

    if (!test_id || !topic) {
      return res.status(400).json({ error: 'test_id and topic are required' });
    }

    // Verify test exists and user has permission
    const test = await Test.findById(test_id);
    if (!test) {
      console.log('Test not found:', test_id);
      return res.status(404).json({ error: 'Test not found' });
    }

    if (req.user.role === 'teacher' && test.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    console.log('Generating questions with OpenAI...');

    // Prepare prompt
    const questionTypeNames = {
      single_choice: "bir tanlovli (4 ta variant, 1 ta to'g'ri javob)",
      multiple_choice: "ko'p tanlovli (4 ta variant, bir nechta to'g'ri javob)",
      true_false: "to'g'ri yoki noto'g'ri",
      short_answer: "qisqa javob"
    };

    const difficultyNames = {
      easy: "oson",
      medium: "o'rta",
      hard: "qiyin"
    };

    const prompt = `Siz ta'lim tizimi uchun test savollari yaratuvchisiz. 

Mavzu: ${topic}
Qiyinlik: ${difficultyNames[difficulty]}
Savol turi: ${questionTypeNames[question_type]}
Savollar soni: ${count}

Quyidagi formatda ${count} ta savol yarating:

Har bir savol uchun JSON formatida:
{
  "question_text": "Savol matni (O'zbek tilida)",
  "options": ["Variant A", "Variant B", "Variant C", "Variant D"],
  "correct_answer": "To'g'ri javob",
  "explanation": "Javob tushuntirilishi",
  "points": ${difficulty === 'hard' ? 3 : difficulty === 'medium' ? 2 : 1}
}

Faqat JSON array qaytaring, boshqa matn yo'q:`;

    const responseText = await chatMessages([
        {
          role: "user",
          content: prompt
        }
      ], {
        system: "Siz professional test savollari yaratuvchisiz. Faqat JSON formatida javob bering, boshqa matn yo'q.",
        temperature: 0.7,
        max_tokens: 2000
      });

    console.log('Claude response received');

    // Parse AI response
    let aiQuestions = [];
    try {
      // Remove markdown code blocks if present
      const jsonText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      aiQuestions = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      console.log('AI Response:', responseText);
      return res.status(500).json({ 
        error: 'Failed to parse AI response',
        details: 'AI javobini parse qilishda xatolik'
      });
    }

    console.log(`Parsed ${aiQuestions.length} questions from AI`);

    // Save questions to database
    const createdQuestions = [];
    for (let i = 0; i < aiQuestions.length; i++) {
      try {
        const aiQ = aiQuestions[i];
        const questionData = {
          test_id,
          question_text: aiQ.question_text,
          question_type,
          options: JSON.stringify(aiQ.options || []),
          correct_answer: aiQ.correct_answer,
          points: aiQ.points || (difficulty === 'hard' ? 3 : difficulty === 'medium' ? 2 : 1),
          explanation: aiQ.explanation || '',
          order_number: (test.total_questions || 0) + i + 1
        };

        const questionId = await Question.create(questionData);
        createdQuestions.push({ id: questionId });
        console.log(`Question ${i + 1} created with ID:`, questionId);
      } catch (qError) {
        console.error(`Error creating question ${i + 1}:`, qError);
      }
    }

    console.log(`✅ Created ${createdQuestions.length} questions successfully`);

    res.json({
      message: `${createdQuestions.length} ta savol AI yordamida yaratildi`,
      count: createdQuestions.length,
      questions: createdQuestions
    });

  } catch (error) {
    console.error('❌ Generate AI questions error:', error);
    console.error('Error stack:', error.stack);
    
    // Check if it's an OpenAI API error
    if (error.response) {
      console.error('OpenAI API error:', error.response.data);
    }
    
    res.status(500).json({ 
      error: 'Failed to generate questions',
      details: error.message 
    });
  }
});
