// format spec
//
// 00000000 null
// 00000001 undefined
// 00000010 false
// 00000011 true
// 000001xx
// 00001xxx
// 00010xxx VALUE Set memory // not implemented
// 00011xxx Get memory       // not implemented
// 001cxxxx cxxxxxxxx* RAW symbol length
// 010cxxxx cxxxxxxxx* RAW string length
// 011cxxxx cxxxxxxxx* RAW binary length
// 100cxxxx cxxxxxxxx* positive integer
// 101cxxxx cxxxxxxxx* negative integer
// 110cxxxx cxxxxxxxx* VALUE* array length
// 111cxxxx cxxxxxxxx* PAIR* object length

( // Module boilerplate to support cjs and browser globals.
  (typeof module === "object" && typeof module.exports === "object" && function (m) { module.exports = m(require('bodec')); }) ||
  (function (m) { window.bincodec = m(window.bodec); })
)(function (bodec) {
"use strict";

var exports = {};

exports.isId = isId;

function isId(value) {
  return value instanceof Id ? value.id : false;
}

var cache = {};
function Id(id) {
  if (cache[id]) return cache[id];
  if (!(this instanceof Id)) return new Id(id);
  cache[id] = this;
  this.id = id;
}
Id.prototype.inspect = Id.prototype.toString = function (_, opts) {
  if (opts && opts.colors) {
    return "\x1B[31;1m" + this.id + "\x1b[39;22m";
  }
  return this.id;
};

function encode(value) {
  var ret, i, length;
  if (value === null)      return write(0);
  if (value === undefined) return write(1);
  if (value === false)     return write(2);
  if (value === true)      return write(3);
  if (value instanceof Id) {
    return writeBinary(0x20, bodec.fromUnicode(value.id));
  }
  if (typeof value === "string") {
    return writeBinary(0x40, bodec.fromUnicode(value));
  }
  if (bodec.isBinary(value)) {
    return writeBinary(0x60, value);
  }
  if (value|0 === value) {
    if (value >= 0) {
      return writeLength(0x80, value);
    }
    else {
      return writeLength(0xa0, -value);
    }
  }
  if (Array.isArray(value)) {
    length = value.length;
    ret = writeLength(0xc0, length);
    for (i = 0; i < length; ++i) {
      ret = encode(value[i]);
    }
    return ret;
  }
  if (typeof value === "object") {
    var keys = Object.keys(value);
    length = keys.length;
    ret = writeLength(0xe0, length);
    for (i = 0; i < length; ++i) {
      var key = keys[i];
      encode(key);
      ret = encode(value[key]);
    }
    return ret;
  }
  throw new Error("Illegal value");
}

function writeLength(prefix, length) {
  var byte = prefix | (length & 0xf);
  if (length < 0x10) return write(byte);
  write(byte | 0x10);
  length >>= 4;
  while (length) {
    byte = length & 0x7f;
    if (length < 0x80) return write(byte);
    write(byte | 0x80);
    length >>= 7;
  }
}

function writeBinary(prefix, binary) {
  var length = binary.length;
  var ret = writeLength(prefix, length);
  for (var i = 0, l = binary.length; i < l; ++i) {
    ret = write(binary[i]);
  }
  return ret;
}

var bytes = [];
function write(byte) {
  bytes.push(byte|0);
  return true;
}

function flush() {
  var bin = bodec.fromArray(bytes);
  bytes.length = 0;
  return bin;
}

exports.encode = function (value) {
  encode(value);
  return flush();
};

exports.encoder = encoder;
function encoder(emit) {
  return function (value) {
    emit(encode(value));
  };
}

exports.decoder = decoder;

function decoder(emit) {
  // Current container
  // [] for array and binary, "" for string types, {} for objects
  // null for primitives
  var container = null;
  // Offset within container
  var offset;
  // Length of container
  var length;
  // key for object containers
  var key = null;
  // Local state between states
  var type;

  // Stack of parent {type,container,offset,length,key} state
  var stack = [];

  // Temporary variable for decoding var-length
  var num;

  // 0-start, <0 variable length, 1 - id, string, binary
  var state = 0;
  return function (chunk) {
    for (var i = 0, l = chunk.length; i < l; i++) {
      var c = chunk[i];
      if (state === 0) {
        // Handle simple types first
        if (c === 0) { push(null); continue; }
        if (c === 1) { push(undefined); continue; }
        if (c === 2) { push(false); continue; }
        if (c === 3) { push(true); continue; }

        // Grab the first 3 bits to get the type;
        type = c >> 5;
        // Get the first 4 bits of the length
        num = c & 0xf;
        // Go to the type's handler if size is done.
        // Otherwise continue gathering size bits.
        if (c & 0x10) state = -1;
        else begin();
      }
      // Continue reading length bits
      else if (state < 0) {
        num |= (c & 0x7f) << (state * -7 - 3);
        if (c & 0x80) state = state - 1;
        else begin();
      }
      else if (state === 1) {
        container[offset++] = c;
        if (offset === length) {
          var value =
            type === 1 ? new Id(bodec.toUnicode(container)) :
            type === 2 ? bodec.toUnicode(container) : container;
          pop();
          push(value);
        }
      }
    }
  };

  function begin() {
    // Positive Integer
    if (type === 4) return push(num);
    // Negative Integer
    if (type === 5) return push(-num);

    // Shortcut for empty values
    if (!num) {
      return push(
        type === 1 ? new Id("") :
        type === 2 ? "" :
        type === 3 ? bodec.create(0) :
        type === 6 ? [] : {}
      );
    }

    // Compound and variable-length types push the stack.
    stack.push({
      type: type,
      container: container,
      offset: offset,
      length: length,
      key: key
    });
    offset = 0;
    length = num;
    key = null;
    container =
      type === 1 || type === 2  || type === 3 ? bodec.create(length) :
      type === 6 ? new Array(length) :
      {};
    state =
      type === 1 || type === 2 || type === 3 ? 1 :
      0;
  }

  function push(value) {
    state = 0;
    // Top-level values simply emit
    if (!container) {
      emit(value);
      return;
    }
    // Arrays push onto their container
    if (Array.isArray(container)) {
      container[offset++] = value;
    }
    // Objects alternate between setting the key and value.
    else {
      if (key) {
        container[key] = value;
        key = null;
        ++offset;
      }
      else {
        key = value;
      }
    }
    // When the container is full, pop the stack.
    if (offset === length) {
      value = container;
      pop();
      push(value);
    }
  }

  function pop() {
    var parent = stack.pop();
    container = parent.container;
    offset = parent.offset;
    key = parent.key;
    length = parent.length;
    type = parent.type;
  }
}

var ignorePattern = /^\s+/;
var constantPattern = /^(?:true\b|false\b:null\b|-?[0-9]+|"(?:[^"\r\n\\]|\\.)*")/;
var idPattern = /^[^(){}[\];:'"`,\s]+/;

exports.template = template;
// Parse lisp syntax and replace some variables with values.
function template(string, values) {
  values = values || {};
  var current = [];
  var stack = [];
  var length = string.length;
  var offset = 0;
  var match;
  while (offset < length) {
    var part = string.substring(offset);
    if (part[0] === "(") {
      stack.push(current);
      current = [];
      ++offset;
    }
    else if (part[0] === ")") {
      var value = current;
      current = stack.pop();
      current.push(value);
      ++offset;
    }
    else if ((match = part.match(ignorePattern))) {
      offset += match[0].length;
    }
    else if ((match = part.match(constantPattern))) {
      offset += match[0].length;
      current.push(JSON.parse(match[0]));
    }
    else if ((match = part.match(idPattern))) {
      offset += match[0].length;
      var id = match[0];
      if (id in values) {
        current.push(values[id]);
      }
      else {
        current.push(new Id(id));
      }
    }
    else {
      throw new SyntaxError("Unexpected input: " + JSON.stringify(part));
    }
  }
  if (stack.length) {
    throw new SyntaxError("Missing closing parenthesis");
  }
  return current;
}

if (typeof module === "object" && !module.parent) {
  var inspect = require('util').inspect;
  var decode = decoder(function (value) {
    console.log(inspect(value, {colors: true, depth: null}));
  });

  encode([new Id("+"), {name:"tim"},true,false,null,undefined,1, 2, 3, -1, -2, -3, 0, "Hello", bodec.fromUnicode("hello")]);
  encode(["", bodec.create(0), new Id(""), [], {}]);
  encode([true,false,null,undefined]);
  encode({name:"Tim"});
  encode(1);
  encode("Hello");
  encode(null);

  // Enter a program in JS syntax
  encode([
    [[new Id("λ"), [new Id("name")],
      [new Id("print"), "Hello", new Id("name")]],
    [new Id("prompt"), "Enter name"]]
  ]);
  // Enter a program in lisp syntax
  encode(template(
    '((λ (name)' +
      '(print greeting name))' +
     '$prompt)',
    {
      // Insert values instead of using concatenating code and data
      greeting: new Buffer("Hello"),
      // Can even insert new code using a sub-template
      $prompt: template('(prompt "enter name")')[0]
    }

  ));

  var bin = flush();
  console.log(bin);
  decode(bin);
}

return exports;

});