const { Op } = require('sequelize');
const { Project, ProjectMember, Document, DocumentSigner, User, AuditLog } = require('../../shared/models');

exports.createProject = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ message: 'El nombre es requerido' });

    const project = await Project.create({
      name,
      description,
      createdBy: req.user.id
    });

    // El creador se agrega automáticamente como MANAGER
    await ProjectMember.create({
      projectId: project.id,
      userId: req.user.id,
      role: 'MANAGER'
    });

    await AuditLog.create({
      userId: req.user.id,
      action: 'CREATE_PROJECT',
      details: `Proyecto "${name}" creado`,
      ip: req.ip
    });

    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ message: 'Error al crear proyecto', error: error.message });
  }
};

/**
 * Obtener proyectos filtrados por acceso:
 * - Administrador: ve todos
 * - Otros: solo proyectos donde son miembros o creadores
 */
exports.getProjects = async (req, res) => {
  try {
    const isAdmin = req.user.role === 'Administrador';

    let whereClause = {};
    if (!isAdmin) {
      // Obtener IDs de proyectos donde el usuario es miembro
      const memberships = await ProjectMember.findAll({
        where: { userId: req.user.id },
        attributes: ['projectId']
      });
      const memberProjectIds = memberships.map(m => m.projectId);

      whereClause = {
        [Op.or]: [
          { createdBy: req.user.id },
          { id: { [Op.in]: memberProjectIds } }
        ]
      };
    }

    const projects = await Project.findAll({
      where: whereClause,
      include: [
        { model: User, as: 'creator', attributes: ['id', 'username'] },
        {
          model: ProjectMember,
          as: 'members',
          include: [{ model: User, as: 'user', attributes: ['id', 'username'] }]
        },
        {
          model: Document,
          as: 'documents',
          attributes: ['id', 'filename', 'status', 'version'],
          include: [
            {
              model: DocumentSigner,
              as: 'signers',
              attributes: ['id', 'status', 'userId']
            }
          ]
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener proyectos', error: error.message });
  }
};

exports.getProjectById = async (req, res) => {
  try {
    const isAdmin = req.user.role === 'Administrador';

    const project = await Project.findByPk(req.params.id, {
      include: [
        { model: User, as: 'creator', attributes: ['id', 'username'] },
        {
          model: ProjectMember,
          as: 'members',
          include: [{ model: User, as: 'user', attributes: ['id', 'username', 'email'] }]
        },
        {
          model: Document,
          as: 'documents',
          include: [
            {
              model: DocumentSigner,
              as: 'signers',
              include: [{ model: User, as: 'user', attributes: ['id', 'username', 'email'] }]
            },
            { model: User, as: 'creator', attributes: ['id', 'username'] }
          ]
        }
      ]
    });
    if (!project) return res.status(404).json({ message: 'Proyecto no encontrado' });

    // Verificar acceso
    if (!isAdmin) {
      const isMember = project.members.some(m => m.userId === req.user.id);
      const isCreator = project.createdBy === req.user.id;
      if (!isMember && !isCreator) {
        return res.status(403).json({ message: 'No tienes acceso a este proyecto' });
      }
    }

    res.json(project);
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message });
  }
};

exports.updateProject = async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id);
    if (!project) return res.status(404).json({ message: 'Proyecto no encontrado' });

    const { name, description, status } = req.body;
    if (name) project.name = name;
    if (description !== undefined) project.description = description;
    if (status) project.status = status;
    await project.save();

    res.json(project);
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar proyecto', error: error.message });
  }
};

exports.deleteProject = async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id);
    if (!project) return res.status(404).json({ message: 'Proyecto no encontrado' });

    await project.destroy();

    await AuditLog.create({
      userId: req.user.id,
      action: 'DELETE_PROJECT',
      details: `Proyecto "${project.name}" eliminado`,
      ip: req.ip
    });

    res.json({ message: 'Proyecto eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar proyecto', error: error.message });
  }
};

/**
 * Asignar miembros a un proyecto.
 * Body: { userIds: [uuid, ...] }
 */
exports.assignMembers = async (req, res) => {
  try {
    const { id } = req.params;
    const { userIds } = req.body;

    const project = await Project.findByPk(id);
    if (!project) return res.status(404).json({ message: 'Proyecto no encontrado' });

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'Debe enviar al menos un userId' });
    }

    // Eliminar miembros anteriores (excepto el creador)
    await ProjectMember.destroy({
      where: { projectId: id, userId: { [Op.ne]: project.createdBy } }
    });

    // Crear nuevas asignaciones (evitar duplicar al creador)
    const uniqueIds = [...new Set(userIds)];
    const members = await ProjectMember.bulkCreate(
      uniqueIds
        .filter(uid => uid !== project.createdBy)
        .map(userId => ({ projectId: id, userId, role: 'VIEWER' })),
      { ignoreDuplicates: true }
    );

    // Asegurar que el creador siempre esté
    await ProjectMember.findOrCreate({
      where: { projectId: id, userId: project.createdBy },
      defaults: { role: 'MANAGER' }
    });

    await AuditLog.create({
      userId: req.user.id,
      action: 'ASSIGN_PROJECT_MEMBERS',
      details: `${uniqueIds.length} miembros asignados al proyecto ${id}`,
      ip: req.ip
    });

    res.json({ message: 'Miembros asignados correctamente', count: members.length + 1 });
  } catch (error) {
    console.error('ASSIGN_MEMBERS ERROR:', error);
    res.status(500).json({ message: 'Error al asignar miembros', error: error.message });
  }
};
