const bcrypt = require('bcryptjs');

// Initialize all tables
async function initializeTables(db) {
  console.log('📝 Creating database tables...');

  try {
    // Drop tables in reverse dependency order (CASCADE handles FK deps)
    const dropTables = [
      'DROP TABLE IF EXISTS user_achievements CASCADE',
      'DROP TABLE IF EXISTS achievements CASCADE',
      'DROP TABLE IF EXISTS statistics CASCADE',
      'DROP TABLE IF EXISTS portfolio_items CASCADE',
      'DROP TABLE IF EXISTS lesson_materials CASCADE',
      'DROP TABLE IF EXISTS results CASCADE',
      'DROP TABLE IF EXISTS test_attempts CASCADE',
      'DROP TABLE IF EXISTS questions CASCADE',
      'DROP TABLE IF EXISTS tests CASCADE',
      'DROP TABLE IF EXISTS lessons CASCADE',
      'DROP TABLE IF EXISTS users CASCADE'
    ];

    for (const sql of dropTables) {
      await db.run(sql);
    }
    console.log('✓ Existing tables dropped');

    // users
    await db.run(`
      CREATE TABLE users (
        id            SERIAL PRIMARY KEY,
        username      TEXT UNIQUE NOT NULL,
        email         TEXT UNIQUE NOT NULL,
        password      TEXT NOT NULL,
        full_name     TEXT NOT NULL,
        role          TEXT NOT NULL CHECK(role IN ('student','teacher','admin')),
        district      TEXT,
        school_number TEXT,
        class_name    TEXT,
        teaching_classes TEXT,
        avatar        TEXT,
        points        INTEGER DEFAULT 0,
        level         INTEGER DEFAULT 1,
        bio           TEXT,
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        updated_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // lessons  (before tests — tests has FK to lessons)
    await db.run(`
      CREATE TABLE lessons (
        id          SERIAL PRIMARY KEY,
        title       TEXT NOT NULL,
        description TEXT,
        grade       INTEGER NOT NULL CHECK(grade IN (9,10)),
        subject     TEXT NOT NULL,
        content     TEXT,
        created_by  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // tests
    await db.run(`
      CREATE TABLE tests (
        id            SERIAL PRIMARY KEY,
        title         TEXT NOT NULL,
        description   TEXT,
        subject       TEXT NOT NULL,
        lesson_id     INTEGER REFERENCES lessons(id) ON DELETE SET NULL,
        duration      INTEGER NOT NULL,
        total_questions INTEGER DEFAULT 0,
        difficulty    TEXT CHECK(difficulty IN ('easy','medium','hard')),
        passing_score INTEGER DEFAULT 60,
        is_published  BOOLEAN DEFAULT FALSE,
        created_by    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        updated_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // lesson_materials
    await db.run(`
      CREATE TABLE lesson_materials (
        id          SERIAL PRIMARY KEY,
        lesson_id   INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
        file_name   TEXT NOT NULL,
        file_path   TEXT NOT NULL,
        file_type   TEXT NOT NULL,
        file_size   INTEGER,
        uploaded_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // questions
    await db.run(`
      CREATE TABLE questions (
        id            SERIAL PRIMARY KEY,
        test_id       INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
        question_text TEXT NOT NULL,
        question_type TEXT NOT NULL CHECK(question_type IN (
          'single_choice','multiple_choice','true_false',
          'short_answer','code_writing','matching'
        )),
        options       TEXT,
        correct_answer TEXT NOT NULL,
        points        INTEGER DEFAULT 1,
        explanation   TEXT,
        image_url     TEXT,
        order_number  INTEGER,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // test_attempts
    await db.run(`
      CREATE TABLE test_attempts (
        id           SERIAL PRIMARY KEY,
        user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        test_id      INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
        started_at   TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        status       TEXT DEFAULT 'in_progress'
                     CHECK(status IN ('in_progress','completed','abandoned'))
      )
    `);

    // results
    await db.run(`
      CREATE TABLE results (
        id               SERIAL PRIMARY KEY,
        attempt_id       INTEGER NOT NULL REFERENCES test_attempts(id) ON DELETE CASCADE,
        user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        test_id          INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
        score            REAL NOT NULL,
        percentage       REAL NOT NULL,
        total_questions  INTEGER NOT NULL,
        correct_answers  INTEGER NOT NULL,
        time_taken       INTEGER,
        answers          TEXT,
        passed           BOOLEAN,
        created_at       TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // portfolio_items
    await db.run(`
      CREATE TABLE portfolio_items (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title       TEXT NOT NULL,
        description TEXT,
        item_type   TEXT CHECK(item_type IN ('project','achievement','test_result','certificate')),
        content     TEXT,
        file_url    TEXT,
        tags        TEXT,
        is_public   BOOLEAN DEFAULT FALSE,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // achievements
    await db.run(`
      CREATE TABLE achievements (
        id            SERIAL PRIMARY KEY,
        name          TEXT NOT NULL,
        description   TEXT,
        badge_icon    TEXT,
        criteria      TEXT NOT NULL,
        points_reward INTEGER DEFAULT 0,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // user_achievements
    await db.run(`
      CREATE TABLE user_achievements (
        id             SERIAL PRIMARY KEY,
        user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        achievement_id INTEGER NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
        earned_at      TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, achievement_id)
      )
    `);

    // statistics
    await db.run(`
      CREATE TABLE statistics (
        id                SERIAL PRIMARY KEY,
        user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        total_tests_taken INTEGER DEFAULT 0,
        total_tests_passed INTEGER DEFAULT 0,
        average_score     REAL DEFAULT 0,
        total_time_spent  INTEGER DEFAULT 0,
        streak_days       INTEGER DEFAULT 0,
        last_activity     TIMESTAMPTZ,
        updated_at        TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id)
      )
    `);

    // lesson_progress — dars bo'yicha o'quvchi o'zlashtirish ko'rsatkichi
    await db.run(`
      CREATE TABLE IF NOT EXISTS lesson_progress (
        id                SERIAL PRIMARY KEY,
        lesson_id         INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
        student_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        total_possible    INTEGER DEFAULT 0,   -- darsning maksimal bali (testlar + topshiriqlar)
        earned_score      INTEGER DEFAULT 0,   -- o'quvchi to'plagan ball
        percent           REAL DEFAULT 0,      -- foiz
        grade             INTEGER DEFAULT 0,   -- baho: 2,3,4,5
        grade_awarded     BOOLEAN DEFAULT FALSE, -- baho bali users.points ga qo'shilganmi
        updated_at        TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(lesson_id, student_id)
      )
    `);

    // assignments
    await db.run(`
      CREATE TABLE assignments (
        id            SERIAL PRIMARY KEY,
        lesson_id     INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
        created_by    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title         TEXT NOT NULL,
        description   TEXT NOT NULL,
        task_type     TEXT NOT NULL CHECK(task_type IN (
          'word','excel','access','python','scratch','html','javascript','css','other'
        )),
        instructions  TEXT NOT NULL,
        max_score     INTEGER DEFAULT 100,
        deadline      TIMESTAMPTZ,
        ai_generated  BOOLEAN DEFAULT FALSE,
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        updated_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // assignment_submissions
    await db.run(`
      CREATE TABLE assignment_submissions (
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
        status          TEXT DEFAULT 'submitted'
                        CHECK(status IN ('submitted','graded')),
        UNIQUE(assignment_id, student_id)
      )
    `);

    // Indexes
    await db.run('CREATE INDEX idx_users_username        ON users(username)');
    await db.run('CREATE INDEX idx_users_email           ON users(email)');
    await db.run('CREATE INDEX idx_tests_created_by      ON tests(created_by)');
    await db.run('CREATE INDEX idx_tests_lesson_id       ON tests(lesson_id)');
    await db.run('CREATE INDEX idx_lessons_created_by    ON lessons(created_by)');
    await db.run('CREATE INDEX idx_lessons_grade         ON lessons(grade)');
    await db.run('CREATE INDEX idx_lesson_materials_lid  ON lesson_materials(lesson_id)');
    await db.run('CREATE INDEX idx_assignments_lesson    ON assignments(lesson_id)');
    await db.run('CREATE INDEX idx_submissions_assign    ON assignment_submissions(assignment_id)');
    await db.run('CREATE INDEX idx_submissions_student   ON assignment_submissions(student_id)');
    await db.run('CREATE INDEX idx_questions_test_id     ON questions(test_id)');
    await db.run('CREATE INDEX idx_results_user_id       ON results(user_id)');
    await db.run('CREATE INDEX idx_results_test_id       ON results(test_id)');
    await db.run('CREATE INDEX idx_portfolio_user_id     ON portfolio_items(user_id)');

    console.log('✅ All tables created successfully!');
  } catch (error) {
    console.error('❌ Table creation failed:', error);
    throw error;
  }
}

// Seed demo accounts
async function seedData(db) {
  console.log('🌱 Seeding demo data...');

  try {
    const adminPwd   = await bcrypt.hash('admin123',   10);
    const teacherPwd = await bcrypt.hash('teacher123', 10);
    const studentPwd = await bcrypt.hash('student123', 10);

    const adminResult = await db.run(
      `INSERT INTO users (username,email,password,full_name,role,points,level,district,school_number)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      ['admin','admin@infotest.uz',adminPwd,'Administrator','admin',0,1,'','']
    );

    const teacherResult = await db.run(
      `INSERT INTO users (username,email,password,full_name,role,bio,points,level,district,school_number,teaching_classes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      ['o_qituvchi','teacher@infotest.uz',teacherPwd,"O'qituvchi Javobi",'teacher',
       "Matematika va Informatika fanlari o'qituvchisi",0,1,'Namangan tumani','15','10-A,10-B,10-V']
    );

    const s1 = await db.run(
      `INSERT INTO users (username,email,password,full_name,role,bio,points,level,district,school_number,class_name)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      ['akmal_yusupov','akmal@infotest.uz',studentPwd,'Akmal Yusupov','student',
       "10-sinf o'quvchisi, dasturlashga qiziqadi",150,2,'Namangan tumani','15','10-A']
    );

    // Statistics rows
    for (const r of [adminResult, teacherResult, s1]) {
      await db.run('INSERT INTO statistics (user_id) VALUES (?)', [r.id]);
    }

    console.log('✅ Demo users created!');
    console.log('\n📋 Demo Accounts:');
    console.log('   Admin:   admin / admin123');
    console.log('   Teacher: o_qituvchi / teacher123');
    console.log('   Student: akmal_yusupov / student123\n');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
}

// Standalone run
async function initDatabase() {
  const database = require('../config/database');
  console.log('🔧 Initializing InfoTest Database (PostgreSQL)...\n');
  try {
    await database.connect();
    await initializeTables(database);
    await seedData(database);
    console.log('✅ Database initialization completed!\n');
  } catch (error) {
    console.error('❌ Initialization failed:', error);
    throw error;
  } finally {
    await database.close();
  }
}

if (require.main === module) {
  initDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { initDatabase, initializeTables, seedData };
