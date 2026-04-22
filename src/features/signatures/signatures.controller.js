const { Signature, Document, DocumentSigner, AuditLog, User, UserRole, Role } = require('../../shared/models');
const signatureService = require('./signatures.service');
const path = require('path');
const fs = require('fs');

exports.signDocument = async (req, res) => {
  try {
    const { documentId, type, coords, signatureData, roleId } = req.body;
    const userId = req.user.id;

    if (!roleId) {
      return res.status(400).json({ message: 'El ID de rol es requerido para firmar' });
    }

    const document = await Document.findByPk(documentId, {
      include: [{ model: DocumentSigner, as: 'signers' }]
    });

    if (!document) {
      return res.status(404).json({ message: 'Documento no encontrado' });
    }

    // --- Validación: usuario asignado como firmante con ese ROL ---
    const signers = document.signers || [];
    const assignedSigner = signers.find(s => s.userId === userId && s.roleId === parseInt(roleId));

    if (!assignedSigner) {
      return res.status(403).json({ message: 'No estás asignado con este rol para firmar este documento' });
    }
    if (assignedSigner.status === 'SIGNED') {
      return res.status(409).json({ message: 'Ya has firmado este documento con este rol' });
    }

    // Obtener los AJUSTES específicos para este usuario y rol
    const userRole = await UserRole.findOne({
      where: { userId, roleId: parseInt(roleId) }
    });
    
    const settings = userRole?.signatureSettings || {};
    
    const inputPath = document.signedPath || document.originalPath;
    const signedFilename = `signed-${Date.now()}-${document.filename}`;
    const outputPath = path.join(__dirname, '../../../uploads', signedFilename);

    let finalSignatureData = { ...signatureData };
    
    // Priorizar datos del sello: 1. Enviados desde frontend, 2. Configuración del rol, 3. Datos del Usuario, 4. Vacío
    finalSignatureData.position = signatureData.position || settings.stampPosition || userRole?.cargo || '';
    finalSignatureData.colegiatura = signatureData.colegiatura || settings.colegiatura || '';
    finalSignatureData.details = signatureData.details || settings.details || '';
    finalSignatureData.name = signatureData.name || settings.stampName || req.user.username || '';

    if (type === 'VISUAL') {
      if (signatureData.signatureImageBase64) {
        const base64Data = signatureData.signatureImageBase64.replace(/^data:image\/\w+;base64,/, '');
        const tempImagePath = path.join(__dirname, '../../../uploads', `temp-sig-${Date.now()}.png`);
        fs.writeFileSync(tempImagePath, base64Data, { encoding: 'base64' });
        finalSignatureData.signatureImagePath = tempImagePath;
      }

      await signatureService.stampVisualSignature(inputPath, outputPath, finalSignatureData, coords);

      document.signedPath = outputPath;

      // --- Lógica de status: PARTIAL vs COMPLETED ---
      assignedSigner.status = 'SIGNED';
      assignedSigner.signedAt = new Date();
      await assignedSigner.save();

      const pendingSigners = await DocumentSigner.count({
        where: { documentId, status: 'PENDING' }
      });
      document.status = pendingSigners === 0 ? 'COMPLETED' : 'PARTIAL';

      await document.save();

      // Limpiar imagen temporal
      if (finalSignatureData.signatureImagePath && fs.existsSync(finalSignatureData.signatureImagePath)) {
        fs.unlinkSync(finalSignatureData.signatureImagePath);
      }
    } else if (type === 'OFFICIAL') {
      return res.status(501).json({ message: 'Integración con SDK oficial en desarrollo' });
    }

    const signature = await Signature.create({
      documentId,
      userId,
      roleId: parseInt(roleId),
      type,
      data: { coords, signatureData: finalSignatureData },
      ip: req.ip
    });

    await AuditLog.create({
      userId,
      action: 'SIGN_DOCUMENT',
      details: `Documento ${documentId} firmado (${type})`,
      ip: req.ip
    });

    const signedFilenameForClient = signedFilename;
    res.json({ message: 'Documento firmado correctamente', signature, signedFilename: signedFilenameForClient });
  } catch (error) {
    console.error('SIGN_DOCUMENT ERROR:', error);
    res.status(500).json({ message: 'Error al firmar documento', error: error.message });
  }
};

/**
 * Obtener firmas y firmantes asignados de un documento.
 */
exports.getDocumentSignatures = async (req, res) => {
  try {
    const { documentId } = req.params;

    const signatures = await Signature.findAll({
      where: { documentId },
      include: [
        { model: User, attributes: ['id', 'username', 'email'] },
        { model: Role, attributes: ['name'] }
      ],
      order: [['signedAt', 'ASC']]
    });

    const signers = await DocumentSigner.findAll({
      where: { documentId },
      include: [
        { model: User, as: 'user', attributes: ['id', 'username', 'email'] },
        { model: Role, as: 'role', attributes: ['name'] }
      ]
    });

    res.json({ signatures, signers });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener firmas', error: error.message });
  }
};
