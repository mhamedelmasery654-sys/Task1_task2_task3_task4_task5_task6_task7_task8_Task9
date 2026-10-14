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

    const databaseErrorCode = error.code || (error.driverError && error.driverError.code);
    if (databaseErrorCode === '23505') {
        return res.status(409).json({ error: 'username or email is already registered' });
    }

    const candidateStatusCode = error.statusCode || error.status || 500;
    const statusCode = Number.isInteger(candidateStatusCode) && candidateStatusCode >= 400 && candidateStatusCode <= 599
        ? candidateStatusCode
        : 500;
    if (statusCode >= 500) {
        console.error('Request failed:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }

    const response = { error: error.message || 'Request failed' };
    if (error.details) {
        response.details = error.details;
    }
    return res.status(statusCode).json(response);
}

module.exports = { createHttpError, notFoundHandler, errorHandler };
