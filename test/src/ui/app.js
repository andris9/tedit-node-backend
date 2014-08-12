require("codemirror/mode/javascript/javascript");
require('cm-jackl-mode');

var CodeMirrorEditor = require('./code-mirror-editor');
var CodeMirrorViewer = require('./code-mirror-viewer');

var rpc = require('rpc');
var wrapWebSocket = require('../wrap-web-socket');
var template = require('bincodec').template;

module.exports = App;

function App(emit, refresh) {

  var code = localStorage.getItem("command") || "";
  var readOnly = false;
  var mode = "jackl";
  var isDark = !!localStorage.getItem("isDark");
  var isVertical = !!localStorage.getItem("isVertical");

  var ws = new WebSocket('ws://localhost:1337/', ['tedit-remote']);
  ws.binaryType = "arraybuffer";
  var call = rpc(wrapWebSocket(ws), {});

  return {
    render: render,
    on: {change: onChangeCode},
  };

  function render() {
    var output = "";
    var outputMode = "text";

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
        ["button", {onclick: onClickRun}, "Run Remote Command"],
      ],
      [isVertical ? ".top" : ".left",
        [CodeMirrorEditor, {
          isDark: isDark,
          id: true,
          code: code,
          readOnly: readOnly,
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
      var result =
    })

  }

  function onChangeCode(newCode) {
    if (newCode === code) return;
    code = newCode;
    localStorage.setItem("command", code);
    refresh();
  }

}

function* sleep(ms) {
  yield function (callback) {
    setTimeout(callback, ms);
  };
}

function stringify(value) {
  return JSON.stringify(value);
}
