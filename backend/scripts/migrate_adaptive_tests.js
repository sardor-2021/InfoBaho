// Migration: Adaptiv test jadvallari qo'shish
// Mavjud DB ga yangi jadvallar qo'shadi (DROP qilmaydi)
const database = require('../config/database');

async function migrate() {
  console.log('🔄 Running adaptive tests migration...');
  try {
    await database.connect();

    // adaptive_tests
    await database.run(`
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
    console.log('✓ adaptive_tests table ready');

    // adaptive_questions
    await database.run(`
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
    console.log('✓ adaptive_questions table ready');

    // adaptive_attempts
    await database.run(`
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
    console.log('✓ adaptive_attempts table ready');

    // concept_explanations (kesh — bir marta yaratilsa, qayta AI chaqirilmaydi)
    await database.run(`
      CREATE TABLE IF NOT EXISTS concept_explanations (
        id               SERIAL PRIMARY KEY,
        adaptive_test_id INTEGER NOT NULL REFERENCES adaptive_tests(id) ON DELETE CASCADE,
        concept          TEXT NOT NULL,
        explanation_html TEXT NOT NULL,
        created_at       TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(adaptive_test_id, concept)
      )
    `);
    console.log('✓ concept_explanations table ready');

    // Indexes
    await database.run('CREATE INDEX IF NOT EXISTS idx_adaptive_tests_lesson ON adaptive_tests(lesson_id)').catch(() => {});
    await database.run('CREATE INDEX IF NOT EXISTS idx_adaptive_questions_test ON adaptive_questions(adaptive_test_id)').catch(() => {});
    await database.run('CREATE INDEX IF NOT EXISTS idx_adaptive_attempts_user ON adaptive_attempts(user_id)').catch(() => {});
    await database.run('CREATE INDEX IF NOT EXISTS idx_adaptive_attempts_test ON adaptive_attempts(adaptive_test_id)').catch(() => {});
    await database.run('CREATE INDEX IF NOT EXISTS idx_concept_explanations_test ON concept_explanations(adaptive_test_id)').catch(() => {});

    console.log('✅ Adaptive tests migration completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await database.close();
  }
}

migrate();
