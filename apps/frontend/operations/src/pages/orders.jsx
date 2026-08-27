import React, { useState, useEffect, useRef } from 'react';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { useStoreStore } from '../store/storeStore';
import { 
  Card, CardContent, CardHeader, CardTitle, 
  Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Badge, Dialog, DialogContent, DialogHeader, DialogTitle,
  Skeleton
} from '@smo/ui';
import { Search01Icon, FilterIcon, PrinterIcon, Download01Icon, Money01Icon } from 'hugeicons-react';

const ORDER_STATUSES = ['DRAFT', 'PENDING_VERIFICATION', 'PROCESSING', 'READY', 'SERVED', 'SETTLED', 'CANCELLED'];
const PAYMENT_MODELS = ['PREPAID', 'POSTPAID'];
const ORIGINS = ['POS', 'QR_MENU', 'KIOSK', 'AGGREGATOR'];

export const Orders = () => {
  const { currentStore } = useStoreStore();
  const selectedStoreId = currentStore?.id;
  
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ total: 0, pages: 1, current: 1, limit: 10 });
  
  // Filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [paymentModel, setPaymentModel] = useState('all');
  const [origin, setOrigin] = useState('all');
  
  // View Details
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const receiptRef = useRef(null);

  const fetchOrders = async (page = 1) => {
    if (!selectedStoreId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page,
        limit: pagination.limit
      });
      if (search) params.append('search', search);
      if (status !== 'all') params.append('status', status);
      if (paymentModel !== 'all') params.append('paymentModel', paymentModel);
      if (origin !== 'all') params.append('origin', origin);

      const res = await api.get(`/stores/${selectedStoreId}/orders/history?${params.toString()}`);
      if (res.data.success) {
        setOrders(res.data.data.orders);
        setPagination(res.data.data.pagination);
      }
    } catch (err) {
      console.error("Failed to fetch orders history:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders(1);
  }, [selectedStoreId, status, paymentModel, origin]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchOrders(1);
  };

  const openDetails = (order) => {
    setSelectedOrder(order);
    setIsDetailsOpen(true);
  };

  const handlePrint = () => {
    if (!receiptRef.current) return;
    const printWindow = window.open('', '', 'width=400,height=600');
    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt</title>
          <style>
            body { font-family: monospace; font-size: 14px; margin: 0; padding: 20px; }
            .flex { display: flex; }
            .justify-between { justify-content: space-between; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .text-xl { font-size: 1.25rem; }
            .text-lg { font-size: 1.125rem; }
            .mb-4 { margin-bottom: 1rem; }
            .mb-2 { margin-bottom: 0.5rem; }
            .mb-1 { margin-bottom: 0.25rem; }
            .pb-2 { padding-bottom: 0.5rem; }
            .pl-2 { padding-left: 0.5rem; }
            .uppercase { text-transform: uppercase; }
            .border-b { border-bottom: 1px dashed black; }
            .flex-1 { flex: 1; }
            .w-10 { width: 2.5rem; }
            .w-16 { width: 4rem; }
            .text-xs { font-size: 0.75rem; }
            .pr-2 { padding-right: 0.5rem; }
          </style>
        </head>
        <body>${receiptRef.current.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
  };

  const getStatusColor = (s) => {
    switch (s) {
      case 'SETTLED': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'CANCELLED': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'PROCESSING': 
      case 'READY': 
      case 'SERVED': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      default: return 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300';
    }
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Filters Header */}
      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search01Icon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <Input 
                placeholder="Search by Order ID..." 
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            <div className="flex gap-2">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {ORDER_STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
              
              <Select value={paymentModel} onValueChange={setPaymentModel}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Payment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Payments</SelectItem>
                  {PAYMENT_MODELS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              
              <Select value={origin} onValueChange={setOrigin}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Origin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Origins</SelectItem>
                  {ORIGINS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>

              <Button type="submit" variant="default" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                Search
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardContent className="p-0 flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead>Table / Origin</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center text-zinc-500">
                    No orders found matching your criteria.
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((order) => (
                  <TableRow key={order.id} className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/50" onClick={() => openDetails(order)}>
                    <TableCell className="font-medium text-xs font-mono">{order.id.slice(-8).toUpperCase()}</TableCell>
                    <TableCell>{new Date(order.createdAt).toLocaleString()}</TableCell>
                    <TableCell>
                      {order.table ? `Table ${order.table.tableNumber}` : order.origin}
                    </TableCell>
                    <TableCell className="text-xs font-semibold">{order.paymentModel}</TableCell>
                    <TableCell>
                      <Badge className={`border-none ${getStatusColor(order.status)}`}>
                        {order.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold">₹{order.totalAmount}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
        
        {/* Pagination */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-950">
          <div className="text-sm text-zinc-500">
            Showing page {pagination.current} of {pagination.pages} ({pagination.total} total orders)
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              disabled={pagination.current <= 1 || loading}
              onClick={() => fetchOrders(pagination.current - 1)}
            >
              Previous
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              disabled={pagination.current >= pagination.pages || loading}
              onClick={() => fetchOrders(pagination.current + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      {/* Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="flex flex-col gap-4">
              {/* Hidden Receipt for Printing */}
              <div style={{ display: 'none' }}>
                <div ref={receiptRef}>
                  <div className="text-center mb-4 border-b pb-2">
                    <div className="font-bold text-xl uppercase mb-1">{currentStore?.name || 'Scan My Order'}</div>
                    <div className="text-xs uppercase">Store: {currentStore?.name}</div>
                    {currentStore?.tenant?.gstin && <div className="text-xs uppercase">GSTIN: {currentStore.tenant.gstin}</div>}
                    <div className="text-xs mt-1">Date: {new Date(selectedOrder.createdAt).toLocaleString()}</div>
                    <div className="text-xs">Order ID: #{selectedOrder.id.slice(-6).toUpperCase()}</div>
                    <div className="text-xs font-bold mt-1 uppercase">
                      {selectedOrder.table ? `DINE-IN - TABLE ${selectedOrder.table.tableNumber}` : selectedOrder.origin}
                    </div>
                  </div>
                  
                  <div className="mb-2 text-xs border-b pb-2">
                    <div className="flex font-bold mb-1">
                      <div className="flex-1">ITEM</div>
                      <div className="w-10 text-center">QTY</div>
                      <div className="w-16 text-right">AMT</div>
                    </div>
                    {selectedOrder.items.map((item, idx) => {
                      const itemTotal = item.priceAtOrder * item.quantity;
                      return (
                        <div key={idx} className="mb-2">
                          <div className="flex">
                            <div className="flex-1 pr-2">{item.menuItem.name}</div>
                            <div className="w-10 text-center">{item.quantity}</div>
                            <div className="w-16 text-right">{itemTotal}</div>
                          </div>
                          {item.modifiers?.length > 0 && item.modifiers.map(mod => (
                            <div key={mod.id} className="flex text-xs pl-2">
                              <div className="flex-1">- {mod.modifierOption.name}</div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="mb-2 text-xs border-b pb-2">
                    <div className="flex justify-between mb-1">
                      <div>SUBTOTAL</div>
                      <div>{selectedOrder.subTotal}</div>
                    </div>
                    <div className="flex justify-between mb-1">
                      <div>TAX</div>
                      <div>{selectedOrder.taxAmount}</div>
                    </div>
                    {selectedOrder.discountAmount > 0 && (
                      <div className="flex justify-between mb-1">
                        <div>DISCOUNT</div>
                        <div>-{selectedOrder.discountAmount}</div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-between font-bold text-lg mb-4">
                    <div>TOTAL</div>
                    <div>INR {selectedOrder.totalAmount}</div>
                  </div>
                  
                  <div className="text-center text-xs">
                    <div className="mb-2">Thank you for dining with us!</div>
                    <div className="font-bold">Powered by ScanMyOrder</div>
                  </div>
                </div>
              </div>

              <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-800">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg">
                      {selectedOrder.table ? `Table ${selectedOrder.table.tableNumber}` : selectedOrder.origin}
                    </h3>
                    <p className="text-sm text-zinc-500 font-mono">#{selectedOrder.id}</p>
                    <p className="text-xs text-zinc-500">{new Date(selectedOrder.createdAt).toLocaleString()}</p>
                  </div>
                  <Badge className={`border-none ${getStatusColor(selectedOrder.status)}`}>
                    {selectedOrder.status.replace('_', ' ')}
                  </Badge>
                </div>
                
                <div className="space-y-3 mb-4 max-h-[300px] overflow-y-auto pr-2">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <div>
                        <div className="font-medium">{item.quantity}x {item.menuItem.name}</div>
                        {item.modifiers?.length > 0 && (
                          <div className="text-xs text-zinc-500 pl-4 mt-0.5">
                            {item.modifiers.map(m => m.modifierOption.name).join(', ')}
                          </div>
                        )}
                      </div>
                      <div className="font-medium">₹{item.priceAtOrder * item.quantity}</div>
                    </div>
                  ))}
                </div>
                
                <div className="border-t border-zinc-200 dark:border-zinc-800 pt-3 space-y-1 text-sm">
                  <div className="flex justify-between text-zinc-500">
                    <span>Subtotal</span>
                    <span>₹{selectedOrder.subTotal}</span>
                  </div>
                  <div className="flex justify-between text-zinc-500">
                    <span>Taxes</span>
                    <span>₹{selectedOrder.taxAmount}</span>
                  </div>
                  {selectedOrder.discountAmount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount</span>
                      <span>-₹{selectedOrder.discountAmount}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg pt-2 border-t border-zinc-200 dark:border-zinc-800 mt-2">
                    <span>Total</span>
                    <span>₹{selectedOrder.totalAmount}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setIsDetailsOpen(false)}>Close</Button>
                <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handlePrint}>
                  <PrinterIcon size={18} className="mr-2" /> Print Receipt
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
