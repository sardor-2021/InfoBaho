const express = require('express');
const path = require('path');
const multer = require('multer');
const database = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { uploadMulterFile } = require('../utils/firebaseStorage');

const router = express.Router();

// ─── Portfolio fayl yuklash config (memory → Firebase) ───────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpg|jpeg|png|gif|webp|pdf|doc|docx|zip|txt|mp4|mov/i;
    const ext = path.extname(file.originalname).slice(1);
    allowed.test(ext) ? cb(null, true) : cb(new Error('Fayl turi qabul qilinmaydi'));
  }
});

// ─── Fayl turi aniqlovchi ────────────────────────────────────
function getFileType(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  if (['.jpg','.jpeg','.png','.gif','.webp'].includes(ext)) return 'image';
  if (ext === '.pdf') return 'pdf';
  if (['.doc','.docx'].includes(ext)) return 'doc';
  if (['.mp4','.mov'].includes(ext)) return 'video';
  if (ext === '.zip') return 'zip';
  return 'file';
}


// Get current user's portfolio
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const items = await database.all(`
      SELECT pi.*,
        (SELECT COUNT(*) FROM portfolio_likes WHERE item_id = pi.id) AS likes_count,
        (SELECT COUNT(*) FROM portfolio_likes WHERE item_id = pi.id AND user_id = ?) AS user_liked,
        (SELECT COALESCE(AVG(score), 0) FROM portfolio_ratings WHERE item_id = pi.id) AS avg_rating,
        (SELECT COUNT(*) FROM portfolio_ratings WHERE item_id = pi.id) AS ratings_count
      FROM portfolio_items pi
      WHERE pi.user_id = ?
      ORDER BY pi.created_at DESC
    `, [userId, userId]);

    items.forEach(item => {
      if (item.tags) { try { item.tags = JSON.parse(item.tags); } catch { item.tags = []; } }
      item.likes_count = parseInt(item.likes_count || 0);
      item.user_liked  = item.user_liked > 0;
      item.avg_rating  = parseFloat(parseFloat(item.avg_rating || 0).toFixed(1));
      item.ratings_count = parseInt(item.ratings_count || 0);
    });

    res.json(items);
  } catch (error) {
    console.error('Get portfolio error:', error);
    res.status(500).json({ error: 'Failed to get portfolio' });
  }
});

// Get user portfolio by ID (o'qituvchi/admin)
router.get('/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    if (req.user.id !== parseInt(userId) && req.user.role === 'student') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const items = await database.all(`
      SELECT pi.*,
        (SELECT COUNT(*) FROM portfolio_likes WHERE item_id = pi.id) AS likes_count,
        (SELECT COUNT(*) FROM portfolio_likes WHERE item_id = pi.id AND user_id = ?) AS user_liked,
        (SELECT COALESCE(AVG(score), 0) FROM portfolio_ratings WHERE item_id = pi.id) AS avg_rating,
        (SELECT COUNT(*) FROM portfolio_ratings WHERE item_id = pi.id) AS ratings_count
      FROM portfolio_items pi
      WHERE pi.user_id = ? AND (pi.is_public = TRUE OR ? = pi.user_id)
      ORDER BY pi.created_at DESC
    `, [req.user.id, userId, req.user.id]);

    items.forEach(item => {
      if (item.tags) { try { item.tags = JSON.parse(item.tags); } catch { item.tags = []; } }
      item.likes_count = parseInt(item.likes_count || 0);
      item.user_liked  = item.user_liked > 0;
      item.avg_rating  = parseFloat(parseFloat(item.avg_rating || 0).toFixed(1));
      item.ratings_count = parseInt(item.ratings_count || 0);
    });

    res.json({ portfolio: items, count: items.length });
  } catch (error) {
    console.error('Get portfolio error:', error);
    res.status(500).json({ error: 'Failed to get portfolio' });
  }
});

// Get portfolio item
router.get('/item/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const item = await database.get(
      'SELECT * FROM portfolio_items WHERE id = ?',
      [id]
    );
    
    if (!item) {
      return res.status(404).json({ error: 'Portfolio item not found' });
    }
    
    // Check permissions
    if (!item.is_public && item.user_id !== req.user.id && req.user.role === 'student') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Parse tags
    if (item.tags) {
      item.tags = JSON.parse(item.tags);
    }
    
    res.json({ item });
  } catch (error) {
    console.error('Get portfolio item error:', error);
    res.status(500).json({ error: 'Failed to get portfolio item' });
  }
});

// POST /api/portfolio/upload — fayl yuklash (rasm, PDF va h.k.)
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Fayl yuklanmadi' });

    const fileType = getFileType(req.file.originalname);

    // Firebase Storage'ga yuklash
    const { url } = await uploadMulterFile(req.file, 'portfolio');

    res.json({
      file_url: url,
      file_name: req.file.originalname,
      file_size: req.file.size,
      file_type: fileType,
      is_image: fileType === 'image'
    });
  } catch (err) {
    console.error('Portfolio upload error:', err);
    res.status(500).json({ error: 'Fayl yuklashda xatolik: ' + err.message });
  }
});

// Create portfolio item
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      title,
      description,
      item_type,
      content,
      file_url,
      tags,
      is_public
    } = req.body;
    
    // Validation
    if (!title || !item_type) {
      return res.status(400).json({ error: 'title and item_type are required' });
    }
    
    const validTypes = ['project', 'achievement', 'test_result', 'certificate'];
    if (!validTypes.includes(item_type)) {
      return res.status(400).json({ 
        error: 'Invalid item type',
        valid_types: validTypes
      });
    }
    
    const sql = `
      INSERT INTO portfolio_items (
        user_id, title, description, item_type, content,
        file_url, tags, is_public
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const result = await database.run(sql, [
      req.user.id,
      title,
      description,
      item_type,
      content,
      file_url,
      tags ? JSON.stringify(tags) : null,
      is_public ? true : false
    ]);
    
    const item = await database.get(
      'SELECT * FROM portfolio_items WHERE id = ?',
      [result.id]
    );
    
    if (item.tags) {
      item.tags = JSON.parse(item.tags);
    }
    
    res.status(201).json({
      message: 'Portfolio item created successfully',
      item
    });
  } catch (error) {
    console.error('Create portfolio item error:', error);
    res.status(500).json({ error: 'Failed to create portfolio item' });
  }
});

