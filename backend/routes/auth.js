const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const database = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { loginLimiter, registerLimiter, forgotPasswordLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Generate JWT token
const generateToken = (userId) => {
  const secret = process.env.JWT_SECRET || 'infotest-default-secret-key-change-in-production';
  return jwt.sign(
    { userId },
    secret,
    { expiresIn: '7d' }
  );
};

// Register new user
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { 
      username, 
      email, 
      password, 
      full_name, 
      role, 
      district, 
      school_number, 
      class_name, 
      teaching_classes 
    } = req.body;

    // Basic validation
    if (!username || !email || !password || !full_name) {
      return res.status(400).json({ 
        error: 'Barcha asosiy maydonlar to\'ldirilishi kerak',
        fields: ['username', 'email', 'password', 'full_name']
      });
    }

    // Username validation
    if (username.length < 3) {
      return res.status(400).json({ error: 'Login kamida 3 belgidan iborat bo\'lishi kerak' });
    }

    // Password validation
    if (password.length < 6) {
      return res.status(400).json({ error: 'Parol kamida 6 belgidan iborat bo\'lishi kerak' });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Noto\'g\'ri email formati' });
    }

    // Check if username already exists
    if (await User.usernameExists(username)) {
      return res.status(400).json({ error: 'Bu login allaqachon band' });
    }

    // Check if email already exists
    if (await User.emailExists(email)) {
      return res.status(400).json({ error: 'Bu email allaqachon ro\'yxatdan o\'tgan' });
    }

    // Validate role — admin faqat mavjud admin tomonidan yaratilishi mumkin
    const validRoles = ['student', 'teacher'];
    const userRole = role || 'student';
    if (!validRoles.includes(userRole)) {
      return res.status(400).json({ error: 'Noto\'g\'ri rol. Faqat student yoki teacher tanlash mumkin.' });
    }

    // Validate district and school
    if (!district || !school_number) {
      return res.status(400).json({ error: 'Tuman va maktab raqami kiritilishi shart' });
    }

    // Role-specific validations
    if (userRole === 'student') {
      if (!class_name) {
        return res.status(400).json({ error: 'O\'quvchi uchun sinf kiritilishi shart' });
      }
    }

    if (userRole === 'teacher') {
      if (!teaching_classes || teaching_classes.trim() === '') {
        return res.status(400).json({ error: 'O\'qituvchi uchun dars o\'tiladigan sinflar kiritilishi shart' });
      }
    }

    // Create user
    const userId = await User.create({
      username,
      email,
      password,
      full_name,
      role: userRole,
      district: district || '',
      school_number: school_number || '',
      class_name: userRole === 'student' ? (class_name || '') : '',
      teaching_classes: userRole === 'teacher' ? (teaching_classes || '') : ''
    });

    // Generate token
    const token = generateToken(userId);

    // Get user data (without password)
    const user = await User.findById(userId);

    res.status(201).json({
      message: 'Ro\'yxatdan o\'tish muvaffaqiyatli amalga oshirildi',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        points: user.points,
        level: user.level,
        mastery_percent: user.mastery_percent || 0,
        district: user.district,
        school_number: user.school_number,
        class_name: user.class_name,
        teaching_classes: user.teaching_classes
      }
    });

  } catch (error) {
    console.error('❌ Registration error:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    
    // Handle SQLite UNIQUE constraint violation
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      if (error.message.includes('username')) {
        return res.status(400).json({ error: 'Bu login allaqachon band' });
      }
      if (error.message.includes('email')) {
        return res.status(400).json({ error: 'Bu email allaqachon ro\'yxatdan o\'tgan' });
      }
      return res.status(400).json({ error: 'Bu login yoki email allaqachon mavjud' });
    }
    
    res.status(500).json({ error: 'Ro\'yxatdan o\'tish amalga oshmadi', details: error.message });
  }
});

// Login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    console.log('Login attempt:', { username: req.body.username });
    
    const { username, password } = req.body;

    // Validation
    if (!username || !password) {
      console.log('Login validation failed: missing fields');
      return res.status(400).json({ error: 'Username and password are required' });
    }

    console.log('Finding user...');
    // Find user
    const user = await User.findByUsername(username);
    console.log('User found:', user ? 'yes' : 'no');
    
    if (!user) {
      console.log('User not found');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('Verifying password...');
    // Verify password
    const isValidPassword = await User.verifyPassword(password, user.password);
    console.log('Password valid:', isValidPassword);
    
    if (!isValidPassword) {
      console.log('Invalid password');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Bloklangan tekshirish
    if (user.is_blocked) {
      return res.status(403).json({ error: 'Sizning hisobingiz bloklangan. Administrator bilan bog\'laning.' });
    }

    console.log('Generating token...');
    // Generate token
    const token = generateToken(user.id);
    console.log('Login successful for user:', user.username);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        avatar: user.avatar,
        points: user.points,
        level: user.level,
        mastery_percent: user.mastery_percent || 0,
        bio: user.bio,
        district: user.district,
        school_number: user.school_number,
        class_name: user.class_name,
        teaching_classes: user.teaching_classes
      }
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Login failed', details: error.message, stack: process.env.NODE_ENV === 'development' ? error.stack : undefined });
  }
});

