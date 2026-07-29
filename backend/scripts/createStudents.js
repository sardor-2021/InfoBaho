/**
 * 19-maktab 9-sinf o'quvchilarini yaratish
 * Ishga tushirish: node scripts/createStudents.js
 */

require('dotenv').config();
const database = require('../config/database');
const User = require('../models/User');

const students = [
  { full_name: "Abdunazarova O'g'ilxon", username: 'abdunazarova_ogilxon' },
  { full_name: 'Abdusattorova Robiya', username: 'abdusattorova_robiya' },
  { full_name: 'Adiljonova Rayxona', username: 'adiljonova_rayxona' },
  { full_name: 'Atamirzaev Muxammadlaziz', username: 'atamirzaev_muxammadlaziz' },
  { full_name: "Azimjonova O'g'iloy", username: 'azimjonova_ogiloy' },
  { full_name: 'Bulanov Elbek', username: 'bulanov_elbek' },
  { full_name: 'Dominjonov Muxammadqodir', username: 'dominjonov_muxammadqodir' },
  { full_name: 'Ergashbaeva Vasilaxon', username: 'ergashbaeva_vasilaxon' },
  { full_name: 'Ergasheva Parizoda', username: 'ergasheva_parizoda' },
  { full_name: 'Ibodillaev Shoxrux', username: 'ibodillaev_shoxrux' },
  { full_name: 'Ismanliev Bekzod', username: 'ismanliev_bekzod' },
  { full_name: 'Ismanaliev Sanjarbek', username: 'ismanaliev_sanjarbek' },
  { full_name: 'Jaraxonova Shirinoy', username: 'jaraxonova_shirinoy' },
];

async function createStudents() {
  try {
    await database.connect();
    console.log('✅ Database connected');

    let created = 0;
    let skipped = 0;

    for (const student of students) {
      // Avval borligini tekshirish
      const exists = await User.usernameExists(student.username);
      if (exists) {
        console.log(`⏭️  ${student.username} — allaqachon mavjud`);
        skipped++;
        continue;
      }

      await User.create({
        username: student.username,
        email: `${student.username}@19maktab.uz`,
        password: '123456',
        full_name: student.full_name,
        role: 'student',
        district: "Uchqo'rg'on tumani",
        school_number: '19',
        class_name: '9-A',
        teaching_classes: ''
      });

      console.log(`✅ ${student.full_name} — yaratildi (${student.username})`);
      created++;
    }

    console.log(`\n📊 Natija: ${created} ta yaratildi, ${skipped} ta o'tkazib yuborildi`);
    console.log('\n📋 Login ma\'lumotlari:');
    console.log('─'.repeat(50));
    for (const s of students) {
      console.log(`${s.full_name.padEnd(30)} | ${s.username} | 123456`);
    }
    console.log('─'.repeat(50));
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Xatolik:', err.message);
    process.exit(1);
  }
}

createStudents();
