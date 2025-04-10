import { Schema, model } from "mongoose";

const menuSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide a name for the menu"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Please provide a description for the menu"],
      trim: true,
    },
    type: {
      type: String,
      required: [true, "Please provide a type for the menu"],
      enum: [
        "breakfast",
        "lunch",
        "dinner",
        "regular",
        "snack",
        "special",
        "dessert",
      ],
      default: "regular",
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Please provide a userId for the menu"],
    },
    items: [
      {
        type: Schema.Types.ObjectId,
        ref: "MenuItem",
      },
    ],
  },
  { timestamps: true }
);

const Menu = model("Menu", menuSchema);
export default Menu;
