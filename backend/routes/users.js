const express = require('express');
const User = require('../models/User');
const database = require('../config/database');
const { authenticateToken, isAdmin, isTeacherOrAdmin } = require('../middleware/auth');

const router = express.Router();

// Get all users (admin only)
router.get('/', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { role } = req.query;
    const users = await User.getAll(role);
    res.json({ users, count: users.length });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Get students (for teachers - filtered by school and classes)
router.get('/students/list', authenticateToken, isTeacherOrAdmin, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    
    let students;
    
    if (currentUser.role === 'teacher') {
      // Teacher sees only students from their school and classes
      const teaching_classes = currentUser.teaching_classes 
        ? currentUser.teaching_classes.split(',').map(c => c.trim())
        : [];
      
      students = await User.getStudentsBySchool(
        currentUser.district,
        currentUser.school_number,
        teaching_classes
      );
    } else if (currentUser.role === 'admin') {
      // Admin sees all students
      students = await User.getAll('student');
    }
    
    res.json(students);
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ error: 'Failed to get students' });
  }
});

// Get user by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Users can only view their own profile, unless they're teacher/admin
    if (req.user.id !== parseInt(id) && req.user.role === 'student') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Get leaderboard (filtered by school for students and teachers)
router.get('/leaderboard/top', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 200;
    const user = await User.findById(req.user.id);
    
    let leaderboard;
    
    // O'quvchi va o'qituvchi — faqat o'z maktabi, admin — hammasi
    if ((user.role === 'student' || user.role === 'teacher') && user.district && user.school_number) {
      leaderboard = await User.getLeaderboard(limit, user.district, user.school_number);
    } else {
      leaderboard = await User.getLeaderboard(limit);
    }
    
    res.json(leaderboard);
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// Block/Unblock user (admin only)
router.patch('/:id/block', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.id === parseInt(id)) {
      return res.status(400).json({ error: 'O\'zingizni bloklashingiz mumkin emas' });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });

    const currentStatus = user.is_blocked || false;
    await database.run('UPDATE users SET is_blocked = ? WHERE id = ?', [!currentStatus, id]);

    res.json({
      message: !currentStatus ? 'Foydalanuvchi BLOKLANDI' : 'Blok olib tashlandi',
      is_blocked: !currentStatus
    });
  } catch (err) {
    res.status(500).json({ error: 'Xatolik: ' + err.message });
  }
});

// Reset user password (admin only)
router.patch('/:id/reset-password', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { new_password } = req.body;

    if (!new_password || new_password.length < 4) {
      return res.status(400).json({ error: 'Parol kamida 4 belgidan iborat bo\'lishi kerak' });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });

    await User.updatePassword(id, new_password);

    res.json({ message: `${user.full_name} paroli yangilandi` });
  } catch (err) {
    res.status(500).json({ error: 'Xatolik: ' + err.message });
  }
});

// Delete user (admin only)
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Cannot delete yourself
    if (req.user.id === parseInt(id)) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await User.delete(id);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ─── POST /api/users/upload-excel — Excel'dan foydalanuvchilar import (admin only) ───
const multerExcelUsers = require('multer')({ storage: require('multer').memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/upload-excel', authenticateToken, isAdmin, multerExcelUsers.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Excel fayl yuklanmadi' });

    const XLSX = require('xlsx');
    const bcrypt = require('bcryptjs');
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (rawRows.length < 2) return res.status(400).json({ error: 'Excel faylda ma\'lumot topilmadi (kamida 2 qator kerak: sarlavha + ma\'lumot)' });

    // Sarlavha: login | parol | ism | rol | tuman | maktab | sinf | email
    const header = rawRows[0].map(h => String(h || '').toLowerCase().trim());
    const usernameIdx = header.findIndex(h => h.includes('login') || h.includes('username') || h.includes('foydalanuvchi'));
    const passwordIdx = header.findIndex(h => h.includes('parol') || h.includes('password'));
    const fullNameIdx = header.findIndex(h => h.includes('ism') || h.includes('name') || h.includes('f.i.o') || h.includes('fio'));
    const roleIdx = header.findIndex(h => h.includes('rol') || h.includes('role'));
    const districtIdx = header.findIndex(h => h.includes('tuman') || h.includes('district'));
    const schoolIdx = header.findIndex(h => h.includes('maktab') || h.includes('school'));
    const classIdx = header.findIndex(h => h.includes('sinf') || h.includes('class'));
    const emailIdx = header.findIndex(h => h.includes('email') || h.includes('pochta'));

    if (usernameIdx === -1 || passwordIdx === -1 || fullNameIdx === -1) {
      return res.status(400).json({
        error: 'Excel sarlavhasida "login", "parol", "ism" ustunlari topilmadi',
        hint: 'Excel birinchi qatorida kamida: login | parol | ism ustunlari bo\'lishi kerak. Qo\'shimcha: rol | tuman | maktab | sinf | email'
      });
    }

    const imported = [];
    const errors = [];

    for (let i = 1; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!row || row.length === 0) continue;

      const username = String(row[usernameIdx] || '').trim();
      const password = String(row[passwordIdx] || '').trim();
      const full_name = String(row[fullNameIdx] || '').trim();
      const role = roleIdx >= 0 ? String(row[roleIdx] || 'student').trim().toLowerCase() : 'student';
      const district = districtIdx >= 0 ? String(row[districtIdx] || '').trim() : '';
      const school_number = schoolIdx >= 0 ? String(row[schoolIdx] || '').trim() : '';
      const class_name = classIdx >= 0 ? String(row[classIdx] || '').trim() : '';
      const email = emailIdx >= 0 ? String(row[emailIdx] || '').trim() : `${username}@infobaho.uz`;

      if (!username || !password || !full_name) {
        errors.push(`${i + 1}-qator: login, parol yoki ism bo'sh`);
        continue;
      }
      if (username.length < 3) { errors.push(`${i + 1}-qator: login kamida 3 belgi`); continue; }
      if (password.length < 6) { errors.push(`${i + 1}-qator: parol kamida 6 belgi`); continue; }

      const validRoles = ['student', 'teacher'];
      const userRole = validRoles.includes(role) ? role : 'student';

      try {
        // Mavjud tekshiruv
        const existingUser = await User.findByUsername(username);
        if (existingUser) { errors.push(`${i + 1}-qator: "${username}" allaqachon mavjud`); continue; }

        const existingEmail = await User.findByEmail(email);
        if (existingEmail) { errors.push(`${i + 1}-qator: "${email}" allaqachon mavjud`); continue; }

        await User.create({
          username, password, full_name, email,
          role: userRole, district, school_number, class_name
        });
        imported.push({ username, full_name, role: userRole });
      } catch (err) {
        errors.push(`${i + 1}-qator: ${err.message}`);
      }
    }

    res.json({
      message: `${imported.length} ta foydalanuvchi import qilindi`,
      imported: imported.length,
      errors: errors.length > 0 ? errors : null,
      total_rows: rawRows.length - 1
    });
  } catch (err) {
    console.error('Users upload-excel error:', err);
    res.status(500).json({ error: 'Excel import qilishda xatolik: ' + err.message });
  }
});

module.exports = router;
