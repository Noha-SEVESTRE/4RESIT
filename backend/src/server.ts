import "dotenv/config";
import { app } from "./app";

const port = Number(process.env.BACKEND_PORT ?? 8080);

app.listen(port, () => {
    console.log(`SUPMEAL API listening on port ${port}`);
});