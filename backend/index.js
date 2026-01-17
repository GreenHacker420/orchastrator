import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import { setupMainAgent } from "./src/agents/mainAgent.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: ["http://localhost:3000", "https://orchastrator.vercel.app", "*"],
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("Server is Running");
});

import debugRoutes from "./src/routes/debugRoutes.js";
app.use("/api/debug", debugRoutes);

io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    setupMainAgent(socket);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});