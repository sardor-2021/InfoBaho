const database = require('../config/database');

class Question {
  // Create new question
  static async create(questionData) {
    const {
      test_id,
      question_text,
      question_type,
      options,
      correct_answer,
      points = 1,
      explanation,
      image_url,
      order_number
    } = questionData;

    const sql = `
      INSERT INTO questions (
        test_id, question_text, question_type, options,
        correct_answer, points, explanation, image_url, order_number
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // Options should already be a JSON string or null
    const optionsValue = options || null;

    const result = await database.run(sql, [
      test_id,
      question_text,
      question_type,
      optionsValue,
      correct_answer,
      points,
      explanation || null,
      image_url || null,
      order_number || null
    ]);

    return result.id;
  }

  // Get question by ID
  static async findById(id) {
    const sql = 'SELECT * FROM questions WHERE id = ?';
    const question = await database.get(sql, [id]);

    if (question && question.options) {
      question.options = JSON.parse(question.options);
    }

    return question;
  }

  // Get all questions for a test
  static async getByTestId(testId, includeAnswers = false) {
    const sql = `
      SELECT ${includeAnswers ? '*' : 'id, test_id, question_text, question_type, options, points, image_url, order_number'}
      FROM questions
      WHERE test_id = ?
      ORDER BY order_number ASC, id ASC
    `;

    const questions = await database.all(sql, [testId]);

    // Parse options JSON - check if already parsed
    return questions.map(q => {
      let parsedOptions = q.options;
      
      // Only parse if it's a string
      if (typeof q.options === 'string' && q.options) {
        try {
          parsedOptions = JSON.parse(q.options);
        } catch (e) {
          console.error('Error parsing options for question', q.id, ':', e);
          parsedOptions = [];
        }
      }
      
      return {
        ...q,
        options: parsedOptions
      };
    });
  }

  // Update question
  static async update(id, updates) {
    const allowedFields = [
      'question_text', 'question_type', 'options', 'correct_answer',
      'points', 'explanation', 'image_url', 'order_number'
    ];

    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        if (key === 'options' && value) {
          fields.push(`${key} = ?`);
          values.push(JSON.stringify(value));
        } else {
          fields.push(`${key} = ?`);
          values.push(value);
        }
      }
    }

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(id);
    const sql = `UPDATE questions SET ${fields.join(', ')} WHERE id = ?`;

    return await database.run(sql, values);
  }

  // Delete question
  static async delete(id) {
    const sql = 'DELETE FROM questions WHERE id = ?';
    return await database.run(sql, [id]);
  }

  // Delete all questions for a test
  static async deleteByTestId(testId) {
    const sql = 'DELETE FROM questions WHERE test_id = ?';
    return await database.run(sql, [testId]);
  }

  // Check answer
  static checkAnswer(question, userAnswer) {
    if (!userAnswer && userAnswer !== 0) return false; // No answer provided
    
    const correctAnswer = question.correct_answer;

    switch (question.question_type) {
      case 'single_choice':
      case 'true_false':
        // Convert both to strings for comparison (handles index-based answers)
        return String(userAnswer) === String(correctAnswer);

      case 'short_answer':
        // Case-insensitive comparison for text answers
        return String(userAnswer).trim().toLowerCase() === String(correctAnswer).trim().toLowerCase();

      case 'multiple_choice':
        // For multiple choice, compare arrays
        try {
          let correctAnswers = correctAnswer;
          let userAnswers = userAnswer;
          
          // Parse if strings
          if (typeof correctAnswer === 'string') {
            correctAnswers = correctAnswer.includes(',') 
              ? correctAnswer.split(',').map(a => a.trim())
              : JSON.parse(correctAnswer);
          }
          
          if (typeof userAnswer === 'string') {
            userAnswers = userAnswer.includes(',')
              ? userAnswer.split(',').map(a => a.trim())
              : JSON.parse(userAnswer);
          }
          
          if (!Array.isArray(correctAnswers) || !Array.isArray(userAnswers)) {
            return false;
          }
          
          if (correctAnswers.length !== userAnswers.length) return false;
          
          // Convert to strings for comparison
          const correctSet = correctAnswers.map(a => String(a).trim()).sort();
          const userSet = userAnswers.map(a => String(a).trim()).sort();
          
          return correctSet.every((ans, idx) => ans === userSet[idx]);
        } catch (e) {
          console.error('Error checking multiple choice answer:', e);
          return false;
        }

      case 'code_writing':
        // Simple check - in production, use code execution engine
        return String(userAnswer).trim().toLowerCase().includes(String(correctAnswer).toLowerCase());

      case 'matching':
        try {
          const correctMatching = typeof correctAnswer === 'string' 
            ? JSON.parse(correctAnswer) 
            : correctAnswer;
          const userMatching = typeof userAnswer === 'string'
            ? JSON.parse(userAnswer)
            : userAnswer;
          
          return JSON.stringify(correctMatching) === JSON.stringify(userMatching);
        } catch (e) {
          console.error('Error checking matching answer:', e);
          return false;
        }

      default:
        return false;
    }
  }

  // Reorder questions
  static async reorder(testId, questionOrders) {
    // questionOrders is an array like [{id: 1, order: 1}, {id: 2, order: 2}, ...]
    for (const item of questionOrders) {
      await database.run(
        'UPDATE questions SET order_number = ? WHERE id = ? AND test_id = ?',
        [item.order, item.id, testId]
      );
    }
  }
}

module.exports = Question;
