import { checkSchema } from "express-validator";

export const addMenuValidator = checkSchema({
  name: {
    in: ["body"],
    isString: {
      errorMessage: "Name must be a string",
    },
    notEmpty: {
      errorMessage: "Name is required",
    },
  },
  description: {
    in: ["body"],
    isString: {
      errorMessage: "Description must be a string",
    },
    notEmpty: {
      errorMessage: "Description is required",
    },
  },
  type: {
    in: ["body"],
    isString: {
      errorMessage: "Type must be a string",
    },
    optional: true,
    isIn: {
      options: [
        [
          "breakfast",
          "lunch",
          "dinner",
          "regular",
          "snack",
          "special",
          "dessert",
        ],
      ],
      errorMessage:
        "Type must be one of the following: breakfast, lunch, dinner, regular, snack, special, dessert",
    },
  },
  items: {
    in: ["body"],
    isArray: {
      errorMessage: "Items must be an array",
    },
    optional: true,
  },
});

// delete menu validator
export const deleteMenuValidator = checkSchema({
  id: {
    in: ["params"],
    isMongoId: {
      errorMessage: "Invalid menu ID",
    },
    notEmpty: {
      errorMessage: "Menu ID is required",
    },
  },
});
// update menu item validator
export const updateMenuItemValidator = checkSchema({
  id: {
    in: ["params"],
    isMongoId: {
      errorMessage: "Invalid menu item ID",
    },
    notEmpty: {
      errorMessage: "Menu item ID is required",
    },
  },
  itemId: {
    in: ["params"],
    isMongoId: {
      errorMessage: "Invalid menu item ID",
    },
    notEmpty: {
      errorMessage: "Menu item ID is required",
    },
  },
  name: {
    in: ["body"],
    isString: {
      errorMessage: "Name must be a string",
    },
    optional: true,
  },
  description: {
    in: ["body"],
    isString: {
      errorMessage: "Description must be a string",
    },
    optional: true,
  },
  price: {
    in: ["body"],
    isNumeric: {
      errorMessage: "Price must be a number",
    },
    optional: true,
  },
  isVeg: {
    in: ["body"],
    isBoolean: {
      errorMessage: "isVeg must be a boolean",
    },
    optional: true,
  },
  category: {
    in: ["body"],
    isString: {
      errorMessage: "Category must be a string",
    },
    optional: true,
    isIn: {
      options: [
        ["starter", "main course", "dessert", "beverage", "snack", "special"],
      ],
      errorMessage:
        "Category must be one of the following: starter, main course, dessert, beverage, snack, special",
    },
  },
});

// add menu item validator
export const addMenuItemValidator = checkSchema({
  id: {
    in: ["params"],
    isMongoId: {
      errorMessage: "Invalid menu ID",
    },
    notEmpty: {
      errorMessage: "Menu ID is required",
    },
  },
  name: {
    in: ["body"],
    isString: {
      errorMessage: "Name must be a string",
    },
    notEmpty: {
      errorMessage: "Name is required",
    },
  },
  description: {
    in: ["body"],
    isString: {
      errorMessage: "Description must be a string",
    },
    notEmpty: {
      errorMessage: "Description is required",
    },
  },
  price: {
    in: ["body"],
    isNumeric: {
      errorMessage: "Price must be a number",
    },
    notEmpty: {
      errorMessage: "Price is required",
    },
  },
  isVeg: {
    in: ["body"],
    isBoolean: {
      errorMessage: "isVeg must be a boolean",
    },
    notEmpty: {
      errorMessage: "isVeg is required",
    },
  },
  category: {
    in: ["body"],
    isString: {
      errorMessage: "Category must be a string",
    },
    notEmpty: {
      errorMessage: "Category is required",
    },
    isIn: {
      options: [
        ["starter", "main course", "dessert", "beverage", "snack", "special"],
      ],
      errorMessage:
        "Category must be one of the following: starter, main course, dessert, beverage, snack, special",
    },
  },
});

// delete menu item validator
export const deleteMenuItemValidator = checkSchema({
  id: {
    in: ["params"],
    isMongoId: {
      errorMessage: "Invalid menu item ID",
    },
    notEmpty: {
      errorMessage: "Menu item ID is required",
    },
  },
  itemId: {
    in: ["params"],
    isMongoId: {
      errorMessage: "Invalid menu item ID",
    },
    notEmpty: {
      errorMessage: "Menu item ID is required",
    },
  },
});

// get menu validator
export const getMenuValidator = checkSchema({
  id: {
    in: ["params"],
    isMongoId: {
      errorMessage: "Invalid menu ID",
    },
    notEmpty: {
      errorMessage: "Menu ID is required",
    },
  },
});
