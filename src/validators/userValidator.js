import { checkSchema } from "express-validator";

const strongRegex = /^(?=.*\d)(?=.*[!@#$%^&*])(?=.*[a-z])(?=.*[A-Z]).{8,}$/;
const emailRegex =
  /^([A-Z0-9_+-]+\.?)*[A-Z0-9_+-]@([A-Z0-9][A-Z0-9-]*\.)+[A-Z]{2,}$/i;

export const registerValidator = checkSchema({
  name: {
    in: ["body"],
    isString: true,
    trim: true,
    errorMessage: "Name is required",
  },
  email: {
    in: ["body"],
    isEmail: true,
    matches: {
      options: emailRegex,
      errorMessage: "Email is not valid",
    },
    errorMessage: "Email is required",
  },
  password: {
    in: ["body"],
    isString: true,
    matches: {
      options: strongRegex,
      errorMessage:
        "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character",
    },
    errorMessage: "Password is required",
  },
});

//validator for login a user
export const loginValidator = checkSchema({
  email: {
    in: ["body"],
    isEmail: true,
    exists: true,
    matches: {
      options: emailRegex,
      errorMessage: "Please provide a valid email",
    },
    errorMessage: "Email is required",
  },
  password: {
    in: ["body"],
    isString: true,
    exists: true,
    errorMessage: "Password is required",
  },
});

//validator for changing password
export const changePassword = checkSchema({
  oldPassword: {
    in: ["body"],
    isString: true,
    exists: true,
    errorMessage: "Old password is required",
  },
  newPassword: {
    in: ["body"],
    isString: true,
    exists: true,
    matches: {
      options: strongRegex,
      errorMessage:
        "Password must contain at least one uppercase letter, one lowercase letter, one number and one special character.",
    },
    errorMessage: "New password is required",
  },
});
