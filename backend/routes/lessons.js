const express = require('express');
const multer = require('multer');
const path = require('path');
const Lesson = require('../models/Lesson');
const User = require('../models/User');
const LessonProgress = require('../models/LessonProgress');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { uploadMulterFile, deleteFile } = require('../utils/firebaseStorage');

const router = express.Router();

// Configure multer (memory storage → Firebase)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max file size
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /pdf|ppt|pptx|doc|docx|xls|xlsx|txt|jpg|jpeg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    if (extname) {
      return cb(null, true);
    } else {
      cb(new Error('Faqat PDF, PPT, PPTX, DOC, DOCX, XLS, XLSX, TXT va rasm fayllari qabul qilinadi!'));
    }
  }
});

// Get all lessons
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    let lessons;

    if (user.role === 'student') {
      // Students see lessons from their grade, district, and school
      const grade = parseInt(user.class_name.split('-')[0]); // Extract grade from class (e.g., "10-A" -> 10)
      lessons = await Lesson.getByGrade(grade, user.district, user.school_number);
    } else if (user.role === 'teacher' || user.role === 'admin') {
      // Teachers and admins see all lessons (can filter)
      const filters = {
        grade: req.query.grade ? parseInt(req.query.grade) : null,
        subject: req.query.subject,
        search: req.query.search,
        created_by: user.role === 'teacher' ? user.id : req.query.created_by
      };

      lessons = await Lesson.getAll(filters);
    }

    res.json(lessons);
  } catch (error) {
    console.error('Get lessons error:', error);
    res.status(500).json({ error: 'Darslarni olishda xatolik yuz berdi' });
  }
});

// Get lesson by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    // O'quvchi bo'lsa my_attempt ma'lumotlari ham qo'shiladi
    const student_id = user.role === 'student' ? user.id : null;
    const lesson = await Lesson.findById(req.params.id, student_id);

    if (!lesson) {
      return res.status(404).json({ error: 'Dars topilmadi' });
    }

    // Check if student has access to this lesson
    if (user.role === 'student') {
      const grade = parseInt(user.class_name.split('-')[0]);
      if (lesson.grade !== grade) {
        return res.status(403).json({ error: 'Bu darsga ruxsatingiz yo\'q' });
      }

      // Ketma-ket ochilish tekshiruvi — shu dars hozircha ochiqmi?
      const visibleLessons = await Lesson.getByGrade(grade, user.district, user.school_number);
      const isUnlocked = visibleLessons.some(l => l.id === parseInt(req.params.id));
      if (!isUnlocked) {
        return res.status(403).json({ error: 'Bu dars hali ochilmagan. Oldingi dars tugagach ochiladi.' });
      }

      // Students only see published tests
      lesson.tests = (lesson.tests_published || lesson.tests.filter(t => t.is_published));
    }
    // Teachers and admins see all tests (published + drafts)

    res.json(lesson);
  } catch (error) {
    console.error('Get lesson error:', error);
    res.status(500).json({ error: 'Darsni olishda xatolik yuz berdi' });
  }
});

// Create new lesson
router.post('/', authenticateToken, requireRole(['teacher', 'admin']), async (req, res) => {
  try {
    const { title, description, grade, subject, content } = req.body;

    // Validation
    if (!title || !grade || !subject) {
      return res.status(400).json({ 
        error: 'Dars nomi, sinf va fan kiritilishi shart' 
      });
    }

    if (![9, 10].includes(parseInt(grade))) {
      return res.status(400).json({ error: 'Sinf 9 yoki 10 bo\'lishi kerak' });
    }

    const lessonId = await Lesson.create({
      title,
      description,
      grade: parseInt(grade),
      subject,
      content: content || '',
      created_by: req.user.id
    });

    const lesson = await Lesson.findById(lessonId);

    res.status(201).json({
      message: 'Dars muvaffaqiyatli yaratildi',
      lesson
    });
  } catch (error) {
    console.error('Create lesson error:', error);
    res.status(500).json({ error: 'Dars yaratishda xatolik yuz berdi' });
  }
});

// Update lesson
router.put('/:id', authenticateToken, requireRole(['teacher', 'admin']), async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id);

    if (!lesson) {
      return res.status(404).json({ error: 'Dars topilmadi' });
    }

    // Check if user owns this lesson
    if (req.user.role !== 'admin' && lesson.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Bu darsni tahrirlash huquqingiz yo\'q' });
    }

    const { title, description, subject, content } = req.body;

    await Lesson.update(req.params.id, {
      title,
      description,
      subject,
      content
    });

    const updatedLesson = await Lesson.findById(req.params.id);

    res.json({
      message: 'Dars muvaffaqiyatli yangilandi',
      lesson: updatedLesson
    });
  } catch (error) {
    console.error('Update lesson error:', error);
    res.status(500).json({ error: 'Darsni yangilashda xatolik yuz berdi' });
  }
});

