import { APIError, BaseError } from "../utils/apiError.js";
class ErrorHandler {
  static handleErrors(err, res) {
    res
      .status(err.httpCode || 500)
      .json(
        new APIError(
          err.name,
          err.httpCode || 500,
          err.isOperational,
          err.description
        )
      );
  }
  static isTrustedError(error) {
    if (error instanceof BaseError) {
      return error.isOperational;
    }
    return false;
  }
}

export default ErrorHandler;
