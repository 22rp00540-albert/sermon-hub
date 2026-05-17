"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("./env");
const app_1 = __importDefault(require("./app"));
const objectStorage_1 = require("./lib/objectStorage");
const port = Number(process.env.PORT || 5000);
app_1.default.listen(port, () => {
    const summary = (0, objectStorage_1.getObjectStorageConfigSummary)();
    console.log(`Server listening on port ${port}`);
    console.log(`Object storage: ${(0, objectStorage_1.isObjectStorageConfigured)() ? `bucket=${summary.bucket}` : "MISSING — set S3_* on Render"}`);
    if (process.env.RENDER === "true") {
        console.log("Render: service must be Web Service (not Static Site) for /api/v1");
    }
    void (0, objectStorage_1.testObjectStorageConnection)().then((result) => {
        console.log(`R2/S3 check: ${result.ok ? "OK" : "FAILED"} — ${result.message}`);
    });
});
