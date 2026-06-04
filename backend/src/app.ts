import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRouter from './routes/auth';
import reportsRouter from './routes/reports';
import approvalsRouter from './routes/approvals';
import exportRouter from './routes/export';
import tractorsRouter from './routes/tractors';
import workTypesRouter from './routes/workTypes';
import fieldsRouter from './routes/fields';
import usersRouter from './routes/users';
import organizationRouter from './routes/organization';
import auditRouter from './routes/audit';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/approvals', approvalsRouter);
app.use('/api/export', exportRouter);
app.use('/api/tractors', tractorsRouter);
app.use('/api/work-types', workTypesRouter);
app.use('/api/fields', fieldsRouter);
app.use('/api/users', usersRouter);
app.use('/api/organization', organizationRouter);
app.use('/api/audit', auditRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`ADW backend running on http://localhost:${port}`);
});
