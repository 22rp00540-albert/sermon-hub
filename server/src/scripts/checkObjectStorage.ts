import "dotenv/config";
import { getObjectStorageConfigSummary, testObjectStorageConnection } from "../lib/objectStorage";

const run = async () => {
  console.log("Storage config:", getObjectStorageConfigSummary());
  const result = await testObjectStorageConnection();
  console.log(result.ok ? "OK:" : "FAILED:", result.message);
  process.exitCode = result.ok ? 0 : 1;
};

void run();
