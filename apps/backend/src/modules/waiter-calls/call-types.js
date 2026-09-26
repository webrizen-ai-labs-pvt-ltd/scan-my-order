/** Call types guests can pick on the QR menu, with the words staff see */
const CALL_TYPE_LABELS = {
  WATER: "Water",
  BILL: "Bill",
  CUTLERY: "Cutlery & napkins",
  CLEAN_TABLE: "Clean table",
  CALL_WAITER: "Assistance"
};

function callTypeLabel(type) {
  return CALL_TYPE_LABELS[type] || CALL_TYPE_LABELS.CALL_WAITER;
}

module.exports = { CALL_TYPE_LABELS, callTypeLabel };
