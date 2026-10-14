import { execSync } from "child_process";
import fs from "fs";

try {
  const oldCollection = execSync("git show e95cae7f6f3d02881be4c3cdcafc8b487341cbae:readygo-backend/readygo_collection.json").toString();
  const oldDoc = execSync("git show e95cae7f6f3d02881be4c3cdcafc8b487341cbae:readygo-backend/readygo_documentation.md").toString();

  fs.writeFileSync("c:/Users/DELL/Downloads/ReadyGo_Backend_Starter/readygo-backend/scripts/old_collection.json", oldCollection);
  fs.writeFileSync("c:/Users/DELL/Downloads/ReadyGo_Backend_Starter/readygo-backend/scripts/old_doc.md", oldDoc);
  console.log("Successfully extracted old collection and old doc!");
} catch (e) {
  console.error("Error:", e.message);
}

