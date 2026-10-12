/** Called when an order is served or completed, so the "rate your order" invitation appears at once */
export const announceOrderFinished = () => window.dispatchEvent(new Event('smo:order-finished'));
