"use strict";

// One policy at native navigation boundaries also covers links, commands,
// history, new leaves and saved layouts. Wrappers read live Oath state.
class OathNavigationGuard {
    constructor(plugin, Leaf) {
        this.plugin = plugin; this.app = plugin.app; this.restores = []; this.disposed = false;
        const guard = this;
        const wrap = (target, key, permitted, async = true) => {
            if (typeof target?.[key] !== "function") return;
            const original = target[key];
            function wrapped(...args) {
                if (!permitted.apply(this, args)) return async ? Promise.resolve(false) : false;
                return original.apply(this, args);
            }
            target[key] = wrapped;
            this.restores.push(() => { if (target[key] === wrapped) target[key] = original; });
        };
        wrap(Leaf?.prototype, "openFile", file => guard.allow(file?.path));
        wrap(Leaf?.prototype, "setViewState", state => guard.allowView(state));
        wrap(this.app.workspace, "changeLayout", layout => guard.allowLayout(layout));
        wrap(this.app.workspace, "setActiveLeaf", leaf => guard.allowView(leaf?.getViewState?.()), false);
        wrap(this.app.workspace, "openLinkText", (link, source) => {
            const path = String(link ?? "").split("#")[0];
            const file = guard.app.metadataCache.getFirstLinkpathDest?.(path, source);
            return guard.allow(file?.path ?? path);
        });
    }
    allow(reference, notify = true) { return this.disposed || this.plugin.oath?.canOpen(reference, notify) !== false; }
    allowView(view) {
        const state = view?.state;
        return this.allow(state?.contextId ?? state?.projectId) &&
            this.allow(state?.file ?? state?.path);
    }
    allowLayout(layout) {
        const visit = node => !node || (node.type === "leaf" ? this.allowView(node.state) :
            (node.children ?? []).every(visit));
        return visit(layout?.main) && visit(layout?.left) && visit(layout?.right);
    }
    destroy() { this.disposed = true; this.restores.reverse().forEach(restore => restore()); this.restores = []; }
}
module.exports = { OathNavigationGuard };
