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
  return (this[name] = yield* execBlock.call(this, arguments, 1));
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
  return (base[name] = yield* execBlock.call(this, arguments, 1));
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
    return yield* execBlock.call(scope, body);
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
  return yield* execBlock.call(this, arguments, 1);
}

$if.raw = true;
function* $if(cond) {
  /*jshint validthis:true*/
  if (yield* exec.call(this, cond)) {
    return yield* execBlock.call(this, arguments, 1);
  }
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

$for.raw = true;
function* $for(inputs) {
  /*jshint validthis:true*/
  var iterator = yield* parallelLoop.call(this, inputs);
  return yield* forGeneric.call(this, iterator, arguments);
}

forStar.raw = true;
function* forStar(inputs) {
  /*jshint validthis:true*/
  var iterator = yield* nestedLoop.call(this, inputs);
  return yield* forGeneric.call(this, iterator, arguments);
}

map.raw = true;
function* map(inputs) {
  /*jshint validthis:true*/
  var iterator = yield* parallelLoop.call(this, inputs);
  return yield* mapGeneric.call(this, iterator, arguments);
}

mapStar.raw = true;
function* mapStar(inputs) {
  /*jshint validthis:true*/
  var iterator = yield* nestedLoop.call(this, inputs);
  return yield* mapGeneric.call(this, iterator, arguments);
}

function* forGeneric(iterator, args) {
  /*jshint validthis:true*/
  var scope, ret;
  while (yield* iterator.call(scope = Object.create(this))) {
    ret = yield* execBlock.call(scope, args, 1);
  }
  return ret;
}

function* mapGeneric(iterator, args) {
  /*jshint validthis:true*/
  var scope, result = [];
  while (yield* iterator.call(scope = Object.create(this))) {
    var ret = yield* execBlock.call(scope, args, 1);
    if (ret !== undefined) result.push(ret);
  }
  return result;
}

function* parallelLoop(inputs) {
  /*jshint validthis:true*/
  var pairs = [];
  for (var i = 0; i < inputs.length; i += 2) {
    var name = isId(inputs[i]);
    if (!name) throw new TypeError("loop heads require variable/iteratable pairs");
    var value = getIterable(yield* exec.call(this, inputs[i + 1]));
    pairs.push(name, value);
  }
  if (!pairs.length) return empty;
  if (pairs.length === 2) {
    return simpleIter(pairs[0], pairs[1]);
  }
  return parallelIter(pairs);
}

function* nestedLoop(inputs) {
  /*jshint validthis:true*/
  if (!inputs.length) return empty;
  var inner;
  for (var i = inputs.length - 2; i >= 0; i -= 2) {
    inner = inner ?
      (makeNested(inputs[i], inputs[i + 1], inner)) :
      (makeSimple(inputs[i], inputs[i + 1]));
  }
  return yield* inner();
}

function makeSimple(id, raw) {
  var name = isId(id);
  if (!name) throw new TypeError("loop heads require variable/iteratable pairs");
  return function* () {
    var fn = getIterable(yield* exec.call(this, raw));
    return simpleIter(name, fn);
  };
}

function makeNested(id, raw, makeInner) {
  var name = isId(id);
  if (!name) throw new TypeError("loop heads require variable/iteratable pairs");
  return function* () {
    /*jshint validthis:true*/
    var fn = getIterable(yield* exec.call(this, raw));
    var value, inner;
    return function* nested() {
      while (true) {
        if (value === undefined) {
          value = yield* getNext.call(this, fn);
          if (value === undefined) return false;
          inner = yield* makeInner.call(this);
        }
        if (!(yield* inner.call(this))) {
          value = undefined;
          inner = undefined;
          continue;
        }
        break;
      }
      this[name] = value;
      return true;
    };
  };
}

function* empty() {}

function parallelIter(pairs) {
  return function* parallel() {
    /*jshint validthis:true*/
    for (var i = 0; i < pairs.length; i += 2) {
      var fn = pairs[i + 1];
      var value = yield* getNext.call(this, fn);
      if (value === undefined) return false;
      this[pairs[i]] = value;
    }
    return true;
  };
}

function simpleIter(name, fn) {
  return function* simple() {
    var value = yield* getNext.call(this, fn);
    if (value === undefined) return false;
    this[name] = value;
    return true;
  };
}

function* getNext(fn) {
  /*jshint validthis:true*/
  if (fn.constructor === Function) {
    var value = fn.call(this);
    if (typeof value === "function" && value.constructor === Function) {
      return yield value;
    }
    return value;
  }
  return yield* fn.call(this);
}

function* execBlock(body, i) {
  i = i|0;
  /*jshint validthis:true*/
  var ret;
  for (var l = body.length; i < l; ++i) {
    ret = yield* exec.call(this, body[i]);
  }
  return ret;
}

function getIterable(item) {
  if (item|0 === item) return integerIterator(item);
  if (Array.isArray(item)) return arrayIterator(item);
  if (typeof item === "function") return item;
  throw new TypeError("Expected iterable value");
}

function integerIterator(num) {
  var i = 0;
  return function range() {
    if (i < num) return i++;
  };
}

function arrayIterator(array) {
  var i = 0;
  return function loop() {
    if (i < array.length) return array[i++];
  };
}


module.exports = {
  "for": $for,
  "for*": forStar,
  "map": map,
  "map*": mapStar,
  "while": $while,
  "clear": function clear() {
    var keys = Object.keys(this);
    for (var i = 0, l = keys.length; i < l; ++i) {
      delete this[keys[i]];
    }
  },
  "scope": function scope() { return this; },
  "def": def,
  "set": set,
  "λ": lambda,
  "lambda": lambda,
  "and": and,
  "or": or,
  "unless": unless,
  "if": $if,
  "?": tri,
  "print": print,
  "list": list,
  "object": object,
  "+": function plus() {
    if (!arguments.length) throw new TypeError("+ needs at least one argument");
    var sum = arguments[0];
    for (var i = 1, l = arguments.length; i < l; ++i) {
      sum += arguments[i];
    }
    return sum;
  },
  "-": function minus() {
    if (!arguments.length) throw new TypeError("- needs at least one argument");
    var sum = arguments[0];
    for (var i = 1, l = arguments.length; i < l; ++i) {
      sum -= arguments[i];
    }
    return sum;
  },
  "÷": function divide() {
    if (!arguments.length) throw new TypeError("/ needs at least one argument");
    var sum = arguments[0];
    for (var i = 1, l = arguments.length; i < l; ++i) {
      sum /= arguments[i];
    }
    return sum|0;
  },
  "×": function times() {
    if (!arguments.length) throw new TypeError("* needs at least one argument");
    var sum = arguments[0];
    for (var i = 1, l = arguments.length; i < l; ++i) {
      sum *= arguments[i];
    }
    return sum;
  },
  "%": function modulus() {
    if (!arguments.length) throw new TypeError("% needs at least one argument");
    var sum = arguments[0];
    for (var i = 1, l = arguments.length; i < l; ++i) {
      sum %= arguments[i];
    }
    return sum;
  },
  "<": function lt() {
    var a = arguments[0];
    for (var i = 1, l = arguments.length; i < l; ++i) {
      var b = arguments[i];
      if (a >= b) return false;
      a = b;
    }
    return true;
  },
  "≤": function lte() {
    var a = arguments[0];
    for (var i = 1, l = arguments.length; i < l; ++i) {
      var b = arguments[i];
      if (a > b) return false;
      a = b;
    }
    return true;
  },
  ">": function gt() {
    var a = arguments[0];
    for (var i = 1, l = arguments.length; i < l; ++i) {
      var b = arguments[i];
      if (a <= b) return false;
      a = b;
    }
    return true;
  },
  "≥": function gte() {
    var a = arguments[0];
    for (var i = 1, l = arguments.length; i < l; ++i) {
      var b = arguments[i];
      if (a < b) return false;
      a = b;
    }
    return true;
  },
  "≠": function neq() {
    var a = arguments[0];
    for (var i = 1, l = arguments.length; i < l; ++i) {
      var b = arguments[i];
      if (a === b) return false;
      a = b;
    }
  },
  "=": function eq() {
    var a = arguments[0];
    for (var i = 1, l = arguments.length; i < l; ++i) {
      var b = arguments[i];
      if (a !== b) return false;
      a = b;
    }
  },
};
module.exports["*"] = module.exports["×"];
module.exports["/"] = module.exports["÷"];
module.exports["!="] = module.exports["≠"];
module.exports["<="] = module.exports["≤"];
module.exports[">="] = module.exports["≥"];
