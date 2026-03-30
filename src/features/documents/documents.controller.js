const { Op } = require('sequelize');
const { Document, DocumentSigner, Signature, AuditLog, User, Role, ProjectMember } = require('../../shared/models');

exports.uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No se subió ningún archivo' });
    }

    if (!req.body.projectId) {
      return res.status(400).json({ message: 'El documento debe estar asociado a un proyecto' });
    }

    const document = await Document.create({
      filename: req.file.originalname,
      originalPath: req.file.path,
      status: 'PENDING',
      projectId: req.body.projectId,
      createdBy: req.user.id
    });

    // Auto-asignar firmantes del proyecto
    const projectMembers = await ProjectMember.findAll({
      where: { projectId: req.body.projectId },
      include: [{ 
        model: User, 
        as: 'user', 
        include: [{ model: Role, as: 'Role' }] 
      }]
    });

    const firmantes = projectMembers.filter(m => m.user?.Role?.name === 'Firmante');
    
    if (firmantes.length > 0) {
      await DocumentSigner.bulkCreate(
        firmantes.map(f => ({
          documentId: document.id,
          userId: f.userId,
          status: 'PENDING'
        })),
        { ignoreDuplicates: true }
      );
    }

    await AuditLog.create({
      userId: req.user.id,
      action: 'UPLOAD_DOCUMENT',
      details: `Documento ${document.filename} subido al proyecto ${req.body.projectId}`,
      ip: req.ip
    });

    res.status(201).json(document);
  } catch (error) {
    console.error('UPLOAD DOCUMENT ERROR:', error);
    res.status(500).json({ message: 'Error al subir documento', error: error.message });
  }
};

/**
 * Reemplazar documento.
 * - Admin: puede reemplazar directamente.
 * - Ejecutor: si el documento ya tiene firmas, solo puede solicitar reemplazo.
 *   El Admin debe aprobar con approveReplace.
 */
exports.replaceDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const document = await Document.findByPk(id);

    if (!document) {
      return res.status(404).json({ message: 'Documento no encontrado' });
    }

    const isAdmin = req.user.role === 'Administrador';
    const hasSignatures = await Signature.count({ where: { documentId: id } });

    // Ejecutor con documento firmado: necesita aprobación
    if (!isAdmin && hasSignatures > 0) {
      document.replaceRequested = true;
      await document.save();

      await AuditLog.create({
        userId: req.user.id,
        action: 'REQUEST_REPLACE',
        details: `Solicitud de reemplazo para documento ${id} (tiene ${hasSignatures} firmas)`,
        ip: req.ip
      });

      return res.json({
        message: 'Solicitud de reemplazo enviada. El Administrador debe aprobarla.',
        replaceRequested: true
      });
    }

    // Admin o documento sin firmas: reemplazar directamente
    await Signature.destroy({ where: { documentId: id } });
    await DocumentSigner.update(
      { status: 'PENDING', signedAt: null },
      { where: { documentId: id } }
    );

    document.originalPath = req.file.path;
    document.filename = req.file.originalname;
    document.signedPath = null;
    document.version += 1;
    document.status = 'PENDING';
    document.replaceRequested = false;
    document.replaceApproved = false;
    await document.save();

    await AuditLog.create({
      userId: req.user.id,
      action: 'REPLACE_DOCUMENT',
      details: `Documento ${id} reemplazado (v${document.version}). Firmas reiniciadas.`,
      ip: req.ip
    });

    res.json(document);
  } catch (error) {
    res.status(500).json({ message: 'Error al reemplazar documento', error: error.message });
  }
};

/**
 * Aprobar solicitud de reemplazo (solo Admin).
 */
exports.approveReplace = async (req, res) => {
  try {
    const { id } = req.params;
    const { approved } = req.body;
    const document = await Document.findByPk(id);

    if (!document) return res.status(404).json({ message: 'Documento no encontrado' });
    if (!document.replaceRequested) {
      return res.status(400).json({ message: 'No hay solicitud de reemplazo pendiente' });
    }

    if (approved) {
      document.replaceApproved = true;
      document.replaceRequested = false;
      await document.save();

      await AuditLog.create({
        userId: req.user.id,
        action: 'APPROVE_REPLACE',
        details: `Reemplazo aprobado para documento ${id}`,
        ip: req.ip
      });

      res.json({ message: 'Reemplazo aprobado. El ejecutor puede subir el nuevo archivo.', document });
    } else {
      document.replaceRequested = false;
      document.replaceApproved = false;
      await document.save();

      await AuditLog.create({
        userId: req.user.id,
        action: 'REJECT_REPLACE',
        details: `Reemplazo rechazado para documento ${id}`,
        ip: req.ip
      });

      res.json({ message: 'Solicitud de reemplazo rechazada.', document });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message });
  }
};

