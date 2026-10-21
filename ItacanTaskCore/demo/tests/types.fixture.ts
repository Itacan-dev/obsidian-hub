import type {DemoRuntimeV1} from "../contracts";
import type {AtomicActionEnvelopeV2} from "../../application/contracts";
declare const runtime:DemoRuntimeV1,intent:AtomicActionEnvelopeV2;
runtime.mutate(intent);runtime.editor("uuid",{type:"project",id:"private"});runtime.close();
// @ts-expect-error no raw command executor
runtime.execute({type:"task.create"});
// @ts-expect-error physical ownership is required
runtime.list({label:"Mounted"});
