const express = require('express');
const { chatMessages } = require('../utils/ai');
const database = require('../config/database');
const User = require('../models/User');
const { authenticateToken, isTeacherOrAdmin } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// ─── HELPER: ball qo'shish (faqat points, level endi updateMasteryLevel boshqaradi) ───
async function addPoints(userId, points) {
  await database.run('UPDATE users SET points = points + ? WHERE id = ?', [points, userId]);
}

// ─── HELPER: bonus ball qo'shish (daraja hisobiga kiradi) ───
async function addBonusPoints(userId, points) {
  await database.run(
    'UPDATE users SET points = points + ?, bonus_points = bonus_points + ? WHERE id = ?',
    [points, points, userId]
  );
}

// ═══════════════════════════════════════════════════════════════
// KATEGORIYALAR
// ═══════════════════════════════════════════════════════════════

// GET /api/forum/categories — barcha kategoriyalar
router.get('/categories', async (req, res) => {
  try {
    const categories = await database.all(`
      SELECT c.*,
        (SELECT COUNT(*) FROM forum_posts WHERE category_id = c.id) AS posts_count,
        (SELECT MAX(created_at) FROM forum_posts WHERE category_id = c.id) AS last_post_at
      FROM forum_categories c
      ORDER BY c.sort_order ASC
    `);
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: 'Kategoriyalarni olishda xatolik' });
  }
});

// ═══════════════════════════════════════════════════════════════
// POSTLAR (MAVZULAR)
// ═══════════════════════════════════════════════════════════════