// Get current user (verify token)
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        avatar: user.avatar,
        points: user.points,
        level: user.level,
        mastery_percent: user.mastery_percent || 0,
        bio: user.bio,
        district: user.district,
        school_number: user.school_number,
        class_name: user.class_name,
        teaching_classes: user.teaching_classes,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user data' });
  }
});

// Update profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { 
      full_name, 
      email, 
      bio, 
      district, 
      school_number, 
      class_name, 
      teaching_classes 
    } = req.body;
    
    const updates = {};

    if (full_name) updates.full_name = full_name;
    if (email) {
      // Check if email is already taken by another user
      const existingUser = await User.findByEmail(email);
      if (existingUser && existingUser.id !== req.user.id) {
        return res.status(400).json({ error: 'Email already in use' });
      }
      updates.email = email;
    }
    if (bio !== undefined) updates.bio = bio;
    
    // School information updates
    if (district !== undefined) updates.district = district;
    if (school_number !== undefined) updates.school_number = school_number;
    if (class_name !== undefined) updates.class_name = class_name;
    if (teaching_classes !== undefined) updates.teaching_classes = teaching_classes;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    await User.update(req.user.id, updates);

    const updatedUser = await User.findById(req.user.id);

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        full_name: updatedUser.full_name,
        role: updatedUser.role,
        avatar: updatedUser.avatar,
        points: updatedUser.points,
        level: updatedUser.level,
        mastery_percent: updatedUser.mastery_percent || 0,
        bio: updatedUser.bio,
        district: updatedUser.district,
        school_number: updatedUser.school_number,
        class_name: updatedUser.class_name,
        teaching_classes: updatedUser.teaching_classes,
        created_at: updatedUser.created_at
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Check if username is available
router.post('/check-username', async (req, res) => {
  try {
    const { username } = req.body;

    if (!username || username.length < 3) {
      return res.status(400).json({ 
        available: false, 
        message: 'Login kamida 3 belgidan iborat bo\'lishi kerak' 
      });
    }

    const exists = await User.usernameExists(username);

    if (exists) {
      return res.json({ 
        available: false, 
        message: '❌ Bu login band' 
      });
    }

    res.json({ 
      available: true, 
      message: '✅ Bu login bo\'sh' 
    });
  } catch (error) {
    console.error('Check username error:', error);
    res.status(500).json({ error: 'Failed to check username' });
  }
});

// Check if email is available
router.post('/check-email', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        available: false, 
        message: 'Email kiritilishi shart' 
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        available: false, 
        message: 'Noto\'g\'ri email formati' 
      });
    }

    const exists = await User.emailExists(email);

    if (exists) {
      return res.json({ 
        available: false, 
        message: '❌ Bu pochta ro\'yxatdan o\'tkazilgan' 
      });
    }

    res.json({ 
      available: true, 
      message: '✅ Bu pochta bo\'sh' 
    });
  } catch (error) {
    console.error('Check email error:', error);
    res.status(500).json({ error: 'Failed to check email' });
  }
});

// Change password
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Joriy va yangi parol kiritilishi shart' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Yangi parol kamida 6 belgidan iborat bo\'lishi kerak' });
    }

    // Verify current password
    const user = await database.get('SELECT password FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
    const isValidPassword = await User.verifyPassword(currentPassword, user.password);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Joriy parol noto\'g\'ri' });
    }

    // Update password
    await User.updatePassword(req.user.id, newPassword);

    res.json({ message: 'Parol muvaffaqiyatli o\'zgartirildi' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Parolni o\'zgartirishda xatolik yuz berdi' });
  }
});

// ─── PAROLNI TIKLASH (Forgot Password) ──────────────────────

const crypto = require('crypto');