// Update portfolio item
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const item = await database.get(
      'SELECT * FROM portfolio_items WHERE id = ?',
      [id]
    );
    
    if (!item) {
      return res.status(404).json({ error: 'Portfolio item not found' });
    }
    
    // Check ownership
    if (item.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const updates = {};
    const allowedFields = [
      'title', 'description', 'item_type', 'content',
      'file_url', 'tags', 'is_public'
    ];
    
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'tags') {
          updates[field] = JSON.stringify(req.body[field]);
        } else {
          updates[field] = req.body[field];
        }
      }
    }
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    const fields = Object.keys(updates).map(f => `${f} = ?`).join(', ');
    const values = [...Object.values(updates), id];
    
    await database.run(
      `UPDATE portfolio_items SET ${fields} WHERE id = ?`,
      values
    );
    
    const updatedItem = await database.get(
      'SELECT * FROM portfolio_items WHERE id = ?',
      [id]
    );
    
    if (updatedItem.tags) {
      updatedItem.tags = JSON.parse(updatedItem.tags);
    }
    
    res.json({
      message: 'Portfolio item updated successfully',
      item: updatedItem
    });
  } catch (error) {
    console.error('Update portfolio item error:', error);
    res.status(500).json({ error: 'Failed to update portfolio item' });
  }
});

// POST /api/portfolio/:id/like — like bosish / olib tashlash (toggle)
router.post('/:id/like', authenticateToken, async (req, res) => {
  try {
    const itemId = parseInt(req.params.id);
    const userId = req.user.id;

    // Element mavjudmi?
    const item = await database.get('SELECT id, user_id FROM portfolio_items WHERE id = ?', [itemId]);
    if (!item) return res.status(404).json({ error: 'Portfolio elementi topilmadi' });

    // O'z ishiga like bosa olmaydi
    if (item.user_id === userId) {
      return res.status(400).json({ error: "O'z ishingizga like bosa olmaysiz" });
    }

    // Avval like bosilganmi?
    const existing = await database.get(
      'SELECT id FROM portfolio_likes WHERE item_id = ? AND user_id = ?',
      [itemId, userId]
    );

    if (existing) {
      // Unlike — olib tashlash
      await database.run('DELETE FROM portfolio_likes WHERE item_id = ? AND user_id = ?', [itemId, userId]);
      const count = await database.get('SELECT COUNT(*) AS cnt FROM portfolio_likes WHERE item_id = ?', [itemId]);
      return res.json({ liked: false, likes_count: parseInt(count.cnt) });
    } else {
      // Like qo'shish
      await database.run('INSERT INTO portfolio_likes (item_id, user_id) VALUES (?, ?)', [itemId, userId]);
      const count = await database.get('SELECT COUNT(*) AS cnt FROM portfolio_likes WHERE item_id = ?', [itemId]);
      return res.json({ liked: true, likes_count: parseInt(count.cnt) });
    }
  } catch (err) {
    console.error('Like error:', err);
    res.status(500).json({ error: 'Like qo\'yishda xatolik' });
  }
});

