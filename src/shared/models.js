const sequelize = require('./database');
const Role = require('../features/auth/models/Role');
const User = require('../features/auth/models/User');
const UserRole = require('../features/auth/models/UserRole');
const Project = require('../features/projects/models/Project');
const Document = require('../features/documents/models/Document');
const DocumentSigner = require('../features/documents/models/DocumentSigner');
const Signature = require('../features/signatures/models/Signature');
const ProjectMember = require('../features/projects/models/ProjectMember');
const AuditLog = require('../features/audit/models/AuditLog');

// --- Role / User (Many-to-Many) ---
User.belongsToMany(Role, { through: UserRole, foreignKey: 'userId', unique: false });
Role.belongsToMany(User, { through: UserRole, foreignKey: 'roleId', unique: false });

User.hasMany(UserRole, { foreignKey: 'userId', as: 'userRoles' });
UserRole.belongsTo(User, { foreignKey: 'userId' });
UserRole.belongsTo(Role, { foreignKey: 'roleId' });

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
Signature.belongsTo(Role, { foreignKey: 'roleId' });

// --- DocumentSigner ---
Document.hasMany(DocumentSigner, { foreignKey: 'documentId', as: 'signers' });
DocumentSigner.belongsTo(Document, { foreignKey: 'documentId' });

User.hasMany(DocumentSigner, { foreignKey: 'userId' });
DocumentSigner.belongsTo(User, { foreignKey: 'userId', as: 'user' });

DocumentSigner.belongsTo(Role, { foreignKey: 'roleId', as: 'role' });

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
  UserRole,
  Project,
  ProjectMember,
  Document,
  DocumentSigner,
  Signature,
  AuditLog
};
