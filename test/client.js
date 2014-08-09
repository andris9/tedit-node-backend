var connection = new WebSocket('ws://localhost:1337/', ['tedit-remote']);
connection.onopen = function () {
  connection.send('Ping'); // Send the message 'Ping' to the server
};
// Log errors
connection.onerror = function (error) {
  console.log('WebSocket Error ' + error);
};

// Log messages from the server
connection.onmessage = function (e) {
  console.log('Server: ' + e.data);
};
