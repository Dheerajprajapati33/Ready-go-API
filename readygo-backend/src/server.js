import dns from "node:dns";

dns.setServers(["1.1.1.1"]);
import "dotenv/config";
import http from "node:http";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import { initSocket } from "./services/socketService.js";

const port=Number(process.env.PORT||5000);
const server=http.createServer(app);
initSocket(server);
async function start(){
  try{
    await connectDB();
    server.listen(port,()=>console.log(`ReadyGo API listening on http://localhost:${port}`));
  }catch(error){
    console.error("Server startup failed:",error.message);
    process.exit(1);
  }
}
process.on("SIGINT",()=>server.close(()=>process.exit(0)));
process.on("SIGTERM",()=>server.close(()=>process.exit(0)));
start();