// Delete lesson
router.delete('/:id', authenticateToken, requireRole(['teacher', 'admin']), async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id);

    if (!lesson) {
      return res.status(404).json({ error: 'Dars topilmadi' });
    }

    // Check if user owns this lesson
    if (req.user.role !== 'admin' && lesson.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Bu darsni o\'chirish huquqingiz yo\'q' });
    }

    // Delete associated material files from Firebase
    const materials = await Lesson.getMaterials(req.params.id);
    for (const material of materials) {
      // Firebase URL'dan storage path ajratib olish (agar kerak bo'lsa)
      // Yangi fayllar to'liq URL sifatida saqlanadi, shuning uchun deleteFile ga URL beramiz
      if (material.file_path && material.file_path.includes('storage.googleapis.com')) {
        const storagePath = material.file_path.split('/').slice(4).join('/');
        await deleteFile(storagePath);
      }
    }

    await Lesson.delete(req.params.id);

    res.json({ message: 'Dars muvaffaqiyatli o\'chirildi' });
  } catch (error) {
    console.error('Delete lesson error:', error);
    res.status(500).json({ error: 'Darsni o\'chirishda xatolik yuz berdi' });
  }
});

// Upload material to lesson
router.post('/:id/materials', authenticateToken, requireRole(['teacher', 'admin']), upload.single('file'), async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id);

    if (!lesson) {
      return res.status(404).json({ error: 'Dars topilmadi' });
    }

    // Check if user owns this lesson
    if (req.user.role !== 'admin' && lesson.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Bu darsga material qo\'shish huquqingiz yo\'q' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Fayl yuborilmadi' });
    }

    // Firebase Storage'ga yuklash
    const { url, storagePath } = await uploadMulterFile(req.file, 'materials');

    const materialId = await Lesson.addMaterial({
      lesson_id: req.params.id,
      file_name: req.file.originalname,
      file_path: url,
      file_type: req.file.mimetype,
      file_size: req.file.size
    });

    const material = await Lesson.getMaterialById(materialId);

    res.status(201).json({
      message: 'Material muvaffaqiyatli yuklandi',
      material
    });
  } catch (error) {
    console.error('Upload material error:', error);
    res.status(500).json({ error: error.message || 'Materialni yuklashda xatolik yuz berdi' });
  }
});

// Delete material
router.delete('/:lessonId/materials/:materialId', authenticateToken, requireRole(['teacher', 'admin']), async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.lessonId);

    if (!lesson) {
      return res.status(404).json({ error: 'Dars topilmadi' });
    }

    // Check if user owns this lesson
    if (req.user.role !== 'admin' && lesson.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Bu materiallarni o\'chirish huquqingiz yo\'q' });
    }

    const material = await Lesson.getMaterialById(req.params.materialId);

    if (!material) {
      return res.status(404).json({ error: 'Material topilmadi' });
    }

    // Delete file from Firebase Storage
    if (material.file_path && material.file_path.includes('storage.googleapis.com')) {
      const storagePath = material.file_path.split('/').slice(4).join('/');
      await deleteFile(storagePath);
    }

    await Lesson.deleteMaterial(req.params.materialId);

    res.json({ message: 'Material muvaffaqiyatli o\'chirildi' });
  } catch (error) {
    console.error('Delete material error:', error);
    res.status(500).json({ error: 'Materialni o\'chirishda xatolik yuz berdi' });
  }
});

// ─── "Dars o'tildi" toggle (belgilash / bekor qilish) ────────
router.patch('/:id/mark-taught', authenticateToken, requireRole(['teacher', 'admin']), async (req, res) => {
  try {
    const lessonId = req.params.id;
    const database = require('../config/database');
    const lesson = await database.get('SELECT * FROM lessons WHERE id = ?', [lessonId]);
    if (!lesson) return res.status(404).json({ error: 'Dars topilmadi' });

    // Toggle: agar allaqachon o'tilgan bo'lsa — bekor qilamiz, aks holda belgilaymiz
    const newTaughtAt = lesson.taught_at ? null : new Date();
    await database.run('UPDATE lessons SET taught_at = ? WHERE id = ?', [newTaughtAt, lessonId]);

    // Darsni yaratgan o'qituvchining maktab/tumanini olish
    const creator = await database.get('SELECT district, school_number FROM users WHERE id = ?', [lesson.created_by]);

    // Faqat SHU maktab/tuman + SHU sinf o'quvchilari uchun qayta hisobla
    const students = await database.all(
      `SELECT id FROM users
       WHERE role = 'student' AND class_name LIKE ?
         AND district = ? AND school_number = ?`,
      [`${lesson.grade}-%`, creator?.district, creator?.school_number]
    );
    for (const s of students) {
      await LessonProgress.recalculate(lessonId, s.id);
      await User.updateMasteryLevel(s.id);
    }

    res.json({
      message: newTaughtAt ? 'Dars o\'tilgan deb belgilandi' : 'Dars "o\'tilmagan" holatiga qaytarildi',
      taught_at: newTaughtAt
    });
  } catch (err) {
    console.error('Mark-taught toggle error:', err);
    res.status(500).json({ error: 'Xatolik yuz berdi' });
  }
});

// ─── Yangi o'quv yilini boshlash (progressni tozalash, mazmunni saqlash) ───
router.post('/reset-year', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const database = require('../config/database');
    await database.run('UPDATE lessons SET taught_at = NULL');
    await database.run(`UPDATE users SET mastery_percent = 0, level = 1 WHERE role = 'student'`);
    res.json({ message: 'Yangi o\'quv yili uchun barcha darslar va darajalar tozalandi. Dars mazmuni saqlanib qoldi.' });
  } catch (err) {
    console.error('Reset-year error:', err);
    res.status(500).json({ error: 'Xatolik yuz berdi' });
  }
});

module.exports = router;
