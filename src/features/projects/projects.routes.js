const express = require('express');
const router = express.Router();
const projectController = require('./projects.controller');
const { auth, checkRole } = require('../../shared/auth.middleware');
const { validate, createProjectRules } = require('../../shared/validators');

router.post('/', auth, checkRole(['Administrador', 'Ejecutor']), createProjectRules, validate, projectController.createProject);
router.get('/', auth, projectController.getProjects);
router.get('/:id', auth, projectController.getProjectById);
router.put('/:id', auth, checkRole(['Administrador', 'Ejecutor']), projectController.updateProject);
router.delete('/:id', auth, checkRole(['Administrador']), projectController.deleteProject);
router.post('/:id/members', auth, checkRole(['Administrador', 'Ejecutor']), projectController.assignMembers);
router.get('/available-members/list', auth, projectController.getAvailableMembers);

module.exports = router;
