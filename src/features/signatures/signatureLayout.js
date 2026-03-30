/**
 * Constantes y layout unificado para la firma visual (Backend).
 * Debe mantenerse sincronizado con frontend/src/features/signatures/signatureLayout.js
 */

const STAMP_TEXTS = {
  HEADER: '',
  FOOTER_DATE_PREFIX: 'Fecha:',
  FOOTER_HASH_PREFIX: 'VERIFICADO:',
};

const DEFAULT_SETTINGS = {
  width: 220,
  height: 100,
  fontSizes: { name: 10, position: 8, colegiatura: 8, details: 7, meta: 6 },
  fields: { name: true, position: true, colegiatura: true, details: true, hash: true },
  borderColor: '#3b82f6',
  borderWidth: 2,
  rotation: 0,
  opacity: 0.95,
};

const TEXT_COLORS_RGB = {
  name: [0, 0, 0],
  position: [0.3, 0.3, 0.3],
  colegiatura: [0.4, 0.4, 0.4],
  details: [0.5, 0.5, 0.5],
  meta: [0.6, 0.6, 0.6],
};

const LAYOUT = {
  paddingX: 12,
  paddingTop: 12,
  paddingBottom: 8,
  lineSpacing: 3,
  footerHeight: 14,
  accentBorderMultiplier: 3,
};

/**
 * Factor de conversión CSS pixels → PDF points.
 * CSS: 1px = 1/96 inch. PDF: 1pt = 1/72 inch.
 * Para que 180px en el preview = 180px físicos en el PDF:
 *   PDF_points = CSS_pixels * (72/96) = CSS_pixels * 0.75
 */
const PX_TO_PT = 72 / 96;

function mergeSettings(userSettings) {
  if (!userSettings) return { ...DEFAULT_SETTINGS };
  return {
    ...DEFAULT_SETTINGS,
    ...userSettings,
    fontSizes: { ...DEFAULT_SETTINGS.fontSizes, ...(userSettings.fontSizes || {}) },
    fields: { ...DEFAULT_SETTINGS.fields, ...(userSettings.fields || {}) },
  };
}

module.exports = {
  STAMP_TEXTS,
  DEFAULT_SETTINGS,
  TEXT_COLORS_RGB,
  LAYOUT,
  PX_TO_PT,
  mergeSettings,
};