exports.getDocuments = async (req, res) => {
  try {
    const isAdmin = req.user.role === 'Administrador';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const offset = (page - 1) * limit;

    let whereClause = {};

    // Filtros de búsqueda (por nombre de archivo)
    if (search) {
      whereClause.filename = { [Op.iLike]: `%${search}%` };
    }

    // Filtros de seguridad (RBAC)
    if (!isAdmin) {
      // 1. Proyectos donde soy miembro (para Asistentes)
      const memberships = await ProjectMember.findAll({
        where: { userId: req.user.id },
        attributes: ['projectId']
      });
      const memberProjectIds = memberships.map(m => m.projectId);

      // 2. Documentos donde soy firmante (para Firmantes)
      const asSigner = await DocumentSigner.findAll({
        where: { userId: req.user.id },
        attributes: ['documentId']
      });
      const signedDocIds = asSigner.map(s => s.documentId);

      const securityFilter = {
        [Op.or]: [
          { createdBy: req.user.id },
          { id: { [Op.in]: signedDocIds } },
          { projectId: { [Op.in]: memberProjectIds } } // Permite a Asistentes ver todo el proyecto
        ]
      };

      // Combinar filtros si ya existe búsqueda
      if (whereClause.filename) {
        whereClause = {
          [Op.and]: [
            { filename: whereClause.filename },
            securityFilter
          ]
        };
      } else {
        whereClause = securityFilter;
      }
    }

    const { count, rows: documents } = await Document.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: DocumentSigner,
          as: 'signers',
          include: [{ model: User, as: 'user', attributes: ['id', 'username', 'email'] }]
        },
        { model: User, as: 'creator', attributes: ['id', 'username'] }
      ],
      offset,
      limit,
      order: [['createdAt', 'DESC']]
    });

    res.json({
      total: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      documents
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener documentos', error: error.message });
  }
};

exports.getDocumentById = async (req, res) => {
  try {
    const isAdmin = req.user.role === 'Administrador';

    const document = await Document.findByPk(req.params.id, {
      include: [
        {
          model: DocumentSigner,
          as: 'signers',
          include: [{ model: User, as: 'user', attributes: ['id', 'username', 'email'] }]
        },
        { model: User, as: 'creator', attributes: ['id', 'username'] }
      ]
    });
    if (!document) return res.status(404).json({ message: 'No encontrado' });

    // Verificar acceso por proyecto o por creador
    if (!isAdmin) {
      const isCreator = document.createdBy === req.user.id;
      let isMember = false;
      
      if (document.projectId) {
        const membership = await ProjectMember.findOne({
          where: { projectId: document.projectId, userId: req.user.id }
        });
        isMember = !!membership;
      }

      if (!isCreator && !isMember) {
        return res.status(403).json({ message: 'No tienes acceso a este documento' });
      }
    }

    res.json(document);
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message });
  }
};

/**
 * Asignar firmantes a un documento.
 * Body: { userIds: [uuid, uuid, ...] }
 */
exports.assignSigners = async (req, res) => {
  try {
    const { id } = req.params;
    const { userIds } = req.body;

    const document = await Document.findByPk(id);
    if (!document) {
      return res.status(404).json({ message: 'Documento no encontrado' });
    }

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'Debe enviar al menos un userId' });
    }

    // Eliminar asignaciones previas
    await DocumentSigner.destroy({ where: { documentId: id } });

    // Crear nuevas asignaciones
    const signers = await DocumentSigner.bulkCreate(
      userIds.map(userId => ({ documentId: id, userId, status: 'PENDING' }))
    );

    // Reconciliar con firmas existentes
    const existingSignatures = await Signature.findAll({ where: { documentId: id } });
    const signedUserIds = existingSignatures.map(s => s.userId);

    for (const signer of signers) {
      if (signedUserIds.includes(signer.userId)) {
        signer.status = 'SIGNED';
        signer.signedAt = new Date();
        await signer.save();
      }
    }

    // Recalcular status del documento
    const pendingCount = signers.filter(s => !signedUserIds.includes(s.userId)).length;
    if (existingSignatures.length > 0 && pendingCount > 0) {
      document.status = 'PARTIAL';
    } else if (pendingCount === 0 && signers.length > 0 && existingSignatures.length > 0) {
      document.status = 'COMPLETED';
    }
    await document.save();

    await AuditLog.create({
      userId: req.user.id,
      action: 'ASSIGN_SIGNERS',
      details: `${userIds.length} firmantes asignados al documento ${id}`,
      ip: req.ip
    });

    res.json({ message: 'Firmantes asignados correctamente', signers });
  } catch (error) {
    console.error('ASSIGN_SIGNERS ERROR:', error);
    res.status(500).json({ message: 'Error al asignar firmantes', error: error.message });
  }
};

/**
 * Obtener usuarios disponibles para asignar como firmantes.
 */
exports.getAvailableSigners = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'username', 'email', 'roleId'],
      include: [{ model: Role, attributes: ['name'] }]
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener usuarios', error: error.message });
  }
};
