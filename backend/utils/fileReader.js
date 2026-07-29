/**
 * fileReader.js
 * Binary va matn fayllarning tarkibini AI uchun o'qiladigan matnga aylantiradi.
 * Excel → jadval matni, Word → paragraflar, Matn → to'g'ridan, Rasm → base64
 * Firebase URL'dan ham, lokal path'dan ham o'qiy oladi.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Faylni yuklab olish (Firebase URL yoki lokal path)
 * @returns {string} lokal temp fayl path
 */
async function resolveFilePath(filePath, fileName) {
  // Agar http URL bo'lsa — yuklab olish
  if (filePath && filePath.startsWith('http')) {
    try {
      const response = await fetch(filePath);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      const tempPath = path.join(os.tmpdir(), `ai_grade_${Date.now()}_${fileName}`);
      fs.writeFileSync(tempPath, buffer);
      return { localPath: tempPath, isTemp: true };
    } catch (err) {
      console.error('File download error:', err.message);
      return { localPath: null, isTemp: false, error: err.message };
    }
  }
  
  // Lokal path
  if (filePath && fs.existsSync(filePath)) {
    return { localPath: filePath, isTemp: false };
  }

  return { localPath: null, isTemp: false, error: 'Fayl topilmadi' };
}

/**
 * Faylni o'qib, AI uchun content qaytaradi.
 * @returns { type: 'text'|'image'|'binary_unreadable', content, mimeType? }
 */
