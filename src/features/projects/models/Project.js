const { DataTypes } = require('sequelize');
const sequelize = require('../../../shared/database');

const Project = sequelize.define('Project', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('ACTIVE', 'COMPLETED', 'ARCHIVED'),
    defaultValue: 'ACTIVE'
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: false
  }
});

module.exports = Project;
