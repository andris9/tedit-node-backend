// Give an api
module.exports = rpc;
var exec = require('./exec');
var bincodec = require('./bincodec');
var run = require('gen-run');
var consume = require('culvert/consume');
var template = bincodec.template;

// Given an API and a socket channel, return a call function.
// The channel is a duplex socket to the remote party
// The api is the top-level scope for remote code that's run locally.
function rpc(channel, api) {

  var send = bincodec.encoder(channel.put);

  var decode = bincodec.decoder(function (message) {
    console.log(message);

    if (!Array.isArray(message)) {
      return callbacks[message.id](message.err);
    }
    var id = message.shift();
    if (id < 0) {
      return callbacks[-id](null, message[0]);
    }

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
      send(message);
    });
  });

  consume(channel, decode)(function (err) {
    if (err) {
      console.error(err.toString());
    }
    else {
      console.log("Disconnected");
    }
  });

  var nextId = 1;
  var callbacks = {};

  return function* call(command, data) {
    if (typeof command === "string") {
      command = template(command, data);
    }
    var id = nextId++;
    command = [id].concat(command);
    console.log(command);
    return yield function (callback) {
      callbacks[id] = callback;
      send(command);
    };
  };

}