async function readFileForAI(filePath, fileName) {
  // Firebase URL yoki lokal path'ni resolve qilish
  const { localPath, isTemp, error } = await resolveFilePath(filePath, fileName);
  
  if (!localPath) {
    return { 
      type: 'text', 
      content: `O'quvchi topshirgan fayl: "${fileName}"\nFayl ochilmadi: ${error || 'noma\'lum xato'}\n\nIzoh: Fayl yuklangan, lekin tarkibini o'qib bo'lmadi.` 
    };
  }

  const ext = path.extname(fileName).toLowerCase();

  // ── Matn fayllari ──────────────────────────────────────────
  const textExts = ['.py', '.js', '.css', '.html', '.htm', '.txt', '.csv', '.json', '.xml'];
  if (textExts.includes(ext)) {
    try {
      const content = fs.readFileSync(localPath, 'utf8');
      if (isTemp) fs.unlinkSync(localPath);
      return { type: 'text', content: content.slice(0, 6000) };
    } catch (e) {
      if (isTemp && fs.existsSync(localPath)) fs.unlinkSync(localPath);
      return { type: 'text', content: `(Faylni o'qib bo'lmadi: ${e.message})` };
    }
  }

  // ── Scratch (.sb3) fayli — ZIP ichidan project.json o'qish ──
  if (ext === '.sb3') {
    try {
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(localPath);
      const projectEntry = zip.getEntry('project.json');
      if (!projectEntry) throw new Error('project.json topilmadi');
      const project = JSON.parse(zip.readAsText(projectEntry));

      let output = `🐱 Scratch loyihasi: "${fileName}"\n`;
      output += `Sprite'lar soni: ${project.targets?.length || 0}\n\n`;

      for (const target of (project.targets || [])) {
        const blockCount = Object.keys(target.blocks || {}).length;
        output += `— Sprite "${target.name}": ${blockCount} ta blok\n`;
        const opcodes = Object.values(target.blocks || {}).map(b => b.opcode).filter(Boolean);
        const opcodeCounts = {};
        opcodes.forEach(op => { opcodeCounts[op] = (opcodeCounts[op] || 0) + 1; });
        const topOps = Object.entries(opcodeCounts).sort((a,b) => b[1]-a[1]).slice(0, 10);
        if (topOps.length) {
          output += `  Bloklar: ${topOps.map(([op, c]) => `${op}(${c})`).join(', ')}\n`;
        }
      }

      if (isTemp && fs.existsSync(localPath)) fs.unlinkSync(localPath);
      return { type: 'text', content: output.slice(0, 6000) };
    } catch (e) {
      if (isTemp && fs.existsSync(localPath)) fs.unlinkSync(localPath);
      return { type: 'text', content: `(Scratch fayli o'qilmadi: ${e.message})` };
    }
  }

  // ── Rasm fayllari ──────────────────────────────────────────
  const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'];
  if (imageExts.includes(ext)) {
    try {
      const data = fs.readFileSync(localPath);
      if (isTemp) fs.unlinkSync(localPath);
      const base64 = data.toString('base64');
      const mime = { '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
                     '.gif':'image/gif', '.webp':'image/webp', '.bmp':'image/bmp' }[ext] || 'image/png';
      return { type: 'image', content: base64, mimeType: mime };
    } catch (e) {
      if (isTemp && fs.existsSync(localPath)) fs.unlinkSync(localPath);
      return { type: 'text', content: `(Rasm o'qilmadi: ${e.message})` };
    }
  }

  // ── Excel fayllari ─────────────────────────────────────────
  if (ext === '.xlsx' || ext === '.xls') {
    try {
      const XLSX = require('xlsx');
      const workbook = XLSX.readFile(localPath);
      let output = `📊 Excel fayl: "${fileName}"\n`;
      output += `Varaqlar soni: ${workbook.SheetNames.length}\n\n`;

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        output += `═══ Varaq: "${sheetName}" ═══\n`;

        // Hujayra ma'lumotlari — formulalar ham
        const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
        const rows = [];
        for (let r = range.s.r; r <= Math.min(range.e.r, 49); r++) {
          const row = [];
          for (let c = range.s.c; c <= Math.min(range.e.c, 19); c++) {
            const addr = XLSX.utils.encode_cell({ r, c });
            const cell = sheet[addr];
            if (!cell) { row.push(''); continue; }
            // Formulani ham ko'rsat
            if (cell.f) {
              row.push(`[Formula: =${cell.f} → ${cell.v ?? ''}]`);
            } else {
              row.push(String(cell.v ?? ''));
            }
          }
          rows.push(row.join('\t'));
        }
        output += rows.join('\n');

        // Diagrammalar
        if (sheet['!charts'] || workbook.Custprops) {
          output += '\n\n[Diagrammalar mavjud bo\'lishi mumkin]';
        }

        // Aslida diagrammalar xlsx ichidagi drawing XML da — tekshirish
        const chartCheck = checkExcelCharts(localPath, workbook);
        if (chartCheck.hasCharts) {
          output += `\n✅ Diagrammalar topildi: ${chartCheck.chartCount} ta`;
        } else {
          output += `\n❌ Diagramma topilmadi`;
        }

        // Formulalar soni
        const formulaCount = countFormulas(sheet);
        output += `\nFormulalar soni: ${formulaCount}`;
        if (formulaCount === 0) output += ` ← ❌ Hech qanday formula yo'q!`;

        output += '\n\n';
        if (output.length > 5000) break;
      }
      if (isTemp && fs.existsSync(localPath)) fs.unlinkSync(localPath);
      return { type: 'text', content: output.slice(0, 6000) };
    } catch (e) {
      if (isTemp && fs.existsSync(localPath)) fs.unlinkSync(localPath);
      return { type: 'text', content: `(Excel o'qilmadi: ${e.message})` };
    }
  }

  // ── Word fayllari ──────────────────────────────────────────
  if (ext === '.docx') {
    try {
      // Sahifa sozlamalarini olish (adm-zip orqali document.xml dan)
      const pageSetupInfo = extractDocxPageSetup(localPath);

      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ path: localPath });
      if (isTemp) fs.unlinkSync(localPath);
      const text = result.value || '';
      let output = `📝 Word fayl: "${fileName}"\n\n`;
      output += `${pageSetupInfo}\n\n`;
      output += `Matn tarkibi:\n${text.slice(0, 4500)}`;
      if (text.length === 0) output += '(Hujjat bo\'sh yoki matn topilmadi)';
      return { type: 'text', content: output };
    } catch (e) {
      if (isTemp && fs.existsSync(localPath)) fs.unlinkSync(localPath);
      return { type: 'text', content: `(Word o'qilmadi: ${e.message})` };
    }
  }

  // ── .doc (eski Word) ───────────────────────────────────────
  if (ext === '.doc') {
    if (isTemp && fs.existsSync(localPath)) fs.unlinkSync(localPath);
    return {
      type: 'text',
      content: `📝 Word fayl (eski format .doc): "${fileName}"\n\nEslatma: .doc format to'liq o'qilmadi, lekin fayl yuklangan.`
    };
  }

  // ── Access (.accdb/.mdb) — o'qib bo'lmaydi ─────────────────
  if (ext === '.accdb' || ext === '.mdb') {
    if (isTemp && fs.existsSync(localPath)) fs.unlinkSync(localPath);
    return {
      type: 'text',
      content: `🗄️ Access ma'lumotlar bazasi: "${fileName}"\n\n⚠️ MUHIM: Access (.accdb/.mdb) format proprietary bo'lgani uchun avtomatik o'qib bo'lmaydi.\n\nFayl muvaffaqiyatli YUKLANGAN. O'qituvchi qo'lda tekshirishi kerak:\n- Jadvallar yaratilganmi\n- So'rovlar (Query) to'g'ri ishlayaptimi\n- Formalar va hisobotlar bormi\n\nAI BAHOLASH: Bu fayl turini avtomatik baholab bo'lmaydi. Iltimos, o'qituvchi qo'lda ball qo'ysin.`
    };
  }

  // ── Access, Scratch va boshqalar ───────────────────────────
  if (isTemp && fs.existsSync(localPath)) fs.unlinkSync(localPath);
  return {
    type: 'binary_unreadable',
    content: `Fayl: "${fileName}" (${ext})\n\nBu fayl turi avtomatik o'qilmaydi. Fayl yuklangan, lekin tarkibini baholash uchun qo'lda tekshirish tavsiya etiladi.`
  };
}

