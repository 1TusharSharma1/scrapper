import { Schema, model } from "mongoose";
const menuItemSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide a name for the menu item"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Please provide a description for the menu item"],
      trim: true,
    },
    price: {
      type: Number,
      min: 0,
      required: [true, "Please provide a price for the menu item"],
    },
    isVeg: {
      type: Boolean,
      required: [true, "Please provide a isVeg for the menu item"],
    },
    category: {
      type: String,
      required: [true, "Please provide a category for the menu item"],
      enum: [
        "starter",
        "main course",
        "dessert",
        "beverage",
        "snack",
        "special",
      ],
      required: [true, "Please provide a category for the menu item"],
    },
    menuId: {
      type: Schema.Types.ObjectId,
      ref: "Menu",
      required: [true, "Please provide a menuId for the menu item"],
    },
  },
  { timestamps: true }
);

const MenuItem = model("MenuItem", menuItemSchema);
export default MenuItem;
