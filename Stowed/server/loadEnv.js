import fs from "fs";
import path from "path";

// Meteor doesn't read .env itself, and runs the server bundle from
// .meteor/local/build/programs/server rather than the project root, so walk up
// from cwd to find the file. This module must be the first import in
// server/main.js so the variables are set before any other module reads them.
let dir = process.cwd();
for (let i = 0; i < 10; i++) {
  const candidate = path.join(dir, ".env");
  if (fs.existsSync(candidate)) {
    process.loadEnvFile(candidate);
    break;
  }
  const parent = path.dirname(dir);
  if (parent === dir) break;
  dir = parent;
}
