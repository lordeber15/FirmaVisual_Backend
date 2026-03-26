const { DataTypes } = require('sequelize');
const sequelize = require('../../../shared/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  roleId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  signatureSettings: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {
      width: 220,
      height: 100,
      fontSizes: {
        name: 10,
        position: 8,
        colegiatura: 8,
        details: 7,
        meta: 6
      },
      fields: {
        name: true,
        position: true,
        colegiatura: true,
        details: true,
        hash: true
      },
      color: '#0f172a',
      borderColor: '#3b82f6',
      borderWidth: 2,
      opacity: 0.95
    }
  }
}, {
  hooks: {
    beforeCreate: async (user) => {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(user.password, salt);
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    }
  }
});

User.prototype.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = User;
