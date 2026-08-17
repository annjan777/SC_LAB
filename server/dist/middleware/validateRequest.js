import { ZodError } from 'zod';
export function validateBody(schema) {
    return (req, res, next) => {
        try {
            req.body = schema.parse(req.body);
            next();
        }
        catch (err) {
            if (err instanceof ZodError) {
                const errors = err.errors.map((e) => ({
                    field: e.path.join('.'),
                    message: e.message,
                }));
                return res.status(400).json({
                    error: 'Validation failed',
                    details: errors,
                });
            }
            return res.status(400).json({ error: 'Invalid payload shape' });
        }
    };
}
export function validateParams(schema) {
    return (req, res, next) => {
        try {
            req.params = schema.parse(req.params);
            next();
        }
        catch (err) {
            if (err instanceof ZodError) {
                const errors = err.errors.map((e) => ({
                    field: e.path.join('.'),
                    message: e.message,
                }));
                return res.status(400).json({
                    error: 'Invalid parameter shape',
                    details: errors,
                });
            }
            return res.status(400).json({ error: 'Invalid URL parameters' });
        }
    };
}
