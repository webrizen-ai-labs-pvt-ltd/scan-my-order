const clients = new Map();

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

function broadcastToStore(storeId, eventType, payload) {
  if (clients.has(storeId)) {
    const storeClients = clients.get(storeId);
    const message = `data: ${JSON.stringify({ type: eventType, data: payload })}\n\n`;
    
    for (const [clientId, res] of storeClients.entries()) {
      res.write(message);
    }
  }
}

module.exports = {
  subscribeToStore,
  broadcastToStore
};