// POST /api/portfolio/:id/rate — o'qituvchi ball beradi (umumiy ballarga qo'shiladi)
router.post('/:id/rate', authenticateToken, async (req, res) => {
  try {
    // Faqat teacher va admin
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ error: "Faqat o'qituvchi va admin ball bera oladi" });
    }

    const itemId = parseInt(req.params.id);
    const { score, comment } = req.body;

    // Validation
    if (score === undefined || score === null) {
      return res.status(400).json({ error: 'Ball kiritilishi shart' });
    }
    if (score < 1 || score > 10) {
      return res.status(400).json({ error: 'Ball 1 dan 10 gacha bo\'lishi kerak' });
    }

    // Portfolio element mavjudmi?
    const item = await database.get('SELECT id, user_id, title, item_type FROM portfolio_items WHERE id = ?', [itemId]);
    if (!item) return res.status(404).json({ error: 'Portfolio elementi topilmadi' });

    // O'z portfoliosiga ball bera olmaydi
    if (item.user_id === req.user.id) {
      return res.status(400).json({ error: "O'z portfoliongizga ball bera olmaysiz" });
    }

    // Avval ball berilganmi tekshirish
    const existing = await database.get(
      'SELECT id, score FROM portfolio_ratings WHERE item_id = ? AND teacher_id = ?',
      [itemId, req.user.id]
    );

    let oldScore = 0;

    if (existing) {
      // Yangilash — oldingi ballni olib tashlash, yangisini qo'shish
      oldScore = existing.score;
      await database.run(
        `UPDATE portfolio_ratings SET score = ?, comment = ?, updated_at = NOW() WHERE id = ?`,
        [score, comment || '', existing.id]
      );
    } else {
      // Yangi baho qo'shish
      await database.run(
        `INSERT INTO portfolio_ratings (item_id, student_id, teacher_id, score, comment) VALUES (?, ?, ?, ?, ?)`,
        [itemId, item.user_id, req.user.id, score, comment || '']
      );
    }

    // O'quvchi ballariga qo'shish (bonus_points ga ham)
    const pointsDiff = score - oldScore;
    if (pointsDiff !== 0) {
      await database.run(
        'UPDATE users SET points = points + ?, bonus_points = bonus_points + ? WHERE id = ?',
        [pointsDiff, pointsDiff, item.user_id]
      );
    }

    // O'quvchi mastery levelini yangilash
    const User = require('../models/User');
    await User.updateMasteryLevel(item.user_id);

    // Yangilangan user ma'lumoti
    const updatedUser = await database.get(
      'SELECT id, points, level, mastery_percent FROM users WHERE id = ?', [item.user_id]
    );

    // O'rtacha baho
    const avgRating = await database.get(
      'SELECT AVG(score) AS avg_score, COUNT(*) AS total_ratings FROM portfolio_ratings WHERE item_id = ?',
      [itemId]
    );

    res.json({
      message: 'Ball muvaffaqiyatli berildi',
      rating: {
        score,
        comment: comment || '',
        teacher_id: req.user.id,
        is_update: !!existing,
        points_added: pointsDiff
      },
      item_avg_score: parseFloat(parseFloat(avgRating.avg_score || 0).toFixed(1)),
      total_ratings: parseInt(avgRating.total_ratings || 0),
      student_points: updatedUser.points,
      student_level: updatedUser.level
    });
  } catch (err) {
    console.error('Portfolio rate error:', err);
    res.status(500).json({ error: 'Ball berishda xatolik: ' + err.message });
  }
});

// GET /api/portfolio/:id/ratings — element baholari ro'yxati
router.get('/:id/ratings', authenticateToken, async (req, res) => {
  try {
    const itemId = parseInt(req.params.id);

    const ratings = await database.all(`
      SELECT pr.*, u.full_name AS teacher_name
      FROM portfolio_ratings pr
      JOIN users u ON pr.teacher_id = u.id
      WHERE pr.item_id = ?
      ORDER BY pr.updated_at DESC
    `, [itemId]);

    const avg = await database.get(
      'SELECT AVG(score) AS avg_score, COUNT(*) AS total FROM portfolio_ratings WHERE item_id = ?',
      [itemId]
    );

    res.json({
      ratings,
      avg_score: parseFloat(parseFloat(avg.avg_score || 0).toFixed(1)),
      total_ratings: parseInt(avg.total || 0)
    });
  } catch (err) {
    console.error('Get ratings error:', err);
    res.status(500).json({ error: 'Baholarni olishda xatolik' });
  }
});

// DELETE portfolio item
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const item = await database.get(
      'SELECT * FROM portfolio_items WHERE id = ?',
      [id]
    );
    
    if (!item) {
      return res.status(404).json({ error: 'Portfolio item not found' });
    }
    
    // Check ownership
    if (item.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await database.run('DELETE FROM portfolio_items WHERE id = ?', [id]);
    
    res.json({ message: 'Portfolio item deleted successfully' });
  } catch (error) {
    console.error('Delete portfolio item error:', error);
    res.status(500).json({ error: 'Failed to delete portfolio item' });
  }
});

module.exports = router;
