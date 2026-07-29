/**
 * AI Utility — Anthropic Claude API (to'g'ridan-to'g'ri HTTP fetch)
 * SDK muammolaridan qochish uchun raw fetch ishlatiladi
 * 
 * Model: claude-sonnet-5
 * API: https://api.anthropic.com/v1/messages
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-5';

/**
 * Anthropic API'ga raw HTTP so'rov yuborish
 */
async function callAnthropic(body) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY environment variable not set');

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Anthropic API error:', response.status, errorText);
    throw new Error(`Anthropic API ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data;
}

/**
 * Anthropic API javobidan text contentni olish
 * Claude Sonnet 5 da content massivida thinking + text bo'lishi mumkin
 */
function extractText(data) {
  if (!data || !data.content || !Array.isArray(data.content) || data.content.length === 0) {
    console.error('Anthropic: empty content response', JSON.stringify(data)?.slice(0, 500));
    throw new Error('AI javob bermadi (bo\'sh content)');
  }
  // text turli elementni qidirish (thinking blockni o'tkazib yuborish)
  const textBlock = data.content.find(c => c.type === 'text');
  if (textBlock) return textBlock.text;
  // Agar text turli element topilmasa, birinchi elementning textini qaytarish
  return data.content[0].text || JSON.stringify(data.content[0]);
}

/**
 * Matnli so'rov yuborish (text-only)
 * @param {string} prompt - Foydalanuvchi so'rovi
 * @param {object} options - { max_tokens, system, model, effort }
 * @returns {string} AI javobi (text)
 */
async function chat(prompt, options = {}) {
  const {
    max_tokens = 2000,
    system = undefined,
    model = DEFAULT_MODEL,
    effort = 'low'
  } = options;

  const body = {
    model,
    max_tokens,
    messages: [{ role: 'user', content: prompt }]
  };

  if (system) body.system = system;
  if (effort) body.output_config = { effort };

  const data = await callAnthropic(body);
  return extractText(data);
}

/**
 * Ko'p xabarli so'rov (multi-turn messages)
 * @param {Array} messages - [{role:'user'|'assistant', content:'...'}]
 * @param {object} options - { max_tokens, system, model, effort }
 * @returns {string} AI javobi (text)
 */
async function chatMessages(messages, options = {}) {
  const {
    max_tokens = 2000,
    system = undefined,
    model = DEFAULT_MODEL,
    effort = 'low'
  } = options;

  const body = {
    model,
    max_tokens,
    messages
  };

  if (system) body.system = system;
  if (effort) body.output_config = { effort };

  const data = await callAnthropic(body);
  return extractText(data);
}

/**
 * Rasm bilan so'rov (Vision)
 * @param {string} prompt - Matnli so'rov
 * @param {string} base64Data - Rasm base64 kodda
 * @param {string} mimeType - 'image/png', 'image/jpeg', etc.
 * @param {object} options - { max_tokens, model, effort }
 * @returns {string} AI javobi (text)
 */
async function chatWithImage(prompt, base64Data, mimeType, options = {}) {
  const {
    max_tokens = 1000,
    model = DEFAULT_MODEL,
    effort = 'low'
  } = options;

  const body = {
    model,
    max_tokens,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mimeType,
            data: base64Data
          }
        },
        {
          type: 'text',
          text: prompt
        }
      ]
    }]
  };

  if (effort) body.output_config = { effort };

  const data = await callAnthropic(body);
  return extractText(data);
}

module.exports = {
  chat,
  chatMessages,
  chatWithImage,
  DEFAULT_MODEL
};
