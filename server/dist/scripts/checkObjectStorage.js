"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const objectStorage_1 = require("../lib/objectStorage");
const run = async () => {
    console.log("Storage config:", (0, objectStorage_1.getObjectStorageConfigSummary)());
    const result = await (0, objectStorage_1.testObjectStorageConnection)();
    console.log(result.ok ? "OK:" : "FAILED:", result.message);
    process.exitCode = result.ok ? 0 : 1;
};
void run();
