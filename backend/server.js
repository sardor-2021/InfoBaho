const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const database = require('./config/database');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const testRoutes = require('./routes/tests');
const questionRoutes = require('./routes/questions');
const resultRoutes = require('./routes/results');
const portfolioRoutes = require('./routes/portfolio');
const statisticsRoutes = require('./routes/statistics');
const lessonRoutes = require('./routes/lessons');
const assignmentRoutes = require('./routes/assignments');
const lessonProgressRoutes = require('./routes/lessonProgress');
const aiAnalyticsRoutes = require('./routes/aiAnalytics');
const forumRoutes = require('./routes/forum');
const experimentRoutes = require('./routes/experiment');
const surveyRoutes = require('./routes/survey');
const diagnosticRoutes = require('./routes/diagnostic');
const adaptiveTestRoutes = require('./routes/adaptiveTests');

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy (Render.com, Netlify kabi reverse proxy ortida ishlashi uchun)
app.set('trust proxy', 1);

// Middleware
const { apiLimiter } = require('./middleware/rateLimiter');

const allowedOrigins = [
  'http://localhost:3000',
  'https://infotest-platform.netlify.app',
  'https://infotest-action19.netlify.app',
  'https://infobaho.netlify.app',
  process.env.CORS_ORIGIN
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Check if origin ends with .netlify.app
    if (origin.endsWith('.netlify.app')) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all for now, change in production
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Gzip compression — javoblar 70% kichrayadi
const compression = require('compression');
app.use(compression());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Global API rate limit
app.use('/api', apiLimiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/lesson-progress', lessonProgressRoutes);
app.use('/api/ai-analytics', aiAnalyticsRoutes);
app.use('/api/forum', forumRoutes);
app.use('/api/experiment', experimentRoutes);
app.use('/api/survey', surveyRoutes);
app.use('/api/diagnostic', diagnosticRoutes);
app.use('/api', adaptiveTestRoutes);

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'InfoBaho API is running',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'InfoBaho Platform API',
    version: '2.0.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      users: '/api/users',
      tests: '/api/tests',
      questions: '/api/questions',
      results: '/api/results',
      portfolio: '/api/portfolio',
      statistics: '/api/statistics'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found` 
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
async function runMigrations(db) {
  try {
    // assignments table
    await db.run(`
      CREATE TABLE IF NOT EXISTS assignments (
        id            SERIAL PRIMARY KEY,
        lesson_id     INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
        created_by    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title         TEXT NOT NULL,
        description   TEXT NOT NULL DEFAULT '',
        task_type     TEXT NOT NULL CHECK(task_type IN (
          'word','excel','powerpoint','access','paint','python','scratch','html','javascript','css','other'
        )),
        instructions  TEXT NOT NULL,
        max_score     INTEGER DEFAULT 100,
        deadline      TIMESTAMPTZ,
        ai_generated  BOOLEAN DEFAULT FALSE,
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        updated_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    // assignment_submissions table
    await db.run(`
      CREATE TABLE IF NOT EXISTS assignment_submissions (
        id              SERIAL PRIMARY KEY,
        assignment_id   INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
        student_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        file_name       TEXT NOT NULL,
        file_path       TEXT NOT NULL,
        file_size       INTEGER,
        submitted_at    TIMESTAMPTZ DEFAULT NOW(),
        score           INTEGER,
        feedback        TEXT,
        graded_by       TEXT CHECK(graded_by IN ('teacher','ai')),
        graded_at       TIMESTAMPTZ,
        ai_report       TEXT,
        status          TEXT DEFAULT 'submitted' CHECK(status IN ('submitted','graded')),
        UNIQUE(assignment_id, student_id)
      )
    `);
    await db.run('CREATE INDEX IF NOT EXISTS idx_assignments_lesson  ON assignments(lesson_id)').catch(()=>{});
    await db.run('CREATE INDEX IF NOT EXISTS idx_submissions_assign  ON assignment_submissions(assignment_id)').catch(()=>{});
    await db.run('CREATE INDEX IF NOT EXISTS idx_submissions_student ON assignment_submissions(student_id)').catch(()=>{});

    // code_content ustuni qo'shish (kod submissions uchun)
    await db.run('ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS code_content TEXT').catch(()=>{});

    // portfolio_items: file_name, file_type ustunlari qo'shish
    await db.run(`ALTER TABLE portfolio_items ADD COLUMN IF NOT EXISTS file_name TEXT`).catch(()=>{});
    await db.run(`ALTER TABLE portfolio_items ADD COLUMN IF NOT EXISTS file_type TEXT`).catch(()=>{});

    // portfolio_likes jadvali
    await db.run(`
      CREATE TABLE IF NOT EXISTS portfolio_likes (
        id           SERIAL PRIMARY KEY,
        item_id      INTEGER NOT NULL REFERENCES portfolio_items(id) ON DELETE CASCADE,
        user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at   TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(item_id, user_id)
      )
    `).catch(()=>{});
    await db.run('CREATE INDEX IF NOT EXISTS idx_portfolio_likes_item ON portfolio_likes(item_id)').catch(()=>{});

    // lesson_progress
    await db.run(`
      CREATE TABLE IF NOT EXISTS lesson_progress (
        id                SERIAL PRIMARY KEY,
        lesson_id         INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
        student_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        total_possible    INTEGER DEFAULT 0,
        earned_score      INTEGER DEFAULT 0,
        percent           REAL DEFAULT 0,
        grade             INTEGER DEFAULT 0,
        grade_awarded     BOOLEAN DEFAULT FALSE,
        updated_at        TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(lesson_id, student_id)
      )
    `);
    await db.run('CREATE INDEX IF NOT EXISTS idx_lesson_progress_student ON lesson_progress(student_id)').catch(()=>{});
    await db.run('CREATE INDEX IF NOT EXISTS idx_lesson_progress_lesson  ON lesson_progress(lesson_id)').catch(()=>{});

    // password_resets — parolni tiklash kodlari
    await db.run(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id           SERIAL PRIMARY KEY,
        user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        email        TEXT NOT NULL UNIQUE,
        code         TEXT NOT NULL,
        reset_token  TEXT,
        used         BOOLEAN DEFAULT FALSE,
        expires_at   TIMESTAMPTZ NOT NULL,
        created_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await db.run('CREATE INDEX IF NOT EXISTS idx_password_resets_email ON password_resets(email)').catch(()=>{});

    // portfolio_ratings — o'qituvchi tomonidan portfolio baholash
    await db.run(`
      CREATE TABLE IF NOT EXISTS portfolio_ratings (
        id           SERIAL PRIMARY KEY,
        item_id      INTEGER NOT NULL REFERENCES portfolio_items(id) ON DELETE CASCADE,
        student_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        teacher_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        score        INTEGER NOT NULL CHECK(score >= 1 AND score <= 10),
        comment      TEXT DEFAULT '',
        created_at   TIMESTAMPTZ DEFAULT NOW(),
        updated_at   TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(item_id, teacher_id)
      )
    `);
    await db.run('CREATE INDEX IF NOT EXISTS idx_portfolio_ratings_item    ON portfolio_ratings(item_id)').catch(()=>{});
    await db.run('CREATE INDEX IF NOT EXISTS idx_portfolio_ratings_student ON portfolio_ratings(student_id)').catch(()=>{});

    // ─── FORUM TABLES ────────────────────────────────────────
    // Forum kategoriyalar
    await db.run(`
      CREATE TABLE IF NOT EXISTS forum_categories (
        id           SERIAL PRIMARY KEY,
        name         TEXT NOT NULL,
        icon         TEXT DEFAULT '📁',
        description  TEXT DEFAULT '',
        sort_order   INTEGER DEFAULT 0,
        created_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Forum postlar (mavzular)
    await db.run(`
      CREATE TABLE IF NOT EXISTS forum_posts (
        id            SERIAL PRIMARY KEY,
        user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category_id   INTEGER NOT NULL REFERENCES forum_categories(id) ON DELETE CASCADE,
        title         TEXT NOT NULL,
        content       TEXT NOT NULL,
        tags          TEXT DEFAULT '[]',
        image_url     TEXT,
        pinned        BOOLEAN DEFAULT FALSE,
        closed        BOOLEAN DEFAULT FALSE,
        views         INTEGER DEFAULT 0,
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        updated_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await db.run('CREATE INDEX IF NOT EXISTS idx_forum_posts_user     ON forum_posts(user_id)').catch(()=>{});
    await db.run('CREATE INDEX IF NOT EXISTS idx_forum_posts_category ON forum_posts(category_id)').catch(()=>{});

    // Forum javoblar (kommentlar)
    await db.run(`
      CREATE TABLE IF NOT EXISTS forum_comments (
        id              SERIAL PRIMARY KEY,
        post_id         INTEGER NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
        user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content         TEXT NOT NULL,
        is_best_answer  BOOLEAN DEFAULT FALSE,
        is_ai_answer    BOOLEAN DEFAULT FALSE,
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        updated_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await db.run('CREATE INDEX IF NOT EXISTS idx_forum_comments_post ON forum_comments(post_id)').catch(()=>{});

    // Forum ovozlar (like/dislike)
    await db.run(`
      CREATE TABLE IF NOT EXISTS forum_votes (
        id           SERIAL PRIMARY KEY,
        user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        post_id      INTEGER REFERENCES forum_posts(id) ON DELETE CASCADE,
        comment_id   INTEGER REFERENCES forum_comments(id) ON DELETE CASCADE,
        vote_type    TEXT NOT NULL CHECK(vote_type IN ('up', 'down')),
        created_at   TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, post_id),
        UNIQUE(user_id, comment_id)
      )
    `);
    await db.run('CREATE INDEX IF NOT EXISTS idx_forum_votes_post    ON forum_votes(post_id)').catch(()=>{});
    await db.run('CREATE INDEX IF NOT EXISTS idx_forum_votes_comment ON forum_votes(comment_id)').catch(()=>{});

    // Default kategoriyalar qo'shish (agar bo'sh bo'lsa)
    const catCount = await db.get('SELECT COUNT(*) AS cnt FROM forum_categories');
    if (parseInt(catCount?.cnt || 0) === 0) {
      const defaultCats = [
        ['💻', 'Dasturlash', 'Python, JavaScript, HTML/CSS savollar', 1],
        ['📊', 'Ofis dasturlari', 'Word, Excel, Access, PowerPoint', 2],
        ['🧮', 'Algoritmlar', 'Algoritmlar, mantiq va masalalar', 3],
        ['❓', 'Umumiy savollar', 'Informatikaga oid barcha savollar', 4],
        ['📢', 'E\'lonlar', 'O\'qituvchi va admin e\'lonlari', 5],
        ['💡', 'Takliflar', 'Platforma bo\'yicha fikr va takliflar', 6],
      ];
      for (const [icon, name, desc, order] of defaultCats) {
        await db.run(
          'INSERT INTO forum_categories (icon, name, description, sort_order) VALUES (?, ?, ?, ?)',
          [icon, name, desc, order]
        ).catch(()=>{});
      }
      console.log('✓ Forum default categories created');
    }

    // diagnostic_tests — tajriba boshidagi diagnostik testlar
    await db.run(`
      CREATE TABLE IF NOT EXISTS diagnostic_tests (
        id           SERIAL PRIMARY KEY,
        title        TEXT NOT NULL,
        description  TEXT DEFAULT '',
        duration     INTEGER DEFAULT 45,
        grade        INTEGER DEFAULT 9,
        is_active    BOOLEAN DEFAULT TRUE,
        created_by   INTEGER NOT NULL REFERENCES users(id),
        created_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // diagnostic_questions — diagnostik test savollari
    await db.run(`
      CREATE TABLE IF NOT EXISTS diagnostic_questions (
        id              SERIAL PRIMARY KEY,
        test_id         INTEGER NOT NULL REFERENCES diagnostic_tests(id) ON DELETE CASCADE,
        question_text   TEXT NOT NULL,
        question_type   TEXT DEFAULT 'single_choice',
        options         TEXT,
        correct_answer  TEXT NOT NULL,
        points          INTEGER DEFAULT 1,
        explanation     TEXT,
        order_number    INTEGER,
        created_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await db.run('CREATE INDEX IF NOT EXISTS idx_diag_q_test ON diagnostic_questions(test_id)').catch(()=>{});

    // diagnostic_results — diagnostik test natijalari
    await db.run(`
      CREATE TABLE IF NOT EXISTS diagnostic_results (
        id               SERIAL PRIMARY KEY,
        test_id          INTEGER NOT NULL REFERENCES diagnostic_tests(id) ON DELETE CASCADE,
        user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        score            INTEGER DEFAULT 0,
        percentage       REAL DEFAULT 0,
        correct_answers  INTEGER DEFAULT 0,
        total_questions  INTEGER DEFAULT 0,
        time_taken       INTEGER DEFAULT 0,
        answers          TEXT,
        created_at       TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(test_id, user_id)
      )
    `);
    await db.run('CREATE INDEX IF NOT EXISTS idx_diag_r_user ON diagnostic_results(user_id)').catch(()=>{});
    await db.run('CREATE INDEX IF NOT EXISTS idx_diag_r_test ON diagnostic_results(test_id)').catch(()=>{});

    // control_group_data — nazorat guruhi qo'lda kiritilgan ma'lumotlar
    await db.run(`
      CREATE TABLE IF NOT EXISTS control_group_data (
        id           SERIAL PRIMARY KEY,
        data         JSONB NOT NULL,
        description  TEXT DEFAULT '',
        created_by   INTEGER REFERENCES users(id),
        created_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // is_blocked ustuni qo'shish
    await db.run('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE').catch(()=>{});

    // assignments task_type CHECK constraint yangilash (powerpoint, paint qo'shish)
    await db.run('ALTER TABLE assignments DROP CONSTRAINT IF EXISTS assignments_task_type_check').catch(()=>{});
    await db.run(`ALTER TABLE assignments ADD CONSTRAINT assignments_task_type_check CHECK(task_type IN ('word','excel','powerpoint','access','paint','python','scratch','html','javascript','css','other'))`).catch(()=>{});

    // survey_responses — so'rovnoma javoblari
    await db.run(`
      CREATE TABLE IF NOT EXISTS survey_responses (
        id           SERIAL PRIMARY KEY,
        user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        answers      JSONB NOT NULL,
        open_answer  TEXT DEFAULT '',
        created_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await db.run('CREATE INDEX IF NOT EXISTS idx_survey_user ON survey_responses(user_id)').catch(()=>{});

    // ─── ADAPTIVE TEST TABLES ────────────────────────────────
    await db.run(`
      CREATE TABLE IF NOT EXISTS adaptive_tests (
        id            SERIAL PRIMARY KEY,
        lesson_id     INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
        status        TEXT DEFAULT 'draft' CHECK(status IN ('draft','published')),
        generated_from TEXT CHECK(generated_from IN ('material','topic_only')),
        created_by    INTEGER NOT NULL REFERENCES users(id),
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        updated_at    TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(lesson_id)
      )
    `);
    await db.run(`
      CREATE TABLE IF NOT EXISTS adaptive_questions (
        id               SERIAL PRIMARY KEY,
        adaptive_test_id INTEGER NOT NULL REFERENCES adaptive_tests(id) ON DELETE CASCADE,
        question_text    TEXT NOT NULL,
        option_a         TEXT NOT NULL,
        option_b         TEXT NOT NULL,
        option_c         TEXT NOT NULL,
        option_d         TEXT NOT NULL,
        correct_option   TEXT NOT NULL CHECK(correct_option IN ('a','b','c','d')),
        concept          TEXT NOT NULL,
        difficulty_level INTEGER DEFAULT 3 CHECK(difficulty_level BETWEEN 1 AND 5),
        explanation      TEXT DEFAULT '',
        edited_by_teacher BOOLEAN DEFAULT FALSE,
        order_number     INTEGER
      )
    `);
    // explanation ustunini mavjud jadvalga qo'shish (agar jadval allaqachon yaratilgan bo'lsa)
    await db.run('ALTER TABLE adaptive_questions ADD COLUMN IF NOT EXISTS explanation TEXT DEFAULT \'\'').catch(()=>{});
    await db.run(`
      CREATE TABLE IF NOT EXISTS adaptive_attempts (
        id                  SERIAL PRIMARY KEY,
        user_id             INTEGER NOT NULL REFERENCES users(id),
        adaptive_test_id    INTEGER NOT NULL REFERENCES adaptive_tests(id) ON DELETE CASCADE,
        current_difficulty  INTEGER DEFAULT 3,
        asked_question_ids  INTEGER[] DEFAULT '{}',
        answers             JSONB DEFAULT '[]',
        concept_scores      JSONB DEFAULT '{}',
        status              TEXT DEFAULT 'in_progress' CHECK(status IN ('in_progress','completed')),
        started_at          TIMESTAMPTZ DEFAULT NOW(),
        completed_at        TIMESTAMPTZ
      )
    `);
    await db.run(`
      CREATE TABLE IF NOT EXISTS concept_explanations (
        id               SERIAL PRIMARY KEY,
        adaptive_test_id INTEGER NOT NULL REFERENCES adaptive_tests(id) ON DELETE CASCADE,
        concept          TEXT NOT NULL,
        explanation_html TEXT NOT NULL,
        created_at       TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(adaptive_test_id, concept)
      )
    `);
    await db.run('CREATE INDEX IF NOT EXISTS idx_adaptive_tests_lesson ON adaptive_tests(lesson_id)').catch(()=>{});
    await db.run('CREATE INDEX IF NOT EXISTS idx_adaptive_questions_test ON adaptive_questions(adaptive_test_id)').catch(()=>{});
    await db.run('CREATE INDEX IF NOT EXISTS idx_adaptive_attempts_user ON adaptive_attempts(user_id)').catch(()=>{});
    await db.run('CREATE INDEX IF NOT EXISTS idx_adaptive_attempts_test ON adaptive_attempts(adaptive_test_id)').catch(()=>{});
    await db.run('CREATE INDEX IF NOT EXISTS idx_concept_explanations_test ON concept_explanations(adaptive_test_id)').catch(()=>{});

    // ─── MASTERY LEVEL TIZIMI ────────────────────────────────
    await db.run('ALTER TABLE lessons ADD COLUMN IF NOT EXISTS taught_at TIMESTAMPTZ').catch(()=>{});
    await db.run('ALTER TABLE tests ADD COLUMN IF NOT EXISTS max_score INTEGER DEFAULT 20').catch(()=>{});
    await db.run('ALTER TABLE users ADD COLUMN IF NOT EXISTS mastery_percent NUMERIC DEFAULT 0').catch(()=>{});

    // ─── FORUM APPROVAL TIZIMI ───────────────────────────────
    await db.run('ALTER TABLE users ADD COLUMN IF NOT EXISTS bonus_points INTEGER DEFAULT 0').catch(()=>{});
    await db.run('ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE').catch(()=>{});
    await db.run('ALTER TABLE forum_comments ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE').catch(()=>{});

    // ─── AI ANALYSIS CACHE ───────────────────────────────────
    await db.run(`
      CREATE TABLE IF NOT EXISTS ai_analysis_cache (
        id            SERIAL PRIMARY KEY,
        teacher_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        analysis_json TEXT NOT NULL DEFAULT '{}',
        raw_data      TEXT DEFAULT '{}',
        hard_topics   TEXT DEFAULT '[]',
        weak_students TEXT DEFAULT '[]',
        generated_at  TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(teacher_id)
      )
    `);

    // ─── ADAPTIVE BONUS ──────────────────────────────────────
    await db.run('ALTER TABLE adaptive_attempts ADD COLUMN IF NOT EXISTS bonus_awarded BOOLEAN DEFAULT FALSE').catch(()=>{});

    // ─── ASSIGNMENTS PUBLISH ─────────────────────────────────
    await db.run('ALTER TABLE assignments ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT TRUE').catch(()=>{});

    console.log('✓ Migrations applied');
  } catch (err) {
    console.error('Migration warning:', err.message);
  }
}

async function startServer() {
  try {
    // Connect to database
    console.log('🔌 Connecting to database...');
    await database.connect();
    console.log('✓ Database connected');
    
    // Check if tables exist (PostgreSQL information_schema)
    console.log('🔍 Checking database tables...');
    const checkTablesQuery = `
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'users'
    `;
    const tables = await database.get(checkTablesQuery);
    
    if (!tables) {
      console.log('⚠️  Database not initialized. Running initialization...');
      const { initializeTables, seedData } = require('./scripts/initDatabase');
      await initializeTables(database);
      await seedData(database);
      console.log('✅ Database initialized successfully!');
    } else {
      console.log('✓ Database already initialized');
      // Run incremental migrations for new tables
      await runMigrations(database);
    }
    
    // Start listening
    app.listen(PORT, '0.0.0.0', () => {
      console.log('\n🚀 InfoBaho Backend Server Started!');
      console.log(`📍 Server running on: http://0.0.0.0:${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📊 Database: PostgreSQL (${process.env.DATABASE_URL ? 'connected' : 'no URL set'})`);
      console.log(`\n✓ Ready to accept requests\n`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    console.error('Error stack:', error.stack);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\nShutting down gracefully...');
  await database.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n\nShutting down gracefully...');
  await database.close();
  process.exit(0);
});

startServer();

module.exports = app;
