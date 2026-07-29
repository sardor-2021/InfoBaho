const database = require('../config/database');
const User = require('../models/User');
const Test = require('../models/Test');
const Question = require('../models/Question');

async function seedData() {
  console.log('🌱 Seeding InfoTest Database with demo data...\n');

  try {
    await database.connect();

    // Create users
    console.log('👥 Creating users...');
    
    // Admin
    const adminId = await User.create({
      username: 'admin',
      email: 'admin@infotest.uz',
      password: 'admin123',
      full_name: 'Admin User',
      role: 'admin',
      bio: 'System Administrator'
    });
    console.log('✓ Created admin user');

    // Teacher
    const teacherId = await User.create({
      username: 'o_qituvchi',
      email: 'teacher@infotest.uz',
      password: 'teacher123',
      full_name: 'Olimjon Rahmatov',
      role: 'teacher',
      bio: 'Informatika fani o\'qituvchisi, 10 yillik tajriba'
    });
    console.log('✓ Created teacher user');

    // Students
    const student1Id = await User.create({
      username: 'akmal_yusupov',
      email: 'akmal@student.uz',
      password: 'student123',
      full_name: 'Akmal Yusupov',
      role: 'student',
      bio: '10-sinf o\'quvchisi, dasturlashga qiziqadi'
    });

    const student2Id = await User.create({
      username: 'malika_azimova',
      email: 'malika@student.uz',
      password: 'student123',
      full_name: 'Malika Azimova',
      role: 'student',
      bio: '9-sinf o\'quvchisi'
    });

    const student3Id = await User.create({
      username: 'sardor_karimov',
      email: 'sardor@student.uz',
      password: 'student123',
      full_name: 'Sardor Karimov',
      role: 'student',
      bio: '10-sinf o\'quvchisi'
    });

    console.log('✓ Created 3 student users');

    // Add some points to students for testing
    await User.addPoints(student1Id, 150);
    await User.addPoints(student2Id, 80);
    await User.addPoints(student3Id, 220);

    // Create achievements
    console.log('\n🏆 Creating achievements...');
    
    await database.run(`
      INSERT INTO achievements (name, description, badge_icon, criteria, points_reward)
      VALUES 
        ('Birinchi Test', 'Birinchi testni muvaffaqiyatli topshirdingiz!', '🎯', 'first_test', 10),
        ('10 ta Test', '10 ta testni topshirdingiz!', '📚', '10_tests', 50),
        ('Mukammal Ball', 'Testdan 95% dan yuqori ball oldingiz!', '⭐', 'perfect_score', 100)
    `);
    console.log('✓ Created 3 achievements');

    // Create tests
    console.log('\n📝 Creating tests...');

    // Test 1: Python asoslari
    const test1Id = await Test.create({
      title: 'Python Dasturlash Asoslari',
      description: 'Python dasturlash tilining asosiy tushunchalari: o\'zgaruvchilar, ma\'lumot turlari, operatorlar',
      subject: 'Informatika',
      duration: 30,
      difficulty: 'easy',
      passing_score: 60,
      created_by: teacherId
    });

    // Questions for Test 1
    await Question.create({
      test_id: test1Id,
      question_text: 'Python da o\'zgaruvchi qanday yaratiladi?',
      question_type: 'single_choice',
      options: ['var x = 5', 'x = 5', 'int x = 5', 'x := 5'],
      correct_answer: 'x = 5',
      points: 5,
      explanation: 'Python da o\'zgaruvchi yaratish uchun faqat nom va qiymat yetarli.',
      order_number: 1
    });

    await Question.create({
      test_id: test1Id,
      question_text: 'Quyidagi kodning natijasi nima?\n\nx = 10\ny = 3\nprint(x // y)',
      question_type: 'single_choice',
      options: ['3.33', '3', '3.0', '4'],
      correct_answer: '3',
      points: 5,
      explanation: '// operatori butun bo\'lish operatori, faqat butun qismini qaytaradi.',
      order_number: 2
    });

    await Question.create({
      test_id: test1Id,
      question_text: 'Python da string va raqamni qo\'shish mumkinmi?',
      question_type: 'true_false',
      options: ['True', 'False'],
      correct_answer: 'False',
      points: 5,
      explanation: 'Python da turli turdagi ma\'lumotlarni bevosita qo\'shib bo\'lmaydi.',
      order_number: 3
    });

    await Test.updateQuestionCount(test1Id);
    await Test.publish(test1Id);
    console.log('✓ Created Test 1: Python Asoslari (3 questions)');

    // Test 2: Algoritmlar
    const test2Id = await Test.create({
      title: 'Algoritmlar va Ma\'lumotlar Tuzilmasi',
      description: 'Algoritmlar nazariyasi, saralash algoritmlari, qidirish algoritmlari',
      subject: 'Informatika',
      duration: 45,
      difficulty: 'medium',
      passing_score: 65,
      created_by: teacherId
    });

    await Question.create({
      test_id: test2Id,
      question_text: 'Bubble sort algoritmining eng yomon holatdagi murakkabligi qanday?',
      question_type: 'single_choice',
      options: ['O(n)', 'O(n log n)', 'O(n²)', 'O(log n)'],
      correct_answer: 'O(n²)',
      points: 10,
      explanation: 'Bubble sort ning eng yomon holatda O(n²) murakkablikka ega.',
      order_number: 1
    });

    await Question.create({
      test_id: test2Id,
      question_text: 'Binary search faqat qanday massivda ishlaydi?',
      question_type: 'short_answer',
      options: null,
      correct_answer: 'saralangan',
      points: 10,
      explanation: 'Binary search faqat saralangan massivda ishlaydi.',
      order_number: 2
    });

    await Test.updateQuestionCount(test2Id);
    await Test.publish(test2Id);
    console.log('✓ Created Test 2: Algoritmlar (2 questions)');

    // Test 3: Unpublished test for teacher
    const test3Id = await Test.create({
      title: 'Web Dasturlash - HTML/CSS',
      description: 'HTML va CSS asoslari (hali tayyor emas)',
      subject: 'Informatika',
      duration: 40,
      difficulty: 'easy',
      passing_score: 60,
      created_by: teacherId
    });
    console.log('✓ Created Test 3: Web Dasturlash (unpublished)');

    // Create some test results for students
    console.log('\n📊 Creating sample test results...');

    // Student 1 results
    await database.run(`
      INSERT INTO test_attempts (user_id, test_id, completed_at, status)
      VALUES (?, ?, datetime('now', '-2 days'), 'completed')
    `, [student1Id, test1Id]);

    await database.run(`
      INSERT INTO results (
        attempt_id, user_id, test_id, score, percentage,
        total_questions, correct_answers, time_taken, passed, answers
      ) VALUES (
        (SELECT MAX(id) FROM test_attempts),
        ?, ?, 15, 100, 3, 3, 15, 1, '[]'
      )
    `, [student1Id, test1Id]);

    // Update statistics
    await database.run(`
      UPDATE statistics SET
        total_tests_taken = 1,
        total_tests_passed = 1,
        average_score = 100,
        last_activity = datetime('now', '-2 days')
      WHERE user_id = ?
    `, [student1Id]);

    console.log('✓ Created sample results for student 1');

    // Award first achievement to student 1
    await database.run(`
      INSERT INTO user_achievements (user_id, achievement_id)
      VALUES (?, 1)
    `, [student1Id]);
    console.log('✓ Awarded achievement to student 1');

    // Create portfolio item
    console.log('\n📁 Creating portfolio items...');
    
    await database.run(`
      INSERT INTO portfolio_items (
        user_id, title, description, item_type, content, is_public
      ) VALUES (
        ?,
        'Birinchi Python Dasturim',
        'Bu mening birinchi Python dasturim - oddiy kalkulyator',
        'project',
        'def calculator(a, b, op):\n    if op == "+":\n        return a + b\n    elif op == "-":\n        return a - b',
        1
      )
    `, [student1Id]);
    console.log('✓ Created portfolio item for student 1');

    console.log('\n✅ Database seeding completed successfully!\n');
    console.log('📋 Demo Accounts:');
    console.log('   Admin:      username: admin          password: admin123');
    console.log('   Teacher:    username: o_qituvchi     password: teacher123');
    console.log('   Student 1:  username: akmal_yusupov  password: student123');
    console.log('   Student 2:  username: malika_azimova password: student123');
    console.log('   Student 3:  username: sardor_karimov password: student123\n');

  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    throw error;
  } finally {
    await database.close();
  }
}

// Run if called directly
if (require.main === module) {
  seedData()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = seedData;
