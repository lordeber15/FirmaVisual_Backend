const express = require('express');
const router = express.Router();
const sigController = require('./signatures.controller');
const { auth } = require('../../shared/auth.middleware');
const { validate, signDocumentRules } = require('../../shared/validators');

router.post('/', auth, signDocumentRules, validate, sigController.signDocument);
router.get('/document/:documentId', auth, sigController.getDocumentSignatures);

module.exports = router;
