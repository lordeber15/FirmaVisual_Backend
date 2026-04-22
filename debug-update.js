const { sequelize, User, UserRole } = require('./src/shared/models');

async function debugUpdate() {
  try {
    console.log('--- Debugging User Update ---');
    
    // 1. Verificar Índices Reales
    const [indexes] = await sequelize.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'UserRoles';
    `);
    console.log('Índices actuales en UserRoles:', JSON.stringify(indexes, null, 2));

    // 2. Intentar una inserción de prueba que causaría el error si el índice está mal
    const testUserId = 'ca2e7c17-8fd7-4dbd-aa14-2215e0fd6d31'; // Del error del usuario
    const roleId = 4; // Firmante
    
    console.log(`Probando inserción dual para userId: ${testUserId}, roleId: ${roleId}`);
    
    const t = await sequelize.transaction();
    try {
      await UserRole.destroy({ where: { userId: testUserId }, transaction: t });
      
      console.log('Insertando cargo A...');
      await UserRole.create({ userId: testUserId, roleId, cargo: 'Cargo A' }, { transaction: t });
      
      console.log('Insertando cargo B...');
      await UserRole.create({ userId: testUserId, roleId, cargo: 'Cargo B' }, { transaction: t });
      
      await t.commit();
      console.log('✅ Inserción dual exitosa. El índice SI admite cargos distintos.');
    } catch (err) {
      await t.rollback();
      console.error('❌ Inserción dual falló:', err.name, err.message);
      if (err.parent) console.error('Detalle DB:', err.parent.detail);
    }

  } catch (error) {
    console.error('Debug Error:', error);
  } finally {
    process.exit(0);
  }
}

debugUpdate();
