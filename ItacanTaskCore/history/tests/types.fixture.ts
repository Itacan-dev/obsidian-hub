import { analyzeHistoryCapture, proposeImportBundle, projectRecordedHistory, projectStatisticsCompletions, HISTORY_POLICIES } from "../contracts";
import type { HistoryCaptureV1, HistoryReview, CanonicalEventSpecimen, VisibilitySpecimen } from "../contracts";
declare const capture: HistoryCaptureV1;
declare const review: HistoryReview;
declare const events: CanonicalEventSpecimen[];
const analysis = analyzeHistoryCapture(capture);
const zero: 0 = analysis.accounting.allocatedEventIds;
const disabled: false = analysis.readiness.nativeImportImplemented;
const bundle = proposeImportBundle(capture, review);
const executable: false = bundle.canExecute;
const privateOnly: "local-private" = projectRecordedHistory(bundle).privacy;
const visibility: VisibilitySpecimen = { version: 1, captureDigest: capture.digest, reopenedTargets: ["task"] };
projectStatisticsCompletions(bundle, events, visibility);
const policy: "E01" = HISTORY_POLICIES[0];
// @ts-expect-error Future schemas are not accepted as current contracts.
const future: HistoryCaptureV1 = { ...capture, version: 2 };
// @ts-expect-error E1 cannot advertise executable publication.
bundle.canExecute = true;
// @ts-expect-error Private-only captures cannot be exported as shared evidence.
capture.privacy = "shared";
// @ts-expect-error Represented events require a source group.
const invalid: CanonicalEventSpecimen = { version: 1, origin: "represented-import", groupKey: null, event: events[0].event, publication: { revision: 1, index: 0 } };
void [zero, disabled, executable, privateOnly, policy, future, invalid];
