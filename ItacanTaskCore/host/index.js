"use strict";
// Explicit inactive sibling entry point. Never imported by production startup or core/index.
module.exports = {
    createNativeRepositoryHost: require("./repository-host").createNativeRepositoryHost,
    inspectNativeRepository: async options => { try { return await require("./authority").inspectNativeRepository(options); } catch (error) { const H = require("./repository-host"); throw H.safeError(H.coded(error)); } },
    createNativeReadAdapter: require("./native-read-adapter").createNativeReadAdapter,
    createCompletionEvidencePort: require("./completion-proof").createCompletionEvidencePort,
    registryDigest: require("./registry").registryDigest
};
