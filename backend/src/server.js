const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { initDb } = require('./models/db');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const clientRoutes = require('./routes/client');
const equipmentRoutes = require('./routes/equipment');
const monitoringRoutes = require('./routes/monitoring');
const reportRoutes = require('./routes/report');
const agentRoutes = require('./routes/agent');
const intranetRoutes = require('./routes/intranet');
const knowledgeRoutes = require('./routes/knowledge');
const securityDiagnosticRoutes = require('./routes/securityDiagnosticRoutes');
const adminBackupRoutes = require('./routes/adminBackup');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/', (req, res) => {
  res.json({ message: 'Goldtech API Active' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'goldtech-inventario-api' });
});

app.use('/api', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/equipments', equipmentRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/intranet', intranetRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/admin', adminBackupRoutes);
app.use('/api', securityDiagnosticRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Rota nao encontrada' });
});

app.use((err, req, res, next) => {
  console.error('SERVER ERROR:', err);
  res.status(500).json({ message: 'Erro interno no servidor' });
});

const PORT = process.env.PORT || 3002;

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Servidor Goldtech rodando na porta ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('DATABASE INIT FAILED:', err);
    process.exit(1);
  });
