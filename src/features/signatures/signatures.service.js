const { PDFDocument, rgb, StandardFonts, degrees } = require('pdf-lib');
const fs = require('fs');
const fsP = fs.promises;
const { STAMP_TEXTS, TEXT_COLORS_RGB, LAYOUT, PX_TO_PT, mergeSettings } = require('./signatureLayout');

/**
 * Parsea un string de rango de páginas a un array de índices (0-based).
 * Ejemplos: "1-5" → [0,1,2,3,4], "1-3, 5, 8-10" → [0,1,2,4,7,8,9]
 */
function parsePageRange(rangeStr, totalPages) {
  const indices = new Set();
  const parts = rangeStr.split(',').map(s => s.trim()).filter(Boolean);
  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-').map(s => s.trim());
      const start = Math.max(1, parseInt(startStr) || 1);
      const end = Math.min(totalPages, parseInt(endStr) || totalPages);
      for (let i = start; i <= end; i++) indices.add(i - 1);
    } else {
      const num = parseInt(part);
      if (num >= 1 && num <= totalPages) indices.add(num - 1);
    }
  }
  return [...indices].sort((a, b) => a - b);
}

/**
 * Convierte color hexadecimal a rgb de pdf-lib (0-1).
 */
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return rgb(r, g, b);
}

/**
 * Stamps a visual signature on all pages of a PDF.
 *
 * IMPORTANTE: El usuario diseña en CSS pixels (1px = 1/96").
 * pdf-lib usa PDF points (1pt = 1/72").
 * Aplicamos PX_TO_PT (0.75) a todas las dimensiones y font sizes
 * para que el resultado en el PDF coincida con el preview del frontend.
 *
 * @param {string} inputPath - Original PDF path
 * @param {string} outputPath - Signed PDF path
 * @param {object} signatureData - { name, position, colegiatura, details, dateTime, hash, settings, signatureImagePath }
 * @param {object} coords - { x, y, width, height }
 */
