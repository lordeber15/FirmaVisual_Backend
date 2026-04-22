const { DocumentSigner, UserRole } = require('./src/shared/models');

async function fixNullRoles() {
  try {
    console.log('--- Iniciando corrección de roleId NULL en DocumentSigners ---');
    
    // 1. Buscar todos los registros con roleId NULL
    const nullSigners = await DocumentSigner.findAll({
      where: { roleId: null }
    });

    console.log(`Se encontraron ${nullSigners.length} registros para corregir.`);

    let fixedCount = 0;
    for (const signer of nullSigners) {
      // Buscar el primer rol de este usuario
      const userRole = await UserRole.findOne({
        where: { userId: signer.userId },
        order: [['createdAt', 'ASC']]
      });

      if (userRole) {
        signer.roleId = userRole.roleId;
        await signer.save();
        fixedCount++;
      } else {
        console.warn(`No se encontró ningún rol para el usuario ${signer.userId}. No se pudo corregir el registro ${signer.id}.`);
      }
    }

    console.log(`✅ Se corrigieron ${fixedCount} registros con éxito.`);
  } catch (error) {
    console.error('❌ Error en la corrección:', error);
  } finally {
    process.exit(0);
  }
}

fixNullRoles();
