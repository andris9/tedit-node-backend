module.exports = function (callback) {
  var ws = new WebSocket('ws://localhost:1337/', ['tedit-remote']);
  ws.binaryType = "arraybuffer";

  ws.onerror = function () {
    ws.onopen = null;
    callback(new Error("websocket connection failed"));
  };

  ws.onopen = function () {
    ws.onerror = onError;
    ws.onmessage = onMessage;
    ws.onclose = onClose;
    callback(null, {

    });
  };

  function onError(error) {
    console.log('WebSocket Error ' + error);
  };

  function onMessage(evt) {
    if (typeof evt.data === "string") {
      console.log('Server: ' + evt.data);
    }
    else {
      decode(new Uint8Array(evt.data));
    }
  };

  function onClose() {
  };

};
