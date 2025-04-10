/**
 * @description This function is used to handle async functions
 * @param {*} fn - The function to be executed
 */
const asyncHandler = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (error) {
    next(error);
  }
};

export default asyncHandler;
