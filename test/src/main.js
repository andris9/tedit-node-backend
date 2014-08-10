document.body.textContent = "";

var bincodec = require('bincodec');
var run = require('gen-run');
var decode = bincodec.decoder(onMessage);
var send = bincodec.encoder(onChunk);
var template = bincodec.template;

var connection = new WebSocket('ws://localhost:1337/', ['tedit-remote']);
connection.onopen = function () {
  connection.send('Ping'); // Send the message 'Ping' to the server
  run(main, function (err) {
    if (err) throw err;
    connection.close();
  });
};
// Log errors
connection.onerror = function (error) {
  console.log('WebSocket Error ' + error);
};

// Log messages from the server
connection.binaryType = "arraybuffer";
connection.onmessage = function (e) {
  if (typeof e.data === "string") {
    console.log('Server: ' + e.data);
  }
  else {
    decode(new Uint8Array(e.data));
  }
};

function onChunk(chunk) {
  connection.send(chunk);
}
function onMessage(message) {
  var id, err, result;
  if (Array.isArray(message)) {
    id = -message[0];
    result = message[1];
  }
  else {
    id = message.id;
    err = new Error(message.err);
  }
  var callback = callbacks[id];
  delete callbacks[id];
  callback(err, result);
}

var nextId = 1;
var callbacks = {};
function* call(command, vars) {
  var id = nextId++;
  if (typeof command === "string") {
    command = template(command, vars);
  }
  command.unshift(id);
  send(command);
  return yield function (callback) {
    callbacks[id] = callback;
  };
}

function* main() {
  var command = '(list (slowerAdd 1 2) (slowAdd 3 4) (add 5 6))';
  console.log("command", command);
  console.log("result", yield* call(command));
  command = '(map "slower" (slowerAdd 1 2) "slow" (slowAdd 3 4) "add" (add 5 6))';
  console.log("command", command);
  console.log("result", yield* call(command));
}
