const { User, Role, AuditLog } = require('../../shared/models');

exports.getUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'username', 'email', 'roleId', 'createdAt'],
      include: [{ model: Role, attributes: ['id', 'name'] }],
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
  try {
    const { username, email, password, roleId } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Username, email y password son requeridos' });
    }

    const user = await User.create({ username, email, password, roleId });

    await AuditLog.create({
      userId: req.user.id,
      action: 'CREATE_USER',
      details: `Usuario "${username}" (${email}) creado`,
      ip: req.ip
    });

    res.status(201).json({
      id: user.id,
      username: user.username,
      email: user.email,
      roleId: user.roleId
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'El email o username ya existe' });
    }
    res.status(500).json({ message: 'Error al crear usuario', error: error.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    const { username, email, roleId, password } = req.body;
    if (username) user.username = username;
    if (email) user.email = email;
    if (roleId) user.roleId = roleId;
    if (password) user.password = password;
    await user.save();

    await AuditLog.create({
      userId: req.user.id,
      action: 'UPDATE_USER',
      details: `Usuario "${user.username}" actualizado`,
      ip: req.ip
    });

    res.json({ id: user.id, username: user.username, email: user.email, roleId: user.roleId });
  } catch (error) {
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
