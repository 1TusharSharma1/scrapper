import jwt from "jsonwebtoken";
import User from "../models/userModel.js";
import { APIError } from "../utils/apiError.js";
import HttpStatusCode from "../constants/httpCode.js";
/**
 * @description Protect routes (check if user is authenticated)
 */
const protect = async (req, res, next) => {
  try {
    const token =
      req.cookies?.accessToken || req.headers.authorization?.split(" ")[1];
    if (!token) {
      throw new APIError(
        "Token Missing",
        HttpStatusCode.BAD_REQUEST,
        true,
        "Token Not Found"
      );
    }
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(decodedToken?._id);
    if (!user) {
      throw new APIError(
        "UnAuthorized",
        HttpStatusCode.UNAUTHORIZED,
        true,
        "Invalid access token"
      );
    }
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

export default protect;
