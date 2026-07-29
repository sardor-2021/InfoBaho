const database = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
  // Create new user
  static async create(userData) {
    const { 
      username, 
      email, 
      password, 
      full_name, 
      role = 'student', 
      bio = '',
      district = '',
      school_number = '',
      class_name = '',
      teaching_classes = ''
    } = userData;
    
    console.log('🔷 Creating user:', { username, email, role });
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const sql = `
      INSERT INTO users (username, email, password, full_name, role, bio, district, school_number, class_name, teaching_classes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    try {
      const result = await database.run(sql, [
        username,
        email,
        hashedPassword,
        full_name,
        role,
        bio,
        district,
        school_number,
        class_name,
        teaching_classes
      ]);
      
      console.log('✅ User created with ID:', result.id);
      
      // Create initial statistics for user
      await database.run(
        'INSERT INTO statistics (user_id) VALUES (?)',
        [result.id]
      );
      
      return result.id;
    } catch (error) {
      console.error('❌ User creation failed:', error.message);
      throw error; // Re-throw to be caught by auth route
    }
  }

  // Find user by ID
  static async findById(id) {
    const sql = 'SELECT id, username, email, full_name, role, avatar, points, level, mastery_percent, bio, district, school_number, class_name, teaching_classes, is_blocked, created_at FROM users WHERE id = ?';
    return await database.get(sql, [id]);
  }

  // Find user by username
  static async findByUsername(username) {
    const sql = 'SELECT * FROM users WHERE username = ?';
    return await database.get(sql, [username]);
  }

  // Find user by email
  static async findByEmail(email) {
    const sql = 'SELECT * FROM users WHERE email = ?';
    return await database.get(sql, [email]);
  }

  // Verify password
  static async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  // Get all users (admin only)
  static async getAll(role = null) {
    let sql = 'SELECT id, username, email, full_name, role, avatar, points, level, district, school_number, class_name, teaching_classes, is_blocked, created_at FROM users';
    const params = [];
    
    if (role) {
      sql += ' WHERE role = ?';
      params.push(role);
    }
    
    sql += ' ORDER BY created_at DESC';
    return await database.all(sql, params);
  }

  // Update user profile
  static async update(id, updates) {
    const allowedFields = [
      'full_name', 
      'email', 
      'avatar', 
      'bio', 
      'district', 
      'school_number', 
      'class_name', 
      'teaching_classes'
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
    const sql = `UPDATE users SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    
    return await database.run(sql, values);
  }

  // Update password
  static async updatePassword(id, newPassword) {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const sql = 'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    return await database.run(sql, [hashedPassword, id]);
  }

  // Add points to user (faqat points oshadi, level ENDI bu yerda o'zgarmaydi)
  static async addPoints(userId, points) {
    const sql = `
      UPDATE users 
      SET points = points + ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    return await database.run(sql, [points, userId]);
  }

  // Daraja tizimi — foiz asosida hisoblash (hysteresis bilan)
  static async updateMasteryLevel(studentId) {
    const LessonProgress = require('./LessonProgress');

    const user = await database.get('SELECT class_name, level, bonus_points, district, school_number FROM users WHERE id = ?', [studentId]);
    if (!user) return;

    // O'quvchi sinfidan grade ni ajratib olish (masalan "9-A" → 9)
    const gradeNum = parseInt((user.class_name || '').match(/\d+/)?.[0]) || null;
    if (!gradeNum) return;

    const stats = await LessonProgress.getMasteryStats(studentId, gradeNum, user.district, user.school_number);

    if (stats.totalPossible === 0) {
      // Hali birorta ham dars o'tilmagan — daraja hisoblanmaydi
      await database.run('UPDATE users SET mastery_percent = 0 WHERE id = ?', [studentId]);
      return;
    }

    const percent = ((stats.totalEarned + (user.bonus_points || 0)) / stats.totalPossible) * 100;

    // Daraja chegaralari
    const BANDS = [
      { level: 1, min: 0 },
      { level: 2, min: 41 },
      { level: 3, min: 66 },
      { level: 4, min: 91 },
      { level: 5, min: 100.0001 }  // faqat 100% dan oshganda (bonus orqali)
    ];
    const BUFFER = 5; // foiz — faqat pastga tushishda qo'llanadi

    // Hozirgi darajaning quyi chegarasini topish
    const currentBand = BANDS.find(b => b.level === (user.level || 1)) || BANDS[0];
    let newLevel = 1;

    // Yuqoriga — darhol
    for (const band of [...BANDS].reverse()) {
      if (percent >= band.min) { newLevel = band.level; break; }
    }

    // Agar bu PASTGA tushish bo'lsa — faqat bufer bilan tasdiqlansa amalga oshir
    if (newLevel < (user.level || 1)) {
      const stillInCurrentBandWithBuffer = percent >= (currentBand.min - BUFFER);
      if (stillInCurrentBandWithBuffer) newLevel = user.level; // hali o'zgarmasin
    }

    await database.run(
      'UPDATE users SET mastery_percent = ?, level = ? WHERE id = ?',
      [percent.toFixed(1), newLevel, studentId]
    );
  }

  // Get leaderboard (filtered by school)
  static async getLeaderboard(limit = 10, district = null, school_number = null) {
    let sql = `
      SELECT 
        u.id, u.username, u.full_name, u.avatar, u.points, u.level,
        u.mastery_percent, u.district, u.school_number, u.class_name,
        s.total_tests_taken, s.average_score
      FROM users u
      LEFT JOIN statistics s ON u.id = s.user_id
      WHERE u.role = 'student'
    `;
    const params = [];

    if (district && school_number) {
      sql += ' AND u.district = ? AND u.school_number = ?';
      params.push(district, school_number);
    }

    sql += ' ORDER BY u.mastery_percent DESC, u.points DESC LIMIT ?';
    params.push(limit);

    return await database.all(sql, params);
  }

  // Get students by district, school, and classes (for teachers)
  static async getStudentsBySchool(district, school_number, teaching_classes = null) {
    let sql = `
      SELECT 
        u.id, u.username, u.full_name, u.avatar, u.points, u.level,
        u.mastery_percent, u.class_name, u.district, u.school_number,
        s.total_tests_taken, s.average_score
      FROM users u
      LEFT JOIN statistics s ON u.id = s.user_id
      WHERE u.role = 'student' AND u.district = ? AND u.school_number = ?
    `;
    const params = [district, school_number];

    if (teaching_classes && teaching_classes.length > 0) {
      const placeholders = teaching_classes.map(() => '?').join(',');
      sql += ` AND u.class_name IN (${placeholders})`;
      params.push(...teaching_classes);
    }

    sql += ' ORDER BY u.points DESC';
    return await database.all(sql, params);
  }

  // Delete user
  static async delete(id) {
    const sql = 'DELETE FROM users WHERE id = ?';
    return await database.run(sql, [id]);
  }

  // Check if username exists
  static async usernameExists(username) {
    const user = await this.findByUsername(username);
    return !!user;
  }

  // Check if email exists
  static async emailExists(email) {
    const user = await this.findByEmail(email);
    return !!user;
  }
}

module.exports = User;
