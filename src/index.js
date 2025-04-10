import express from "express";
import * as dotenv from "dotenv";
import cors from "cors";
import connectDB from "./configs/database.js";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import helmet from "helmet";
import ErrorHandler from "./middlewares/errorHandlerMiddleware.js";
import { scrape } from "./controllers/scapperController.js";
import puppeteer from 'puppeteer-core';
import healthCheckRouter from "./routes/healthCheckerRouter.js";

dotenv.config();
const app = express();

app.use(cors({
  origin: "*",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

//middlewares
app.use(morgan("dev"));
app.use(cors());
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(helmet());
app.use(cookieParser());

//routes
app.use("/api/v1/", healthCheckRouter);
app.get('/api/v1/scrape', scrape);

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

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    // Try to connect to MongoDB if URL is provided
    if (process.env.MONGODB_URL) {
      try {
        await connectDB(process.env.MONGODB_URL);
        console.log("MongoDB connected successfully");
      } catch (dbError) {
        console.log("MongoDB connection failed:", dbError.message);
        console.log("Continuing without database connection...");
      }
    } else {
      console.log("No MongoDB URL provided. Continuing without database connection...");
    }
    app.listen(PORT, () => console.log(`Server started at port ${PORT}`));
  } catch (error) {
    console.log(error.message);
  }
};
startServer();
export default app;
