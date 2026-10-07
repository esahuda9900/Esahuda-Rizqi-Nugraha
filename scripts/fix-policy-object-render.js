const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'index.html');
let source = fs.readFileSync(file, 'utf8');
const marker = 'React.createElement(App, null)';
if (!source.includes(marker)) throw new Error('App render marker not found');
if (source.includes('__SDLG_POLICY_RENDER_GUARD_V3__')) process.exit(0);
const replacement = `(() => {
    const originalCreateElement = React.createElement;
    const policyKeys = new Set(["reason","status","failure_hm","policy_code","failure_date","warranty_hours","calendar_expiry","warranty_months","bill_of_lading_date","standard_or_contract"]);
    const isPolicy = (v) => {
        if (!v || typeof v !== 'object' || Array.isArray(v) || React.isValidElement(v)) return false;
        const keys = Object.keys(v);
        return keys.length >= 2 && keys.filter(k => policyKeys.has(k)).length >= 2;
    };
    const scalarize = (v) => {
        if (!isPolicy(v)) return v;
        return v.reason || v.status || v.policy_code || 'Policy data';
    };
    React.createElement = function(type, props, ...children) {
        return originalCreateElement.call(this, type, props, ...children.map(scalarize));
    };
    const sanitizeNode = (node, seen) => {
        if (isPolicy(node)) return scalarize(node);
        if (!node || typeof node !== 'object') return node;
        if (seen.has(node)) return node;
        if (React.isValidElement(node)) {
            seen.add(node);
            const props = node.props || {};
            if (props.children === undefined) return node;
            const nextChildren = Array.isArray(props.children)
                ? props.children.map(child => sanitizeNode(child, seen))
                : sanitizeNode(props.children, seen);
            if (nextChildren === props.children) return node;
            return React.cloneElement(node, { ...props, children: nextChildren });
        }
        if (Array.isArray(node)) return node.map(child => sanitizeNode(child, seen));
        return node;
    };
    const sanitizeRoot = (root) => sanitizeNode(root, new Set());
    if (typeof ReactDOM !== 'undefined') {
        if (typeof ReactDOM.createRoot === 'function') {
            const originalCreateRoot = ReactDOM.createRoot;
            ReactDOM.createRoot = function(...args) {
                const root = originalCreateRoot.apply(this, args);
                if (root && typeof root.render === 'function' && !root.__sdlgPolicyGuard) {
                    const originalRender = root.render.bind(root);
                    root.render = (element) => originalRender(sanitizeRoot(element));
                    root.__sdlgPolicyGuard = true;
                }
                return root;
            };
        }
        if (typeof ReactDOM.render === 'function') {
            const originalRenderLegacy = ReactDOM.render;
            ReactDOM.render = function(element, container, ...rest) {
                return originalRenderLegacy.call(this, sanitizeRoot(element), container, ...rest);
            };
        }
    }
    globalThis.__SDLG_POLICY_RENDER_GUARD_V3__ = true;
    return React.createElement(App, null);
})()`;
source = source.replace(marker, replacement);
fs.writeFileSync(file, source, 'utf8');
console.log('React policy object render guard v3 applied');