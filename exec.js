"use strict";

var isId = require('./bincodec').isId;
module.exports = exec;
// A little lisp style evaluater
function* exec(command) {
  /*jshint validthis:true*/
  if (!Array.isArray(command)) {
    throw new TypeError("Commands must be arrays");
  }
  var fn = command[0];
  // Assume the first is a symbol if it's a string
  var id;
  if ((id = isId(fn))) {
    fn = this[id];
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
    // TODO: maybe evaluate these in parallel?
    for (var i = 0, l = args.length; i < l; ++i) {
      if ((id = isId(fn))) {
        args[i] = this[id];
      }
      else if (Array.isArray(args[i])) {
        args[i] = yield* exec.call(this, args[i]);
      }
    }
  }
  if (fn.constructor === Function) {
    var result = fn.apply(this, args);
    if (typeof result === "function") {
      return yield result;
    }
    return result;
  }
  return yield* fn.apply(this, args);
}
