const { Signature, Document, DocumentSigner, AuditLog, User } = require('../../shared/models');
const signatureService = require('./signatures.service');
const path = require('path');
const fs = require('fs');

exports.signDocument = async (req, res) => {
  try {
    const { documentId, type, coords, signatureData } = req.body;
    const userId = req.user.id;

    const document = await Document.findByPk(documentId, {
      include: [{ model: DocumentSigner, as: 'signers' }]
    });

    if (!document) {
      return res.status(404).json({ message: 'Documento no encontrado' });
    }

    // --- Validación: usuario asignado como firmante ---
    const signers = document.signers || [];
    if (signers.length > 0) {
      const assignedSigner = signers.find(s => s.userId === userId);
      if (!assignedSigner) {
        return res.status(403).json({ message: 'No estás asignado como firmante de este documento' });
      }
      if (assignedSigner.status === 'SIGNED') {
        return res.status(409).json({ message: 'Ya has firmado este documento' });
      }
    } else {
      // Sin firmantes asignados: verificar que no haya firmado antes
      const existingSignature = await Signature.findOne({
        where: { documentId, userId }
      });
      if (existingSignature) {
        return res.status(409).json({ message: 'Ya has firmado este documento' });
      }
    }

    const inputPath = document.signedPath || document.originalPath;
    const signedFilename = `signed-${Date.now()}-${document.filename}`;
    const outputPath = path.join(__dirname, '../../../uploads', signedFilename);

    let finalSignatureData = { ...signatureData };

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
      if (signers.length > 0) {
        const assignedSigner = signers.find(s => s.userId === userId);
        assignedSigner.status = 'SIGNED';
        assignedSigner.signedAt = new Date();
        await assignedSigner.save();

        const pendingSigners = signers.filter(s => s.userId !== userId && s.status === 'PENDING');
        document.status = pendingSigners.length === 0 ? 'COMPLETED' : 'PARTIAL';
      } else {
        document.status = 'COMPLETED';
      }

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

    res.json({ message: 'Documento firmado correctamente', signature });
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
      include: [{ model: User, attributes: ['id', 'username', 'email'] }],
      order: [['signedAt', 'ASC']]
    });

    const signers = await DocumentSigner.findAll({
      where: { documentId },
      include: [{ model: User, as: 'user', attributes: ['id', 'username', 'email'] }]
    });

    res.json({ signatures, signers });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener firmas', error: error.message });
  }
};
