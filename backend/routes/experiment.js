/**
 * Tajriba-sinov ishlari statistik hisoblash
 * PhD dissertatsiya uchun — Student t-test, Fisher F-test, Cohen's d,
 * Cronbach's alpha, o'rtacha, dispersiya, standart og'ish
 */

const express = require('express');
const database = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// ─── Statistik funksiyalar ───────────────────────────────────

// O'rtacha (Mean)
function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

// Dispersiya (Variance)
function variance(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return arr.reduce((s, v) => s + Math.pow(v - m, 2), 0) / (arr.length - 1);
}

// Standart og'ish (Standard Deviation)
function stdDev(arr) {
  return Math.sqrt(variance(arr));
}

// Standard Error of Mean
function sem(arr) {
  if (!arr.length) return 0;
  return stdDev(arr) / Math.sqrt(arr.length);
}

// Independent Samples t-test (Student)
function tTest(group1, group2) {
  const n1 = group1.length;
  const n2 = group2.length;
  if (n1 < 2 || n2 < 2) return { t: 0, df: 0, p: 1, significant: false };

  const m1 = mean(group1);
  const m2 = mean(group2);
  const v1 = variance(group1);
  const v2 = variance(group2);

  // Pooled variance
  const sp = Math.sqrt(((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2));
  const t = (m1 - m2) / (sp * Math.sqrt(1/n1 + 1/n2));
  const df = n1 + n2 - 2;

  // p-value taxminiy (t-distribution approximation)
  const p = tDistPValue(Math.abs(t), df);

  return {
    t: round(t, 4),
    df,
    p: round(p, 6),
    significant: p < 0.05,
    significance_level: p < 0.001 ? '***' : p < 0.01 ? '**' : p < 0.05 ? '*' : 'ns'
  };
}

// Fisher F-test (dispersiyalar tengligi)
function fisherTest(group1, group2) {
  const v1 = variance(group1);
  const v2 = variance(group2);
  if (v2 === 0) return { F: 0, df1: 0, df2: 0, p: 1, equal_variances: true };

  const F = v1 > v2 ? v1 / v2 : v2 / v1;
  const df1 = (v1 > v2 ? group1.length : group2.length) - 1;
  const df2 = (v1 > v2 ? group2.length : group1.length) - 1;

  // F-distribution p-value taxminiy
  const p = fDistPValue(F, df1, df2);

  return {
    F: round(F, 4),
    df1,
    df2,
    p: round(p, 6),
    equal_variances: p > 0.05,
    significance: p < 0.05 ? 'Dispersiyalar teng emas' : 'Dispersiyalar teng'
  };
}

// Cohen's d (effekt o'lchami)
function cohensD(group1, group2) {
  const m1 = mean(group1);
  const m2 = mean(group2);
  const n1 = group1.length;
  const n2 = group2.length;

  // Pooled standard deviation
  const sp = Math.sqrt(
    ((n1 - 1) * variance(group1) + (n2 - 1) * variance(group2)) / (n1 + n2 - 2)
  );

  if (sp === 0) return { d: 0, interpretation: 'Hisoblash imkonsiz' };

  const d = (m1 - m2) / sp;

  let interpretation = '';
  const absD = Math.abs(d);
  if (absD >= 0.8) interpretation = 'Katta effekt (large)';
  else if (absD >= 0.5) interpretation = "O'rta effekt (medium)";
  else if (absD >= 0.2) interpretation = 'Kichik effekt (small)';
  else interpretation = "Effekt yo'q (negligible)";

  return { d: round(d, 4), abs_d: round(absD, 4), interpretation };
}

// Cronbach's Alpha (ichki izchillik)
function cronbachAlpha(items) {
  // items = [[q1_scores], [q2_scores], ...] — har savol bo'yicha ballar
  const k = items.length;
  if (k < 2) return { alpha: 0, interpretation: 'Kamida 2 ta element kerak' };

  const itemVariances = items.map(item => variance(item));
  const sumItemVariances = itemVariances.reduce((s, v) => s + v, 0);

  // Umumiy ball variansi
  const totalScores = items[0].map((_, i) =>
    items.reduce((sum, item) => sum + (item[i] || 0), 0)
  );
  const totalVariance = variance(totalScores);

  if (totalVariance === 0) return { alpha: 0, interpretation: 'Variansiya 0' };

  const alpha = (k / (k - 1)) * (1 - sumItemVariances / totalVariance);

  let interpretation = '';
  if (alpha >= 0.9) interpretation = "A'lo (excellent)";
  else if (alpha >= 0.8) interpretation = 'Yaxshi (good)';
  else if (alpha >= 0.7) interpretation = "Qabul qilinarli (acceptable)";
  else if (alpha >= 0.6) interpretation = "So'roqli (questionable)";
  else interpretation = 'Past (poor)';

  return { alpha: round(alpha, 4), interpretation };
}

// Paired t-test (pre-test vs post-test)
function pairedTTest(pre, post) {
  if (pre.length !== post.length || pre.length < 2)
    return { t: 0, df: 0, p: 1, significant: false };

  const differences = pre.map((v, i) => post[i] - v);
  const n = differences.length;
  const mDiff = mean(differences);
  const sDiff = stdDev(differences);
  const t = mDiff / (sDiff / Math.sqrt(n));
  const df = n - 1;
  const p = tDistPValue(Math.abs(t), df);

  return {
    t: round(t, 4),
    df,
    p: round(p, 6),
    mean_difference: round(mDiff, 2),
    significant: p < 0.05,
    significance_level: p < 0.001 ? '***' : p < 0.01 ? '**' : p < 0.05 ? '*' : 'ns'
  };
}

// ─── P-value approximation ───────────────────────────────────

function tDistPValue(t, df) {
  // Student t-distribution p-value (two-tailed) approximation
  const x = df / (df + t * t);
  return incompleteBeta(df / 2, 0.5, x);
}

function fDistPValue(F, df1, df2) {
  // F-distribution p-value approximation
  const x = df2 / (df2 + df1 * F);
  return incompleteBeta(df2 / 2, df1 / 2, x);
}

// Incomplete Beta function (regularized) — approximation
function incompleteBeta(a, b, x) {
  if (x <= 0) return 1;
  if (x >= 1) return 0;
  // Simple approximation using continued fraction
  const lnBeta = lgamma(a) + lgamma(b) - lgamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnBeta) / a;
  // Use series expansion
  let sum = 1, term = 1;
  for (let i = 0; i < 200; i++) {
    const num = (a + i) * (a + b + i) * x;
    const den = (a + 2 * i) * (a + 2 * i + 1);
    term *= -num / den;
    sum += term;
    if (Math.abs(term) < 1e-10) break;
  }
  const result = 1 - front * sum;
  return Math.max(0, Math.min(1, result));
}

