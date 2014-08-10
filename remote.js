var template = require('./bincodec').template;
var exec = require('./exec');
var inspect = require('util').inspect;

function log() {
  console.log([].slice.call(arguments).map(function (item) {
    return inspect(item, {colors:true,depth:null});
  }).join(" "));
}

var apis = {
  list: function () {
    return [].slice.call(arguments)
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
  }
};

require('gen-run')(function* () {
  var command = template('(add 1 2)')[0];
  log({command: command});
  log({result: yield* exec.call(apis, command)});
  command = template('(slowAdd 1 2)')[0];
  log({command: command});
  log({result: yield* exec.call(apis, command)});
  command = template('(slowerAdd 1 2)')[0];
  log({command: command});
  log({result: yield* exec.call(apis, command)});
  command = template('(list (slowerAdd 1 2) (slowAdd 3 4) (add 5 6))')[0];
  log({command: command});
  log({result: yield* exec.call(apis, command)});
  command = template('(map "slower" (slowerAdd 1 2) "slow" (slowAdd 3 4) "add" (add 5 6))')[0];
  log({command: command});
  log({result: yield* exec.call(apis, command)});
});
