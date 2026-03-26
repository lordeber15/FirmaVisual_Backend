const { AuditLog } = require('../../shared/models');

exports.getLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const { count, rows: logs } = await AuditLog.findAndCountAll({
      order: [['createdAt', 'DESC']],
      include: ['User'],
      limit,
      offset
    });

    res.json({
      total: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      logs
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener logs', error: error.message });
  }
};
