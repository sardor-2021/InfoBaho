// Migration: assignments va assignment_submissions jadvallarini qo'shish
// Mavjud DB ga yangi jadvallar qo'shadi (DROP qilmaydi)
const database = require('../config/database');

async function migrate() {
  console.log('🔄 Running assignments migration...');
  try {
    await database.connect();

    // assignments
    await database.run(`
      CREATE TABLE IF NOT EXISTS assignments (
        id            SERIAL PRIMARY KEY,
        lesson_id     INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
        created_by    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title         TEXT NOT NULL,
        description   TEXT NOT NULL DEFAULT '',
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
    console.log('✓ assignments table ready');

    // assignment_submissions
    await database.run(`
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
        status          TEXT DEFAULT 'submitted'
                        CHECK(status IN ('submitted','graded')),
        UNIQUE(assignment_id, student_id)
      )
    `);
    console.log('✓ assignment_submissions table ready');

    // Indexes (IF NOT EXISTS PostgreSQL 9.5+)
    await database.run('CREATE INDEX IF NOT EXISTS idx_assignments_lesson   ON assignments(lesson_id)').catch(() => {});
    await database.run('CREATE INDEX IF NOT EXISTS idx_submissions_assign   ON assignment_submissions(assignment_id)').catch(() => {});
    await database.run('CREATE INDEX IF NOT EXISTS idx_submissions_student  ON assignment_submissions(student_id)').catch(() => {});

    console.log('✅ Migration completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await database.close();
  }
}

migrate();
