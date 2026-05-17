import "./env";
import app from "./app";
import { isObjectStorageConfigured } from "./lib/objectStorage";

const port = Number(process.env.PORT || 5000);

app.listen(port, () => {
  const storage = isObjectStorageConfigured() ? "configured" : "MISSING (set S3_* for uploads)";
  console.log(`Server listening on port ${port}`);
  console.log(`Object storage: ${storage}`);
  if (process.env.RENDER === "true") {
    console.log("Render: use Web Service (not Static Site) so /api/v1 and uploads work.");
  }
});
