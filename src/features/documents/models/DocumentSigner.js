const { DataTypes } = require('sequelize');
const sequelize = require('../../../shared/database');

const DocumentSigner = sequelize.define('DocumentSigner', {
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
  status: {
    type: DataTypes.ENUM('PENDING', 'SIGNED'),
    defaultValue: 'PENDING'
  },
  signedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  indexes: [
    {
      unique: true,
      fields: ['documentId', 'userId']
    }
  ]
});

module.exports = DocumentSigner;
