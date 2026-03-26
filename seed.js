const { Role, User } = require('./src/shared/models');

async function seed() {
  const [adminRole] = await Role.findOrCreate({ where: { name: 'Administrador' } });
  await Role.findOrCreate({ where: { name: 'Asistente' } });
  await Role.findOrCreate({ where: { name: 'Ejecutor' } });
  await Role.findOrCreate({ where: { name: 'Firmante' } });

  // Crear usuario admin por defecto
  const adminUser = await User.findOne({ 
    where: { 
      [require('sequelize').Op.or]: [
        { email: 'admin@rpd.com' },
        { username: 'admin' }
      ]
    } 
  });
  
  if (!adminUser) {
    await User.create({
      username: 'admin',
      email: 'admin@rpd.com',
      password: 'admin1212', // Se encriptará automáticamente por el hook beforeCreate
      roleId: adminRole.id
    });
    console.log('Admin user created: admin@rpd.com / admin1212');
  } else {
    console.log('Admin user already exists (by email or username)');
  }

  console.log('Roles and Admin seeded');
}

module.exports = seed;
