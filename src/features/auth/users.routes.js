const express = require('express');
const router = express.Router();
const usersController = require('./users.controller');
const { auth, checkRole } = require('../../shared/auth.middleware');
const { validate, createUserRules, updateUserRules } = require('../../shared/validators');

router.get('/', auth, checkRole(['Administrador']), usersController.getUsers);
router.get('/roles', auth, checkRole(['Administrador']), usersController.getRoles);
router.post('/', auth, checkRole(['Administrador']), createUserRules, validate, usersController.createUser);
router.put('/:id', auth, checkRole(['Administrador']), updateUserRules, validate, usersController.updateUser);
router.delete('/:id', auth, checkRole(['Administrador']), usersController.deleteUser);

module.exports = router;
