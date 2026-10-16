function createHttpError(statusCode, message, details) {
    const error = new Error(message);
    error.statusCode = statusCode;
    if (details) {
        error.details = details;
    }
    return error;
}

function notFoundHandler(req, res, next) {
    return next(createHttpError(404, 'Route not found'));
}

function errorHandler(error, req, res, next) {
    if (res.headersSent) {
        return next(error);
    }

    const requestId = req && req.requestId ? req.requestId : undefined;
    const databaseErrorCode = error.code || (error.driverError && error.driverError.code);
    if (databaseErrorCode === '23505') {
        req.errorCode = 'DUPLICATE_RECORD';
        const response = { error: 'username or email is already registered' };
        if (requestId) {
            response.requestId = requestId;
        }
        return res.status(409).json(response);
    }

    const candidateStatusCode = error.statusCode || error.status || 500;
    const statusCode = Number.isInteger(candidateStatusCode) && candidateStatusCode >= 400 && candidateStatusCode <= 599
        ? candidateStatusCode
        : 500;
    if (statusCode === 503 && error.code === 'NOTES_DATABASE_UNAVAILABLE') {
        req.errorCode = 'NOTES_DATABASE_UNAVAILABLE';
        const response = { error: error.message };
        if (requestId) response.requestId = requestId;
        return res.status(503).json(response);
    }
    if (statusCode >= 500) {
        req.errorCode = 'INTERNAL_ERROR';
        const response = { error: 'Internal server error' };
        if (requestId) {
            response.requestId = requestId;
        }
        return res.status(500).json(response);
    }

    req.errorCode = statusCode === 400 ? 'VALIDATION_ERROR'
        : statusCode === 401 ? 'AUTHENTICATION_FAILED'
            : statusCode === 403 ? 'ACCESS_DENIED'
                : statusCode === 404 ? 'NOT_FOUND'
                    : 'REQUEST_REJECTED';
    const response = { error: error.message || 'Request failed' };
    if (requestId) {
        response.requestId = requestId;
    }
    if (error.details) {
        response.details = error.details;
    }
    return res.status(statusCode).json(response);
}

module.exports = { createHttpError, notFoundHandler, errorHandler };
