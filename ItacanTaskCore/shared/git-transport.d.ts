import type {GitPacketV3} from "../src/git-shared";
export interface GitPacketTransportV1 {
 publish(packet:GitPacketV3):Promise<{readonly version:1;readonly digest:string;readonly relativePath:string}>;
 read():Promise<readonly GitPacketV3[]>;
 capacity():Promise<Readonly<{version:1;objects:number;heads:number;bytes:number;objectLimit:1024;headLimit:1024;byteLimit:number}>>;
}
/** Explicit ordinary Git clone, immutable packets only. No Git commands or native writes. */
export function createGitPacketTransport(input:{version:1;root:string;authorityId:string;projectId:string}):Promise<GitPacketTransportV1>;
