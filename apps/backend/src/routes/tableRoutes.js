const express = require("express");
const router = express.Router();
const tableController = require("../controllers/tableController.js");
const { authenticateToken } = require("../middleware/auth.js");
const { authorizeRoles } = require("../middleware/role.js");

// All Table routes require authentication
router.use(authenticateToken);

// List and get table details
router.get("/", tableController.listStoreTables);
router.get("/:id", tableController.getTableById);

// Create, Update, Delete tables (Restricted to OWNER and MANAGER)
router.post("/", authorizeRoles("ADMIN", "OWNER", "MANAGER"), tableController.createTable);
router.put("/:id", authorizeRoles("ADMIN", "OWNER", "MANAGER"), tableController.updateTable);
router.delete("/:id", authorizeRoles("ADMIN", "OWNER", "MANAGER"), tableController.deleteTable);

module.exports = router;
