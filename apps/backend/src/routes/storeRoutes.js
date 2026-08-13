const express = require("express");
const router = express.Router();
const storeController = require("../controllers/storeController.js");
const { authenticateToken } = require("../middleware/auth.js");
const { authorizeRoles } = require("../middleware/role.js");

// Public store details & menu fetching
router.get("/", storeController.listStores);
router.get("/:id", storeController.getStore);

// Owner & Admin Store Management
router.post("/", authenticateToken, authorizeRoles("OWNER", "ADMIN"), storeController.createStore);
router.post("/:id/menu", authenticateToken, authorizeRoles("OWNER", "MANAGER", "ADMIN"), storeController.addMenuItem);

module.exports = router;
