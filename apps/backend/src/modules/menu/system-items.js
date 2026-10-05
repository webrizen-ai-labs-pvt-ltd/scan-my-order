/**
 * The store's built-in "open" dish that POS custom dishes are recorded against. Staff-only:
 * never shown on the guest menu and never orderable from it.
 */
const SYSTEM_OPEN_ITEM_NAME = "Open Custom Dish";
const SYSTEM_OPEN_CATEGORY_NAME = "Custom & Open Orders";

module.exports = { SYSTEM_OPEN_ITEM_NAME, SYSTEM_OPEN_CATEGORY_NAME };
