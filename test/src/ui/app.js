require("codemirror/mode/javascript/javascript");
require('cm-jackl-mode');

var CodeMirrorEditor = require('./code-mirror-editor');
var CodeMirrorViewer = require('./code-mirror-viewer');

var rpc = require('rpc');
var wrapWebSocket = require('culvert/wrap-web-socket');
var template = require('bincodec').template;
var run = require('gen-run');

module.exports = App;

function App(emit, refresh) {

  var code = localStorage.getItem("code") || "";
  var mode = "jackl";
  var connected = false;
  var isDark = !!localStorage.getItem("isDark");
  var isVertical = !!localStorage.getItem("isVertical");
  var call;
  var timeout = 100;
  connect();

  function connect() {
    var ws = new WebSocket('ws://localhost:1337/', ['tedit-remote']);
    ws.binaryType = "arraybuffer";
    ws.onopen = function () {
      connected = true;
      timeout = 100;
      call = rpc(wrapWebSocket(ws), api);
      refresh();
    };

    ws.onerror = function () {
      console.log("Connection failed, trying again in %sms", timeout);
      connected = false;
      timeout = timeout * 2;
      refresh();
      setTimeout(connect, timeout);
    };
  }

  var api;
  var output = "";
  var outputMode = "text";

  return {
    render: render,
    on: {change: onChangeCode},
  };

  function render(newApi) {
    api = newApi;

    return [
      [".toolbar",
        ["label",
          ["input", {type:"checkbox", checked: isDark, onchange: onChangeDark}],
          "Dark Theme"
        ],
        ["label",
          ["input", {type:"checkbox", checked: isVertical, onchange: onChangeVertical}],
          "Vertical Layout"
        ],
        connected ?
          ["button", {onclick: onClickRun}, "Run Remote Command"] :
          ["span", "Connecting to remote backend..."],
      ],
      [isVertical ? ".top" : ".left",
        [CodeMirrorEditor, {
          isDark: isDark,
          id: true,
          code: code,
          mode: mode
        }]
      ],
      [isVertical ? ".bottom" : ".right",
        [CodeMirrorViewer, {
          isDark: isDark,
          lineWrapping: true,
          code: output,
          mode: outputMode
        }]
      ]
    ];
  }

  function onChangeDark() {
    /*jshint validthis: true*/
    isDark = this.checked;
    localStorage.setItem("isDark", isDark ? "true" : "");
    refresh();
  }

  function onChangeVertical() {
    /*jshint validthis:true*/
    isVertical = this.checked;
    localStorage.setItem("isVertical", isVertical ? "true" : "");
    refresh();
  }

  function onClickRun() {
    run(function* () {
      var command = template(code);
      return yield* call(command);
    }, function (err, result) {
      if (err) {
        output = err.toString();
        outputMode = "text";
        refresh();
      }
      else {
        output = JSON.stringify(result, null, 2);
        outputMode = "javascript";
        refresh();
      }
    });
  }

  function onChangeCode(newCode) {
    if (newCode === code) return;
    code = newCode;
    localStorage.setItem("code", code);
  }
}
