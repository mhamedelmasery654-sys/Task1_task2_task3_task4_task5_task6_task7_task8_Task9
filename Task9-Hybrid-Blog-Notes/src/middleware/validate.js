const { createHttpError } = require('./errorHandler');

function validate(schema, target = 'body') {
    return (req, res, next) => {
        const result = schema.safeParse(req[target]);
        if (!result.success) {
            return next(createHttpError(
                400,
                'Validation failed',
                result.error.issues.map((issue) => ({
                    field: issue.path.join('.'),
                    message: issue.message,
                }))
            ));
        }
        if (target === 'query') {
            req.validatedQuery = result.data;
        } else {
            req[target] = result.data;
        }
        return next();
    };
}

module.exports = validate;
