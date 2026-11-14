import { jsPDF } from 'jspdf';
import { GAME_IDENTITY, PIAGAM_IKRAR_ITEMS } from './blueprintData';
import { evaluatePredicate } from './rules';

export interface PiagamPdfPayload {
  playerName: string;
  player2Name?: string;
  isTwoPlayer?: boolean;
  studentClass: string;
  totalScore: number;
  p2TotalScore?: number;
  ecoHealth: number;
  amanah: number;
  checkedPledges: readonly boolean[];
  teacherName: string;
  parentName: string;
  dateFormatted: string;
}

/**
 * Strips non-Latin1 emojis/symbols so built-in PDF Helvetica never renders garbled characters.
 */
export function sanitizePdfText(input: string): string {
  return input
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildPiagamPdfFilename(
  playerName: string,
  isTwoPlayer?: boolean,
  player2Name?: string
): string {
  const slugify = (s: string) =>
    sanitizePdfText(s)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'penjaga-bumi';

  const namePart = isTwoPlayer && player2Name
    ? `${slugify(playerName)}-${slugify(player2Name)}`
    : slugify(playerName);
  return `Piagam-Penjaga-Bumi-${namePart}.pdf`;
}

async function tryLoadImageAsDataUrl(url: string, timeoutMs = 1500): Promise<string | null> {
  if (typeof window === 'undefined' || typeof Image === 'undefined') return null;
  return new Promise((resolve) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, timeoutMs);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    img.onload = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 128;
        canvas.height = img.naturalHeight || 128;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(null);
    };
    img.src = url;
  });
}

function drawVectorBadgeFallback(
  doc: jsPDF,
  type: 'pgri' | 'game' | 'wonogiri',
  x: number,
  y: number,
  size: number
) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size * 0.44;

  if (type === 'pgri') {
    doc.setFillColor(220, 38, 38);
    doc.setDrawColor(180, 83, 9);
    doc.setLineWidth(0.5);
    doc.circle(cx, cy, r, 'FD');
    doc.setFillColor(255, 255, 255);
    doc.circle(cx, cy, r * 0.68, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(180, 83, 9);
    doc.text('PGRI', cx, cy + 1.2, { align: 'center' });
  } else if (type === 'game') {
    doc.setFillColor(5, 150, 105);
    doc.setDrawColor(245, 158, 11);
    doc.setLineWidth(0.5);
    doc.roundedRect(x + 0.5, y + 0.5, size - 1, size - 1, 2.5, 2.5, 'FD');
    doc.setFillColor(253, 224, 71);
    doc.circle(cx, cy - 1, r * 0.36, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5);
    doc.setTextColor(255, 255, 255);
    doc.text('NUSANTARA', cx, y + size - 2.2, { align: 'center' });
  } else {
    doc.setFillColor(21, 128, 61);
    doc.setDrawColor(245, 158, 11);
    doc.setLineWidth(0.5);
    doc.roundedRect(x + 0.5, y + 0.5, size - 1, size - 1, 2.5, 2.5, 'FD');
    doc.setFillColor(250, 204, 21);
    doc.triangle(cx, cy - r * 0.5, cx + r * 0.45, cy + r * 0.3, cx - r * 0.45, cy + r * 0.3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(4.8);
    doc.setTextColor(255, 255, 255);
    doc.text('WONOGIRI', cx, y + size - 2.2, { align: 'center' });
  }
}

function drawCheckmark(doc: jsPDF, x: number, y: number, boxSize: number, checked: boolean) {
  if (checked) {
    doc.setFillColor(4, 120, 87);
    doc.setDrawColor(6, 78, 59);
    doc.setLineWidth(0.35);
    doc.roundedRect(x, y, boxSize, boxSize, 1, 1, 'FD');
    doc.setDrawColor(253, 230, 138);
    doc.setLineWidth(0.65);
    doc.line(x + boxSize * 0.22, y + boxSize * 0.52, x + boxSize * 0.44, y + boxSize * 0.74);
    doc.line(x + boxSize * 0.44, y + boxSize * 0.74, x + boxSize * 0.78, y + boxSize * 0.28);
  } else {
    doc.setFillColor(245, 245, 244);
    doc.setDrawColor(168, 162, 158);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, boxSize, boxSize, 1, 1, 'FD');
  }
}

