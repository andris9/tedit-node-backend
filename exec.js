"use strict";

var isId = require('./bincodec').isId;
module.exports = exec;
// A little lisp style evaluater
function* exec(command) {
  /*jshint validthis:true*/
  var id;
  if ((id = isId(command))) {
    return getVar(this, id);
  }
  // Normal values pass through untouched.
  if (!Array.isArray(command)) return command;
  var fn = yield* exec.call(this, command[0]);
  if (typeof fn === "object") fn = accessor(fn);
  if (typeof fn !== "function") {
    throw new TypeError("First item must be function");
  }
  var args = command.slice(1);
  // Evaluate arguments for non-raw functions
  if (!fn.raw) {
    for (var i = 0, l = args.length; i < l; ++i) {
      var arg = args[i];
      if ((id = isId(arg))) {
        args[i] = getVar(this, id);
      }
      else if (Array.isArray(args[i])) {
        args[i] = yield* exec.call(this, arg);
      }
    }
  }
  if (fn.constructor === Function) {
    var result = fn.apply(this, args);
    if (typeof result === "function" && result.constructor === Function) {
      return yield result;
    }
    return result;
  }
  return yield* fn.apply(this, args);
}

function getVar(root, id) {
  var value = root;
  var parent = null;
  var parts = id.split(".");
  for (var i = 0, l = parts.length; i < l; ++i) {
    var part = parts[i];
    if (!(part in value)) {
      console.error(value, part);
      if (i) {
        throw new Error("No such property: " + part);
      }
      throw new Error("No such variable: " + part);
    }
    parent = value;
    value = value[part];
  }
  if (typeof value === "function" && parent !== root) {
    var isRaw = value.raw;
    value = value.bind(parent);
    if (isRaw) value.raw = true;
  }
  return value;
}


function accessor(obj) {
  return function (key, value) {
    if (arguments.length === 1) {
      return obj[key];
    }
    if (arguments.length === 2) {
      return (obj[key] = value);
    }
    throw new Error("maps and lists must be called with one or two arguments when used as functions.");
  };
}