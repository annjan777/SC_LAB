/**
 * Input sanitizer.
 *
 * The UI renders every value through React (which escapes output), so the server only needs to
 * remove things that are unambiguously HTML markup. It must NOT touch ordinary text that happens
 * to contain "<" or ">" — lab data is full of it ("Tips <200 uL", "p<0.05", "T>37C", "a < b").
 *
 * Removed:
 *  - dangerous elements together with their content: <script>, <style>, <iframe>, <object>, <embed>, <xml>
 *  - any real tag: "<" immediately followed by a letter, "/" or "!" and closed by ">"
 *    (e.g. <img src=x onerror=...>, </b>, <!-- -->)
 *  - a trailing unclosed tag opener at the very end of a value ("<img src=x onerror=alert(1)")
 * Everything else is kept exactly as typed.
 */
const DANGEROUS_BLOCK = /<\s*(script|style|iframe|object|embed|xml)\b[\s\S]*?<\s*\/\s*\1\s*>/gi;
const DANGEROUS_OPEN = /<\s*(script|style|iframe|object|embed|xml)\b[^>]*>/gi;
const TAG = /<\/?[a-zA-Z!][^<>]*>/g;
const UNCLOSED_TAG_AT_END = /<[a-zA-Z][^<>]*$/;
export function sanitizeString(val) {
    let out = val.replace(DANGEROUS_BLOCK, '').replace(DANGEROUS_OPEN, '');
    let prev;
    do {
        prev = out;
        out = out.replace(TAG, '');
    } while (out !== prev);
    return out.replace(UNCLOSED_TAG_AT_END, '');
}
function sanitizeValue(val) {
    if (typeof val === 'string')
        return sanitizeString(val);
    if (Array.isArray(val))
        return val.map(sanitizeValue);
    if (val !== null && typeof val === 'object') {
        const sanitizedObj = {};
        for (const key in val) {
            if (Object.prototype.hasOwnProperty.call(val, key)) {
                sanitizedObj[sanitizeString(key)] = sanitizeValue(val[key]);
            }
        }
        return sanitizedObj;
    }
    return val;
}
export const xssSanitizer = (req, _res, next) => {
    if (req.body)
        req.body = sanitizeValue(req.body);
    if (req.query)
        req.query = sanitizeValue(req.query);
    if (req.params)
        req.params = sanitizeValue(req.params);
    next();
};
