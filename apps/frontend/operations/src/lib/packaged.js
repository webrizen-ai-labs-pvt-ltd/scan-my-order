import api from './api';
import { apiErrorMessage } from '../components/pos/pos-toasts';

/**
 * An order of only packaged items (water, cans, dips) sold at the counter: once its bill is paid
 * it's handed over on the spot, so mark it served. A paid order settles when served.
 * The bill is already paid when this runs, so a failure only warns.
 */
export async function handOverPackagedOrder(storeId, orderId, toast) {
  try {
    await api.patch(`/stores/${storeId}/orders/${orderId}/status`, { status: 'SERVED' });
  } catch (err) {
    toast?.(`Bill paid, but the order couldn't be marked served: ${apiErrorMessage(err, 'try it from Active orders')}`, 'error');
  }
}