exports.stampVisualSignature = async (inputPath, outputPath, signatureData, coords) => {
  const existingPdfBytes = await fsP.readFile(inputPath);
  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Merge user settings with defaults
  const settings = mergeSettings(signatureData.settings);

  // Cargar imagen: primero desde settings (persistida), luego desde signatureData (temporal)
  let signatureImage;
  const imgPath = settings.signatureImagePath || signatureData.signatureImagePath;
  if (imgPath && fs.existsSync(imgPath)) {
    const imageBytes = await fsP.readFile(imgPath);
    const ext = imgPath.toLowerCase();
    if (ext.endsWith('.jpg') || ext.endsWith('.jpeg')) {
      signatureImage = await pdfDoc.embedJpg(imageBytes);
    } else {
      signatureImage = await pdfDoc.embedPng(imageBytes);
    }
  }

  // --- IMÁGENES: Carga de recursos ---
  const { fields } = settings;

  // --- Convertir dimensiones de CSS px a PDF pt ---
  const S = PX_TO_PT; // 0.75
  const boxWidth = settings.width * S;
  const boxHeight = settings.height * S;
  const borderWidth = settings.borderWidth * S;
  const accentWidth = borderWidth * LAYOUT.accentBorderMultiplier;
  const paddingX = LAYOUT.paddingX * S;
  const paddingTop = LAYOUT.paddingTop * S;
  const paddingBottom = LAYOUT.paddingBottom * S;
  const lineSpacing = LAYOUT.lineSpacing * S;

  // Font sizes: convertir de CSS pt a PDF pt
  // En CSS, font-size en pt ya es 1pt = 1/72", igual que PDF.
  // Pero el SignatureSettingsPage usa `fontSize: Xpt` en CSS que el browser
  // renderiza a X * (96/72) px de alto. Para que coincida visualmente:
  const fs_name = settings.fontSizes.name * S;
  const fs_position = settings.fontSizes.position * S;
  const fs_colegiatura = settings.fontSizes.colegiatura * S;
  const fs_details = settings.fontSizes.details * S;
  const fs_meta = settings.fontSizes.meta * S;

  const borderColorHex = settings.borderColor;
  const borderColor = hexToRgb(borderColorHex);
  const opacity = settings.opacity;

  // --- Determinar qué páginas firmar ---
  let pagesToSign;
  if (coords.pageMode === 'current') {
    const idx = Math.max(0, Math.min((coords.page || 1) - 1, pages.length - 1));
    pagesToSign = [idx];
  } else if (coords.pageMode === 'range' && coords.pageRange) {
    pagesToSign = parsePageRange(coords.pageRange, pages.length);
  } else {
    pagesToSign = pages.map((_, i) => i); // todas
  }

  for (const pageIndex of pagesToSign) {
    const page = pages[pageIndex];
    if (!page) continue;

    const cropBox = page.getCropBox();
    const { x: cx, y: cy, width: cw, height: ch } = cropBox;
    const pageRotation = page.getRotation().angle;

    // Determinamos las dimensiones visuales (lo que ve el usuario)
    const is90or270 = (pageRotation === 90 || pageRotation === 270);
    const visW = is90or270 ? ch : cw;
    const visH = is90or270 ? cw : ch;

    // Las coordenadas vienen de PDF.js convertToPdfPoint, que ya deshace la rotación del viewport.
    // El problema reside en que pdf-lib dibuja relativo al MediaBox (0,0).
    // Para asegurar posición definitiva, sumamos el origen del CropBox.
    let stampX = coords.x + cx;
    let stampY = coords.y + cy;

    // La rotación del sello debe compensar la rotación de la página para que el usuario
    // lo vea horizontal (u orientado según su diseño) en el visor.
    const userRotation = settings.rotation || 0;
    const totalRotation = userRotation - pageRotation; 

    // Al rotar el sello con pdf-lib (que lo hace CCW alrededor del punto x,y),
    // debemos ajustar stampX y stampY si la página tiene rotación intrínseca,
    // de lo contrario el punto de anclaje visual (bottom-left) se desplazaría.
    // PDF Rotations (pageRotation) son usualmente Clockwise en pdf-lib.
    if (pageRotation === 90) {
      stampY += boxWidth;
    } else if (pageRotation === 180) {
      stampX += boxWidth;
      stampY += boxHeight;
    } else if (pageRotation === 270) {
      stampX += boxHeight;
    }

    const rad = (totalRotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    // Helper para transformar coordenadas locales (rx, ry) a coordenadas de página (px, py)
    const transform = (rx, ry) => {
      const rxRot = rx * cos - ry * sin;
      const ryRot = rx * sin + ry * cos;
      return { px: stampX + rxRot, py: stampY + ryRot };
    };

    // --- BORDE: Estilo accent izquierdo ---
    const accentPos = transform(0, 0);
    page.drawRectangle({
      x: accentPos.px,
      y: accentPos.py,
      width: accentWidth,
      height: boxHeight,
      color: borderColor,
      opacity: opacity,
      rotate: degrees(totalRotation),
    });

    // Bordes sutiles
    const subtleOpacity = opacity * 0.35;
    // Función auxiliar para dibujar líneas rotadas
    const drawRotatedLine = (startR, endR) => {
      const s = transform(startR.x, startR.y);
      const e = transform(endR.x, endR.y);
      page.drawLine({
        start: { x: s.px, y: s.py },
        end: { x: e.px, y: e.py },
        thickness: 0.75,
        color: borderColor,
        opacity: subtleOpacity,
      });
    };

    drawRotatedLine({ x: 0, y: boxHeight }, { x: boxWidth, y: boxHeight }); // Superior
    drawRotatedLine({ x: boxWidth, y: 0 }, { x: boxWidth, y: boxHeight }); // Derecho
    drawRotatedLine({ x: 0, y: 0 }, { x: boxWidth, y: 0 }); // Inferior

    // --- Cálculo de posición del texto ---
    const hasImage = !!signatureImage;
    const relTextX = accentWidth + (hasImage ? (boxWidth * 0.35) + (8 * S) : paddingX);
    const textMaxWidth = hasImage
      ? boxWidth - accentWidth - (boxWidth * 0.35) - (8 * S) - paddingX
      : boxWidth - accentWidth - (paddingX * 2);

    // Helper para truncar texto
    const truncateText = (text, size) => {
      if (!text) return '';
      const estimatedCharWidth = size * 0.52;
      const maxChars = Math.floor(textMaxWidth / estimatedCharWidth);
      return text.length > maxChars ? text.substring(0, Math.max(maxChars - 3, 1)) + '...' : text;
    };

    // --- Calcular zona del footer (2 líneas apiladas: fecha + hash) ---
    const hasHash = fields.hash !== false && signatureData.hash;
    const footerLines = hasHash ? 2 : 1;
    const footerZoneHeight = (fs_meta * footerLines) + (lineSpacing * footerLines) + (3 * S);
    const relFooterBaseY = paddingBottom;
    const footerMinY = relFooterBaseY + footerZoneHeight;

    let currentRelY = boxHeight - paddingTop;

    // --- Imagen de firma (lado izquierdo del sello) ---
    if (signatureImage) {
      const imgWidth = boxWidth * 0.30;
      const imgHeight = boxHeight * 0.7;
      const imgPos = transform(accentWidth + (4 * S), (boxHeight - imgHeight) / 2);
      page.drawImage(signatureImage, {
        x: imgPos.px,
        y: imgPos.py,
        width: imgWidth,
        height: imgHeight,
        opacity: opacity,
        rotate: degrees(totalRotation),
      });
    }

    // --- Campos de texto con guardia anti-superposición ---
    // 1. Nombre
    if (fields.name && (currentRelY - fs_name) > footerMinY) {
      const pos = transform(relTextX, currentRelY);
      page.drawText(truncateText(signatureData.name || 'N/A', fs_name), {
        x: pos.px,
        y: pos.py,
        size: fs_name,
        font: fontBold,
        color: rgb(...TEXT_COLORS_RGB.name),
        rotate: degrees(totalRotation),
      });
      currentRelY -= (fs_name + lineSpacing);
    }

    // 2. Cargo
    if (fields.position && (currentRelY - fs_position) > footerMinY) {
      const pos = transform(relTextX, currentRelY);
      page.drawText(truncateText(signatureData.position || 'N/A', fs_position), {
        x: pos.px,
        y: pos.py,
        size: fs_position,
        font: fontBold,
        color: rgb(...TEXT_COLORS_RGB.position),
        rotate: degrees(totalRotation),
      });
      currentRelY -= (fs_position + lineSpacing);
    }

    // 3. Colegiatura
    if (fields.colegiatura && signatureData.colegiatura && (currentRelY - fs_colegiatura) > footerMinY) {
      const pos = transform(relTextX, currentRelY);
      page.drawText(truncateText(signatureData.colegiatura, fs_colegiatura), {
        x: pos.px,
        y: pos.py,
        size: fs_colegiatura,
        font: font,
        color: rgb(...TEXT_COLORS_RGB.colegiatura),
        rotate: degrees(totalRotation),
      });
      currentRelY -= (fs_colegiatura + lineSpacing);
    }

    // 4. Detalles
    if (fields.details && signatureData.details && (currentRelY - fs_details) > footerMinY) {
      const pos = transform(relTextX, currentRelY);
      page.drawText(truncateText(signatureData.details, fs_details), {
        x: pos.px,
        y: pos.py,
        size: fs_details,
        font: font,
        color: rgb(...TEXT_COLORS_RGB.details),
        rotate: degrees(totalRotation),
      });
    }

    // --- Footer: 2 líneas apiladas (fecha arriba, hash abajo) ---
    const relDividerY = relFooterBaseY + (fs_meta * footerLines) + (lineSpacing * footerLines);
    drawRotatedLine({ x: relTextX, y: relDividerY }, { x: boxWidth - paddingX, y: relDividerY });

    // Línea 1: Fecha
    const dateText = truncateText(`${STAMP_TEXTS.FOOTER_DATE_PREFIX} ${signatureData.dateTime}`, fs_meta);
    const relFooterLine1Y = relFooterBaseY + (hasHash ? fs_meta + lineSpacing : 0);
    const f1Pos = transform(relTextX, relFooterLine1Y);
    page.drawText(dateText, {
      x: f1Pos.px,
      y: f1Pos.py,
      size: fs_meta,
      font: font,
      color: rgb(...TEXT_COLORS_RGB.meta),
       rotate: degrees(totalRotation),
    });

    // Línea 2: Hash (debajo de la fecha)
    if (hasHash) {
      const hashText = truncateText(`${STAMP_TEXTS.FOOTER_HASH_PREFIX} ${signatureData.hash}`, fs_meta - 1);
      const f2Pos = transform(relTextX, relFooterBaseY);
      page.drawText(hashText, {
        x: f2Pos.px,
        y: f2Pos.py,
        size: fs_meta - 1,
        font: font,
        color: rgb(...TEXT_COLORS_RGB.meta),
        rotate: degrees(totalRotation),
      });
    }
  }

  const pdfBytes = await pdfDoc.save();
  await fsP.writeFile(outputPath, pdfBytes);
  return outputPath;
};
