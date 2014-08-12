var isId = require('./bincodec').isId;
var exec = require('./exec');
var inspect = require('util').inspect;

def.raw = true;
function* def(id) {
  var name = isId(id);
  if (!name) throw new TypeError("First argument to def must be id");
  if (this.hasOwnProperty(name)) {
    throw new Error("Can't redefine existing local variable: " + name);
  }
  var body = [].slice.call(arguments, 1);
  var ret = null;
  for (var i = 0, l = body.length; i < l; ++i) {
    ret = yield* exec.call(this, body[i]);
  }
  this[name] = ret;
  return ret;
}

function print() {
  console.log([].slice.call(arguments).map(function (item) {
    return inspect(item, {colors:true,depth:null});
  }).join(" "));
}

function list() {
  return [].slice.call(arguments);
}

function object() {
  var obj = {};
  for (var i = 0, l = arguments.length; i < l; i += 2) {
    obj[arguments[i]] = arguments[i + 1];
  }
  return obj;
}

// This function opens up some wide security holes to programs that can run arbitrary lisp programs.
function scope() { return this; }

module.exports = {
  def: def,
  print: print,
  list: list,
  object: object,
  scope: scope,
  "+": function () {
    if (!arguments.length) throw new TypeError("+ needs at least one argument");
    var sum = arguments[0];
    for (var i = 1, l = arguments.length; i < l; ++i) {
      sum += arguments[i];
    }
    return sum;
  },
  "-": function () {
    if (!arguments.length) throw new TypeError("- needs at least one argument");
    var sum = arguments[0];
    for (var i = 1, l = arguments.length; i < l; ++i) {
      sum -= arguments[i];
    }
    return sum;
  },
  "/": function () {
    if (!arguments.length) throw new TypeError("/ needs at least one argument");
    var sum = arguments[0];
    for (var i = 1, l = arguments.length; i < l; ++i) {
      sum /= arguments[i];
    }
    return sum;
  },
  "*": function () {
    if (!arguments.length) throw new TypeError("* needs at least one argument");
    var sum = arguments[0];
    for (var i = 1, l = arguments.length; i < l; ++i) {
      sum *= arguments[i];
    }
    return sum;
  },
  "%": function () {
    if (!arguments.length) throw new TypeError("% needs at least one argument");
    var sum = arguments[0];
    for (var i = 1, l = arguments.length; i < l; ++i) {
      sum %= arguments[i];
    }
    return sum;
  },
};
