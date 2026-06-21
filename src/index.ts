import AgentAPI from "apminsight";
AgentAPI.config()

import express from 'express';
import subjectsRouter from "./routes/subjects.js"
import usersRouter from "./routes/users.js"
import cors from "cors";
import securityMiddleware from "./middleware/security.js";
import {toNodeHandler} from "better-auth/node";
import {auth} from "./lib/auth.js";
import classesRouter from "./routes/classes.js"

const app = express();
const port = process.env.PORT || 8000;

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

app.get('/', (req,res) => {
    res.send('Hello, Welcome to the Classroom API!');
});

app.listen(port, () => {
    console.log(`Server started on port ${port}`);
})