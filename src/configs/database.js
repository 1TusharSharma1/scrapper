import mongoose from "mongoose";

/**
 * @description connect to MongoDB
 * @param {*} url - The MongoDB connection URL
 * @returns {Promise} - A promise that resolves when the connection is successful or rejects with an error
 */
const connectDB = (url) => {
  mongoose.set("strictQuery", true);
  return new Promise((resolve, reject) => {
    mongoose
      .connect(url)
      .then(() => {
        console.log("MongoDB connected");
        resolve();
      })
      .catch((error) => {
        console.log(error);
        reject(error);
      });
  });
};

export default connectDB;