// GET /api/forum/posts — postlar ro'yxati (filter, search, sort)
router.get('/posts', async (req, res) => {
  try {
    const { category_id, search, tag, sort, filter } = req.query;
    let query = `
      SELECT p.*,
        u.full_name AS author_name,
        u.username AS author_username,
        u.role AS author_role,
        u.avatar AS author_avatar,
        c.name AS category_name,
        c.icon AS category_icon,
        (SELECT COUNT(*) FROM forum_comments WHERE post_id = p.id) AS comments_count,
        (SELECT COUNT(*) FROM forum_votes WHERE post_id = p.id AND vote_type = 'up') AS upvotes,
        (SELECT COUNT(*) FROM forum_votes WHERE post_id = p.id AND vote_type = 'down') AS downvotes,
        (SELECT COUNT(*) FROM forum_comments WHERE post_id = p.id AND is_best_answer = TRUE) AS has_best_answer
      FROM forum_posts p
      JOIN users u ON p.user_id = u.id
      JOIN forum_categories c ON p.category_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (category_id) {
      query += ' AND p.category_id = ?';
      params.push(category_id);
    }

    if (search) {
      query += ' AND (p.title ILIKE ? OR p.content ILIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (tag) {
      query += ' AND p.tags ILIKE ?';
      params.push(`%${tag}%`);
    }

    if (filter === 'unanswered') {
      query += ' AND (SELECT COUNT(*) FROM forum_comments WHERE post_id = p.id) = 0';
    } else if (filter === 'solved') {
      query += ' AND (SELECT COUNT(*) FROM forum_comments WHERE post_id = p.id AND is_best_answer = TRUE) > 0';
    }

    // Saralash
    if (sort === 'popular') {
      query += ' ORDER BY p.pinned DESC, upvotes DESC, p.views DESC, p.created_at DESC';
    } else if (sort === 'unanswered') {
      query += ' ORDER BY p.pinned DESC, comments_count ASC, p.created_at DESC';
    } else {
      query += ' ORDER BY p.pinned DESC, p.created_at DESC';
    }

    query += ' LIMIT 50';

    const posts = await database.all(query, params);

    // Tags parse
    posts.forEach(p => {
      try { p.tags = JSON.parse(p.tags || '[]'); } catch { p.tags = []; }
      p.upvotes = parseInt(p.upvotes || 0);
      p.downvotes = parseInt(p.downvotes || 0);
      p.score = p.upvotes - p.downvotes;
    });

    res.json(posts);
  } catch (err) {
    console.error('Forum posts error:', err);
    res.status(500).json({ error: 'Postlarni olishda xatolik' });
  }
});

// GET /api/forum/posts/:id — bitta post (batafsil)
router.get('/posts/:id', async (req, res) => {
  try {
    const post = await database.get(`
      SELECT p.*,
        u.full_name AS author_name,
        u.username AS author_username,
        u.role AS author_role,
        u.avatar AS author_avatar,
        u.points AS author_points,
        c.name AS category_name,
        c.icon AS category_icon,
        (SELECT COUNT(*) FROM forum_votes WHERE post_id = p.id AND vote_type = 'up') AS upvotes,
        (SELECT COUNT(*) FROM forum_votes WHERE post_id = p.id AND vote_type = 'down') AS downvotes
      FROM forum_posts p
      JOIN users u ON p.user_id = u.id
      JOIN forum_categories c ON p.category_id = c.id
      WHERE p.id = ?
    `, [req.params.id]);

    if (!post) return res.status(404).json({ error: 'Post topilmadi' });

    // View count oshirish
    await database.run('UPDATE forum_posts SET views = views + 1 WHERE id = ?', [req.params.id]);
    post.views = (post.views || 0) + 1;

    // Tags parse
    try { post.tags = JSON.parse(post.tags || '[]'); } catch { post.tags = []; }
    post.upvotes = parseInt(post.upvotes || 0);
    post.downvotes = parseInt(post.downvotes || 0);
    post.score = post.upvotes - post.downvotes;

    // Javoblar
    const comments = await database.all(`
      SELECT fc.*,
        u.full_name AS author_name,
        u.username AS author_username,
        u.role AS author_role,
        u.points AS author_points,
        (SELECT COUNT(*) FROM forum_votes WHERE comment_id = fc.id AND vote_type = 'up') AS upvotes,
        (SELECT COUNT(*) FROM forum_votes WHERE comment_id = fc.id AND vote_type = 'down') AS downvotes
      FROM forum_comments fc
      JOIN users u ON fc.user_id = u.id
      WHERE fc.post_id = ?
      ORDER BY fc.is_best_answer DESC, upvotes DESC, fc.created_at ASC
    `, [req.params.id]);

    comments.forEach(c => {
      c.upvotes = parseInt(c.upvotes || 0);
      c.downvotes = parseInt(c.downvotes || 0);
      c.score = c.upvotes - c.downvotes;
    });

    res.json({ post, comments });
  } catch (err) {
    console.error('Forum post detail error:', err);
    res.status(500).json({ error: 'Postni olishda xatolik' });
  }
});


// POST /api/forum/posts — yangi post yaratish
router.post('/posts', authenticateToken, async (req, res) => {
  try {
    const { category_id, title, content, tags, image_url } = req.body;

    if (!category_id || !title || !content) {
      return res.status(400).json({ error: 'Kategoriya, sarlavha va matn kiritilishi shart' });
    }

    if (title.length < 5) {
      return res.status(400).json({ error: 'Sarlavha kamida 5 belgidan iborat bo\'lishi kerak' });
    }

    // E'lonlar kategoriyasi — faqat teacher/admin
    const category = await database.get('SELECT * FROM forum_categories WHERE id = ?', [category_id]);
    if (category && category.name === "E'lonlar" && req.user.role === 'student') {
      return res.status(403).json({ error: "E'lonlar bo'limiga faqat o'qituvchi yoza oladi" });
    }

    const tagsJson = tags ? JSON.stringify(
      Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()).filter(Boolean)
    ) : '[]';

    const result = await database.run(`
      INSERT INTO forum_posts (user_id, category_id, title, content, tags, image_url)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [req.user.id, category_id, title, content, tagsJson, image_url || null]);

    // Post yaratildi — ball FAQAT o'qituvchi tasdiqlagandan keyin beriladi

    const post = await database.get('SELECT * FROM forum_posts WHERE id = ?', [result.id]);
    try { post.tags = JSON.parse(post.tags || '[]'); } catch { post.tags = []; }

    res.status(201).json({
      message: 'Post yaratildi',
      post
    });
  } catch (err) {
    console.error('Create post error:', err);
    res.status(500).json({ error: 'Post yaratishda xatolik' });
  }
});

