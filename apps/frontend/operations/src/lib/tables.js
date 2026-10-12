/** A table that has something on it: an open bill, a PIN, or unpaid orders */
export const tableIsBusy = (t) => Boolean(t.isOccupied || t.activePin || t.unpaidTotal > 0);
