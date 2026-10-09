// One-time (or whenever METADATA changes): publish the role-connection metadata schema to Discord.
import { loadConfig } from "./config.js";
import { registerMetadata } from "./discord.js";

const config = loadConfig();
const result = await registerMetadata(config);
console.log("Registered role-connection metadata:");
console.log(JSON.stringify(result, null, 2));
