import AgentAPI from "apminsight";
AgentAPI.config()

import express from 'express';
import subjectsRouter from "./routes/subjects.js"
import cors from "cors";
import securityMiddleware from "./middleware/security.js";
import {toNodeHandler} from "better-auth/node";
import {auth} from "./lib/auth.js";

const app = express();
const port = process.env.PORT || 8000;

// Behind a reverse proxy / load balancer (Docker, nginx, cloud host) so that
// req.ip and Arcjet read the real client IP from the X-Forwarded-For header.
app.set('trust proxy', 1);

if(!process.env.FRONTEND_URL) throw new Error('FRONTEND_URL is not set in .env file')

app.use(cors({
    origin:process.env.FRONTEND_URL,
    methods: ['GET','POST','PUT','DELETE'],
    credentials: true
}))

app.all('/api/auth/*splat',toNodeHandler((auth)))

app.use(express.json());

app.use(securityMiddleware)

app.use('/api/subjects', subjectsRouter);

app.get('/', (req,res) => {
    res.send('Hello, Welcome to the Classroom API!');
});

app.listen(port, () => {
    console.log(`Server started on port ${port}`);
})