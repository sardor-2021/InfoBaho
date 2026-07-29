const database = require('../config/database');

class Assignment {
  // ─── CRUD ─────────────────────────────────────────────────────

  static async create(data) {
    const {
      lesson_id, created_by, title, description,
      task_type, instructions, max_score = 100,
      deadline = null, ai_generated = false, is_published = false
    } = data;

    const result = await database.run(`
      INSERT INTO assignments
        (lesson_id, created_by, title, description, task_type, instructions, max_score, deadline, ai_generated, is_published)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [lesson_id, created_by, title, description, task_type, instructions, max_score, deadline, ai_generated, is_published]);

    return result.id;
  }

  static async findById(id) {
    const assignment = await database.get(`
      SELECT a.*,
        u.full_name as creator_name,
        (SELECT COUNT(*) FROM assignment_submissions WHERE assignment_id = a.id) as submissions_count,
        (SELECT COUNT(*) FROM assignment_submissions WHERE assignment_id = a.id AND status = 'graded') as graded_count
      FROM assignments a
      LEFT JOIN users u ON a.created_by = u.id
      WHERE a.id = ?
    `, [id]);
    return assignment;
  }

  static async getByLesson(lesson_id, student_id = null) {
    let whereClause = 'WHERE a.lesson_id = ?';
    const params = [lesson_id];

    // O'quvchi faqat e'lon qilingan topshiriqlarni ko'radi
    if (student_id) {
      whereClause += ' AND a.is_published = TRUE';
    }

    const rows = await database.all(`
      SELECT a.*,
        u.full_name as creator_name,
        (SELECT COUNT(*) FROM assignment_submissions WHERE assignment_id = a.id) as submissions_count,
        (SELECT COUNT(*) FROM assignment_submissions WHERE assignment_id = a.id AND status = 'graded') as graded_count
      FROM assignments a
      LEFT JOIN users u ON a.created_by = u.id
      ${whereClause}
      ORDER BY a.created_at ASC
    `, params);

    // If student_id provided, attach their submission status
    if (student_id) {
      for (const row of rows) {
        row.my_submission = await database.get(
          `SELECT id, status, score, feedback, graded_by, submitted_at, file_name
           FROM assignment_submissions
           WHERE assignment_id = ? AND student_id = ?`,
          [row.id, student_id]
        ) || null;
      }
    }

    return rows;
  }

  static async update(id, data) {
    const allowed = ['title','description','task_type','instructions','max_score','deadline'];
    const fields = [], values = [];
    for (const [k, v] of Object.entries(data)) {
      if (allowed.includes(k)) { fields.push(`${k} = ?`); values.push(v); }
    }
    if (!fields.length) return;
    values.push(id);
    await database.run(
      `UPDATE assignments SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );
  }

  static async delete(id) {
    await database.run('DELETE FROM assignments WHERE id = ?', [id]);
  }

  // ─── Submissions ──────────────────────────────────────────────

  static async submitFile(data) {
    const { assignment_id, student_id, file_name, file_path, file_size } = data;

    // Upsert: agar avvalgi topshirma bo'lsa yangilash
    const existing = await database.get(
      'SELECT id FROM assignment_submissions WHERE assignment_id = ? AND student_id = ?',
      [assignment_id, student_id]
    );

    if (existing) {
      await database.run(`
        UPDATE assignment_submissions
        SET file_name=?, file_path=?, file_size=?, submitted_at=NOW(),
            status='submitted', score=NULL, feedback=NULL, graded_by=NULL, graded_at=NULL, ai_report=NULL
        WHERE assignment_id=? AND student_id=?
      `, [file_name, file_path, file_size, assignment_id, student_id]);
      return existing.id;
    }

    const result = await database.run(`
      INSERT INTO assignment_submissions
        (assignment_id, student_id, file_name, file_path, file_size)
      VALUES (?, ?, ?, ?, ?)
    `, [assignment_id, student_id, file_name, file_path, file_size]);
    return result.id;
  }

  static async getSubmission(assignment_id, student_id) {
    return await database.get(
      'SELECT * FROM assignment_submissions WHERE assignment_id = ? AND student_id = ?',
      [assignment_id, student_id]
    );
  }

  static async getAllSubmissions(assignment_id) {
    return await database.all(`
      SELECT s.*,
        u.full_name as student_name,
        u.username,
        u.class_name
      FROM assignment_submissions s
      LEFT JOIN users u ON s.student_id = u.id
      WHERE s.assignment_id = ?
      ORDER BY s.submitted_at DESC
    `, [assignment_id]);
  }

  static async gradeSubmission(submission_id, { score, feedback, graded_by, ai_report = null }) {
    await database.run(`
      UPDATE assignment_submissions
      SET score=?, feedback=?, graded_by=?, ai_report=?,
          status='graded', graded_at=NOW()
      WHERE id=?
    `, [score, feedback, graded_by, ai_report, submission_id]);
  }

  static async getSubmissionById(id) {
    return await database.get(
      `SELECT s.*, u.full_name as student_name, u.class_name,
              a.title as assignment_title, a.max_score, a.task_type
       FROM assignment_submissions s
       LEFT JOIN users u ON s.student_id = u.id
       LEFT JOIN assignments a ON s.assignment_id = a.id
       WHERE s.id = ?`,
      [id]
    );
  }
}

module.exports = Assignment;
