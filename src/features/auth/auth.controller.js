const { User, Role } = require('../../shared/models');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

exports.register = async (req, res) => {
  try {
    const { username, email, password, roleName } = req.body;
    const role = await Role.findOne({ where: { name: roleName || 'Firmante' } });
    
    const user = await User.create({
      username,
      email,
      password,
      roleId: role.id
    });

    res.status(201).json({ message: 'Usuario registrado exitosamente', userId: user.id });
  } catch (error) {
    res.status(400).json({ message: 'Error al registrar usuario', error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email }, include: [Role] });

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.Role.name },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ 
      token, 
      user: { 
        id: user.id, 
        username: user.username, 
        role: user.Role.name,
        signatureSettings: user.signatureSettings 
      } 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const { signatureSettings } = req.body;
    const { User } = require('../../shared/models');
    const user = await User.findByPk(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    console.log('Actualizando ajustes para usuario:', user.username, signatureSettings);
    
    user.signatureSettings = {
      ...(user.signatureSettings || {}),
      ...signatureSettings
    };

    // Force Sequelize to detect changes in JSON field
    user.changed('signatureSettings', true);
    await user.save();
    
    console.log('Ajustes guardados exitosamente:', user.signatureSettings);

    res.json({ 
      message: 'Configuración actualizada', 
      signatureSettings: user.signatureSettings 
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar configuración', error: error.message });
  }
};

/**
 * Subir imagen para el sello de firma (PNG/JPG).
 * Se guarda en /uploads/signatures/ y la ruta se almacena en signatureSettings.
 */
exports.uploadSignatureImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No se subió ninguna imagen' });
    }

    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    // Eliminar imagen anterior si existe
    const oldPath = user.signatureSettings?.signatureImagePath;
    if (oldPath && fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath);
    }

    const imagePath = req.file.path;

    user.signatureSettings = {
      ...(user.signatureSettings || {}),
      signatureImagePath: imagePath
    };
    user.changed('signatureSettings', true);
    await user.save();

    res.json({
      message: 'Imagen de firma subida correctamente',
      signatureSettings: user.signatureSettings
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al subir imagen', error: error.message });
  }
};

/**
 * Eliminar imagen del sello de firma.
 */
exports.deleteSignatureImage = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    const imgPath = user.signatureSettings?.signatureImagePath;
    if (imgPath && fs.existsSync(imgPath)) {
      fs.unlinkSync(imgPath);
    }

    const settings = { ...(user.signatureSettings || {}) };
    delete settings.signatureImagePath;
    user.signatureSettings = settings;
    user.changed('signatureSettings', true);
    await user.save();

    res.json({
      message: 'Imagen eliminada',
      signatureSettings: user.signatureSettings
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar imagen', error: error.message });
  }
};

/**
 * Subir imagen de acento (franja) para el sello.
 */
exports.uploadAccentImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No se subió ninguna imagen' });
    }

    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    // Eliminar imagen anterior si existe
    const oldPath = user.signatureSettings?.accentImagePath;
    if (oldPath && fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath);
    }

    const imagePath = req.file.path;

    user.signatureSettings = {
      ...(user.signatureSettings || {}),
      accentImagePath: imagePath
    };
    user.changed('signatureSettings', true);
    await user.save();

    res.json({
      message: 'Imagen de acento subida correctamente',
      signatureSettings: user.signatureSettings
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al subir imagen', error: error.message });
  }
};

/**
 * Eliminar imagen de acento.
 */
exports.deleteAccentImage = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    const imgPath = user.signatureSettings?.accentImagePath;
    if (imgPath && fs.existsSync(imgPath)) {
      fs.unlinkSync(imgPath);
    }

    const settings = { ...(user.signatureSettings || {}) };
    delete settings.accentImagePath;
    user.signatureSettings = settings;
    user.changed('signatureSettings', true);
    await user.save();

    res.json({
      message: 'Imagen de acento eliminada',
      signatureSettings: user.signatureSettings
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar imagen', error: error.message });
  }
};