function lgamma(x) {
  // Stirling's approximation for log-gamma
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

function round(val, decimals) {
  return Math.round(val * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

// ═══════════════════════════════════════════════════════════════
// API ENDPOINT
// ═══════════════════════════════════════════════════════════════

router.get('/stats', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Faqat admin ko\'ra oladi' });
    }

    const { district, school_number, class_name } = req.query;

    // Filter shartlari
    let filterWhere = "WHERE u.role = 'student'";
    const filterParams = [];
    if (district) { filterWhere += ' AND u.district = ?'; filterParams.push(district); }
    if (school_number) { filterWhere += ' AND u.school_number = ?'; filterParams.push(school_number); }
    if (class_name) { filterWhere += ' AND u.class_name = ?'; filterParams.push(class_name); }

    // ═══ TAJRIBA GURUHI — platformadan foydalanuvchilar ═══
    // Diagnostik test (pre-test) natijalari
    const preTestResults = await database.all(`
      SELECT dr.user_id, dr.percentage, u.full_name, u.class_name
      FROM diagnostic_results dr
      JOIN users u ON dr.user_id = u.id
      ${filterWhere}
      ORDER BY dr.created_at ASC
    `, filterParams);

    // Yakuniy test (post-test) — platformadagi eng oxirgi test natijalari
    const postTestResults = await database.all(`
      SELECT DISTINCT ON (r.user_id) r.user_id, r.percentage, u.full_name, u.class_name
      FROM results r
      JOIN users u ON r.user_id = u.id
      ${filterWhere}
      ORDER BY r.user_id, r.created_at DESC
    `, filterParams);

    // ═══ NAZORAT GURUHI — qo'lda kiritilgan ma'lumotlar ═══
    const controlData = await database.all(
      'SELECT * FROM control_group_data ORDER BY created_at DESC LIMIT 1'
    );
    const controlGroup = controlData.length > 0
      ? (typeof controlData[0].data === 'string' ? JSON.parse(controlData[0].data) : controlData[0].data)
      : null;

    // Tajriba guruhi ballari (FOIZ)
    const expPreScores = preTestResults.map(r => r.percentage);
    const expPostScores = postTestResults.map(r => r.percentage);

    // Paired t-test uchun — faqat IKKALA test ham bo'lgan o'quvchilar (user_id bo'yicha moslashgan)
    const preByUser = {};
    preTestResults.forEach(r => { preByUser[r.user_id] = r.percentage; });
    const postByUser = {};
    postTestResults.forEach(r => { postByUser[r.user_id] = r.percentage; });

    const pairedUserIds = Object.keys(preByUser).filter(uid => postByUser[uid] != null);
    const pairedPreScores = pairedUserIds.map(uid => preByUser[uid]);
    const pairedPostScores = pairedUserIds.map(uid => postByUser[uid]);

    // Nazorat guruhi ballari - FOIZ (qo'lda kiritilgan)
    const ctrlPreScores = controlGroup?.pre_test || [];
    const ctrlPostScores = controlGroup?.post_test || [];

    // FOIZ → BAHO konversiya funksiyasi
    const percentToGrade = (percent) => {
      if (percent >= 81) return 5;
      if (percent >= 60) return 4;
      if (percent >= 40) return 3;
      return 2;
    };

    // BAHO formatidagi massivlar
    const expPreGrades = expPreScores.map(percentToGrade);
    const expPostGrades = expPostScores.map(percentToGrade);
    const ctrlPreGrades = ctrlPreScores.map(percentToGrade);
    const ctrlPostGrades = ctrlPostScores.map(percentToGrade);

    // ═══ HISOBLASHLAR ═══

    // 1. Tajriba guruhi umumiy statistikasi
    const expStats = {
      pre: {
        n: expPreScores.length,
        mean: round(mean(expPreScores), 2),
        std_dev: round(stdDev(expPreScores), 2),
        variance: round(variance(expPreScores), 2),
      },
      post: {
        n: expPostScores.length,
        mean: round(mean(expPostScores), 2),
        std_dev: round(stdDev(expPostScores), 2),
        variance: round(variance(expPostScores), 2),
      }
    };

    // 2. Nazorat guruhi umumiy statistikasi
    const ctrlStats = {
      pre: {
        n: ctrlPreScores.length,
        mean: round(mean(ctrlPreScores), 2),
        std_dev: round(stdDev(ctrlPreScores), 2),
        variance: round(variance(ctrlPreScores), 2),
      },
      post: {
        n: ctrlPostScores.length,
        mean: round(mean(ctrlPostScores), 2),
        std_dev: round(stdDev(ctrlPostScores), 2),
        variance: round(variance(ctrlPostScores), 2),
      }
    };

    // 3. Student t-test: tajriba vs nazorat (POST-TEST natijalar bo'yicha)
    const tTestPostTest = expPostScores.length > 1 && ctrlPostScores.length > 1
      ? tTest(expPostScores, ctrlPostScores) : null;

    // 4. Student t-test: tajriba vs nazorat (PRE-TEST — guruhlar ekvivalentligi)
    const tTestPreTest = expPreScores.length > 1 && ctrlPreScores.length > 1
      ? tTest(expPreScores, ctrlPreScores) : null;

    // 5. Fisher F-test (post-test dispersiyalar tengligi)
    const fisherResult = expPostScores.length > 1 && ctrlPostScores.length > 1
      ? fisherTest(expPostScores, ctrlPostScores) : null;

    // 6. Cohen's d (post-test effekt o'lchami)
    const cohenResult = expPostScores.length > 1 && ctrlPostScores.length > 1
      ? cohensD(expPostScores, ctrlPostScores) : null;

    // 7. Paired t-test (tajriba ichida: pre vs post — user_id bo'yicha moslashgan)
    const pairedExp = pairedPreScores.length > 1
      ? pairedTTest(pairedPreScores, pairedPostScores) : null;

    // 8. Paired t-test (nazorat ichida: pre vs post)
    const pairedCtrl = ctrlPreScores.length > 1 && ctrlPostScores.length > 1 && ctrlPreScores.length === ctrlPostScores.length
      ? pairedTTest(ctrlPreScores, ctrlPostScores) : null;

    // 9. O'sish hisoblash
    const expGrowth = expStats.post.mean - expStats.pre.mean;
    const ctrlGrowth = ctrlStats.post.mean - ctrlStats.pre.mean;

    res.json({
      // FOIZ bo'yicha
      experiment_group: expStats,
      control_group: ctrlStats,
      control_data_entered: !!controlGroup,
      growth: {
        experiment: round(expGrowth, 2),
        control: round(ctrlGrowth, 2),
        difference: round(expGrowth - ctrlGrowth, 2)
      },
      t_test_pre: tTestPreTest,
      t_test_post: tTestPostTest,
      fisher_test: fisherResult,
      cohens_d: cohenResult,
      paired_t_experiment: pairedExp,
      paired_n: pairedPreScores.length,
      paired_t_control: pairedCtrl,

      // BAHO (2-5) bo'yicha
      grades: {
        experiment: {
          pre: { n: expPreGrades.length, mean: round(mean(expPreGrades), 2), std_dev: round(stdDev(expPreGrades), 2) },
          post: { n: expPostGrades.length, mean: round(mean(expPostGrades), 2), std_dev: round(stdDev(expPostGrades), 2) },
          growth: round(mean(expPostGrades) - mean(expPreGrades), 2)
        },
        control: {
          pre: { n: ctrlPreGrades.length, mean: round(mean(ctrlPreGrades), 2), std_dev: round(stdDev(ctrlPreGrades), 2) },
          post: { n: ctrlPostGrades.length, mean: round(mean(ctrlPostGrades), 2), std_dev: round(stdDev(ctrlPostGrades), 2) },
          growth: round(mean(ctrlPostGrades) - mean(ctrlPreGrades), 2)
        },
        t_test_post: expPostGrades.length > 1 && ctrlPostGrades.length > 1 ? tTest(expPostGrades, ctrlPostGrades) : null,
        cohens_d: expPostGrades.length > 1 && ctrlPostGrades.length > 1 ? cohensD(expPostGrades, ctrlPostGrades) : null,
        distribution: {
          experiment_post: { '5': expPostGrades.filter(g=>g===5).length, '4': expPostGrades.filter(g=>g===4).length, '3': expPostGrades.filter(g=>g===3).length, '2': expPostGrades.filter(g=>g===2).length },
          control_post: { '5': ctrlPostGrades.filter(g=>g===5).length, '4': ctrlPostGrades.filter(g=>g===4).length, '3': ctrlPostGrades.filter(g=>g===3).length, '2': ctrlPostGrades.filter(g=>g===2).length }
        }
      },

      students_pre: preTestResults.slice(0, 50),
      students_post: postTestResults.slice(0, 50)
    });
  } catch (err) {
    console.error('Experiment stats error:', err);
    res.status(500).json({ error: 'Statistik hisoblashda xatolik: ' + err.message });
  }
});

