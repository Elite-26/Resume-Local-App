import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from './config/index.js';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import formatRoutes from './routes/formats.js';
import jobLinkRoutes from './routes/jobLinks.js';
import buildRoutes from './routes/builds.js';
import adminRoutes from './routes/admin.js';
import { getTemplatesDir, syncProjectTemplates } from './services/templateSync.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const uploadsDir = path.resolve(__dirname, '../uploads');
const templatesDir = getTemplatesDir();
const outputsDir = path.resolve(config.defaultOutputPath);
fs.mkdirSync(uploadsDir, { recursive: true });
fs.mkdirSync(templatesDir, { recursive: true });
try {
  fs.mkdirSync(outputsDir, { recursive: true });
} catch (err) {
  console.warn(`Could not ensure output path ${outputsDir}:`, err);
}

app.use(
  cors({
    origin: [
      config.clientUrl,
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ],
    credentials: true,
  })
);
app.use(express.json({ limit: '5mb' }));
app.use('/uploads', express.static(uploadsDir));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/formats', formatRoutes);
app.use('/api/job-links', jobLinkRoutes);
app.use('/api/builds', buildRoutes);
app.use('/api/admin', adminRoutes);

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
);

async function start() {
  try {
    const result = await syncProjectTemplates();
    console.log(
      `Templates synced from ${templatesDir}: ${result.synced} active, ${result.deactivated} removed`
    );
  } catch (err) {
    console.warn('Initial template sync skipped (DB may not be ready):', err);
  }

  const server = app.listen(config.port, '127.0.0.1', () => {
    console.log(`API listening on http://127.0.0.1:${config.port}`);
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `Port ${config.port} is already in use. Stop the other process (or close the other terminal running the API), then retry.`
      );
      process.exit(1);
    }
    throw err;
  });
}

void start();
