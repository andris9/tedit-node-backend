// Load our UI related libraries
var domChanger = require('domchanger');
var App = require('./ui/app');
document.body.textContent = "";
domChanger(App, document.body).update({
  add: function (a, b) {
    return a + b;
  }
});
