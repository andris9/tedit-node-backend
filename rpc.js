// Give an api
module.exports = rpc;
var exec = require('./exec');
var bincodec = require('./bincodec');

// Given an API and a socket channel, return a call function.
// The channel is a duplex socket to the remote party
// The api is the top-level scope for remote code that's run locally.
function* rpc(channel, api) {
  channel.addCodec(websocketCodec);

  var send = bincodec.encoder(function (chunk) {
    return channel.put({
      fin: 1,
      opcode: 2,
      body: chunk
    });
  });
  var decode = bincodec.decoder(function (message) {
    log(message);
    var id = message.shift();
    run(function* () {
      var ret;
      var scope = Object.create(api);
      for (var i = 0, l = message.length; i < l; ++i) {
        ret = yield* exec.call(scope, message[i]);
      }
      return ret;
    }, function (err, result) {
      var message;
      if (err) {
        console.error(err.stack);
        message = {id:id,err:err.stack};
      }
      else {
        message = [-id, result];
      }
      log(message);
      send(message);
    });

  });
  consume(channel, function (item) {
    if (item.opcode === 2) decode(item.body);
  })(function () {
    console.log("Disconnected");
  });

}



// var run = require('gen-run');

// var decode = bincodec.decoder(onMessage);
// var send = bincodec.encoder(onChunk);
// var template = bincodec.template;

// var connection = new WebSocket('ws://localhost:1337/', ['tedit-remote']);
// connection.onopen = function () {
//   connection.send('Ping'); // Send the message 'Ping' to the server
//   run(main, function (err) {
//     if (err) throw err;
//     connection.close();
//   });
// };
// // Log errors
// connection.onerror = function (error) {
//   console.log('WebSocket Error ' + error);
// };

// // Log messages from the server
// connection.binaryType = "arraybuffer";
// connection.onmessage = function (e) {
//   if (typeof e.data === "string") {
//     console.log('Server: ' + e.data);
//   }
//   else {
//     decode(new Uint8Array(e.data));
//   }
// };

// connection.onclose = function () {
//   var ids = Object.keys(callbacks);
//   if (!ids.length) return;
//   var error = new Error("Websocket Connection Closed");
//   ids.forEach(function (id) {
//     callbacks[id](error);
//   });
// };


function onChunk(chunk) {
  connection.send(chunk);
}
function onMessage(message) {
  console.info(message)
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
  var command = '(repo.loadAs "commit" (repo.readRef "refs/heads/master"))';
  console.log("command", command);
  console.log("result", yield* call(command));
  command =
    '(def head (repo.readRef "refs/heads/master"))' +
    '(def stream (repo.logWalk head))' +
    '(map ' +
      '"head" head' +
      '"list" (list (stream.read) (stream.read) (stream.read))' +
    ')' +
    '(stream.constructor.getOwnPropertyNames stream.__proto__)';
  console.log("command", command);
  console.log("result", yield* call(command));
  command =
    '(def name "Tim Caswell")' +
    '(def age 32)' +
    '(scope)';
  console.log("command", command);
  console.log("result", yield* call(command));
  command =
    '(def names (list))' +
    '(names.push  "Tim")' +
    '(names.push "Greg")' +
    '(names "Extra" "Stuff")' +
    '(names.forEach print)' +
    'names';
  console.log("command", command);
  console.log("result", yield* call(command));
}
