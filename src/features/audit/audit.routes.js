const express = require('express');
const router = express.Router();
const auditController = require('./audit.controller');
const { auth, checkRole } = require('../../shared/auth.middleware');

router.get('/', auth, checkRole(['Administrador']), auditController.getLogs);

module.exports = router;