// PUT /api/forum/posts/:id — post tahrirlash
router.put('/posts/:id', authenticateToken, async (req, res) => {
  try {
    const post = await database.get('SELECT * FROM forum_posts WHERE id = ?', [req.params.id]);
    if (!post) return res.status(404).json({ error: 'Post topilmadi' });

    if (post.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Ruxsat yo\'q' });
    }

    const { title, content, tags } = req.body;
    const tagsJson = tags ? JSON.stringify(
      Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()).filter(Boolean)
    ) : post.tags;

    await database.run(`
      UPDATE forum_posts SET title = ?, content = ?, tags = ?, updated_at = NOW() WHERE id = ?
    `, [title || post.title, content || post.content, tagsJson, req.params.id]);

    res.json({ message: 'Post yangilandi' });
  } catch (err) {
    res.status(500).json({ error: 'Yangilashda xatolik' });
  }
});

// DELETE /api/forum/posts/:id
router.delete('/posts/:id', authenticateToken, async (req, res) => {
  try {
    const post = await database.get('SELECT * FROM forum_posts WHERE id = ?', [req.params.id]);
    if (!post) return res.status(404).json({ error: 'Post topilmadi' });

    if (post.user_id !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'teacher') {
      return res.status(403).json({ error: 'Ruxsat yo\'q' });
    }

    await database.run('DELETE FROM forum_posts WHERE id = ?', [req.params.id]);
    res.json({ message: 'Post o\'chirildi' });
  } catch (err) {
    res.status(500).json({ error: 'O\'chirishda xatolik' });
  }
});

// PATCH /api/forum/posts/:id/pin — pin/unpin (teacher/admin)
router.patch('/posts/:id/pin', authenticateToken, isTeacherOrAdmin, async (req, res) => {
  try {
    const post = await database.get('SELECT pinned FROM forum_posts WHERE id = ?', [req.params.id]);
    if (!post) return res.status(404).json({ error: 'Post topilmadi' });

    const newPinned = !post.pinned;
    await database.run('UPDATE forum_posts SET pinned = ? WHERE id = ?', [newPinned, req.params.id]);

    res.json({ message: newPinned ? 'Post mahkamlandi 📌' : 'Pin olib tashlandi', pinned: newPinned });
  } catch (err) {
    res.status(500).json({ error: 'Xatolik' });
  }
});


// ═══════════════════════════════════════════════════════════════
// JAVOBLAR (COMMENTS)
// ═══════════════════════════════════════════════════════════════

// POST /api/forum/posts/:id/comments — javob yozish
router.post('/posts/:postId/comments', authenticateToken, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || content.trim().length < 2) {
      return res.status(400).json({ error: 'Javob matni kiritilishi shart' });
    }

    const post = await database.get('SELECT * FROM forum_posts WHERE id = ?', [req.params.postId]);
    if (!post) return res.status(404).json({ error: 'Post topilmadi' });

    if (post.closed) {
      return res.status(403).json({ error: 'Bu mavzu yopilgan, javob yozish mumkin emas' });
    }

    const result = await database.run(`
      INSERT INTO forum_comments (post_id, user_id, content)
      VALUES (?, ?, ?)
    `, [req.params.postId, req.user.id, content]);

    // Javob yaratildi — ball FAQAT o'qituvchi tasdiqlagandan keyin beriladi

    const comment = await database.get(`
      SELECT fc.*, u.full_name AS author_name, u.username AS author_username, u.role AS author_role
      FROM forum_comments fc
      JOIN users u ON fc.user_id = u.id
      WHERE fc.id = ?
    `, [result.id]);

    res.status(201).json({
      message: 'Javob qo\'shildi (+2 ball)',
      comment,
      points_added: 2
    });
  } catch (err) {
    console.error('Create comment error:', err);
    res.status(500).json({ error: 'Javob yozishda xatolik' });
  }
});

// DELETE /api/forum/comments/:id
router.delete('/comments/:id', authenticateToken, async (req, res) => {
  try {
    const comment = await database.get('SELECT * FROM forum_comments WHERE id = ?', [req.params.id]);
    if (!comment) return res.status(404).json({ error: 'Javob topilmadi' });

    if (comment.user_id !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'teacher') {
      return res.status(403).json({ error: 'Ruxsat yo\'q' });
    }

    await database.run('DELETE FROM forum_comments WHERE id = ?', [req.params.id]);
    res.json({ message: 'Javob o\'chirildi' });
  } catch (err) {
    res.status(500).json({ error: 'O\'chirishda xatolik' });
  }
});