// GET /api/experiment/filters — mavjud maktab va sinflar ro'yxati
router.get('/filters', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Faqat admin' });

    const districts = await database.all(
      "SELECT DISTINCT district FROM users WHERE role='student' AND district IS NOT NULL AND district != '' ORDER BY district"
    );
    const schools = await database.all(
      "SELECT DISTINCT district, school_number FROM users WHERE role='student' AND school_number IS NOT NULL AND school_number != '' ORDER BY district, school_number"
    );
    const classes = await database.all(
      "SELECT DISTINCT district, school_number, class_name FROM users WHERE role='student' AND class_name IS NOT NULL AND class_name != '' ORDER BY class_name"
    );

    res.json({
      districts: districts.map(d => d.district),
      schools: schools.map(s => ({ district: s.district, school_number: s.school_number })),
      classes: classes.map(c => ({ district: c.district, school_number: c.school_number, class_name: c.class_name }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/experiment/control-data — nazorat guruhi ma'lumotlarini qo'lda kiritish
router.post('/control-data', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Faqat admin kirita oladi' });
    }

    const { pre_test, post_test, description } = req.body;

    if (!pre_test || !post_test || !Array.isArray(pre_test) || !Array.isArray(post_test)) {
      return res.status(400).json({ error: 'pre_test va post_test massivlari kerak' });
    }

    // Bazaga saqlash
    await database.run(`
      CREATE TABLE IF NOT EXISTS control_group_data (
        id SERIAL PRIMARY KEY,
        data JSONB NOT NULL,
        description TEXT DEFAULT '',
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await database.run(`
      INSERT INTO control_group_data (data, description, created_by)
      VALUES (?, ?, ?)
    `, [JSON.stringify({ pre_test, post_test }), description || '', req.user.id]);

    res.json({
      message: 'Nazorat guruhi ma\'lumotlari saqlandi',
      pre_test_count: pre_test.length,
      post_test_count: post_test.length
    });
  } catch (err) {
    res.status(500).json({ error: 'Saqlashda xatolik: ' + err.message });
  }
});

// GET /api/experiment/control-data — nazorat guruhi ma'lumotlarini olish
router.get('/control-data', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Faqat admin' });
    }
    
    await database.run(`
      CREATE TABLE IF NOT EXISTS control_group_data (
        id SERIAL PRIMARY KEY, data JSONB NOT NULL,
        description TEXT DEFAULT '', created_by INTEGER, created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `).catch(()=>{});

    const data = await database.all('SELECT * FROM control_group_data ORDER BY created_at DESC LIMIT 1');
    if (data.length === 0) return res.json({ entered: false });
    
    const parsed = typeof data[0].data === 'string' ? JSON.parse(data[0].data) : data[0].data;
    res.json({ entered: true, ...parsed, created_at: data[0].created_at });
  } catch (err) {
    res.json({ entered: false });
  }
});

module.exports = router;
