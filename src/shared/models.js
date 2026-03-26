const sequelize = require('./database');
const Role = require('../features/auth/models/Role');
const User = require('../features/auth/models/User');
const Project = require('../features/projects/models/Project');
const Document = require('../features/documents/models/Document');
const DocumentSigner = require('../features/documents/models/DocumentSigner');
const Signature = require('../features/signatures/models/Signature');
const ProjectMember = require('../features/projects/models/ProjectMember');
const AuditLog = require('../features/audit/models/AuditLog');

// --- Role / User ---
Role.hasMany(User, { foreignKey: 'roleId' });
User.belongsTo(Role, { foreignKey: 'roleId' });

// --- Project ---
User.hasMany(Project, { foreignKey: 'createdBy' });
Project.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

Project.hasMany(Document, { foreignKey: 'projectId', as: 'documents' });
Document.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });

// --- Document ---
User.hasMany(Document, { foreignKey: 'createdBy' });
Document.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

// --- Signature ---
Document.hasMany(Signature, { foreignKey: 'documentId' });
Signature.belongsTo(Document, { foreignKey: 'documentId' });

User.hasMany(Signature, { foreignKey: 'userId' });
Signature.belongsTo(User, { foreignKey: 'userId' });

// --- DocumentSigner ---
Document.hasMany(DocumentSigner, { foreignKey: 'documentId', as: 'signers' });
DocumentSigner.belongsTo(Document, { foreignKey: 'documentId' });

User.hasMany(DocumentSigner, { foreignKey: 'userId' });
DocumentSigner.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// --- ProjectMember ---
Project.hasMany(ProjectMember, { foreignKey: 'projectId', as: 'members' });
ProjectMember.belongsTo(Project, { foreignKey: 'projectId' });

User.hasMany(ProjectMember, { foreignKey: 'userId' });
ProjectMember.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// --- AuditLog ---
User.hasMany(AuditLog, { foreignKey: 'userId' });
AuditLog.belongsTo(User, { foreignKey: 'userId' });

module.exports = {
  sequelize,
  Role,
  User,
  Project,
  ProjectMember,
  Document,
  DocumentSigner,
  Signature,
  AuditLog
};