// PATCH /api/forum/comments/:id/best — eng yaxshi javob belgilash
router.patch('/comments/:id/best', authenticateToken, async (req, res) => {
  try {
    const comment = await database.get('SELECT * FROM forum_comments WHERE id = ?', [req.params.id]);
    if (!comment) return res.status(404).json({ error: 'Javob topilmadi' });

    const post = await database.get('SELECT * FROM forum_posts WHERE id = ?', [comment.post_id]);

    // Faqat post egasi yoki teacher/admin belgilay oladi
    if (post.user_id !== req.user.id && req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Faqat savol egasi yoki o\'qituvchi belgilay oladi' });
    }

    // Avvalgi best answer ni olib tashlash
    await database.run(
      'UPDATE forum_comments SET is_best_answer = FALSE WHERE post_id = ?',
      [comment.post_id]
    );

    // Yangi best answer
    const newBest = !comment.is_best_answer;
    if (newBest) {
      await database.run('UPDATE forum_comments SET is_best_answer = TRUE WHERE id = ?', [req.params.id]);
      // +5 bonus ball javob egasiga (eng yaxshi javob)
      if (comment.user_id !== req.user.id) {
        await addBonusPoints(comment.user_id, 5);
      }
    }

    res.json({
      message: newBest ? 'Eng yaxshi javob belgilandi ✅ (+5 ball javob egasiga)' : 'Belgi olib tashlandi',
      is_best_answer: newBest
    });
  } catch (err) {
    console.error('Best answer error:', err);
    res.status(500).json({ error: 'Xatolik' });
  }
});


// ═══════════════════════════════════════════════════════════════
// OVOZ BERISH (VOTING)
// ═══════════════════════════════════════════════════════════════

// POST /api/forum/vote — post yoki comment ga ovoz berish
router.post('/vote', authenticateToken, async (req, res) => {
  try {
    const { post_id, comment_id, vote_type } = req.body;

    if (!vote_type || !['up', 'down'].includes(vote_type)) {
      return res.status(400).json({ error: 'vote_type "up" yoki "down" bo\'lishi kerak' });
    }

    if (!post_id && !comment_id) {
      return res.status(400).json({ error: 'post_id yoki comment_id kerak' });
    }

    // O'z postiga ovoz berish mumkin emas
    if (post_id) {
      const post = await database.get('SELECT user_id FROM forum_posts WHERE id = ?', [post_id]);
      if (post && post.user_id === req.user.id) {
        return res.status(400).json({ error: 'O\'z postingizga ovoz bera olmaysiz' });
      }
    }
    if (comment_id) {
      const comment = await database.get('SELECT user_id FROM forum_comments WHERE id = ?', [comment_id]);
      if (comment && comment.user_id === req.user.id) {
        return res.status(400).json({ error: 'O\'z javobingizga ovoz bera olmaysiz' });
      }
    }

    if (post_id) {
      // Post uchun ovoz
      const existing = await database.get(
        'SELECT * FROM forum_votes WHERE user_id = ? AND post_id = ?',
        [req.user.id, post_id]
      );

      if (existing) {
        if (existing.vote_type === vote_type) {
          // Ovozni olib tashlash (toggle)
          await database.run('DELETE FROM forum_votes WHERE id = ?', [existing.id]);
          return res.json({ message: 'Ovoz olib tashlandi', vote: null });
        } else {
          // Ovozni o'zgartirish
          await database.run('UPDATE forum_votes SET vote_type = ? WHERE id = ?', [vote_type, existing.id]);
          return res.json({ message: 'Ovoz o\'zgartirildi', vote: vote_type });
        }
      }

      await database.run(
        'INSERT INTO forum_votes (user_id, post_id, vote_type) VALUES (?, ?, ?)',
        [req.user.id, post_id, vote_type]
      );

      // Like berganda post egasiga +1 ball
      if (vote_type === 'up') {
        const post = await database.get('SELECT user_id FROM forum_posts WHERE id = ?', [post_id]);
        if (post) await addPoints(post.user_id, 1);
      }
    } else {
      // Comment uchun ovoz
      const existing = await database.get(
        'SELECT * FROM forum_votes WHERE user_id = ? AND comment_id = ?',
        [req.user.id, comment_id]
      );

      if (existing) {
        if (existing.vote_type === vote_type) {
          await database.run('DELETE FROM forum_votes WHERE id = ?', [existing.id]);
          return res.json({ message: 'Ovoz olib tashlandi', vote: null });
        } else {
          await database.run('UPDATE forum_votes SET vote_type = ? WHERE id = ?', [vote_type, existing.id]);
          return res.json({ message: 'Ovoz o\'zgartirildi', vote: vote_type });
        }
      }

      await database.run(
        'INSERT INTO forum_votes (user_id, comment_id, vote_type) VALUES (?, ?, ?)',
        [req.user.id, comment_id, vote_type]
      );

      // Like berganda javob egasiga +1 ball
      if (vote_type === 'up') {
        const comment = await database.get('SELECT user_id FROM forum_comments WHERE id = ?', [comment_id]);
        if (comment) await addPoints(comment.user_id, 1);
      }
    }

    res.json({ message: 'Ovoz berildi', vote: vote_type });
  } catch (err) {
    console.error('Vote error:', err);
    res.status(500).json({ error: 'Ovoz berishda xatolik' });
  }
});

