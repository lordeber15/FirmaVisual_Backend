const { User, Role, UserRole, AuditLog } = require('../../shared/models');

exports.getUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'username', 'email', 'createdAt'],
      include: [
        { 
          model: UserRole, 
          as: 'userRoles',
          include: [{ model: Role, attributes: ['id', 'name'] }]
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener usuarios', error: error.message });
  }
};

exports.getRoles = async (req, res) => {
  try {
    const roles = await Role.findAll();
    res.json(roles);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener roles', error: error.message });
  }
};

exports.createUser = async (req, res) => {
  const t = await User.sequelize.transaction();
  try {
    const { username, email, password, roles } = req.body; // roles: [{ id, cargo }, ...]
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Username, email y password son requeridos' });
    }

    const user = await User.create({ username, email, password }, { transaction: t });

    if (roles && Array.isArray(roles)) {
      for (const r of roles) {
        await UserRole.create({
          userId: user.id,
          roleId: r.id,
          cargo: r.cargo
        }, { transaction: t });
      }
    }

    await AuditLog.create({
      userId: req.user.id,
      action: 'CREATE_USER',
      details: `Usuario "${username}" (${email}) creado con ${roles?.length || 0} roles`,
      ip: req.ip
    }, { transaction: t });

    await t.commit();

    res.status(201).json({
      id: user.id,
      username: user.username,
      email: user.email
    });
  } catch (error) {
    await t.rollback();
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'El email o username ya existe' });
    }
    res.status(500).json({ message: 'Error al crear usuario', error: error.message });
  }
};

exports.updateUser = async (req, res) => {
  const t = await User.sequelize.transaction();
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    const { username, email, roles, password } = req.body;
    if (username) user.username = username;
    if (email) user.email = email;
    if (password) user.password = password;
    await user.save({ transaction: t });

    if (roles && Array.isArray(roles)) {
      // Eliminar roles previos y crear nuevos (sincronización simple)
      await UserRole.destroy({ where: { userId: user.id }, transaction: t });
      for (const r of roles) {
        await UserRole.create({
          userId: user.id,
          roleId: r.id,
          cargo: r.cargo
        }, { transaction: t });
      }
    }

    await AuditLog.create({
      userId: req.user.id,
      action: 'UPDATE_USER',
      details: `Usuario "${user.username}" actualizado`,
      ip: req.ip
    }, { transaction: t });

    await t.commit();
    res.json({ id: user.id, username: user.username, email: user.email });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ message: 'Error al actualizar usuario', error: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    // No permitir eliminar al propio admin
    if (user.id === req.user.id) {
      return res.status(400).json({ message: 'No puedes eliminarte a ti mismo' });
    }

    const username = user.username;
    await user.destroy();

    await AuditLog.create({
      userId: req.user.id,
      action: 'DELETE_USER',
      details: `Usuario "${username}" eliminado`,
      ip: req.ip
    });

    res.json({ message: 'Usuario eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar usuario', error: error.message });
  }
};
