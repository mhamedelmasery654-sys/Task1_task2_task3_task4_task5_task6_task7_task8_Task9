const { createHttpError } = require('./errorHandler');

function requirePasswordChange(req, res, next) {
    if (req.user && req.user.mustChangePassword) {
        return next(createHttpError(403, 'You must change your temporary password before continuing'));
    }
    return next();
}

module.exports = requirePasswordChange;
