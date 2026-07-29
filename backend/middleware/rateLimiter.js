/**
 * Rate Limiting Middleware
 * Brute force va DDoS hujumlardan himoya
 */

const rateLimit = require('express-rate-limit');

// ─── Login uchun qattiq limit ────────────────────────────────
// 15 daqiqada 5 ta urinish (brute force himoya)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 daqiqa
  max: 20,
  message: {
    error: 'Juda ko\'p urinish. 15 daqiqadan keyin qaytadan urinib ko\'ring.',
    retry_after: 15
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // IP + username bo'yicha limit
    return `${req.ip}_${req.body?.username || 'unknown'}`;
  },
  skip: (req) => {
    // OPTIONS (preflight) so'rovlarni o'tkazib yuborish
    if (req.method === 'OPTIONS') return true;
    return process.env.NODE_ENV === 'development' && process.env.SKIP_RATE_LIMIT === 'true';
  }
});

// ─── Register uchun limit ────────────────────────────────────
// 1 soatda 50 ta akkaunt (admin batch yaratish uchun)
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 soat
  max: 50,
  message: {
    error: 'Juda ko\'p ro\'yxatdan o\'tish urinishi. 1 soatdan keyin qaytadan urinib ko\'ring.',
    retry_after: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Parol tiklash uchun limit ───────────────────────────────
// 1 soatda 3 ta so'rov
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 soat
  max: 3,
  message: {
    error: 'Juda ko\'p so\'rov. 1 soatdan keyin qaytadan urinib ko\'ring.',
    retry_after: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Umumiy API limit ────────────────────────────────────────
// 1 daqiqada 100 ta so'rov (DDoS himoya)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 daqiqa
  max: 100,
  message: {
    error: 'Juda ko\'p so\'rov. Biroz kutib turing.',
    retry_after: 1
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── AI endpointlar uchun limit ──────────────────────────────
// 1 daqiqada 5 ta so'rov (OpenAI xarajatlarni nazorat qilish)
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 daqiqa
  max: 5,
  message: {
    error: 'AI so\'rovlar limiti. 1 daqiqadan keyin qaytadan urinib ko\'ring.',
    retry_after: 1
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  loginLimiter,
  registerLimiter,
  forgotPasswordLimiter,
  apiLimiter,
  aiLimiter,
};
