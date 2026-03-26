const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const { auth } = require('../../shared/auth.middleware');
const { validate, loginRules, registerRules } = require('../../shared/validators');
const { uploadSignatureImage } = require('../../shared/upload');

router.post('/register', registerRules, validate, authController.register);
router.post('/login', loginRules, validate, authController.login);
router.put('/update-settings', auth, authController.updateSettings);
router.post('/upload-signature-image', auth, uploadSignatureImage.single('image'), authController.uploadSignatureImage);
router.delete('/signature-image', auth, authController.deleteSignatureImage);
router.post('/upload-accent-image', auth, uploadSignatureImage.single('image'), authController.uploadAccentImage);
router.delete('/accent-image', auth, authController.deleteAccentImage);

module.exports = router;