// ── Word (.docx) sahifa sozlamalarini olish ──────────────────
function extractDocxPageSetup(localPath) {
  try {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(localPath);
    const docEntry = zip.getEntry('word/document.xml');
    if (!docEntry) return 'Sahifa sozlamalari aniqlanmadi (document.xml topilmadi)';

    const xml = zip.readAsText(docEntry);

    // <w:sectPr> ichidan <w:pgSz ... /> va <w:pgMar ... /> ni topish
    const sectPrMatch = xml.match(/<w:sectPr[^>]*>([\s\S]*?)<\/w:sectPr>/);
    if (!sectPrMatch) return 'Sahifa sozlamalari aniqlanmadi (sectPr topilmadi — standart qiymatlar bo\'lishi mumkin)';

    const sectPr = sectPrMatch[0];

    // ── Sahifa o'lchami va yo'nalishi ──
    let orientation = 'portrait';
    const pgSzMatch = sectPr.match(/<w:pgSz([^/]*)\/?>/);
    if (pgSzMatch) {
      const attrs = pgSzMatch[1];
      const orientAttr = attrs.match(/w:orient="([^"]+)"/);
      if (orientAttr) {
        orientation = orientAttr[1]; // "landscape" yoki "portrait"
      } else {
        // w:orient yo'q bo'lsa, w:w va w:h solishtirish
        const wMatch = attrs.match(/w:w="(\d+)"/);
        const hMatch = attrs.match(/w:h="(\d+)"/);
        if (wMatch && hMatch) {
          const w = parseInt(wMatch[1]);
          const h = parseInt(hMatch[1]);
          if (w > h) orientation = 'landscape';
        }
      }
    }

    // ── Hoshiyalar (margins) ──
    let margins = null;
    const pgMarMatch = sectPr.match(/<w:pgMar([^/]*)\/?>/);
    if (pgMarMatch) {
      const attrs = pgMarMatch[1];
      const topM = attrs.match(/w:top="(-?\d+)"/);
      const bottomM = attrs.match(/w:bottom="(-?\d+)"/);
      const leftM = attrs.match(/w:left="(\d+)"/);
      const rightM = attrs.match(/w:right="(\d+)"/);

      // Twips dan sm ga: 1 sm = 566.9291 twips
      const toSm = (twips) => (Math.abs(parseInt(twips)) / 566.9291).toFixed(2);

      margins = {
        top: topM ? toSm(topM[1]) : '?',
        bottom: bottomM ? toSm(bottomM[1]) : '?',
        left: leftM ? toSm(leftM[1]) : '?',
        right: rightM ? toSm(rightM[1]) : '?'
      };
    }

    // Natijani matn sifatida shakllantirish
    let result = `📐 Sahifa sozlamalari:\n`;
    result += `- Yo'nalish (orientation): ${orientation}\n`;
    if (margins) {
      result += `- Hoshiyalar (margins): yuqori ${margins.top}sm, pastki ${margins.bottom}sm, chap ${margins.left}sm, o'ng ${margins.right}sm\n`;
    } else {
      result += `- Hoshiyalar: aniqlanmadi (standart qiymatlar bo'lishi mumkin)\n`;
    }

    return result;
  } catch (e) {
    return `Sahifa sozlamalari aniqlanmadi: ${e.message}`;
  }
}

// Excel da formulalar sonini hisoblash
function countFormulas(sheet) {
  let count = 0;
  for (const key in sheet) {
    if (key.startsWith('!')) continue;
    if (sheet[key] && sheet[key].f) count++;
  }
  return count;
}

// Excel da diagramma borligini tekshirish (zip ichidagi xl/charts/ papkasi)
function checkExcelCharts(filePath, workbook) {
  try {
    // SheetJS workbook da chartlar to'g'ridan saqlanmaydi
    // Lekin workbook.Sheets da '!drawings' yoki workbook.Workbook.Sheets da SheetId tekshirish mumkin
    // Oddiy usul: zip sifatida o'qib xl/charts/ papkasini tekshirish
    const AdmZip = (() => { try { return require('adm-zip'); } catch { return null; } })();
    if (!AdmZip) {
      // adm-zip yo'q — workbook metadata tekshir
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (sheet['!drawings']) return { hasCharts: true, chartCount: 1 };
      }
      return { hasCharts: false, chartCount: 0 };
    }
    const zip = new AdmZip(filePath);
    const entries = zip.getEntries().map(e => e.entryName);
    const chartFiles = entries.filter(e => e.startsWith('xl/charts/') && e.endsWith('.xml'));
    return { hasCharts: chartFiles.length > 0, chartCount: chartFiles.length };
  } catch {
    return { hasCharts: false, chartCount: 0 };
  }
}

module.exports = { readFileForAI };
