import express from "express";
import * as dotenv from "dotenv";
import cors from "cors";
import connectDB from "./configs/database.js";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import helmet from "helmet";
import ErrorHandler from "./middlewares/errorHandlerMiddleware.js";
import healthCheckRouter from "./routes/healthCheckerRouter.js";
import userRouter from "./routes/userRouter.js";
import menuRouter from "./routes/menuRouter.js";
import scrapeRouter from "./routes/scrapeRouter.js";
import analysisRouter from "./routes/analysisRouter.js";
dotenv.config();
const app = express();
//middlewares
app.use(morgan("dev"));
app.use(cors({
  origin: ['http://localhost:5173', 'https://localhost:5173'],
  credentials: true
}));
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(helmet());
app.use(cookieParser());

//routes
app.use("/api/v1", healthCheckRouter);
app.use("/api/v1/scrape", scrapeRouter);

app.use("/api/v1/users", userRouter);
app.use("/api/v1/menus", menuRouter);
app.use("/api/v1/analysis", analysisRouter);
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

const PORT = process.env.PORT || 5600;

const startServer = async () => {
  try {
    await connectDB(process.env.MONGODB_URL);
    app.listen(PORT, () => console.log(`Server started at port ${PORT}`));
  } catch (error) {
    console.log(error.message);
  }
};
startServer();
export default app;
