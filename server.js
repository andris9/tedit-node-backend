var net = require('net');
var httpCodec = require('http-codec').server;
var websocketCodec = require('websocket-codec');
var wrapNodeSocket = require('culvert/wrap-node-socket');
var run = require('gen-run');
var bodec = require('bodec');
var sha1 = require('git-sha1');
var inspect = require('util').inspect;
var rpc = require('./rpc');
var addCodec = require('culvert/add-codec');

function log() {
  console.log([].slice.call(arguments).map(function (item) {
    return inspect(item, {colors:true,depth:null});
  }).join(" "));
}

var server = net.createServer(onConnection);
server.listen(1337, function () {
  console.log("Tedit remote helper listening at ws://localhost:%s", server.address().port);
});

// Magic websocket value;
var magic = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

function onConnection(socket) {
  var tcpChannel = wrapNodeSocket(socket);
  var httpChannel = addCodec(tcpChannel, httpCodec);
  run(handleRequest(httpChannel, socket), function (err, res) {
    var code, headers, body;
    if (!err) {
      if (!res) return;
      try {
        if (!Array.isArray(res) || res.length < 2 || res.length > 3) {
          throw new TypeError("Response must be [code, headers, body]");
        }
        code = res[0];
        if ((code|0) !== code) {
          throw new TypeError("code must be integer");
        }
        headers = res[1];
        if (headers && typeof headers === "object" && !Array.isArray(headers)) {
          headers = Object.keys(headers).map(function (key) {
            return [key, headers[key]];
          });
        }
        if (!Array.isArray(headers)) {
          throw new TypeError("headers must be array or object");
        }
        body = res[2];
        if (typeof body === "string") {
          body = bodec.fromUnicode(body);
        }
        if (body && !bodec.isBinary(body)) {
          throw new TypeError("body must be string, binary or missing");
        }
      }
      catch (error) {
        err = error;
      }
    }
    if (err) {
      code = 500;
      headers = [["Content-Type", "text/plain"]];
      console.error(err.stack);
      body = bodec.fromUnicode(err.message + "\n");
    }
    if (bodec.isBinary(body)) {
      headers.push(["Content-Length", body.length]);
    }
    httpChannel.put({
      code: code,
      headers: headers,
    });
    if (body) httpChannel.put(body);
    httpChannel.put();
  });
}

function* handleRequest(httpChannel, socket) {
  var req = yield httpChannel.take;

  if (req.method !== "GET") {
    return [405, ["Allow", "GET"]];
  }
  // Convert headers list to node-style headers object.
  var headers = {};
  req.headers.forEach(function (pair) {
    headers[pair[0].toLowerCase()] = pair[1];
  });

  var key = headers["sec-websocket-key"];
  var protocol = headers["sec-websocket-protocol"];
  var version = headers["sec-websocket-version"];

  if (headers.upgrade !== "websocket" || !key || protocol !== "tedit-remote" || version !== "13") {
    return [200, {"Content-Type": "text/plain"}, "Only tedit-remote websocket v13 protocol supported.\n"];
  }

  var accept = bodec.encodeBase64(
    bodec.decodeHex(sha1(key + magic))
  );

  httpChannel.put({
    code: 101,
    headers: [
      ["Upgrade", "websocket"],
      ["Connection", "Upgrade"],
      ["Sec-WebSocket-Accept", accept],
      ["Sec-WebSocket-Protocol", "tedit-remote"],
    ]
  });

  // Add the websocket framing protocol to the stream
  // The new channel speaks raw type 2 binary messages.
  var wsChannel = addCodec(httpChannel, {
    encoder: function (emit) {
      var send = websocketCodec.encoder(emit);
      return function (item) {
        send({opcode: 2, body: item});
      };
    },
    decoder: function (emit) {
      return websocketCodec.decoder(function (item) {
        if (item.opcode === 2) return emit(item.body);
      });
    }
  });

  console.log("New RPC client", socket.address());
  rpc(wsChannel, api);
}

var fs = require('fs');
var repo = {};
require('git-node-fs/mixins/fs-db')(repo, "/Users/tim/Desktop/tedit.git");
require('js-git/mixins/walkers')(repo);
require('js-git/mixins/formats')(repo);

var api = Object.create(require('./base'));

// Expose a js-git repo for testing
api.repo = repo;

// And a file reader
api.readFile = function readFile(path, encoding) {
  return function (callback) {
    fs.readFile(path, encoding, function (err, result) {
      if (err) {
        if (err.code === "ENOENT") return callback();
        return callback(err);
      }
      return callback(null, result);
    });
  };
};
