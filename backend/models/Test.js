const database = require('../config/database');

class Test {
  // Create new test
  static async create(testData) {
    const {
      title,
      description,
      subject,
      lesson_id = null,
      duration,
      difficulty = 'medium',
      passing_score = 60,
      created_by
    } = testData;

    const sql = `
      INSERT INTO tests (
        title, description, subject, lesson_id, duration, difficulty, 
        passing_score, created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await database.run(sql, [
      title,
      description,
      subject,
      lesson_id,
      duration,
      difficulty,
      passing_score,
      created_by
    ]);

    return result.id;
  }

  // Get test by ID
  static async findById(id) {
    const sql = `
      SELECT 
        t.*,
        t.duration as time_limit,
        u.username as creator_username,
        u.full_name as creator_name,
        l.title as lesson_title,
        l.grade as lesson_grade,
        (SELECT COUNT(*) FROM questions q WHERE q.test_id = t.id) as questions_count
      FROM tests t
      LEFT JOIN users u ON t.created_by = u.id
      LEFT JOIN lessons l ON t.lesson_id = l.id
      WHERE t.id = ?
    `;
    return await database.get(sql, [id]);
  }

  // Get all tests
  static async getAll(filters = {}) {
    let sql = `
      SELECT 
        t.*,
        u.username as creator_username,
        u.full_name as creator_name,
        u.district as creator_district,
        u.school_number as creator_school,
        u.teaching_classes as creator_classes,
        (SELECT COUNT(*) FROM results r WHERE r.test_id = t.id) as total_attempts,
        (SELECT AVG(r2.percentage) FROM results r2 WHERE r2.test_id = t.id) as average_score,
        (SELECT COUNT(*) FROM questions q WHERE q.test_id = t.id) as questions_count,
        t.duration as time_limit
      FROM tests t
      LEFT JOIN users u ON t.created_by = u.id
    `;

    const conditions = [];
    const params = [];

    if (filters.subject) {
      conditions.push('t.subject = ?');
      params.push(filters.subject);
    }

    if (filters.difficulty) {
      conditions.push('t.difficulty = ?');
      params.push(filters.difficulty);
    }

    if (filters.is_published !== undefined) {
      conditions.push('t.is_published = ?');
      params.push(filters.is_published ? true : false);
    }

    if (filters.created_by) {
      conditions.push('t.created_by = ?');
      params.push(filters.created_by);
    }

    // Filter for students - only see tests from their school and class
    if (filters.student_district && filters.student_school && filters.student_class) {
      conditions.push('u.district = ?');
      params.push(filters.student_district);
      
      conditions.push('u.school_number = ?');
      params.push(filters.student_school);
      
      // Check if student's class is in teacher's teaching_classes
      // Using LIKE to match comma-separated values
      conditions.push('(u.teaching_classes LIKE ? OR u.teaching_classes LIKE ? OR u.teaching_classes LIKE ? OR u.teaching_classes = ?)');
      params.push(`%${filters.student_class},%`); // At the beginning or middle
      params.push(`%,${filters.student_class}%`); // In the middle or end
      params.push(`%,${filters.student_class},%`); // In the middle
      params.push(filters.student_class); // Exact match (only one class)
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY t.created_at DESC';

    return await database.all(sql, params);
  }

  // Get published tests only
  static async getPublished(filters = {}) {
    return await this.getAll({ ...filters, is_published: true });
  }

  // Update test
  static async update(id, updates) {
    const allowedFields = [
      'title', 'description', 'subject', 'duration',
      'difficulty', 'passing_score', 'is_published', 'lesson_id'
    ];

    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(id);
    const sql = `UPDATE tests SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;

    return await database.run(sql, values);
  }

  // Update question count
  static async updateQuestionCount(testId) {
    const countSql = 'SELECT COUNT(*) as count FROM questions WHERE test_id = ?';
    const result = await database.get(countSql, [testId]);

    const updateSql = 'UPDATE tests SET total_questions = ? WHERE id = ?';
    await database.run(updateSql, [result.count, testId]);
  }

  // Publish test
  static async publish(id) {
    const sql = 'UPDATE tests SET is_published = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    return await database.run(sql, [id]);
  }

  // Unpublish test
  static async unpublish(id) {
    const sql = 'UPDATE tests SET is_published = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    return await database.run(sql, [id]);
  }

  // Delete test
  static async delete(id) {
    const sql = 'DELETE FROM tests WHERE id = ?';
    return await database.run(sql, [id]);
  }

  // Get test statistics
  static async getStatistics(testId) {
    const sql = `
      SELECT 
        COUNT(DISTINCT r.user_id) as total_takers,
        COUNT(r.id) as total_attempts,
        AVG(r.percentage) as average_score,
        MAX(r.percentage) as highest_score,
        MIN(r.percentage) as lowest_score,
        SUM(CASE WHEN r.passed = TRUE THEN 1 ELSE 0 END) as total_passed,
        AVG(r.time_taken) as average_time
      FROM results r
      WHERE r.test_id = ?
    `;

    return await database.get(sql, [testId]);
  }

  // Get recent test attempts
  static async getRecentAttempts(testId, limit = 10) {
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
      LIMIT ?
    `;

    return await database.all(sql, [testId, limit]);
  }
}

module.exports = Test;
