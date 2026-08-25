const express = require("express");
const { createApiResponse } = require("@smo/shared");
const { asyncHandler } = require("../../middleware/async-handler");
const { authenticate } = require("../../middleware/auth");
const {
  createUser,
  deleteUser,
  getUserById,
  listUsers,
  serializeUser,
  updateUser,
  updateUserStatus
} = require("./user-service");

const router = express.Router();

router.use(authenticate);

router.get("/me", (req, res) => {
  res.json(createApiResponse(serializeUser(req.user)));
});

router.get("/", asyncHandler(async (req, res) => {
  const users = await listUsers(req.user, req.query);

  res.json(createApiResponse(users));
}));

router.post("/", asyncHandler(async (req, res) => {
  const user = await createUser(req.user, req.body);

  res.status(201).json(createApiResponse(user));
}));

router.get("/:id", asyncHandler(async (req, res) => {
  const user = await getUserById(req.user, req.params.id);

  res.json(createApiResponse(user));
}));

router.patch("/:id", asyncHandler(async (req, res) => {
  const user = await updateUser(req.user, req.params.id, req.body);

  res.json(createApiResponse(user));
}));

router.patch("/:id/status", asyncHandler(async (req, res) => {
  const user = await updateUserStatus(req.user, req.params.id, req.body.status);

  res.json(createApiResponse(user));
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const user = await deleteUser(req.user, req.params.id);

  res.json(createApiResponse(user));
}));

module.exports = router;
