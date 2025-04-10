import HttpStatusCode from "../constants/httpCode.js";
/**
 * @class BaseError
 * @extends {Error}
 * @description Base error class
 */
class BaseError extends Error {
  constructor(name, httpCode, isOperational, description) {
    super(description);
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = name;
    this.httpCode = httpCode;
    this.isOperational = isOperational;
    this.description = description;
    Error.captureStackTrace(this);
  }
}

/**
 * @class APIError
 * @extends {BaseError}
 * @description API error class
 */
class APIError extends BaseError {
  constructor(
    name,
    httpCode = HttpStatusCode.INTERNAL_SERVER,
    isOperational = true,
    description = "internal server error"
  ) {
    super(name, httpCode, isOperational, description);
  }
}

export { APIError, BaseError };
