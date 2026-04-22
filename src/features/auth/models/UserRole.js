const { DataTypes } = require('sequelize');
const sequelize = require('../../../shared/database');

const UserRole = sequelize.define('UserRole', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  roleId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  cargo: {
    type: DataTypes.STRING,
    allowNull: true
  },
  signatureSettings: {
    type: DataTypes.JSON,
    allowNull: true
  }
}, {
  indexes: [
    {
      unique: true,
      fields: ['userId', 'roleId', 'cargo']
    }
  ]
});

module.exports = UserRole;
