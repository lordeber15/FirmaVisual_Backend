const { sequelize } = require('./src/shared/models');

async function fixIndex() {
  try {
    console.log('--- Iniciando migración de índice de UserRole ---');
    
    // 1. Intentar encontrar el nombre del índice antiguo
    const [indexes] = await sequelize.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'UserRoles' 
      AND indexdef LIKE '%(userId, roleId)%';
    `);

    if (indexes.length > 0) {
      for (const idx of indexes) {
        console.log(`Eliminando índice antiguo: ${idx.indexname}`);
        await sequelize.query(`DROP INDEX IF EXISTS "${idx.indexname}";`);
      }
    } else {
      console.log('No se encontró el índice antiguo (o ya fue eliminado).');
    }

    // 2. Crear el nuevo índice si no existe
    console.log('Creando nuevo índice único: user_roles_user_id_role_id_cargo');
    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_id_role_id_cargo 
      ON "UserRoles" ("userId", "roleId", "cargo");
    `);

    console.log('✅ Migración completada con éxito.');
  } catch (error) {
    console.error('❌ Error en la migración:', error);
  } finally {
    process.exit(0);
  }
}

fixIndex();
