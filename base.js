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

lambda.raw = true;
function lambda(ids) {

  if (!Array.isArray(ids)) throw new TypeError("First item must be list of ids");
  var names = new Array(ids.length);
  for (var i = 0, l = ids.length; i < l; ++i) {
    var name = isId(ids[i]);
    if (!name) throw new TypeError("Only ids allowed in lambda arguments list");
    names[i] = name;
  }
  var body = [].slice.call(arguments, 1);

  return λ;

  function* λ() {
    if (arguments.length !== names.length) {
      throw new Error("Argument length mismatch");
    }
    var scope = Object.create(this);
    for (var i = 0, l = names.length; i < l; ++i) {
      scope[names[i]] = arguments[i];
    }
    var ret;
    for (i = 0, l = body.length; i < l; ++i) {
      console.log(body[i])
      ret = yield* exec.call(scope, body[i]);
    }
    return ret;
  }

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

and.raw = true;
function* and() {
  var ret;
  for (var i = 0, l = arguments.length; i < l; ++i) {
    ret = yield* exec.call(this, arguments[i]);
    if (!ret) return ret;
  }
  return ret;
}

or.raw = true;
function* or() {
  var ret;
  for (var i = 0, l = arguments.length; i < l; ++i) {
    ret = yield* exec.call(this, arguments[i]);
    if (ret) return ret;
  }
  return ret;
}

unless.raw = true;
function* unless(cond) {
  if (yield* exec.call(this, cond)) return;
  var ret;
  for (var i = 1, l = arguments.length; i < l; ++i) {
    ret = yield* exec.call(this, arguments[i]);
  }
  return ret;
}

$if.raw = true;
function* $if(cond) {
  if (!(yield* exec.call(this, cond))) return;
  var ret;
  for (var i = 1, l = arguments.length; i < l; ++i) {
    ret = yield* exec.call(this, arguments[i]);
  }
  return ret;
}

function* tri(cond, yes, no) {
  if (tri.length !== 3) throw new TypeError("? must be used with 3 arguments");
  if (yield* exec.call(this, cond)) {
    return yield* exec.call(this, yes);
  }
  return yield* exec.call(this, no);
}


// This function opens up some wide security holes to programs that can run arbitrary lisp programs.
function scope() { return this; }

module.exports = {
  def: def,
  λ: lambda,
  and: and,
  or: or,
  unless: unless,
  if: $if,
  "?": tri,
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
    return sum|0;
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
