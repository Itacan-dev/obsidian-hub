import { AthenaError, AthenaState, DEFAULT_SETTINGS } from "./contracts";
import { vaultPath } from "./knowledge/eligibility";
export function restoreState(value: unknown): AthenaState {
  const empty: AthenaState = { version: 1, settings: { ...DEFAULT_SETTINGS, excluded: [] }, conversations: [], identities: Object.create(null) };
  if (value === null || value === undefined) return empty;
  if (typeof value !== "object" || Array.isArray(value)) throw new AthenaError("Invalid Athena state; the original file is preserved.");
  const state = value as AthenaState;
  if (state.version !== 1 || !state.settings || !Array.isArray(state.conversations) || !state.identities || typeof state.identities !== "object" || Array.isArray(state.identities)) throw new AthenaError("Unsupported Athena state; the original file is preserved.");
  const settings = { ...DEFAULT_SETTINGS, ...state.settings };
  if (!["mock", "ollama"].includes(settings.provider) || !Number.isInteger(settings.port) || settings.port < 1 || settings.port > 65535 || typeof settings.model !== "string" || settings.model.length > 256 || !Array.isArray(settings.excluded) || !settings.excluded.every(item => typeof item === "string") || ![4096, 8192, 16384, 32768].includes(settings.contextLength)) throw new AthenaError("Invalid Athena settings; the original file is preserved.");
  for (const excluded of settings.excluded) vaultPath(excluded);
  settings.enabled = settings.enabled === true; settings.localOnlyConfirmed = settings.localOnlyConfirmed === true;
  for (const [key, id] of Object.entries(state.identities)) { vaultPath(key); if (typeof id !== "string" || !/^[a-f0-9-]{36}$/i.test(id)) throw new AthenaError("Invalid Athena document identities."); }
  const conversationIds = new Set<string>(), turnIds = new Set<string>();
  for (const conversation of state.conversations) {
    if (!conversation || typeof conversation.id !== "string" || !conversation.id || conversationIds.has(conversation.id) || typeof conversation.title !== "string" || !Array.isArray(conversation.turns)) throw new AthenaError("Invalid Athena conversation.");
    conversationIds.add(conversation.id);
    for (const turn of conversation.turns) {
      if (!turn || typeof turn.id !== "string" || !turn.id || turnIds.has(turn.id) || typeof turn.question !== "string" || typeof turn.answer !== "string" || !Array.isArray(turn.evidence) || typeof turn.provider !== "string" || typeof turn.model !== "string" || !Number.isFinite(turn.createdAt) || !["retrieving", "streaming", "complete", "cancelled", "error", "interrupted"].includes(turn.state) || (turn.error !== undefined && typeof turn.error !== "string")) throw new AthenaError("Invalid Athena turn.");
      turnIds.add(turn.id);
      if (turn.dependencies !== undefined && !Array.isArray(turn.dependencies)) throw new AthenaError("Invalid Athena provenance.");
      for (const item of [...turn.evidence, ...(turn.dependencies ?? [])]) {
        if (!item || typeof item.documentId !== "string" || typeof item.sourceId !== "string" || !/^S\d+$/.test(item.sourceId) || typeof item.revision !== "string" || !/^[a-f0-9]{64}$/.test(item.revision) || typeof item.text !== "string" || !item.location || !Number.isInteger(item.location.startLine) || item.location.startLine < 1 || !Number.isInteger(item.location.endLine) || item.location.endLine < item.location.startLine || (item.location.page !== undefined && (!Number.isInteger(item.location.page) || item.location.page < 1)) || (item.location.cell !== undefined && typeof item.location.cell !== "string") || (item.location.heading !== undefined && typeof item.location.heading !== "string") || (item.location.startColumn !== undefined && (!Number.isInteger(item.location.startColumn) || item.location.startColumn < 0))) throw new AthenaError("Invalid Athena evidence.");
        vaultPath(item.path);
      }
      if (["retrieving", "streaming"].includes(turn.state)) turn.state = "interrupted";
    }
  }
  return { version: 1, settings, conversations: state.conversations, identities: Object.assign(Object.create(null), state.identities) };
}
