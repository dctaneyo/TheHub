// src/worker.js
self.onmessage = (event) => {
  console.log('Message received from main script:', event.data);
  const result = `Worker has processed: ${event.data}`;
  self.postMessage(result);
};