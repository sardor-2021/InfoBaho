/**
 * Code Runner — Piston API orqali kodni xavfsiz ishga tushirish
 * https://emkc.org/api/v2/piston
 * 
 * Qo'llab-quvvatlanadigan tillar: python, javascript, html, css
 * Xavfsiz: Docker sandbox, 10s timeout, 256MB memory limit
 */

const PISTON_API = 'https://emkc.org/api/v2/piston';

// Til → Piston til nomi mapping
const LANGUAGE_MAP = {
  python: { language: 'python', version: '3.10.0' },
  javascript: { language: 'javascript', version: '18.15.0' },
  // HTML va CSS bajarilmaydi — faqat sintaksis tekshiriladi
};

/**
 * Kodni Piston API orqali ishga tushirish
 * @param {string} code — dastur kodi
 * @param {string} taskType — 'python', 'javascript', 'html', 'css'
 * @param {string} stdin — kiritish ma'lumotlari (ixtiyoriy)
 * @returns {object} { success, output, error, executionTime }
 */
async function runCode(code, taskType, stdin = '') {
  // HTML va CSS — bajarilmaydi, faqat sintaksis tekshiruvi
  if (taskType === 'html' || taskType === 'css') {
    return {
      success: true,
      output: null,
      error: null,
      executionTime: 0,
      note: `${taskType.toUpperCase()} kodi brauzerda ishlaydi — server tomondan bajarib bo'lmaydi. AI sintaksis va strukturani tekshiradi.`
    };
  }

  const langConfig = LANGUAGE_MAP[taskType];
  if (!langConfig) {
    return {
      success: false,
      output: null,
      error: `"${taskType}" tili kod ishga tushirish uchun qo'llab-quvvatlanmaydi`,
      executionTime: 0
    };
  }

  try {
    const response = await fetch(`${PISTON_API}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: langConfig.language,
        version: langConfig.version,
        files: [{ name: `main.${taskType === 'python' ? 'py' : 'js'}`, content: code }],
        stdin: stdin,
        run_timeout: 10000,       // 10 sekund maksimum
        compile_timeout: 10000,
        compile_memory_limit: 256000000,  // 256MB
        run_memory_limit: 256000000
      })
    });

    if (!response.ok) {
      return {
        success: false,
        output: null,
        error: `Piston API xatosi: HTTP ${response.status}`,
        executionTime: 0
      };
    }

    const result = await response.json();
    const run = result.run || {};
    const compile = result.compile || {};

    // Kompilatsiya xatosi
    if (compile.stderr) {
      return {
        success: false,
        output: compile.stdout || '',
        error: compile.stderr,
        executionTime: 0,
        exitCode: compile.code
      };
    }

    // Ishga tushirish natijasi
    const hasError = run.stderr && run.stderr.trim().length > 0;
    const hasOutput = run.stdout && run.stdout.trim().length > 0;

    return {
      success: !hasError && run.code === 0,
      output: run.stdout ? run.stdout.trim().slice(0, 5000) : '',
      error: run.stderr ? run.stderr.trim().slice(0, 2000) : null,
      executionTime: run.time || 0,
      exitCode: run.code,
      signal: run.signal || null
    };
  } catch (err) {
    console.error('Code runner error:', err.message);
    return {
      success: false,
      output: null,
      error: `Kod ishga tushirishda xatolik: ${err.message}`,
      executionTime: 0
    };
  }
}

/**
 * Kodni ishga tushirib, natijani AI uchun formatlash
 * @returns {string} — AI ga beriladigan matn
 */
async function runCodeForAI(code, taskType) {
  const result = await runCode(code, taskType);

  if (result.note) {
    // HTML/CSS — bajarilmaydi
    return `\n\n[KOD BAJARILISHI]\n${result.note}`;
  }

  let text = '\n\n[KOD BAJARILISHI NATIJASI]\n';

  if (result.success) {
    text += `✅ Kod muvaffaqiyatli bajarildi (exit code: 0)\n`;
    if (result.output) {
      text += `📤 Chiqish (stdout):\n${result.output}\n`;
    } else {
      text += `📤 Chiqish: (bo'sh — hech narsa chop etilmagan)\n`;
    }
  } else {
    text += `❌ Kod XATO bilan tugadi (exit code: ${result.exitCode})\n`;
    if (result.error) {
      text += `🐛 Xatolik:\n${result.error}\n`;
    }
    if (result.output) {
      text += `📤 Chiqish (xatogacha):\n${result.output}\n`;
    }
  }

  if (result.executionTime) {
    text += `⏱️ Bajarilish vaqti: ${result.executionTime}ms\n`;
  }

  return text;
}

module.exports = { runCode, runCodeForAI };
