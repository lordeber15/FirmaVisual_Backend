const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env.tmp') });

const modelsPath = path.join(process.cwd(), 'src/shared/models');
const { sequelize, User, Role, UserRole } = require(modelsPath);

async function migrate() {
  try {
    console.log('--- Iniciando migración ---');
    console.log(`Conectando a: ${process.env.DB_HOST}:${process.env.DB_PORT} / ${process.env.DB_NAME}`);
    
    // 1. Sincronizar la base de datos para crear la nueva tabla UserRole y columnas nuevas
    await sequelize.sync({ alter: true });
    console.log('Base de datos sincronizada (tablas creadas/actualizadas).');

    // 2. Obtener usuarios actuales con su roleId
    const users = await User.findAll();
    const roles = await Role.findAll();
    const rolesMap = roles.reduce((acc, r) => ({ ...acc, [r.id]: r.name }), {});

    console.log(`Procesando ${users.length} usuarios...`);

    for (const user of users) {
      if (user.roleId) {
        // Verificar si ya existe en UserRole para evitar duplicados
        const existing = await UserRole.findOne({ where: { userId: user.id, roleId: user.roleId } });
        
        if (!existing) {
          await UserRole.create({
            userId: user.id,
            roleId: user.roleId,
            cargo: rolesMap[user.roleId] || 'Especialista'
          });
          console.log(`Migrado rol para usuario: ${user.username}`);
        } else {
          console.log(`Usuario ${user.username} ya tiene el rol asignado.`);
        }
      }
    }

    console.log('--- Migración completada con éxito ---');
    process.exit(0);
  } catch (error) {
    console.error('Error durante la migración:', error);
    process.exit(1);
  }
}

migrate();
