var net = require('net');
var httpCodec = require('http-codec').server;
var websocketCodec = require('websocket-codec');
var wrapNodeSocket = require('culvert/wrap-node-socket');
var run = require('gen-run');
var bodec = require('bodec');
var sha1 = require('git-sha1');
var exec = require('./exec');
var bincodec = require('./bincodec');
var inspect = require('util').inspect;
var consume = require('culvert/consume');

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
  var channel = wrapNodeSocket(socket);
  channel.setCodecs(httpCodec);
  run(handleRequest(channel), function (err, res) {
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
      body = bodec.fromUnicode(err.stack + "\n");
    }
    if (bodec.isBinary(body)) {
      headers.push(["Content-Length", body.length]);
    }
    channel.put({
      code: code,
      headers: headers,
    });
    if (body) channel.put(body);
    channel.put();
  });
}

function* handleRequest(channel) {
  var req = yield channel.take;

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

  channel.put({
    code: 101,
    headers: [
      ["Upgrade", "websocket"],
      ["Connection", "Upgrade"],
      ["Sec-WebSocket-Accept", accept],
      ["Sec-WebSocket-Protocol", "tedit-remote"],
    ]
  });

  channel.setCodecs(websocketCodec);

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
      for (var i = 0, l = message.length; i < l; ++i) {
        ret = yield* exec.call(api, message[i]);
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

var fs = require('fs');

var api = {
  list: function () {
    return [].slice.call(arguments);
  },
  map: function () {
    var obj = {};
    for (var i = 0, l = arguments.length; i < l; i += 2) {
      obj[arguments[i]] = arguments[i + 1];
    }
    return obj;
  },
  add: function add(a, b) {
    return a + b;
  },
  slowAdd: function slowAdd(a, b) {
    return function (callback) {
      setTimeout(function () {
        callback(null, a + b);
      }, 500);
    };
  },
  slowerAdd: function* slowerAdd(a, b) {
    return yield function (callback) {
      setTimeout(function () {
        callback(null, a + b);
      }, 500);
    };
  },
  readFile: function readFile(path, encoding) {
    return function (callback) {
      fs.readFile(path, encoding, function (err, result) {
        if (err) {
          if (err.code === "ENOENT") return callback();
          return callback(err);
        }
        return callback(null, result);
      });
    }
  }
};
