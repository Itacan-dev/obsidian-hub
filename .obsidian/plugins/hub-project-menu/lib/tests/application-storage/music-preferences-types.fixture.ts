import {createMusicPreferences, type TransactionalMusicPreferencesV1, type PreparedMusicPreferenceV1, type MusicPreferenceIntentV1, type AdoptedMusicPreferencesCallerV1, type MusicLibraryPreferenceOptionsV1} from "../../services/application-storage/music-preferences";
import type {TransactionalApplicationStoreV1} from "../../services/application-storage/contracts";
declare const store:TransactionalApplicationStoreV1;
const port:TransactionalMusicPreferencesV1 = createMusicPreferences({store,authorityId:"id",applicationContextId:"context"});
async function usage(){const read=await port.read(); const prepared:PreparedMusicPreferenceV1=port.prepare({kind:"set-enabled",enabled:true},read,"original-operation"); await port.submit(prepared,new AbortController().signal);await port.reconcile(prepared);for(const provider of ["spotify","youtube","youtube-music","local"] as const)port.prepare({kind:"set-provider-enabled",provider,enabled:false},read);}
declare const caller:AdoptedMusicPreferencesCallerV1;
caller.setEnabled(true);caller.setProviderEnabled("local",false);caller.reconcilePreferences();caller.replayPreferences();caller.getPreferenceStatus().prepared?.request.operationId;
// @ts-expect-error no arbitrary field or replacement action
const unsupported:MusicPreferenceIntentV1={kind:"replace",value:{}};
// @ts-expect-error provider definitions are closed
const provider:MusicPreferenceIntentV1={kind:"set-provider-enabled",provider:"other",enabled:true};
// @ts-expect-error strict supplied boolean
const bool:MusicPreferenceIntentV1={kind:"set-enabled",enabled:1};
// @ts-expect-error prepare requires original field observations
port.prepare({kind:"set-enabled",enabled:true});
// @ts-expect-error prepared contract is mandatory for submit
port.submit({enabled:true});
// @ts-expect-error no generic persistence API
port.save({music:{}});
// @ts-expect-error caller provider union preserved
caller.setProviderEnabled("other",true);

declare const prepared:PreparedMusicPreferenceV1;
// @ts-expect-error original stable evidence is immutable
prepared.request.reason="changed";
// @ts-expect-error original guards cannot be refreshed in place
prepared.request.observation.revision++;

const legacyOptions:MusicLibraryPreferenceOptionsV1={};
const optedOptions:MusicLibraryPreferenceOptionsV1={transactionalPreferences:port};
// @ts-expect-error an arbitrary storage handle is not the preference dependency
const badOptions:MusicLibraryPreferenceOptionsV1={transactionalPreferences:store};
