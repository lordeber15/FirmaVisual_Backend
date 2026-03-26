const { DataTypes } = require('sequelize');
const sequelize = require('../../../shared/database');

const ProjectMember = sequelize.define('ProjectMember', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  projectId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('VIEWER', 'MANAGER'),
    defaultValue: 'VIEWER'
  }
}, {
  indexes: [
    {
      unique: true,
      fields: ['projectId', 'userId']
    }
  ]
});

module.exports = ProjectMember;
