#!js

var cjsBundler = require('../node_modules/wheaty-cjs-bundler/bundler.js');
module.exports = cjsBundler("test/src/main.js", ["", "node_modules"]);
