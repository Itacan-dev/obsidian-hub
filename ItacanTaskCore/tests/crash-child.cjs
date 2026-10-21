"use strict";
const { openJsonRepository } = require("../src/json-repository");
async function main() {
    const [directory, stage, serialized] = process.argv.slice(2);
    const repo = await openJsonRepository({ directory, fault(current) { if (current === stage) process.exit(73); } });
    await repo.execute(JSON.parse(serialized)); await repo.close(); process.exitCode = 0;
}
main().catch(error => { process.stderr.write(String(error.stack)); process.exitCode = 1; });
