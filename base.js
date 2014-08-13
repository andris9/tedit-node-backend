"use strict";

var isId = require('./bincodec').isId;
var exec = require('./exec');
var inspect = require('util').inspect;

def.raw = true;
function* def(id) {
  /*jshint validthis:true*/
  // Syntax sugar for easy function defs
  if (Array.isArray(id)) {
    return yield* exec.call(this,
      [def, id[0], [lambda, id.slice(1)].concat([].slice.call(arguments, 1))]
    );
  }
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

set.raw = true;
function* set(id) {
  /*jshint validthis:true*/
  // Syntax sugar for easy function sets
  if (Array.isArray(id)) {
    return yield* exec.call(this,
      [set, id[0], [lambda, id.slice(1)].concat([].slice.call(arguments, 1))]
    );
  }
  var name = isId(id);
  if (!name) throw new TypeError("First argument to set must be id");
  var base = this;
  while (base && !base.hasOwnProperty(name)) {
    base = Object.getPrototypeOf(base);
  }
  if (!base) throw new Error("No such variable: " + name);
  var body = [].slice.call(arguments, 1);
  var ret = null;
  for (var i = 0, l = body.length; i < l; ++i) {
    ret = yield* exec.call(this, body[i]);
  }
  base[name] = ret;
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
    /*jshint validthis:true*/
    if (arguments.length !== names.length) {
      throw new Error("Argument length mismatch");
    }
    var scope = Object.create(this);
    for (var i = 0, l = names.length; i < l; ++i) {
      scope[names[i]] = arguments[i];
    }
    var ret;
    for (i = 0, l = body.length; i < l; ++i) {
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
  /*jshint validthis:true*/
  var ret;
  for (var i = 0, l = arguments.length; i < l; ++i) {
    ret = yield* exec.call(this, arguments[i]);
    if (!ret) return ret;
  }
  return ret;
}

or.raw = true;
function* or() {
  /*jshint validthis:true*/
  var ret;
  for (var i = 0, l = arguments.length; i < l; ++i) {
    ret = yield* exec.call(this, arguments[i]);
    if (ret) return ret;
  }
  return ret;
}

unless.raw = true;
function* unless(cond) {
  /*jshint validthis:true*/
  if (yield* exec.call(this, cond)) return;
  var ret;
  for (var i = 1, l = arguments.length; i < l; ++i) {
    ret = yield* exec.call(this, arguments[i]);
  }
  return ret;
}

$if.raw = true;
function* $if(cond) {
  /*jshint validthis:true*/
  if (!(yield* exec.call(this, cond))) return;
  var ret;
  for (var i = 1, l = arguments.length; i < l; ++i) {
    ret = yield* exec.call(this, arguments[i]);
  }
  return ret;
}

function* tri(cond, yes, no) {
  /*jshint validthis:true*/
  if (tri.length !== 3) throw new TypeError("? must be used with 3 arguments");
  if (yield* exec.call(this, cond)) {
    return yield* exec.call(this, yes);
  }
  return yield* exec.call(this, no);
}

$while.raw = true;
function* $while(cond) {
  var scope = Object.create(this);
  var ret;
  var length = arguments.length;
  while (yield* exec.call(scope, cond)) {
    for (var i = 1; i < length; ++i) {
      ret = yield* exec.call(scope, arguments[i]);
    }
  }
  return ret;
}

function* $for() {

}

function* map() {

}

module.exports = {
  for: $for,
  map: map,
  while: $while,
  clear: function () {
    var keys = Object.keys(this);
    for (var i = 0, l = keys.length; i < l; ++i) {
      delete this[keys[i]];
    }
  },
  scope: function () { return this; },
  def: def,
  set: set,
  λ: lambda,
  lambda: lambda,
  and: and,
  or: or,
  unless: unless,
  if: $if,
  "?": tri,
  print: print,
  list: list,
  object: object,
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
  "<": function () {
    var a = arguments[0];
    for (var i = 1, l = arguments.length; i < l; ++i) {
      var b = arguments[i];
      if (a >= b) return false;
      a = b;
    }
    return true;
  },
  "≤": function () {
    var a = arguments[0];
    for (var i = 1, l = arguments.length; i < l; ++i) {
      var b = arguments[i];
      if (a > b) return false;
      a = b;
    }
    return true;
  },
  ">": function () {
    var a = arguments[0];
    for (var i = 1, l = arguments.length; i < l; ++i) {
      var b = arguments[i];
      if (a <= b) return false;
      a = b;
    }
    return true;
  },
  "≥": function () {
    var a = arguments[0];
    for (var i = 1, l = arguments.length; i < l; ++i) {
      var b = arguments[i];
      if (a < b) return false;
      a = b;
    }
    return true;
  },
  "≠": function () {
    var a = arguments[0];
    for (var i = 1, l = arguments.length; i < l; ++i) {
      var b = arguments[i];
      if (a === b) return false;
      a = b;
    }
  },
  "=": function () {
    var a = arguments[0];
    for (var i = 1, l = arguments.length; i < l; ++i) {
      var b = arguments[i];
      if (a !== b) return false;
      a = b;
    }
  },
};
module.exports["!="] = module.exports["≠"];
module.exports["<="] = module.exports["≤"];
module.exports[">="] = module.exports["≥"];
