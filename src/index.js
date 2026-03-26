require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { sequelize } = require('./shared/models');
const seed = require('../seed');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Security Middlewares ───
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));

// CORS - configurable via env
const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
};
app.use(cors(corsOptions));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Demasiadas solicitudes, intente de nuevo más tarde' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Demasiados intentos de autenticación' },
});

app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Trust proxy (for correct IP in Docker)
app.set('trust proxy', 1);

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ─── Routes ───
const authRoutes = require('./features/auth/auth.routes');
const documentRoutes = require('./features/documents/documents.routes');
const signatureRoutes = require('./features/signatures/signatures.routes');
const auditRoutes = require('./features/audit/audit.routes');
const projectRoutes = require('./features/projects/projects.routes');
const usersRoutes = require('./features/auth/users.routes');

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/signatures', signatureRoutes);
app.use('/api/audit', auditRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'RPD Backend is running' });
});

// ─── Global Error Handler ───
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Error interno del servidor' });
});

// ─── Sync Database and Start ───
sequelize.sync({ alter: true }).then(async () => {
  console.log('Database synced');
  await seed();

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Error syncing database:', err);
});