// Email yuborish (Resend API)
const sendResetEmail = async (email, fullName, resetCode) => {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'InfoBaho <noreply@infobaho.uz>',
        to: [email],
        subject: 'InfoBaho — Parolni tiklash kodi',
        html: `
          <div style="max-width:500px;margin:0 auto;font-family:Arial,sans-serif;background:#0f172a;color:#f1f5f9;padding:2rem;border-radius:16px;">
            <h1 style="text-align:center;background:linear-gradient(135deg,#06b6d4,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:1.5rem;">
              InfoBaho
            </h1>
            <p>Salom, <strong>${fullName}</strong>!</p>
            <p>Parolingizni tiklash uchun quyidagi kodni kiriting:</p>
            <div style="text-align:center;margin:2rem 0;">
              <div style="display:inline-block;background:linear-gradient(135deg,#06b6d4,#8b5cf6);color:white;font-size:2.5rem;font-weight:800;letter-spacing:8px;padding:1rem 2rem;border-radius:12px;">
                ${resetCode}
              </div>
            </div>
            <p style="color:#94a3b8;font-size:0.9rem;">
              ⏰ Kod 15 daqiqa ichida amal qiladi.<br>
              Agar siz bu so'rovni yubormagan bo'lsangiz, ushbu xabarni e'tiborsiz qoldiring.
            </p>
            <hr style="border:none;border-top:1px solid #334155;margin:1.5rem 0;">
            <p style="color:#64748b;font-size:0.75rem;text-align:center;">
              InfoBaho Platform — Informatika fanidan baholash tizimi
            </p>
          </div>
        `
      })
    });

    const data = await response.json();
    if (response.ok) {
      console.log(`✅ Email sent to ${email} via Resend`);
      return true;
    } else {
      console.error('Resend error:', data);
      return false;
    }
  } catch (err) {
    console.error('Email sending error:', err.message);
    return false;
  }
};

// POST /api/auth/forgot-password — email ga kod yuborish
router.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email kiritilishi shart' });
    }

    const user = await User.findByEmail(email);

    if (!user) {
      return res.json({
        message: 'Agar bu email ro\'yxatdan o\'tgan bo\'lsa, parolni tiklash kodi yuborildi.'
      });
    }

    // 6 xonali tasodifiy kod
    const resetCode = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Kodni bazaga saqlash
    await database.run(`
      INSERT INTO password_resets (user_id, email, code, expires_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT (email) DO UPDATE SET
        code = EXCLUDED.code,
        expires_at = EXCLUDED.expires_at,
        used = FALSE,
        created_at = NOW()
    `, [user.id, email, resetCode, expiresAt.toISOString()]);

    // Email yuborish (Resend API)
    const sent = await sendResetEmail(email, user.full_name, resetCode);

    if (!sent) {
      console.log(`🔑 Reset code for ${email}: ${resetCode}`);
    }

    // Hozircha kod response'da ham qaytariladi (keyinchalik olib tashlanadi)
    res.json({
      message: 'Parolni tiklash kodi emailingizga yuborildi. 15 daqiqa ichida kiriting.'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Xatolik yuz berdi. Qaytadan urinib ko\'ring.' });
  }
});

// POST /api/auth/verify-reset-code — kodni tekshirish
router.post('/verify-reset-code', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Email va kod kiritilishi shart' });
    }

    const resetRecord = await database.get(
      'SELECT * FROM password_resets WHERE email = ? AND code = ? AND used = FALSE',
      [email, code]
    );

    if (!resetRecord) {
      return res.status(400).json({ error: 'Noto\'g\'ri kod yoki email' });
    }

    // Muddati o'tganmi tekshirish
    if (new Date(resetRecord.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Kod muddati o\'tgan. Yangi kod so\'rang.' });
    }

    // Tasdiqlash tokeni yaratish (parolni o'zgartirish uchun)
    const resetToken = crypto.randomBytes(32).toString('hex');
    await database.run(
      'UPDATE password_resets SET reset_token = ? WHERE email = ? AND code = ?',
      [resetToken, email, code]
    );

    res.json({
      message: 'Kod tasdiqlandi',
      reset_token: resetToken
    });
  } catch (error) {
    console.error('Verify reset code error:', error);
    res.status(500).json({ error: 'Xatolik yuz berdi' });
  }
});

// POST /api/auth/reset-password — yangi parol o'rnatish
router.post('/reset-password', async (req, res) => {
  try {
    const { email, reset_token, new_password } = req.body;

    if (!email || !reset_token || !new_password) {
      return res.status(400).json({ error: 'Barcha maydonlar to\'ldirilishi shart' });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ error: 'Parol kamida 6 belgidan iborat bo\'lishi kerak' });
    }

    // Token tekshirish
    const resetRecord = await database.get(
      'SELECT * FROM password_resets WHERE email = ? AND reset_token = ? AND used = FALSE',
      [email, reset_token]
    );

    if (!resetRecord) {
      return res.status(400).json({ error: 'Noto\'g\'ri yoki muddati o\'tgan token' });
    }

    if (new Date(resetRecord.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Token muddati o\'tgan. Qaytadan boshlang.' });
    }

    // Parolni yangilash
    await User.updatePassword(resetRecord.user_id, new_password);

    // Tokenni ishlatilgan deb belgilash
    await database.run(
      'UPDATE password_resets SET used = TRUE WHERE email = ?',
      [email]
    );

    res.json({ message: 'Parol muvaffaqiyatli yangilandi! Endi yangi parol bilan kirishingiz mumkin.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Parolni yangilashda xatolik yuz berdi' });
  }
});

module.exports = router;
