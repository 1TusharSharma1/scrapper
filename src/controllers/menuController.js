import asyncHandler from "../utils/asyncHandler.js";
import { APIError } from "../utils/apiError.js";
import ApiResponse from "../utils/apiResponse.js";
import HttpStatusCode from "../constants/httpCode.js";
import Menu from "../models/menuModel.js";
import MenuItem from "../models/menuItemModel.js";
import { validationResult } from "express-validator";
import runInTransaction from "../utils/runTransaction.js";

/**
 * @description Create a menu
 * @route POST /api/v1/menus
 * @access Private
 */
const addMenu = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new APIError(
      "Bad Request",
      HttpStatusCode.BAD_REQUEST,
      true,
      errors.array()
    );
  }
  const menu = await Menu.create({ ...req.body, userId: req.user._id });
  await menu.save();
  return res
    .status(HttpStatusCode.CREATED)
    .json(
      new ApiResponse(HttpStatusCode.CREATED, menu, "Menu created successfully")
    );
});

/**
 * @description Delete a menu
 * @route DELETE /api/v1/menus/:id
 * @access Private
 */
const deleteMenu = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new APIError(
      "Bad Request",
      HttpStatusCode.BAD_REQUEST,
      true,
      errors.array()
    );
  }
  const { id } = req.params;
  const menu = await Menu.findById(id);
  if (!menu) {
    throw new APIError(
      "Not Found",
      HttpStatusCode.NOT_FOUND,
      true,
      "Menu not found"
    );
  }
  if (menu.userId.toString() !== req.user._id.toString()) {
    throw new APIError(
      "Forbidden",
      HttpStatusCode.FORBIDDEN,
      true,
      "You are not authorized to delete this menu"
    );
  }
  await runInTransaction(async (session) => {
    for (const item of menu.items) {
      await MenuItem.findByIdAndDelete(item).session(session);
    }
    await Menu.findByIdAndDelete(id).session(session);
  });
  return res
    .status(HttpStatusCode.OK)
    .json(
      new ApiResponse(HttpStatusCode.OK, menu, "Menu deleted successfully")
    );
});

/**
 * @description Delete a menu item
 * @route DELETE /api/v1/menus/:id/items/:itemId
 * @access Private
 */
const deleteMenuItem = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new APIError(
      "Bad Request",
      HttpStatusCode.BAD_REQUEST,
      true,
      errors.array()
    );
  }
  const { id, itemId } = req.params;
  const menu = await Menu.findById(id);
  if (!menu) {
    throw new APIError(
      "Not Found",
      HttpStatusCode.NOT_FOUND,
      true,
      "Menu not found"
    );
  }
  if (menu.userId.toString() !== req.user._id.toString()) {
    throw new APIError(
      "Forbidden",
      HttpStatusCode.FORBIDDEN,
      true,
      "You are not authorized to delete this menu item"
    );
  }
  await runInTransaction(async (session) => {
    await MenuItem.findByIdAndDelete(itemId).session(session);
    await Menu.findByIdAndUpdate(id, { $pull: { items: itemId } }).session(
      session
    );
  });
  const updatedMenu = await Menu.findById(id).populate("items");
  return res
    .status(HttpStatusCode.OK)
    .json(
      new ApiResponse(
        HttpStatusCode.OK,
        updatedMenu,
        "Menu item deleted successfully"
      )
    );
});

/**
 *  @description Update a menu item
 *  @route PUT /api/v1/menus/:id/items/:itemId
 * @access Private
 */
const updateMenuItem = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new APIError(
      "Bad Request",
      HttpStatusCode.BAD_REQUEST,
      true,
      errors.array()
    );
  }
  const { id, itemId } = req.params;
  const menu = await Menu.findById(id);
  if (!menu) {
    throw new APIError(
      "Not Found",
      HttpStatusCode.NOT_FOUND,
      true,
      "Menu not found"
    );
  }
  if (menu.userId.toString() !== req.user._id.toString()) {
    throw new APIError(
      "Forbidden",
      HttpStatusCode.FORBIDDEN,
      true,
      "You are not authorized to update this menu item"
    );
  }
  await MenuItem.findByIdAndUpdate(itemId, { ...req.body }, { new: true });
  const updatedMenu = await Menu.findById(id).populate("items");
  return res
    .status(HttpStatusCode.OK)
    .json(
      new ApiResponse(
        HttpStatusCode.OK,
        updatedMenu,
        "Menu item updated successfully"
      )
    );
});

/**
 * @description Add a menu item
 * @route POST /api/v1/menus/:id/items
 * @access Private
 */
const addMenuItem = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new APIError(
      "Bad Request",
      HttpStatusCode.BAD_REQUEST,
      true,
      errors.array()
    );
  }
  const { id } = req.params;
  const menu = await Menu.findById(id);
  if (!menu) {
    throw new APIError(
      "Not Found",
      HttpStatusCode.NOT_FOUND,
      true,
      "Menu not found"
    );
  }
  if (menu.userId.toString() !== req.user._id.toString()) {
    throw new APIError(
      "Forbidden",
      HttpStatusCode.FORBIDDEN,
      true,
      "You are not authorized to add this menu item"
    );
  }
  await runInTransaction(async (session) => {
    const menuItem = await MenuItem.create({ ...req.body, menuId: id });
    await menuItem.save({ session });
    await Menu.findByIdAndUpdate(id, {
      $push: { items: menuItem._id },
    }).session(session);
  });
  const updatedMenu = await Menu.findById(id).populate("items");
  return res
    .status(HttpStatusCode.CREATED)
    .json(
      new ApiResponse(
        HttpStatusCode.CREATED,
        updatedMenu,
        "Menu item created successfully"
      )
    );
});

/**
 * @description Get a menu by ID
 * @route GET /api/v1/menus/:id
 */
const getMenuById = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new APIError(
      "Bad Request",
      HttpStatusCode.BAD_REQUEST,
      true,
      errors.array()
    );
  }
  const { id } = req.params;
  const menu = await Menu.findById(id).populate("items");
  if (!menu) {
    throw new APIError(
      "Not Found",
      HttpStatusCode.NOT_FOUND,
      true,
      "Menu not found"
    );
  }
  return res
    .status(HttpStatusCode.OK)
    .json(
      new ApiResponse(HttpStatusCode.OK, menu, "Menu fetched successfully")
    );
});

/**
 * @description Get all menus for a user
 * @route GET /api/v1/menus
 */
const getMenuForUser = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new APIError(
      "Bad Request",
      HttpStatusCode.BAD_REQUEST,
      true,
      errors.array()
    );
  }
  const id = req.user._id;
  const menus = await Menu.find({ userId: id }).populate("items").sort({ createdAt: -1 });
  return res
    .status(HttpStatusCode.OK)
    .json(
      new ApiResponse(HttpStatusCode.OK, menus, "Menu fetched successfully")
    );
});

export {
  addMenu,
  deleteMenu,
  deleteMenuItem,
  updateMenuItem,
  addMenuItem,
  getMenuById,
  getMenuForUser,
};
