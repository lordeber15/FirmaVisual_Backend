const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
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
  const existingPdfBytes = fs.readFileSync(inputPath);
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
    const imageBytes = fs.readFileSync(imgPath);
    const ext = imgPath.toLowerCase();
    if (ext.endsWith('.jpg') || ext.endsWith('.jpeg')) {
      signatureImage = await pdfDoc.embedJpg(imageBytes);
    } else {
      signatureImage = await pdfDoc.embedPng(imageBytes);
    }
  }

  // Cargar imagen de acento (franja)
  let accentImage;
  const accentPath = settings.accentImagePath;
  if (accentPath && fs.existsSync(accentPath)) {
    const imageBytes = fs.readFileSync(accentPath);
    const ext = accentPath.toLowerCase();
    if (ext.endsWith('.jpg') || ext.endsWith('.jpeg')) {
      accentImage = await pdfDoc.embedJpg(imageBytes);
    } else {
      accentImage = await pdfDoc.embedPng(imageBytes);
    }
  }
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

    // --- BORDE: Estilo accent izquierdo / Imagen de acento ---
    if (accentImage) {
      page.drawImage(accentImage, {
        x: coords.x,
        y: coords.y,
        width: accentWidth,
        height: boxHeight,
        opacity: opacity,
      });
    } else {
      page.drawRectangle({
        x: coords.x,
        y: coords.y,
        width: accentWidth,
        height: boxHeight,
        color: borderColor,
        opacity: opacity,
      });
    }

    // Bordes sutiles
    const subtleOpacity = opacity * 0.25;
    // Superior
    page.drawLine({
      start: { x: coords.x, y: coords.y + boxHeight },
      end: { x: coords.x + boxWidth, y: coords.y + boxHeight },
      thickness: 0.5,
      color: borderColor,
      opacity: subtleOpacity,
    });
    // Derecho
    page.drawLine({
      start: { x: coords.x + boxWidth, y: coords.y },
      end: { x: coords.x + boxWidth, y: coords.y + boxHeight },
      thickness: 0.5,
      color: borderColor,
      opacity: subtleOpacity,
    });
    // Inferior
    page.drawLine({
      start: { x: coords.x, y: coords.y },
      end: { x: coords.x + boxWidth, y: coords.y },
      thickness: 0.5,
      color: borderColor,
      opacity: subtleOpacity,
    });

    // Fondo transparente (sin rectángulo blanco)

    // --- Cálculo de posición del texto ---
    const hasImage = !!signatureImage;
    const textX = coords.x + accentWidth + (hasImage ? (boxWidth * 0.35) + (8 * S) : paddingX);
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
    const footerBaseY = coords.y + paddingBottom;
    const footerMinY = footerBaseY + footerZoneHeight;

    let currentY = coords.y + boxHeight - paddingTop;

    // --- Imagen de firma (lado izquierdo del sello) ---
    if (signatureImage) {
      const imgWidth = boxWidth * 0.30;
      const imgHeight = boxHeight * 0.7;
      page.drawImage(signatureImage, {
        x: coords.x + accentWidth + (4 * S),
        y: coords.y + (boxHeight - imgHeight) / 2,
        width: imgWidth,
        height: imgHeight,
        opacity: opacity,
      });
    }

    // --- Campos de texto con guardia anti-superposición ---
    // Solo renderizar si hay espacio antes de la zona del footer

    // 1. Nombre
    if (fields.name && (currentY - fs_name) > footerMinY) {
      page.drawText(truncateText(signatureData.name || 'N/A', fs_name), {
        x: textX,
        y: currentY,
        size: fs_name,
        font: fontBold,
        color: rgb(...TEXT_COLORS_RGB.name),
      });
      currentY -= (fs_name + lineSpacing);
    }

    // 2. Cargo
    if (fields.position && (currentY - fs_position) > footerMinY) {
      page.drawText(truncateText(signatureData.position || 'N/A', fs_position), {
        x: textX,
        y: currentY,
        size: fs_position,
        font: fontBold,
        color: rgb(...TEXT_COLORS_RGB.position),
      });
      currentY -= (fs_position + lineSpacing);
    }

    // 3. Colegiatura
    if (fields.colegiatura && signatureData.colegiatura && (currentY - fs_colegiatura) > footerMinY) {
      page.drawText(truncateText(signatureData.colegiatura, fs_colegiatura), {
        x: textX,
        y: currentY,
        size: fs_colegiatura,
        font: font,
        color: rgb(...TEXT_COLORS_RGB.colegiatura),
      });
      currentY -= (fs_colegiatura + lineSpacing);
    }

    // 4. Detalles
    if (fields.details && signatureData.details && (currentY - fs_details) > footerMinY) {
      page.drawText(truncateText(signatureData.details, fs_details), {
        x: textX,
        y: currentY,
        size: fs_details,
        font: font,
        color: rgb(...TEXT_COLORS_RGB.details),
      });
    }

    // --- Footer: 2 líneas apiladas (fecha arriba, hash abajo) ---
    // Línea divisora
    const dividerY = footerBaseY + (fs_meta * footerLines) + (lineSpacing * footerLines);
    page.drawLine({
      start: { x: textX, y: dividerY },
      end: { x: coords.x + boxWidth - paddingX, y: dividerY },
      thickness: 0.3,
      color: rgb(0.85, 0.85, 0.85),
      opacity: 0.8,
    });

    // Línea 1: Fecha
    const dateText = truncateText(`${STAMP_TEXTS.FOOTER_DATE_PREFIX} ${signatureData.dateTime}`, fs_meta);
    const footerLine1Y = footerBaseY + (hasHash ? fs_meta + lineSpacing : 0);
    page.drawText(dateText, {
      x: textX,
      y: footerLine1Y,
      size: fs_meta,
      font: font,
      color: rgb(...TEXT_COLORS_RGB.meta),
    });

    // Línea 2: Hash (debajo de la fecha)
    if (hasHash) {
      const hashText = truncateText(`${STAMP_TEXTS.FOOTER_HASH_PREFIX} ${signatureData.hash}`, fs_meta - 1);
      page.drawText(hashText, {
        x: textX,
        y: footerBaseY,
        size: fs_meta - 1,
        font: font,
        color: rgb(...TEXT_COLORS_RGB.meta),
      });
    }
  }

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
  return outputPath;
};
