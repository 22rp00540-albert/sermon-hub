import "./env";
import app from "./app";
import {
  getObjectStorageConfigSummary,
  isObjectStorageConfigured,
  testObjectStorageConnection,
} from "./lib/objectStorage";

const port = Number(process.env.PORT || 5000);

app.listen(port, () => {
  const summary = getObjectStorageConfigSummary();
  console.log(`Server listening on port ${port}`);
  console.log(
    `Object storage: ${isObjectStorageConfigured() ? `bucket=${summary.bucket}` : "MISSING — set S3_* on Render"}`,
  );
  if (process.env.RENDER === "true") {
    console.log("Render: service must be Web Service (not Static Site) for /api/v1");
  }
  void testObjectStorageConnection().then((result) => {
    console.log(`R2/S3 check: ${result.ok ? "OK" : "FAILED"} — ${result.message}`);
  });
});
