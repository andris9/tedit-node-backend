var bodec = require('bodec');

var apis = {
  add: function (a, b) {
    return a + b;
  },
  slowAdd: function* (a, b) {
    yield function (callback) {
      setTimeout(function () {
        callback(null, a + b);
      }, 500);
    };
  }
};


// A lisp-style RPC command
var command = ["add",
  ["slowAdd", 1, 2],
  ["add", 3, 4]
];

var rules = [
  BIN,      /^\0[^\0]*\0,
  null,     /^\s+/,
  null,     /^--.*/,
  CONSTANT, /^(?:true|false|null)\b/,
  CONSTANT, /^-?[0-9]+/,
  CONSTANT, /^"(?:[^\r\n"\\]|\\.)*"/,
  ID,       /^[^:;'",.`(){}[\]]+/,
  CHAR,     /^./,
];

//        "{  }  (  )  [  ]     \n")
// <Buffer 7b 7d 28 29 5b 5d 20 0a>


function read(code) {
  var offset = 0;
  var length = code.length;
  var tokens = [];
  while (offset < length) {
    var c = code[offset];
    if (c === )

  }
  var offset = 0;
  var tokens = [];
  var length = code.length;
  while (offset < length) {
    var part = code.substring(offset);
  }
}


// A little lisp style evaluater
function* exec(command) {
  if (!Array.isArray(command)) {
    throw new TypeError("Commands must be arrays");
  }
  var fn = command[0];
  // Assume the first is a symbol if it's a string
  if (typeof fn === "string") {
    fn = this[fn];
  }
  // If it's an array, execute it to get the result.
  else if (Array.isArray(fn)) {
    fn = yield* exec.call(this, fn);
  }
  if (typeof fn !== "function") {
    throw new TypeError("First item must be function");
  }
  var args = command.slice(1);
  // Evaluate arguments for non-raw functions
  if (!fn.raw) {
    for (var i = 0, l = args.length; i < l; ++i) {
      if (Array.isArray(args[i])) {
        args[i] = yield* exec.call(this, args[i]);
      }
    }
  }
  if (fn.constructor === Function) {
    return fn.apply(apis, args);
  }
  return yield* fn.apply(apis, args);
}

require('gen-run')(exec(command, apis));