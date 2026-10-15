#!/usr/bin/env node
import { Command } from "commander";
import { AppError, EXIT } from "../utils/errors.js";

const program = new Command();

program
  .name("devflow")
  .description("Local-first developer workflow and coding-session manager")
  .version("0.0.0")
  .option("--json", "Output results as JSON");

async function main() {
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    if (error instanceof AppError) {
      if (program.opts().json) {
        console.error(
          JSON.stringify({ error: error.message, code: error.code }),
        );
      } else {
        console.error(`Error: ${error.message}`);
      }
      process.exit(error.code);
    }

    const message = error instanceof Error ? error.message : String(error);
    if (program.opts().json) {
      console.error(JSON.stringify({ error: message, code: EXIT.ERROR }));
    } else {
      console.error(`Fatal error: ${message}`);
    }
    process.exit(EXIT.ERROR);
  }
}

main();

