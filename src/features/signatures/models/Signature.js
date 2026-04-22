const { DataTypes } = require('sequelize');
const sequelize = require('../../../shared/database');

const Signature = sequelize.define('Signature', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  documentId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  roleId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  type: {
    type: DataTypes.ENUM('VISUAL', 'OFFICIAL'),
    allowNull: false
  },
  data: {
    type: DataTypes.JSON, // Coordenadas, página, metadatos, texto
    allowNull: false
  },
  ip: {
    type: DataTypes.STRING,
    allowNull: true
  },
  signedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
});

module.exports = Signature;
