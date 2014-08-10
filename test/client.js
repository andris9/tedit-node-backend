/*global bodec, bincodec*/

var decode = bincodec.decoder(onMessage);

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
  if (typeof e.data === "string") {
    console.log('Server: ' + e.data);
  }
  else {
    decode(e.data);
  }
};

function onMessage(message) {
  console.log('Message', message);
}
