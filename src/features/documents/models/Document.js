const { DataTypes } = require('sequelize');
const sequelize = require('../../../shared/database');

const Document = sequelize.define('Document', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  filename: {
    type: DataTypes.STRING,
    allowNull: false
  },
  originalPath: {
    type: DataTypes.STRING,
    allowNull: false
  },
  signedPath: {
    type: DataTypes.STRING,
    allowNull: true
  },
  version: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'PARTIAL', 'COMPLETED', 'REPLACED'),
    defaultValue: 'PENDING'
  },
  projectId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: false
  },
  replaceRequested: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  replaceApproved: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
});

module.exports = Document;
