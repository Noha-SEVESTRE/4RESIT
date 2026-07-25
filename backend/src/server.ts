import "dotenv/config";
import { createServer } from "http";
import { app } from "./app";
import { initializeSocket } from "./realtime/socket";

const port = Number(process.env.BACKEND_PORT ?? 8080);
const server = createServer(app);

initializeSocket(server);

server.listen(port, () => {
    console.log(`SUPMEAL API listening on port ${port}`);
});