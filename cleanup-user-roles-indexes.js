const { sequelize } = require('./src/shared/models');

async function cleanupIndexes() {
  try {
    console.log('--- Iniciando limpieza exhaustiva de índices en UserRoles ---');
    
    // 1. Obtener todos los índices únicos actuales
    const [indexes] = await sequelize.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'UserRoles' 
      AND (indexdef LIKE '%UNIQUE%' OR indexname LIKE '%key%');
    `);

    console.log(`Se encontraron ${indexes.length} índices potenciales.`);

    for (const idx of indexes) {
      const isPrimaryKey = idx.indexname.includes('_pkey');
      const isTripleIndex = idx.indexdef.includes('cargo');

      if (isPrimaryKey) {
        console.log(`Omitiendo Primary Key: ${idx.indexname}`);
        continue;
      }

      if (isTripleIndex) {
        console.log(`Manteniendo índice triple: ${idx.indexname}`);
        continue;
      }

      // Si es un índice que termina en '_key', probablemente es un CONSTRAINT de Sequelize
      if (idx.indexname.includes('_key')) {
        console.log(`Eliminando CONSTRAINT redundante: ${idx.indexname}`);
        await sequelize.query(`ALTER TABLE "UserRoles" DROP CONSTRAINT IF EXISTS "${idx.indexname}" CASCADE;`);
      } else {
        console.log(`Eliminando índice redundante: ${idx.indexname} (${idx.indexdef})`);
        await sequelize.query(`DROP INDEX IF EXISTS "${idx.indexname}" CASCADE;`);
      }
    }

    // 2. Asegurarse de que el índice triple existe
    console.log('Verificando existencia del índice triple...');
    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_id_role_id_cargo 
      ON "UserRoles" ("userId", "roleId", "cargo");
    `);

    console.log('✅ Limpieza completada con éxito.');
  } catch (error) {
    console.error('❌ Error en la limpieza:', error);
  } finally {
    process.exit(0);
  }
}

cleanupIndexes();
