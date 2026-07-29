// Migration: Daraja tizimini foiz asosiga o'zgartirish
// taught_at, tests.max_score, users.mastery_percent ustunlari qo'shiladi
const database = require('../config/database');

async function migrate() {
  console.log('🔄 Running mastery level migration...');
  try {
    await database.connect();

    // Dars "o'tildi" deb belgilanganda to'ldiriladi (NULL = hali o'tilmagan)
    await database.run(`ALTER TABLE lessons ADD COLUMN IF NOT EXISTS taught_at TIMESTAMPTZ`);
    console.log('✓ lessons.taught_at qo\'shildi');

    // O'qituvchi test uchun umumiy maksimal ballni belgilaydi
    await database.run(`ALTER TABLE tests ADD COLUMN IF NOT EXISTS max_score INTEGER DEFAULT 20`);
    console.log('✓ tests.max_score qo\'shildi');

    // Foydalanuvchida joriy foiz saqlanadi
    await database.run(`ALTER TABLE users ADD COLUMN IF NOT EXISTS mastery_percent NUMERIC DEFAULT 0`);
    console.log('✓ users.mastery_percent qo\'shildi');

    console.log('✅ Mastery level migration completed!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await database.close();
  }
}

migrate();
