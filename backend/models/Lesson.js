const database = require('../config/database');

class Lesson {
  // Create new lesson
  static async create(lessonData) {
    const { title, description, grade, subject, content, created_by } = lessonData;
    
    const result = await database.run(`
      INSERT INTO lessons (title, description, grade, subject, content, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [title, description, grade, subject, content, created_by]);
    
    return result.id;
  }

  // Get lesson by ID with materials (student_id berilsa — har testda my_attempt qo'shiladi)
  static async findById(id, student_id = null) {
    const lesson = await database.get(
      'SELECT * FROM lessons WHERE id = ?',
      [id]
    );

    if (lesson) {
      lesson.materials = await database.all(
        'SELECT * FROM lesson_materials WHERE lesson_id = ? ORDER BY uploaded_at DESC',
        [id]
      );
      lesson.creator = await database.get(
        'SELECT id, username, full_name FROM users WHERE id = ?',
        [lesson.created_by]
      );
      lesson.tests = await database.all(
        `SELECT t.*, t.duration as time_limit,
          (SELECT COUNT(*) FROM questions WHERE test_id = t.id) as questions_count,
          (SELECT COUNT(*) FROM results WHERE test_id = t.id) as attempts_count
         FROM tests t 
         WHERE t.lesson_id = ?
         ORDER BY t.created_at DESC`,
        [id]
      );

      // O'quvchi uchun har bir testda topshirganmi tekshiruvi
      if (student_id) {
        for (const test of lesson.tests) {
          const attempt = await database.get(
            `SELECT r.id, r.percentage, r.correct_answers, r.total_questions, r.created_at
             FROM results r
             WHERE r.test_id = ? AND r.user_id = ?
             ORDER BY r.created_at DESC LIMIT 1`,
            [test.id, student_id]
          );
          test.my_attempt = attempt || null;
          test.already_attempted = !!attempt;
        }
      }

      lesson.tests_all = lesson.tests;
      lesson.tests_published = lesson.tests.filter(t => t.is_published);
    }

    return lesson;
  }

  // Get all lessons with optional filters
  static async getAll(filters = {}) {
    let query = `
      SELECT l.*,
        u.full_name as creator_name,
        (SELECT COUNT(*) FROM lesson_materials WHERE lesson_id = l.id) as materials_count,
        (SELECT COUNT(*) FROM tests WHERE lesson_id = l.id AND is_published = TRUE) as tests_count
      FROM lessons l
      LEFT JOIN users u ON l.created_by = u.id
      WHERE 1=1
    `;
    
    const params = [];

    if (filters.grade) {
      query += ' AND l.grade = ?';
      params.push(filters.grade);
    }

    if (filters.subject) {
      query += ' AND l.subject LIKE ?';
      params.push(`%${filters.subject}%`);
    }

    if (filters.created_by) {
      query += ' AND l.created_by = ?';
      params.push(filters.created_by);
    }

    if (filters.search) {
      query += ' AND (l.title LIKE ? OR l.description LIKE ?)';
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    query += ' ORDER BY l.created_at ASC';

    const lessons = await database.all(query, params);
    return lessons;
  }

  // Get lessons for specific grade (for students)
  static async getByGrade(grade, teacherDistrict, teacherSchool, teacherClasses) {
    let lessons;
    if (teacherDistrict && teacherSchool) {
      lessons = await database.all(`
        SELECT l.*,
          u.full_name as creator_name,
          (SELECT COUNT(*) FROM lesson_materials WHERE lesson_id = l.id) as materials_count,
          (SELECT COUNT(*) FROM tests WHERE lesson_id = l.id AND is_published = TRUE) as tests_count
        FROM lessons l
        LEFT JOIN users u ON l.created_by = u.id
        WHERE l.grade = ?
          AND u.district = ?
          AND u.school_number = ?
        ORDER BY l.subject ASC, l.created_at ASC
      `, [grade, teacherDistrict, teacherSchool]);
    } else {
      lessons = await database.all(`
        SELECT l.*,
          u.full_name as creator_name,
          (SELECT COUNT(*) FROM lesson_materials WHERE lesson_id = l.id) as materials_count,
          (SELECT COUNT(*) FROM tests WHERE lesson_id = l.id AND is_published = TRUE) as tests_count
        FROM lessons l
        LEFT JOIN users u ON l.created_by = u.id
        WHERE l.grade = ?
        ORDER BY l.subject ASC, l.created_at ASC
      `, [grade]);
    }

    // Ketma-ket ochilish endi HAR BIR FAN uchun ALOHIDA zanjir hisoblanadi.
    // Bitta fanning o'tilmagan darsi boshqa fanning darslarini qulflamaydi.
    const bySubject = {};
    for (const l of lessons) {
      if (!bySubject[l.subject]) bySubject[l.subject] = [];
      bySubject[l.subject].push(l);
    }

    const visibleLessons = [];
    for (const subject in bySubject) {
      const chain = bySubject[subject];
      for (let i = 0; i < chain.length; i++) {
        if (i === 0 || chain[i - 1].taught_at) {
          visibleLessons.push(chain[i]);
        } else {
          break;
        }
      }
    }

    // Asl tartibni saqlash uchun created_at bo'yicha qayta saralash
    visibleLessons.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    return visibleLessons;
  }

  // Update lesson
  static async update(id, updates) {
    const fields = [];
    const params = [];

    if (updates.title !== undefined) {
      fields.push('title = ?');
      params.push(updates.title);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      params.push(updates.description);
    }
    if (updates.subject !== undefined) {
      fields.push('subject = ?');
      params.push(updates.subject);
    }
    if (updates.content !== undefined) {
      fields.push('content = ?');
      params.push(updates.content);
    }

    if (fields.length === 0) return;

    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    await database.run(
      `UPDATE lessons SET ${fields.join(', ')} WHERE id = ?`,
      params
    );
  }

  // Delete lesson
  static async delete(id) {
    // Delete associated materials first (cascade should handle this, but explicit is better)
    await database.run('DELETE FROM lesson_materials WHERE lesson_id = ?', [id]);
    
    // Update tests to remove lesson reference
    await database.run('UPDATE tests SET lesson_id = NULL WHERE lesson_id = ?', [id]);
    
    // Delete lesson
    await database.run('DELETE FROM lessons WHERE id = ?', [id]);
  }

  // Add material to lesson
  static async addMaterial(materialData) {
    const { lesson_id, file_name, file_path, file_type, file_size } = materialData;
    
    const result = await database.run(`
      INSERT INTO lesson_materials (lesson_id, file_name, file_path, file_type, file_size)
      VALUES (?, ?, ?, ?, ?)
    `, [lesson_id, file_name, file_path, file_type, file_size]);
    
    return result.id;
  }

  // Get materials for lesson
  static async getMaterials(lessonId) {
    return await database.all(
      'SELECT * FROM lesson_materials WHERE lesson_id = ? ORDER BY uploaded_at DESC',
      [lessonId]
    );
  }

  // Delete material
  static async deleteMaterial(materialId) {
    await database.run('DELETE FROM lesson_materials WHERE id = ?', [materialId]);
  }

  // Get material by ID
  static async getMaterialById(id) {
    return await database.get(
      'SELECT * FROM lesson_materials WHERE id = ?',
      [id]
    );
  }
}

module.exports = Lesson;
