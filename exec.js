"use strict";

// TODO: Implement dot access
// TODO: Implement def and other lisp builtins userspace

var isId = require('./bincodec').isId;
var run = require('gen-run');
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
    var tasks = [];
    var api = this;
    args.forEach(function (arg, i) {
      if ((id = isId(arg))) {
        args[i] = this[id];
      }
      else if (Array.isArray(args[i])) {
        tasks.push(function (callback) {
          run(exec.call(api, arg), function (err, result) {
            if (err) return callback(err);
            args[i] = result;
            callback();
          });
        });
      }
    });
    // If there are async tasks, run them in parallel
    if (tasks.length) yield tasks;
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
