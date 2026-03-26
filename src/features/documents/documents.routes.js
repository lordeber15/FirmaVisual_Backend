const express = require('express');
const router = express.Router();
const docController = require('./documents.controller');
const upload = require('../../shared/upload');
const { auth, checkRole } = require('../../shared/auth.middleware');
const { validate, documentIdRules, assignSignersRules } = require('../../shared/validators');

// Rutas estáticas ANTES de las dinámicas con :id
router.get('/available-signers', auth, checkRole(['Administrador', 'Ejecutor']), docController.getAvailableSigners);

router.post('/', auth, checkRole(['Administrador', 'Ejecutor']), upload.single('pdf'), docController.uploadDocument);
router.get('/', auth, docController.getDocuments);
router.get('/:id', auth, documentIdRules, validate, docController.getDocumentById);
router.put('/:id', auth, checkRole(['Administrador', 'Ejecutor']), upload.single('pdf'), docController.replaceDocument);
router.post('/:id/signers', auth, checkRole(['Administrador', 'Ejecutor']), assignSignersRules, validate, docController.assignSigners);
router.post('/:id/approve-replace', auth, checkRole(['Administrador']), documentIdRules, validate, docController.approveReplace);

module.exports = router;
