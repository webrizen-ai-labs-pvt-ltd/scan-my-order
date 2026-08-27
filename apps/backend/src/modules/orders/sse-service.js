const clients = new Map();
const customerClients = new Map();

// Generate a simple unique ID
const generateId = () => Math.random().toString(36).substr(2, 9);

function subscribeToStore(storeId, req, res) {
  // Set headers for SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  const clientId = generateId();
  
  if (!clients.has(storeId)) {
    clients.set(storeId, new Map());
  }
  
  clients.get(storeId).set(clientId, res);

  // Send an initial connected message
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', clientId })}\n\n`);

  req.on('close', () => {
    if (clients.has(storeId)) {
      clients.get(storeId).delete(clientId);
      if (clients.get(storeId).size === 0) {
        clients.delete(storeId);
      }
    }
  });
}

function subscribeToCustomer(customerId, req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  const clientId = generateId();
  
  if (!customerClients.has(customerId)) {
    customerClients.set(customerId, new Map());
  }
  
  customerClients.get(customerId).set(clientId, res);

  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', clientId })}\n\n`);

  req.on('close', () => {
    if (customerClients.has(customerId)) {
      customerClients.get(customerId).delete(clientId);
      if (customerClients.get(customerId).size === 0) {
        customerClients.delete(customerId);
      }
    }
  });
}

function broadcastToStore(storeId, eventType, payload) {
  if (clients.has(storeId)) {
    const storeClients = clients.get(storeId);
    const message = `data: ${JSON.stringify({ type: eventType, data: payload })}\n\n`;
    
    for (const [clientId, res] of storeClients.entries()) {
      res.write(message);
    }
  }
}

function broadcastToCustomer(customerId, eventType, payload) {
  if (customerClients.has(customerId)) {
    const custClients = customerClients.get(customerId);
    const message = `data: ${JSON.stringify({ type: eventType, data: payload })}\n\n`;
    
    for (const [clientId, res] of custClients.entries()) {
      res.write(message);
    }
  }
}

module.exports = {
  subscribeToStore,
  subscribeToCustomer,
  broadcastToStore,
  broadcastToCustomer
};