// GET /api/forum/my-votes?post_id=X — foydalanuvchining ovozlari
router.get('/my-votes', authenticateToken, async (req, res) => {
  try {
    const { post_id } = req.query;
    if (!post_id) return res.json({ post_vote: null, comment_votes: {} });

    const postVote = await database.get(
      'SELECT vote_type FROM forum_votes WHERE user_id = ? AND post_id = ?',
      [req.user.id, post_id]
    );

    const commentVotes = await database.all(
      'SELECT comment_id, vote_type FROM forum_votes WHERE user_id = ? AND comment_id IN (SELECT id FROM forum_comments WHERE post_id = ?)',
      [req.user.id, post_id]
    );

    const votesMap = {};
    commentVotes.forEach(v => { votesMap[v.comment_id] = v.vote_type; });

    res.json({
      post_vote: postVote?.vote_type || null,
      comment_votes: votesMap
    });
  } catch (err) {
    res.status(500).json({ error: 'Xatolik' });
  }
});


// ═══════════════════════════════════════════════════════════════
// AI YORDAMCHI
// ═══════════════════════════════════════════════════════════════

// POST /api/forum/posts/:id/ai-answer — AI javob beradi
router.post('/posts/:postId/ai-answer', authenticateToken, aiLimiter, async (req, res) => {
  try {
    const post = await database.get('SELECT * FROM forum_posts WHERE id = ?', [req.params.postId]);
    if (!post) return res.status(404).json({ error: 'Post topilmadi' });

    // AI javob avval berilganmi tekshirish
    const existingAI = await database.get(
      'SELECT id FROM forum_comments WHERE post_id = ? AND is_ai_answer = TRUE',
      [req.params.postId]
    );
    if (existingAI) {
      return res.status(400).json({ error: 'Bu savolga AI allaqachon javob bergan' });
    }

    const category = await database.get(
      'SELECT name FROM forum_categories WHERE id = ?', [post.category_id]
    );

    const prompt = `Sen InfoTest platformasidagi AI yordamchisisan. O'zbek tilida javob ber.
Kategoriya: ${category?.name || 'Umumiy'}
Savol: ${post.title}

${post.content}

QOIDALAR:
- Aniq, tushunarli javob ber
- Agar dasturlash savoli bo'lsa — kod misollar bilan tushuntir
- Javobni qisqa va aniq yoz (3-5 paragraf)
- Agar bilmasang, shunchaki "Bu savolga aniq javob bera olmayman" de`;

    const aiContent = await chatMessages([
        { role: 'user', content: prompt }
      ], {
        system: 'Sen informatika bo\'yicha yordamchi. O\'zbek tilida, aniq va qisqa javob ber.',
        temperature: 0.5,
        max_tokens: 1000
      });

    // AI javobni saqlash (user_id = 0 yoki admin id)
    const result = await database.run(`
      INSERT INTO forum_comments (post_id, user_id, content, is_ai_answer)
      VALUES (?, ?, ?, TRUE)
    `, [req.params.postId, req.user.id, aiContent]);

    const comment = await database.get(`
      SELECT fc.*, u.full_name AS author_name, u.role AS author_role
      FROM forum_comments fc
      JOIN users u ON fc.user_id = u.id
      WHERE fc.id = ?
    `, [result.id]);

    res.json({
      message: 'AI javob berdi 🤖',
      comment
    });
  } catch (err) {
    console.error('AI answer error:', err);
    res.status(500).json({ error: 'AI javob berishda xatolik: ' + err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// TOP HELPERS & STATISTIKA
// ═══════════════════════════════════════════════════════════════

// GET /api/forum/top-helpers — eng ko'p yordam berganlar
router.get('/top-helpers', async (req, res) => {
  try {
    const helpers = await database.all(`
      SELECT u.id, u.full_name, u.username, u.avatar, u.role, u.points,
        (SELECT COUNT(*) FROM forum_comments WHERE user_id = u.id) AS answers_count,
        (SELECT COUNT(*) FROM forum_comments WHERE user_id = u.id AND is_best_answer = TRUE) AS best_answers,
        (SELECT COUNT(*) FROM forum_posts WHERE user_id = u.id) AS posts_count
      FROM users u
      WHERE (SELECT COUNT(*) FROM forum_comments WHERE user_id = u.id) > 0
      ORDER BY best_answers DESC, answers_count DESC
      LIMIT 10
    `);
    res.json(helpers);
  } catch (err) {
    res.status(500).json({ error: 'Xatolik' });
  }
});

// GET /api/forum/stats — forum statistikasi
router.get('/stats', async (req, res) => {
  try {
    const stats = await database.get(`
      SELECT
        (SELECT COUNT(*) FROM forum_posts) AS total_posts,
        (SELECT COUNT(*) FROM forum_comments) AS total_comments,
        (SELECT COUNT(*) FROM forum_comments WHERE is_best_answer = TRUE) AS solved_posts,
        (SELECT COUNT(DISTINCT user_id) FROM forum_posts) AS active_users
    `);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Xatolik' });
  }
});

// ═══════════════════════════════════════════════════════════════
// TASDIQLASH (faqat teacher/admin)
// ═══════════════════════════════════════════════════════════════

// PATCH /api/forum/posts/:id/approve — postni tasdiqlash (+1 bonus ball)
router.patch('/posts/:id/approve', authenticateToken, isTeacherOrAdmin, async (req, res) => {
  try {
    const post = await database.get('SELECT * FROM forum_posts WHERE id = ?', [req.params.id]);
    if (!post) return res.status(404).json({ error: 'Post topilmadi' });
    if (post.is_approved) return res.status(400).json({ error: 'Allaqachon tasdiqlangan' });

    await database.run('UPDATE forum_posts SET is_approved = TRUE WHERE id = ?', [req.params.id]);
    await addBonusPoints(post.user_id, 1);

    res.json({ message: 'Post tasdiqlandi (+1 ball)', is_approved: true });
  } catch (err) {
    console.error('Post approve error:', err);
    res.status(500).json({ error: 'Tasdiqlashda xatolik' });
  }
});

// PATCH /api/forum/comments/:id/approve — javobni tasdiqlash (+2 bonus ball)
router.patch('/comments/:id/approve', authenticateToken, isTeacherOrAdmin, async (req, res) => {
  try {
    const comment = await database.get('SELECT * FROM forum_comments WHERE id = ?', [req.params.id]);
    if (!comment) return res.status(404).json({ error: 'Javob topilmadi' });
    if (comment.is_approved) return res.status(400).json({ error: 'Allaqachon tasdiqlangan' });

    await database.run('UPDATE forum_comments SET is_approved = TRUE WHERE id = ?', [req.params.id]);
    await addBonusPoints(comment.user_id, 2);

    res.json({ message: 'Javob tasdiqlandi (+2 ball)', is_approved: true });
  } catch (err) {
    console.error('Comment approve error:', err);
    res.status(500).json({ error: 'Tasdiqlashda xatolik' });
  }
});

module.exports = router;
