import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth.js';
import tasksRouter from './routes/tasks.js';
import milestonesRouter from './routes/milestones.js';
import suggestionsRouter from './routes/suggestions.js';
import rewardsRouter from './routes/rewards.js';
import redemptionsRouter from './routes/redemptions.js';
import xpRouter from './routes/xp.js';
import dashboardRouter from './routes/dashboard.js';

const app = express();

// Browsers enforce this, not us: the SPA is served from a different origin than
// the API once deployed. CORS_ORIGIN is a comma-separated allowlist; with none
// set (local dev) any origin is allowed. Auth travels as a Bearer header, not a
// cookie, so no credentials flag is needed.
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
  })
);
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/milestones', milestonesRouter);
app.use('/api/suggestions', suggestionsRouter);
app.use('/api/rewards', rewardsRouter);
app.use('/api/redemptions', redemptionsRouter);
app.use('/api/xp', xpRouter);
app.use('/api/dashboard', dashboardRouter);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
// Hosts route to the container's external interface, so don't bind to loopback.
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => console.log(`API listening on ${HOST}:${PORT}`));
