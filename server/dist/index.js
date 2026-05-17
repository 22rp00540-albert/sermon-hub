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
    const storage = (0, objectStorage_1.isObjectStorageConfigured)() ? "configured" : "MISSING (set S3_* for uploads)";
    console.log(`Server listening on port ${port}`);
    console.log(`Object storage: ${storage}`);
    if (process.env.RENDER === "true") {
        console.log("Render: use Web Service (not Static Site) so /api/v1 and uploads work.");
    }
});
