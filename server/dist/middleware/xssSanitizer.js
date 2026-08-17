import { FilterXSS } from 'xss';
// Configure xss to aggressively filter anything that looks like HTML/Script
const xssOptions = {
    whiteList: {}, // empty means all tags are stripped out
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style', 'xml', 'iframe', 'object', 'embed'] // completely remove these tags and their contents
};
const myxss = new FilterXSS(xssOptions);
function sanitizeValue(val) {
    if (typeof val === 'string') {
        const cleaned = myxss.process(val);
        return cleaned
            .replace(/&gt;/g, '>')
            .replace(/&lt;/g, '<')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&amp;/g, '&');
    }
    if (Array.isArray(val)) {
        return val.map(sanitizeValue);
    }
    if (val !== null && typeof val === 'object') {
        const sanitizedObj = {};
        for (const key in val) {
            if (Object.prototype.hasOwnProperty.call(val, key)) {
                const safeKey = myxss.process(key);
                sanitizedObj[safeKey] = sanitizeValue(val[key]);
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
