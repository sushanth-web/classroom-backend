import AgentAPI from "apminsight";
AgentAPI.config()

// Node < 20 doesn't expose the Web Crypto API as a global, which Better Auth's
// generateId() requires (throws "crypto is not defined"). Polyfill it from the
// built-in module so the app runs even if the host defaults to an older Node.
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) {
    globalThis.crypto = webcrypto as Crypto;
}

import express from 'express';
import subjectsRouter from "./routes/subjects.js"
import usersRouter from "./routes/users.js"
import cors from "cors";
import securityMiddleware from "./middleware/security.js";
import {toNodeHandler} from "better-auth/node";
import {auth} from "./lib/auth.js";
import classesRouter from "./routes/classes.js"
import departmentsRouter from "./routes/departments.js"
import enrollmentsRouter from "./routes/enrollments.js"
import statsRouter from "./routes/stats.js"

const app = express();

// Behind a reverse proxy / load balancer (Docker, nginx, cloud host) so that
// req.ip and Arcjet read the real client IP from the X-Forwarded-For header.
app.set('trust proxy', 1);

if(!process.env.FRONTEND_URL) throw new Error('FRONTEND_URL is not set in .env file')

// Health check — declared BEFORE auth/Arcjet so the platform probe is never
// rate-limited or flagged as a bot. Railway healthcheckPath points here.
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

app.use(cors({
    origin:process.env.FRONTEND_URL,
    methods: ['GET','POST','PUT','DELETE'],
    credentials: true
}))

app.all('/api/auth/*splat',toNodeHandler((auth)))

app.use(express.json());

app.use(securityMiddleware)

app.use('/api/subjects', subjectsRouter);

app.use('/api/users', usersRouter);

app.use('/api/classes',classesRouter)

app.use('/api/departments', departmentsRouter);

app.use('/api/enrollments', enrollmentsRouter);

app.use('/api/stats', statsRouter);

app.get('/', (req,res) => {
    res.send('Hello, Welcome to the Classroom API!');
});

const port = Number(process.env.PORT) || 8080;

app.listen(port, "0.0.0.0", () => {
    console.log(`Server started on port ${port}`);
});