function drawGoldenWaxSeal(doc: jsPDF, cx: number, cy: number, radius: number) {
  doc.setFillColor(245, 158, 11);
  doc.setDrawColor(120, 53, 15);
  doc.setLineWidth(0.7);
  doc.circle(cx, cy, radius, 'FD');

  doc.setFillColor(253, 224, 71);
  doc.setDrawColor(254, 243, 199);
  doc.setLineWidth(0.4);
  doc.circle(cx, cy, radius * 0.78, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.setTextColor(69, 26, 3);
  doc.text('PENJAGA BUMI', cx, cy - 2.2, { align: 'center' });
  doc.setFontSize(5);
  doc.text('NUSANTARA', cx, cy + 1.2, { align: 'center' });
  doc.setFontSize(4.4);
  doc.setTextColor(120, 53, 15);
  doc.text('WONOGIRI 2026', cx, cy + 4.4, { align: 'center' });
}

export async function generateAndDownloadPiagamPdf(
  payload: PiagamPdfPayload
): Promise<{ fileName: string; blobUrl: string }> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageW = 210;
  const pageH = 297;

  // Attempt parallel CORS-safe load of official badges (fast timeout, never blocks)
  const [pgriImg, gameImg, wonogiriImg] = await Promise.all([
    tryLoadImageAsDataUrl(GAME_IDENTITY.logoPgri),
    tryLoadImageAsDataUrl(GAME_IDENTITY.logoGame),
    tryLoadImageAsDataUrl(GAME_IDENTITY.logoWonogiri),
  ]);

  // 1. Parchment Background & Classical Nusantara Double Frame
  doc.setFillColor(255, 253, 247);
  doc.rect(0, 0, pageW, pageH, 'F');

  // Outer amber border
  doc.setDrawColor(180, 83, 9);
  doc.setLineWidth(1.2);
  doc.rect(8, 8, pageW - 16, pageH - 16);

  // Cream frame fill band
  doc.setDrawColor(254, 243, 199);
  doc.setLineWidth(1.6);
  doc.rect(10.2, 10.2, pageW - 20.4, pageH - 20.4);

  // Inner gold rule
  doc.setDrawColor(217, 119, 6);
  doc.setLineWidth(0.5);
  doc.rect(11.6, 11.6, pageW - 23.2, pageH - 23.2);

  // 2. Kop Dokumen Resmi + Logos
  const logoSize = 15;
  const headerTop = 16;

  if (pgriImg) {
    doc.addImage(pgriImg, 'PNG', 16, headerTop, logoSize, logoSize);
  } else {
    drawVectorBadgeFallback(doc, 'pgri', 16, headerTop, logoSize);
  }

  if (gameImg) {
    doc.addImage(gameImg, 'PNG', 33, headerTop, logoSize, logoSize);
  } else {
    drawVectorBadgeFallback(doc, 'game', 33, headerTop, logoSize);
  }

  if (wonogiriImg) {
    doc.addImage(wonogiriImg, 'PNG', pageW - 16 - logoSize, headerTop, logoSize, logoSize);
  } else {
    drawVectorBadgeFallback(doc, 'wonogiri', pageW - 16 - logoSize, headerTop, logoSize);
  }

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(28, 25, 23);
  doc.setFontSize(10.5);
  doc.text('PEMERINTAH KABUPATEN WONOGIRI', pageW / 2, 20, { align: 'center' });
  doc.text('PERSATUAN GURU REPUBLIK INDONESIA (PGRI)', pageW / 2, 25, { align: 'center' });
  doc.setFontSize(9.2);
  doc.setTextColor(120, 53, 15);
  doc.text('CABANG PGRI GIRIMARTO', pageW / 2, 29.5, { align: 'center' });

  // Double kop separator
  doc.setDrawColor(146, 64, 14);
  doc.setLineWidth(0.8);
  doc.line(16, 35, pageW - 16, 35);
  doc.setLineWidth(0.3);
  doc.line(16, 36.2, pageW - 16, 36.2);

  // 3. Certificate Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15.5);
  doc.setTextColor(6, 78, 59);
  doc.text('PIAGAM IKRAR AKSI NYATA PENJAGA BUMI CILIK', pageW / 2, 44.5, {
    align: 'center',
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(68, 64, 60);
  doc.text(
    sanitizePdfText(`Game Edukasi PAI & BP: "${GAME_IDENTITY.title} - ${GAME_IDENTITY.subtitle}"`),
    pageW / 2,
    50,
    { align: 'center' }
  );

  // 4. Identitas Penerima Piagam Box
  const boxX = 16;
  const boxY = 55;
  const boxW = pageW - 32;
  const boxH = 34;

  doc.setFillColor(255, 251, 235);
  doc.setDrawColor(252, 211, 77);
  doc.setLineWidth(0.4);
  doc.roundedRect(boxX, boxY, boxW, boxH, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(68, 64, 60);
  doc.text('Diberikan kepada:', boxX + 5, boxY + 6.5);

  const displayName = payload.isTwoPlayer
    ? `${payload.playerName} & ${payload.player2Name || 'Pemain 2'}`
    : payload.playerName;

  const p1Pred = evaluatePredicate(payload.totalScore);
  const p2Pred = evaluatePredicate(payload.p2TotalScore ?? 0);
  const predText = payload.isTwoPlayer
    ? `P1 (${payload.playerName}): ${p1Pred.stars} Bintang (${payload.totalScore}/100) | P2 (${payload.player2Name || 'Pemain 2'}): ${p2Pred.stars} Bintang (${payload.p2TotalScore ?? 0}/100)`
    : `${p1Pred.stars > 0 ? `${p1Pred.stars} Bintang - ` : ''}${p1Pred.title} (${payload.totalScore}/100)`;

  doc.setFontSize(9.5);
  doc.setTextColor(41, 37, 36);
  doc.setFont('helvetica', 'normal');
  doc.text('Nama Siswa', boxX + 5, boxY + 13);
  doc.setFont('helvetica', 'bold');
  doc.text(`: ${sanitizePdfText(displayName)}`, boxX + 36, boxY + 13);

  doc.setFont('helvetica', 'normal');
  doc.text('Kelas / Fase', boxX + 5, boxY + 18.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`: ${sanitizePdfText(payload.studentClass)}`, boxX + 36, boxY + 18.5);

  doc.setFont('helvetica', 'normal');
  doc.text('Predikat Game', boxX + 5, boxY + 24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(6, 95, 70);
  const predLines = doc.splitTextToSize(`: ${sanitizePdfText(predText)}`, boxW - 41);
  doc.text(predLines, boxX + 36, boxY + 24);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(146, 64, 14);
  doc.text(
    `Indikator Karakter: Eco-Health ${payload.ecoHealth}%   |   Amanah ${payload.amanah}%`,
    boxX + 5,
    boxY + 30.5
  );

  // 5. 6 Butir Janji Aksi Nyata Pelestarian Alam
  let curY = 95;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.2);
  doc.setTextColor(41, 37, 36);
  const introText =
    'Telah menyelesaikan seluruh misi pemulihan lingkungan dari Level 1 sampai Level 6 dan berikrar sungguh-sungguh untuk menjalankan 6 Rencana Aksi Nyata Pelestarian Alam:';
  const introLines = doc.splitTextToSize(introText, boxW);
  doc.text(introLines, boxX, curY);
  curY += introLines.length * 4.2 + 2.5;

  PIAGAM_IKRAR_ITEMS.forEach((itemText, idx) => {
    const isChecked = payload.checkedPledges[idx] ?? true;
    const wrapped = doc.splitTextToSize(`${idx + 1}. ${sanitizePdfText(itemText)}`, boxW - 18);
    const cardH = Math.max(10.8, wrapped.length * 4.1 + 4.4);

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(252, 211, 77);
    doc.setLineWidth(0.35);
    doc.roundedRect(boxX, curY, boxW, cardH, 2.2, 2.2, 'FD');

    drawCheckmark(doc, boxX + 4, curY + (cardH - 5.2) / 2, 5.2, isChecked);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(28, 25, 23);
    doc.text(wrapped, boxX + 13, curY + 4.8);

    curY += cardH + 2.2;
  });

  // Closing gratitude statement
  curY += 2;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.8);
  doc.setTextColor(68, 64, 60);
  const closingLines = doc.splitTextToSize(
    'Ikrar ini dibuat dengan penuh kesadaran dan tanggung jawab sebagai wujud rasa syukur kepada Tuhan Yang Maha Esa atas anugerah alam semesta.',
    boxW
  );
  doc.text(closingLines, boxX, curY);

  // 6. Signature Section + Vector Wax Seal
  const sigTop = Math.min(224, Math.max(curY + closingLines.length * 4.2 + 4.5, 212));
  doc.setDrawColor(252, 211, 77);
  doc.setLineWidth(0.4);
  doc.line(boxX, sigTop, pageW - boxX, sigTop);

  const col1X = 44;
  const col2X = pageW / 2;
  const col3X = pageW - 44;

  // Center Wax Seal
  drawGoldenWaxSeal(doc, col2X, sigTop + 13.5, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.6);
  doc.setTextColor(28, 25, 23);

  // Left: Orang Tua
  doc.text('Mengetahui,', col1X, sigTop + 24.5, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.text('Orang Tua / Wali Murid,', col1X, sigTop + 29, { align: 'center' });
  doc.text(`( ${sanitizePdfText(payload.parentName)} )`, col1X, sigTop + 46.5, {
    align: 'center',
  });

  // Center: Guru PAI
  doc.setFont('helvetica', 'normal');
  doc.text('Menyetujui,', col2X, sigTop + 28, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.text('Guru PAI & Budi Pekerti,', col2X, sigTop + 32.5, { align: 'center' });
  doc.text(`( ${sanitizePdfText(payload.teacherName)} )`, col2X, sigTop + 46.5, {
    align: 'center',
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.4);
  doc.setTextColor(87, 83, 78);
  doc.text(
    sanitizePdfText(`Pengembang: ${GAME_IDENTITY.developerBranch}`),
    col2X,
    sigTop + 51,
    { align: 'center' }
  );

  // Right: Siswa
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.6);
  doc.setTextColor(28, 25, 23);
  doc.text(`Wonogiri, ${sanitizePdfText(payload.dateFormatted)}`, col3X, sigTop + 24.5, {
    align: 'center',
  });
  doc.setFont('helvetica', 'bold');
  doc.text('Siswa Penjaga Bumi Cilik,', col3X, sigTop + 29, { align: 'center' });
  doc.text(`( ${sanitizePdfText(displayName)} )`, col3X, sigTop + 46.5, { align: 'center' });

  const fileName = buildPiagamPdfFilename(
    payload.playerName,
    payload.isTwoPlayer,
    payload.player2Name
  );

  // Save triggers immediate browser PDF download; also return blobUrl for reliable fallback link
  const pdfBlob = doc.output('blob');
  const blobUrl = URL.createObjectURL(pdfBlob);

  // Trigger download via jsPDF save (and fallback anchor if needed)
  doc.save(fileName);

  return { fileName, blobUrl };
}
