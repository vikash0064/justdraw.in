const { validationResult } = require('express-validator');

/**
 * Middleware that checks express-validator results and returns
 * a standardised 400 error if validation fails.
 */
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const firstErr = errors.array()[0];
        const msg = firstErr?.msg || 'Validation failed';
        return res.status(400).json({
            message: msg,
            errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
        });
    }
    next();
};

module.exports = { validate };
