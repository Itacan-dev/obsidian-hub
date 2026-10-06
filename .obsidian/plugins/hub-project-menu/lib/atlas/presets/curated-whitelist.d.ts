import { type Policy } from '../core/index';
export interface CuratedService {
    readonly label: string;
    readonly hostname: string;
    /** Equivalent entry hostnames, explicitly reviewed; never inferred from a prefix. */
    readonly aliases?: readonly string[];
    /** Distinct useful entry points of the service, not claims of equivalence. */
    readonly destinations?: readonly string[];
}
export interface CuratedGroup {
    readonly label: string;
    readonly services: readonly CuratedService[];
}
/** Initial product preset. Edit services here; generated Policy remains exact-host only. */
export declare const curatedWhitelist: readonly CuratedGroup[];
export declare function serviceHostnames(service: CuratedService): readonly string[];
/** Display metadata only; never makes a hostname available or equivalent. */
export declare function serviceLabel(hostname: string): string;
export declare function compileCuratedWhitelist(groups?: readonly CuratedGroup[]): Policy;
