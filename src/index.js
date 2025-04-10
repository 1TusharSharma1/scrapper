import express from "express";
import * as dotenv from "dotenv";
import cors from "cors";
import connectDB from "./configs/database.js";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import helmet from "helmet";
import ErrorHandler from "./middlewares/errorHandlerMiddleware.js";
// routes
import healthCheckRouter from "./routes/healthCheckerRouter.js";
import userRouter from "./routes/userRouter.js";
import menuRouter from "./routes/menuRouter.js";

dotenv.config();
const app = express();

//middlewares
app.use(morgan("dev"));
app.use(cors());
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(helmet());
app.use(cookieParser());

//routes

app.use("/api/v1/", healthCheckRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/menus", menuRouter);
//error handling middleware
app.use(async (err, req, res, next) => {
  if (!ErrorHandler.isTrustedError(err)) {
    next(err);
  }
  ErrorHandler.handleErrors(err, res);
});

process.on("unhandledRejection", (err) => {
  console.log("UNHANDLED REJECTION! Shutting down...");
  console.log(err.name, err.message, err);
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  console.log("UNCAUGHT EXCEPTION!  Shutting down...");
  console.log(err.name, err.message);
  process.exit(1);
});

const PORT = process.env.PORT || 5000;
const startServer = async () => {
  try {
    await connectDB(process.env.MONGODB_URL);
    app.listen(PORT, () => console.log(`server started at port ${PORT}`));
  } catch (error) {
    console.log(error.message);
  }
};
startServer();
export default app;
