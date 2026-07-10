import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runCli, parseArgs } from "./dispatch-cli.js";

export { runCli } from "./dispatch-cli.js";

export const __testing = {
  parseArgs,
};

const self = fileURLToPath(import.meta.url);
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(self)) {
  runCli().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
