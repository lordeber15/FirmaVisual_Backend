const { body, param, validationResult } = require('express-validator');

/**
 * Middleware que ejecuta las validaciones y retorna errores si los hay.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Error de validación',
      errors: errors.array().map(e => ({ field: e.path, message: e.msg }))
    });
  }
  next();
};

// ─── Auth ───
const loginRules = [
  body('email').isEmail().withMessage('Email inválido'),
  body('password').notEmpty().withMessage('La contraseña es requerida'),
];

const registerRules = [
  body('username').trim().isLength({ min: 2, max: 50 }).withMessage('Username debe tener entre 2 y 50 caracteres'),
  body('email').isEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
];

// ─── Users ───
const createUserRules = [
  body('username').trim().isLength({ min: 2, max: 50 }).withMessage('Username debe tener entre 2 y 50 caracteres'),
  body('email').isEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
  body('roleId').optional().isInt().withMessage('roleId debe ser un entero'),
];

const updateUserRules = [
  param('id').isUUID().withMessage('ID inválido'),
  body('username').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Username inválido'),
  body('email').optional().isEmail().withMessage('Email inválido'),
  body('password').optional().isLength({ min: 6 }).withMessage('Contraseña muy corta'),
  body('roleId').optional().isInt().withMessage('roleId debe ser un entero'),
];

// ─── Documents ───
const documentIdRules = [
  param('id').isUUID().withMessage('ID de documento inválido'),
];

const assignSignersRules = [
  param('id').isUUID().withMessage('ID de documento inválido'),
  body('userIds').isArray({ min: 1 }).withMessage('Debe enviar al menos un componente de firma'),
  body('userIds.*.userId').isUUID().withMessage('Cada userId debe ser un UUID válido'),
  body('userIds.*.roleId').optional({ checkFalsy: true }).isInt().withMessage('Cada componente debe tener un roleId válido (entero)'),
];

// ─── Projects ───
const createProjectRules = [
  body('name').trim().isLength({ min: 1, max: 200 }).withMessage('Nombre del proyecto es requerido'),
  body('description').optional().isLength({ max: 1000 }).withMessage('Descripción muy larga'),
];

// ─── Signatures ───
const signDocumentRules = [
  body('documentId').isUUID().withMessage('documentId inválido'),
  body('type').isIn(['VISUAL', 'OFFICIAL']).withMessage('Tipo debe ser VISUAL u OFFICIAL'),
  body('coords').isObject().withMessage('Coordenadas son requeridas'),
  body('coords.x').isNumeric().withMessage('Coordenada X inválida'),
  body('coords.y').isNumeric().withMessage('Coordenada Y inválida'),
];

module.exports = {
  validate,
  loginRules,
  registerRules,
  createUserRules,
  updateUserRules,
  documentIdRules,
  assignSignersRules,
  createProjectRules,
  signDocumentRules,
};
