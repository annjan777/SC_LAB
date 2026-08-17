import { Request, Response, NextFunction } from 'express';
import { FilterXSS } from 'xss';

// Configure xss to aggressively filter anything that looks like HTML/Script
const xssOptions = {
  whiteList: {}, // empty means all tags are stripped out
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style', 'xml', 'iframe', 'object', 'embed'] // completely remove these tags and their contents
};

const myxss = new FilterXSS(xssOptions);

function sanitizeValue(val: any): any {
  if (typeof val === 'string') {
    const cleaned = myxss.process(val);
    // Only decode entities that cannot reconstruct tag syntax (< / > are left encoded,
    // otherwise a pre-encoded payload like "&lt;script&gt;" would survive stripping and
    // get turned back into a live <script> tag here).
    return cleaned
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&');
  }
  if (Array.isArray(val)) {
    return val.map(sanitizeValue);
  }
  if (val !== null && typeof val === 'object') {
    const sanitizedObj: any = {};
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

export const xssSanitizer = (req: Request, _res: Response, next: NextFunction) => {
  if (req.body) req.body = sanitizeValue(req.body);
  if (req.query) req.query = sanitizeValue(req.query);
  if (req.params) req.params = sanitizeValue(req.params);
  next();
};
