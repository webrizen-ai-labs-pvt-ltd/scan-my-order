const express = require("express");
const router = express.Router();
const ownerController = require("../controllers/ownerController.js");
const { authenticateToken } = require("../middleware/auth.js");
const { authorizeRoles } = require("../middleware/role.js");

// Protect all owner routes with JWT auth and OWNER/ADMIN role requirement
router.use(authenticateToken, authorizeRoles("OWNER", "ADMIN"));

router.get("/employees", ownerController.listEmployees);
router.get("/employees/:id", ownerController.getEmployeeById);
router.post("/employees", ownerController.createEmployee);
router.put("/employees/:id", ownerController.updateEmployee);
router.delete("/employees/:id", ownerController.removeEmployee);
router.patch("/employees/:id/role", ownerController.changeEmployeeRole);
router.patch("/employees/:id/status", ownerController.changeEmployeeStatus);

module.exports = router;
