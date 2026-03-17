import { ensureDatabaseInitialized } from "@/lib/db";

async function main() {
  await ensureDatabaseInitialized();
  console.log("Database seeded.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
