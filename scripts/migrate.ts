import { closeDatabase, runDatabaseMigrations } from "@/lib/db";

async function main() {
  try {
    await runDatabaseMigrations();
    console.log("Database schema is up to date.");
  } finally {
    await closeDatabase();
  }
}

void main();
