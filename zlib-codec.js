var bodec = require('bodec');
var ZStream = require('pako/lib/zlib/zstream.js');
var zlib_deflate = require('pako/lib/zlib/deflate.js');
var zlib_inflate = require('pako/lib/zlib/inflate.js');
var messages = require('pako/lib/zlib/messages.js');
var Z_NO_FLUSH      = 0;
var Z_SYNC_FLUSH    = 2;
var Z_FINISH        = 4;
var Z_OK            = 0;
var Z_STREAM_END    = 1;
var Z_DEFAULT_COMPRESSION = -1;
var Z_DEFAULT_STRATEGY    = 0;
var Z_DEFLATED  = 8;

var level = Z_DEFAULT_COMPRESSION;
var method = Z_DEFLATED;
var chunkSize = 16384;
var windowBits = 15;
var memLevel = 8;
var strategy = Z_DEFAULT_STRATEGY;

module.exports = {
  deflater: deflater,
  inflater: inflater,
};

function deflater(emit) {
  var stream = new ZStream();
  var start;
  stream.avail_out = 0;
  var status = zlib_deflate.deflateInit2(stream, level, method, windowBits, memLevel, strategy);
  if (status !== Z_OK) {
    throw new Error("Problem initializing deflate stream: " + messages[status]);
  }

  return function (data) {
    if (data === undefined) return emit();
    // UTF8 encode strings
    if (typeof data === "string") {
      data = bodec.fromUnicode(data);
    }
    // When bodec's native binary type isn't typed array, we need to convert it
    // This happens in node.js where it's Buffer.
    if (bodec.Binary !== Uint8Array) {
      data = new Uint8Array(data);
    }

    // Attach the input data
    stream.input = data;
    stream.next_in = 0;
    stream.avail_in = stream.input.length;

    var status, output;
    var ret = true;

    do {
      // When the stream gets full, we need to create new space.
      if (stream.avail_out === 0) {
        stream.output = new Uint8Array(chunkSize);
        start = stream.next_out = 0;
        stream.avail_out = chunkSize;
      }

      // Perform the deflate
      status = zlib_deflate.deflate(stream, Z_SYNC_FLUSH);
      if (status !== Z_STREAM_END && status !== Z_OK) {
        throw new Error("Deflate problem: " + messages[status]);
      }

      // If the output buffer got full, flush the data.
      if (stream.avail_out === 0 && stream.next_out > start) {
        output = stream.output.subarray(start, start = stream.next_out);
        if (bodec.Binary !== Uint8Array) output = new bodec.Binary(output);
        ret = emit(output);
      }
    } while ((stream.avail_in > 0 || stream.avail_out === 0) && status !== Z_STREAM_END);

    // Emit whatever is left in output.
    if (stream.next_out > start) {
      output = stream.output.subarray(start, start = stream.next_out);
      if (bodec.Binary !== Uint8Array) output = new bodec.Binary(output);
      ret = emit(output);
    }
    return ret;
  };
}

function inflater(emit) {
  var stream = new ZStream();
  var start;
  stream.avail_out = 0;

  var status = zlib_inflate.inflateInit2(stream, windowBits);
  if (status !== Z_OK) {
    throw new Error("Problem initializing inflate stream: " + messages[status]);
  }

  return function (data) {
    if (data === undefined) return emit();

    stream.input = data;
    stream.next_in = 0;
    stream.avail_in = stream.input.length;

    var status, output;
    var ret = true;

    do {
      if (stream.avail_out === 0) {
        stream.output = new Uint8Array(chunkSize);
        start = stream.next_out = 0;
        stream.avail_out = chunkSize;
      }

      status = zlib_inflate.inflate(stream, Z_NO_FLUSH);
      if (status !== Z_STREAM_END && status !== Z_OK) {
        throw new Error("inflate problem: " + messages[status]);
      }

      if (stream.next_out) {
        if (stream.avail_out === 0 || status === Z_STREAM_END) {
          output = stream.output.subarray(start, start = stream.next_out);
          if (bodec.Binary !== Uint8Array) output = new bodec.Binary(output);
          ret = emit(output);
        }
      }
    } while ((stream.avail_in > 0) && status !== Z_STREAM_END);

    if (stream.next_out > start) {
      output = stream.output.subarray(start, start = stream.next_out);
      if (bodec.Binary !== Uint8Array) output = new bodec.Binary(output);
      ret = emit(output);
    }

    return ret;
  };
}

if (module.parent === null) {

  var inflate = inflater(function (chunk) {
    console.log("I ", chunk && chunk.length);
  });

  var deflate = deflater(function (chunk) {
    console.log(" D", chunk && chunk.length);
    inflate(chunk);
  });

  var inspect = require('util').inspect;

  deflate(inspect(process, {color:true,depth:null}));
  deflate(inspect(process, {depth:null}));
  deflate(inspect(process));
  deflate(inspect(process, {colors:true}));
  deflate();
}