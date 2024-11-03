"ui";


/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 628:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

/*
 * @Author: BATU1579
 * @CreateDate: 2022-02-04 21:03:08
 * @LastEditor: BATU1579
 * @LastTime: 2023-08-07 08:06:32
 * @FilePath: \\src\\global.ts
 * @Description: 全局常量和配置项验证
 */

Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.SHOW_CONSOLE = exports.EVENT = exports.LONG_WAIT_MS = exports.SHORT_WAIT_MS = exports.LISTENER_INTERVAL = exports.VERSION = exports.PROJECT_NAME = void 0;

var exception_1 = __webpack_require__(564);

var logger_1 = __webpack_require__(437);

exports.PROJECT_NAME = "Untitled Script";
/**
 * @description: 脚本版本号。建议根据 [语义化版本号] 迭代
 */

exports.VERSION = "0.1.0";
exports.LISTENER_INTERVAL = 100;
exports.SHORT_WAIT_MS = 300;
exports.LONG_WAIT_MS = 1000;
exports.EVENT = events.emitter();
logger_1.Record.info("Launching...\n\n\tCurrent script version: ".concat(exports.VERSION, "\n")); // ---------------------- configuration -------------------------

var _a = hamibot.env,
    _TOKEN = _a._TOKEN,
    _SHOW_CONSOLE = _a._SHOW_CONSOLE; // -------------------- register listener -----------------------
// register exit listener

events.on("exit", function () {
  threads.shutDownAll();
  logger_1.Record.info("Exit..."); // send to pushplus

  var collection = logger_1.LOG_STACK.filter(function (frame) {
    return frame.getLevel() >= logger_1.LogLevel.Log;
  });

  if (_TOKEN && _TOKEN !== "") {
    logger_1.Record.info("Sending logs to pushplus...");

    for (var i = 0; i < 3; i++) {
      if ((0, logger_1.sendLog)(collection, "[LOG] ".concat(exports.PROJECT_NAME))) {
        logger_1.Record.info("Sending logs succeeds");
        return;
      }

      logger_1.Record.warn("Sending failed, retry ".concat(i + 1));
    }

    logger_1.Record.error("Failure to send logs !");
  } // send to hamibot


  for (var _i = 0, _a = collection.toStringArray(); _i < _a.length; _i++) {
    var item = _a[_i];
    hamibot.postMessage(item);
  }

  sleep(exports.LONG_WAIT_MS * 5);
  console.hide();
}); // ------------------------ validation --------------------------

logger_1.Record.info("Verifying configurations"); // pushplus token

if (_TOKEN && _TOKEN !== "" && (0, logger_1.setToken)(_TOKEN) == false) {
  throw new exception_1.ConfigInvalidException("pushplus token", "needs to be a 32-bit hexadecimal number");
} // show console


if (typeof _SHOW_CONSOLE !== "boolean") {
  throw new exception_1.ConfigInvalidException("show console");
}

exports.SHOW_CONSOLE = _SHOW_CONSOLE;
logger_1.Record.info("Start running script");

/***/ }),

/***/ 564:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";


var __extends = this && this.__extends || function () {
  var _extendStatics = function extendStatics(d, b) {
    _extendStatics = Object.setPrototypeOf || {
      __proto__: []
    } instanceof Array && function (d, b) {
      d.__proto__ = b;
    } || function (d, b) {
      for (var p in b) {
        if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p];
      }
    };

    return _extendStatics(d, b);
  };

  return function (d, b) {
    if (typeof b !== "function" && b !== null) throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");

    _extendStatics(d, b);

    function __() {
      this.constructor = d;
    }

    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
  };
}();

Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.isConfigInvalidException = exports.ConfigInvalidException = exports.isWidgetNotFoundException = exports.WidgetNotFoundException = exports.isValueException = exports.ValueException = exports.isServiceNotEnabled = exports.ServiceNotEnabled = exports.isPermissionException = exports.PermissionException = exports.isBaseException = exports.BaseException = void 0;
/*
 * @Author: BATU1579
 * @CreateDate: 2022-02-04 16:09:50
 * @LastEditor: BATU1579
 * @LastTime: 2023-03-28 19:08:12
 * @FilePath: \\src\\lib\\exception.ts
 * @Description: 全局异常类
 */

var logger_1 = __webpack_require__(437);

var ERROR_EVENTS = events.emitter();
ERROR_EVENTS.on("error", function errorListener(err) {
  // 防止重复输出异常信息
  logger_1.Record.customLog(logger_1.LoggerSchemes.error, {
    needPrint: false,
    needRecord: true,
    skipCallerNumber: 2
  }, err.toString());
});

var BaseException =
/** @class */
function (_super) {
  __extends(BaseException, _super);

  function BaseException(message) {
    var _this = _super.call(this) || this;

    _this.exceptionType = 'BaseException';
    _this.traceFilter = undefined;
    _this.traceFormatter = undefined;
    _this.message = message;
    var trace = (0, logger_1.getStackTrace)();

    if (_this.traceFilter) {
      trace = trace.filter(_this.traceFilter);
    }

    _this.traceBack = trace.toString(_this.traceFormatter);
    ERROR_EVENTS.emit("error", _this);
    return _this;
  }

  BaseException.prototype.toString = function () {
    return "Traceback (most recent call last):\n" + this.traceBack + "\n" + this.exceptionType + (this.message ? ": " + this.message : "") + "\n";
  };

  return BaseException;
}(Error);

exports.BaseException = BaseException;

function __isExceptionType(error, targetException) {
  var exceptionType = Object.getOwnPropertyDescriptor(error, "exceptionType");

  if (exceptionType === undefined) {
    return false;
  }

  return exceptionType.value === targetException;
}

function isBaseException(error) {
  return __isExceptionType(error, "BaseException");
}

exports.isBaseException = isBaseException;

var PermissionException =
/** @class */
function (_super) {
  __extends(PermissionException, _super);

  function PermissionException() {
    var _this = _super !== null && _super.apply(this, arguments) || this;

    _this.exceptionType = "PermissionException";
    return _this;
  }

  return PermissionException;
}(BaseException);

exports.PermissionException = PermissionException;

function isPermissionException(error) {
  return __isExceptionType(error, 'PermissionException');
}

exports.isPermissionException = isPermissionException;

var ServiceNotEnabled =
/** @class */
function (_super) {
  __extends(ServiceNotEnabled, _super);

  function ServiceNotEnabled() {
    var _this = _super !== null && _super.apply(this, arguments) || this;

    _this.exceptionType = "ServiceNotEnabled";
    return _this;
  }

  return ServiceNotEnabled;
}(BaseException);

exports.ServiceNotEnabled = ServiceNotEnabled;

function isServiceNotEnabled(error) {
  return __isExceptionType(error, 'ServiceNotEnabled');
}

exports.isServiceNotEnabled = isServiceNotEnabled;

var ValueException =
/** @class */
function (_super) {
  __extends(ValueException, _super);

  function ValueException() {
    var _this = _super !== null && _super.apply(this, arguments) || this;

    _this.exceptionType = "ValueException";
    return _this;
  }

  return ValueException;
}(BaseException);

exports.ValueException = ValueException;

function isValueException(error) {
  return __isExceptionType(error, 'ValueException');
}

exports.isValueException = isValueException;

var WidgetNotFoundException =
/** @class */
function (_super) {
  __extends(WidgetNotFoundException, _super);

  function WidgetNotFoundException() {
    var _this = _super !== null && _super.apply(this, arguments) || this;

    _this.exceptionType = "WidgetNotFoundException";
    return _this;
  }

  return WidgetNotFoundException;
}(BaseException);

exports.WidgetNotFoundException = WidgetNotFoundException;

function isWidgetNotFoundException(error) {
  return __isExceptionType(error, 'WidgetNotFoundException');
}

exports.isWidgetNotFoundException = isWidgetNotFoundException;

var ConfigInvalidException =
/** @class */
function (_super) {
  __extends(ConfigInvalidException, _super);

  function ConfigInvalidException(fieldName, helpInfo) {
    var _this = _super.call(this, "The '".concat(fieldName, "' field in the configuration is invalid").concat(", " + helpInfo, ". ") + "please check it again !") || this;

    _this.exceptionType = "ConfigInvalidException";
    return _this;
  }

  return ConfigInvalidException;
}(ValueException);

exports.ConfigInvalidException = ConfigInvalidException;

function isConfigInvalidException(error) {
  return __isExceptionType(error, 'ConfigInvalidException');
}

exports.isConfigInvalidException = isConfigInvalidException;

/***/ }),

/***/ 103:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.init = void 0;
/*
 * @Author: BATU1579
 * @CreateDate: 2022-02-04 20:58:39
 * @LastEditor: BATU1579
 * @LastTime: 2023-08-07 08:06:24
 * @FilePath: \\src\\lib\\init.ts
 * @Description: 脚本初始化
 */

var logger_1 = __webpack_require__(437);

var global_1 = __webpack_require__(628);

var exception_1 = __webpack_require__(564);

function init() {
  // check accessibility permission
  if (auto.service === null) {
    if (!confirm('Please enable accessibility permission')) {
      throw new exception_1.PermissionException("Accessibility permission obtaining failure.");
    }

    auto.waitFor();
  } else {
    logger_1.Record.verbose("Accessibility permissions enabled");
  } // check is service alive


  if (device.height === 0 || device.width === 0) {
    throw new exception_1.ServiceNotEnabled('Failed to get the screen size. ' + 'Please try restarting the service or re-installing Hamibot');
  } else {
    logger_1.Record.debug("Screen size: " + device.height + " x " + device.width);
  } // show console


  if (global_1.SHOW_CONSOLE) {
    console.show();
    sleep(global_1.SHORT_WAIT_MS);
    console.setPosition(0, 100);
    console.setSize(device.width, device.height / 4);
  }

  setScreenMetrics(1080, 2400);
}

exports.init = init;

/***/ }),

/***/ 437:
/***/ (function(__unused_webpack_module, exports) {

"use strict";


var __extends = this && this.__extends || function () {
  var _extendStatics = function extendStatics(d, b) {
    _extendStatics = Object.setPrototypeOf || {
      __proto__: []
    } instanceof Array && function (d, b) {
      d.__proto__ = b;
    } || function (d, b) {
      for (var p in b) {
        if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p];
      }
    };

    return _extendStatics(d, b);
  };

  return function (d, b) {
    if (typeof b !== "function" && b !== null) throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");

    _extendStatics(d, b);

    function __() {
      this.constructor = d;
    }

    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
  };
}();

var __spreadArray = this && this.__spreadArray || function (to, from, pack) {
  if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
    if (ar || !(i in from)) {
      if (!ar) ar = Array.prototype.slice.call(from, 0, i);
      ar[i] = from[i];
    }
  }
  return to.concat(ar || Array.prototype.slice.call(from));
};

Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.sendLog = exports.sendMessage = exports.setToken = exports.Record = exports.getStackTrace = exports.getRawStackTrace = exports.getCallerName = exports.LOG_STACK = exports.LoggerSchemes = exports.LogLevel = void 0;
/*
 * @Author: BATU1579
 * @CreateDate: 2022-02-05 04:00:16
 * @LastEditor: BATU1579
 * @LastTime: 2023-03-29 16:22:59
 * @FilePath: \\src\\lib\\logger.ts
 * @Description: 存放关于日志和调试信息的预制方法。
 */

var FrameCollection =
/** @class */
function () {
  function FrameCollection() {
    var frames = [];

    for (var _i = 0; _i < arguments.length; _i++) {
      frames[_i] = arguments[_i];
    }

    this.frames = frames;
  }
  /**
   * @description: 清空栈帧集合中的数据，用于手动清空堆栈。
   *
   * **注意！：**
   *
   * - 一般来说不需要手动清空。
   *
   */


  FrameCollection.prototype.clear = function () {
    this.frames.length = 0;
  };
  /**
   * @description: 向堆栈中压入新的栈帧。
   * @param {FrameType} frame 添加的栈帧。
   */


  FrameCollection.prototype.push = function (frame) {
    this.frames.push(frame);
  };

  return FrameCollection;
}();

var TraceCollection =
/** @class */
function (_super) {
  __extends(TraceCollection, _super);

  function TraceCollection() {
    return _super !== null && _super.apply(this, arguments) || this;
  }
  /**
   * @description: 从当前的集合当中过滤符合条件的栈帧。
   * @param {Function} callbackFn 用来测试数组中每个元素的函数。返回 `true` 表示该元素通过测试，保留该元素， `false` 则不保留。它接受以下三个参数：
   * - `element` 数组中当前正在处理的元素。
   * - `index` 正在处理的元素在数组中的索引。
   * - `array` 调用了 `filter()` 的数组本身。
   * @return {LogCollection} 过滤出的符合条件的栈帧组成的新栈帧集合。
   */


  TraceCollection.prototype.filter = function (callbackFn) {
    var result = new TraceCollection();
    var tempFrame;

    for (var i = 0; i < this.frames.length; i++) {
      tempFrame = this.frames[i];

      if (callbackFn(tempFrame, i, this.frames)) {
        result.push(tempFrame);
      }
    }

    return result;
  };
  /**
   * @description: 将调用堆栈集合逐个转换为字符串。
   * @param {TraceFormatter} [format] 用于规定转换后的字符串格式的回调方法，默认转换格式的默认转换格式类似 Python 。
   * @return {string[]} 将集合中元素转换为字符串后的数组。
   */


  TraceCollection.prototype.toStringArray = function (format) {
    var trace = [];

    for (var _i = 0, _a = this.frames; _i < _a.length; _i++) {
      var frame = _a[_i];
      trace.push(frame.toString(format));
    }

    return trace;
  };
  /**
   * @description: 将调用堆栈集合转换为字符串。
   * @param {TraceFormatter} [format] 用于规定转换后的字符串格式的回调方法，默认转换格式的默认转换格式类似 Python 。
   * @return {string} 转换后的字符串。
   */


  TraceCollection.prototype.toString = function (format) {
    var trace = [];

    for (var _i = 0, _a = this.frames; _i < _a.length; _i++) {
      var frame = _a[_i];
      trace.push(frame.toString(format));
    }

    return trace.join("\n");
  };

  return TraceCollection;
}(FrameCollection);

var LogCollection =
/** @class */
function (_super) {
  __extends(LogCollection, _super);

  function LogCollection() {
    return _super !== null && _super.apply(this, arguments) || this;
  }
  /**
   * @description: 从当前的集合当中过滤符合条件的元素。
   * @param {Function} callbackFn 用来测试数组中每个元素的函数。返回 `true` 表示该元素通过测试，保留该元素， `false` 则不保留。它接受以下三个参数：
   * - `element` 数组中当前正在处理的元素。
   * - `index` 正在处理的元素在数组中的索引。
   * - `array` 调用了 `filter()` 的数组本身。
   * @return {LogCollection} 过滤出的符合条件的日志组成的新集合。
   */


  LogCollection.prototype.filter = function (callbackFn) {
    var result = new LogCollection();
    var tempFrame;

    for (var i = 0; i < this.frames.length; i++) {
      tempFrame = this.frames[i];

      if (callbackFn(tempFrame, i, this.frames)) {
        result.push(tempFrame);
      }
    }

    return result;
  };
  /**
   * @description: 将日志集合转换为 html 字符串用于发送日志。
   * @return {string} 转换后的字符串。
   */


  LogCollection.prototype.toHtmlString = function () {
    var stack = ["<div style=\"\n                font-size: 15px;\n                font-family: monospace;\n                word-wrap:break-word;\n            \">"];

    for (var i = 0; i < this.frames.length; i++) {
      stack.push(this.frames[i].toHtmlString());
    }

    stack.push('</div>');
    return stack.join('\n');
  };
  /**
   * @description: 将日志集合逐个转换为字符串。
   * @return {string[]} 将集合中元素转换为字符串后的数组。
   */


  LogCollection.prototype.toStringArray = function () {
    var stack = [];

    for (var i = 0; i < this.frames.length; i++) {
      stack.push(this.frames[i].toString());
    }

    return stack;
  };
  /**
   * @description: 将日志集合转换为字符串。
   * @return {string} 将日志集合元素转换为字符串后使用换行符拼接的字符串。
   */


  LogCollection.prototype.toString = function () {
    var stack = [];

    for (var i = 0; i < this.frames.length; i++) {
      stack.push(this.frames[i].toString());
    }

    return stack.join('\n');
  };

  return LogCollection;
}(FrameCollection);

var TraceStackFrame =
/** @class */
function () {
  function TraceStackFrame(line, callerName) {
    this.line = line;
    this.callerName = callerName;
  }
  /**
   * @description: 获取调用所在代码中的行数。
   * @return {number} 调用所在的行号。
   */


  TraceStackFrame.prototype.getLine = function () {
    return this.line;
  };
  /**
   * @description: 获取调用者的函数名。
   * @return {string} 调用者的函数名。
   */


  TraceStackFrame.prototype.getCallerName = function () {
    return this.callerName;
  };
  /**
   * @description: 设置调用者的函数名。
   * @param {string} callerName 要设置的函数名。
   */


  TraceStackFrame.prototype.setCallerName = function (callerName) {
    this.callerName = callerName;
  };
  /**
   * @description: 将 TraceStackFrame 对象转换为字符串的方法。
   * @param {TraceFormatter} [format] 用于规定转换后的字符串格式的回调方法，默认转换格式的默认转换格式类似 Python 。
   * @return {string} 转换后的字符串。
   */


  TraceStackFrame.prototype.toString = function (format) {
    return (format !== null && format !== void 0 ? format : defaultFormatter)(this.line, this.callerName);
  };

  return TraceStackFrame;
}();

var LogStackFrame =
/** @class */
function () {
  function LogStackFrame(data, scheme) {
    this.data = data;
    this.scheme = scheme !== null && scheme !== void 0 ? scheme : LoggerSchemes.log;
  }
  /**
   * @description: 获取日志栈帧的级别，一般用于 `LogCollection.filter()` 的回调函数进行判断。建议通过 `LogLevel` 枚举类型来比较等级。
   * @return {number} 日志栈帧的级别。
   * @example
   * ```typescript
   * // 获取日志堆栈中全部的 log 等级的日志记录
   * let collection = LOG_STACK.filter((frame) => {
   *     return frame.getLevel() == LogLevel.log;
   * });
   * ```
   */


  LogStackFrame.prototype.getLevel = function () {
    return this.scheme.level;
  };
  /**
   * @description: 获取日志栈帧曾经输出的信息，一般用于 `LogCollection.filter()` 的回调函数进行判断。
   * @return {string} 日志栈帧曾经输出的信息。
   * @example
   * ```typescript
   * // 获取日志堆栈中全部包含其中 hello 的日志记录
   * let collection = LOG_STACK.filter((frame) => {
   *     return /hello/.test(frame.getData());
   * });
   * ```
   */


  LogStackFrame.prototype.getData = function () {
    return this.data;
  };
  /**
   * @description: 将日志堆栈的栈帧转换为字符串。
   * @return {string} 转换后的栈帧。
   */


  LogStackFrame.prototype.toString = function () {
    return this.data;
  };
  /**
   * @description: 将日志堆栈的栈帧转换为 html 字符串用于发送日志。
   * @return {string} 转换后的栈帧。
   */


  LogStackFrame.prototype.toHtmlString = function () {
    var htmlArray = []; // TODO(BATU1579): 添加可以自定义的行内样式

    var startTag = "<span style='color: ".concat(this.scheme.color, ";'>");
    var endTag = "</span></br>";

    for (var _i = 0, _a = this.data.split('\n'); _i < _a.length; _i++) {
      var line = _a[_i]; // 转义特殊字符

      line = line.replace(/[<>&"'`\/]/g, function (c) {
        return {
          '<': '&lt;',
          '>': '&gt;',
          '&': '&amp;',
          '"': '&quot;',
          '\'': '&#39;',
          '`': '&#96',
          '\/': '&#x2F'
        }[c];
      });
      htmlArray.push([startTag, line, endTag].join(''));
    }

    return htmlArray.join('\n');
  };

  return LogStackFrame;
}();

var LogLevel;

(function (LogLevel) {
  LogLevel[LogLevel["Debug"] = 0] = "Debug";
  LogLevel[LogLevel["Log"] = 1] = "Log";
  LogLevel[LogLevel["Info"] = 2] = "Info";
  LogLevel[LogLevel["Warn"] = 3] = "Warn";
  LogLevel[LogLevel["Error"] = 4] = "Error";
})(LogLevel = exports.LogLevel || (exports.LogLevel = {}));

var LoggerSchemes =
/** @class */
function () {
  function LoggerSchemes() {}

  LoggerSchemes.trace = {
    'displayName': 'TRACE',
    'logFunction': console.verbose,
    'color': 'lightgrey',
    'level': LogLevel.Debug
  };
  LoggerSchemes.debug = {
    'displayName': 'DEBUG',
    'logFunction': console.verbose,
    'color': 'lightgrey',
    'level': LogLevel.Debug
  };
  LoggerSchemes.log = {
    'displayName': ' LOG ',
    'logFunction': console.log,
    'color': 'black',
    'level': LogLevel.Log
  };
  LoggerSchemes.info = {
    'displayName': 'INFO',
    'logFunction': console.info,
    'color': 'green',
    'level': LogLevel.Info
  };
  LoggerSchemes.warn = {
    'displayName': 'WARN',
    'logFunction': console.warn,
    'color': 'yellow',
    'level': LogLevel.Warn
  };
  LoggerSchemes.error = {
    'displayName': 'ERROR',
    'logFunction': console.error,
    'color': 'red',
    'level': LogLevel.Error
  };
  return LoggerSchemes;
}();

exports.LoggerSchemes = LoggerSchemes;
/**
 * @description: 日志堆栈，用来记录打印的全部日志。
 */

exports.LOG_STACK = new LogCollection();
/**
 * @description: pushplus 的令牌。用于发送日志。
 */

var _token = null;
/**
 * @description: 通过抛出异常，从调用堆栈中获取调用者的函数名。
 * @param {number} [index] 调用堆栈层数（默认为 0 ），大于等于 0 视为 0 即调用此函数的函数名。
 * @return {string} 调用者的函数名。
 */

function getCallerName(index) {
  if (index === void 0) {
    index = 0;
  }

  var trace = sliceStackFrames(getRawStackTrace(), 1, 0);
  var stackFrames = parseTrace(trace); // 检查参数 index 的范围

  if (index < 0) index = 0;
  if (index > stackFrames.length - 1) index = stackFrames.length - 1;
  return stackFrames[index].getCallerName();
}

exports.getCallerName = getCallerName;
/**
 * @description: 获取当前真实的调用堆栈。
 * @param {Function} [endFunction] 终止栈帧，会自动排除后续的无用栈帧。
 *
 * **注意！：**
 *
 * - 匿名函数和类中的方法等 `console.trace()` 方法不显示的函数不能当作终止栈帧。
 *
 * @return {string} 调用堆栈的字符串。
 */

function getRawStackTrace(endFunction) {
  var stackTrace = {
    stack: ''
  };
  Error.captureStackTrace(stackTrace, endFunction); // 删除不必要的栈帧

  return sliceStackFrames(stackTrace.stack, 1, -2);
}

exports.getRawStackTrace = getRawStackTrace;
/**
 * @description: 获取修正后的调用堆栈信息。
 * @param {Function} [endFunction] 终止栈帧，会自动排除后续的无用栈帧。
 * @return {TraceCollection} 调用堆栈集合。
 */

function getStackTrace(endFunction) {
  var trace = sliceStackFrames(getRawStackTrace(endFunction), 1, 0);
  return new (TraceCollection.bind.apply(TraceCollection, __spreadArray([void 0], parseTrace(trace), false)))();
}

exports.getStackTrace = getStackTrace;
var DEFAULT_LOG_RECORD_CONFIG = {
  needPrint: true,
  needRecord: true,
  skipCallerNumber: 1
};

var Record =
/** @class */
function () {
  function Record() {}
  /**
   * @description: 设置记录的日志级别，低于设置的级别的日志都不会记录。
   *
   * **注意！：**
   *
   * - 修改前的日志记录不会改变。
   *
   * @param {number} level 设置的等级。建议使用 `LogLevel` 枚举类型来获取等级。
   */


  Record.setRecordLevel = function (level) {
    Record.RECORD_LEVEL = level;
  };
  /**
   * @description: 设置显示的日志级别，低于设置的级别的日志都不会显示。
   * @param {number} level 设置的等级。建议使用 `LogLevel` 枚举类型来获取等级。
   */


  Record.setDisplayLevel = function (level) {
    Record.DISPLAY_LEVEL = level;
  };
  /**
   * @description: 将信息打印到控制台，并带上换行符。 可以一次性传入多个参数，第一个参数作为主要信息，其他参数作为类似于 [printf(3)](https://man7.org/linux/man-pages/man3/printf.3.html) 中的代替值（参数都会传给 `util.format()` ）。
   *
   * 此函数与 `console.log` 方法的主要区别在于会自动存储每一次的日志，以供后面使用。
   * @param {string} [message] 主要信息。
   * @param {any[]} [args] 要填充的数据。
   * @return {string} 输出的日志信息。
   * @example
   * ```typescript
   * const count: number = 5;
   *
   * // 打印 'count: 5' 到 stdout
   * Record.log('count: %d', count);
   *
   * // 打印 'count: 5' 到 stdout
   * Record.log('count:', count);
   * ```
   */


  Record.log = function (message) {
    var args = [];

    for (var _i = 1; _i < arguments.length; _i++) {
      args[_i - 1] = arguments[_i];
    }

    return Record.recLog(LoggerSchemes.log, DEFAULT_LOG_RECORD_CONFIG, // @ts-ignore
    util.format.apply(util, __spreadArray([message], args, false)));
  };
  /**
   * @description: 与 `Record.log` 类似，但输出结果以灰色字体显示。输出优先级低于 `log` ，用于输出观察性质的信息。
   * @param {string} [message] 主要信息。
   * @param {array} [args] 要填充的数据。
   * @return {string} 输出的日志信息。
   */


  Record.verbose = function (message) {
    var args = [];

    for (var _i = 1; _i < arguments.length; _i++) {
      args[_i - 1] = arguments[_i];
    }

    return Record.recLog(LoggerSchemes.debug, DEFAULT_LOG_RECORD_CONFIG, // @ts-ignore
    util.format.apply(util, __spreadArray([message], args, false)));
  };
  /**
   * @description: 与 `Record.log` 类似，但输出结果以绿色字体显示。输出优先级高于 `log` ，用于输出重要信息。
   * @param {string} [message] 主要信息。
   * @param {array} [args] 要填充的数据。
   * @return {string} 输出的日志信息。
   */


  Record.info = function (message) {
    var args = [];

    for (var _i = 1; _i < arguments.length; _i++) {
      args[_i - 1] = arguments[_i];
    }

    return Record.recLog(LoggerSchemes.info, DEFAULT_LOG_RECORD_CONFIG, // @ts-ignore
    util.format.apply(util, __spreadArray([message], args, false)));
  };
  /**
   * @description: 与 `Record.log` 类似，但输出结果以蓝色字体显示。输出优先级高于 `info` ，用于输出警告信息。
   * @param {string} [message] 主要信息。
   * @param {array} [args] 要填充的数据。
   * @return {string} 输出的日志信息。
   */


  Record.warn = function (message) {
    var args = [];

    for (var _i = 1; _i < arguments.length; _i++) {
      args[_i - 1] = arguments[_i];
    }

    return Record.recLog(LoggerSchemes.warn, DEFAULT_LOG_RECORD_CONFIG, // @ts-ignore
    util.format.apply(util, __spreadArray([message], args, false)));
  };
  /**
   * @description: 与 `Record.log` 类似，但输出结果以红色字体显示。输出优先级高于 `warn` ，用于输出错误信息。
   * @param {string} [message] 主要信息。
   * @param {array} [args] 要填充的数据。
   * @return {string} 输出的日志信息。
   */


  Record.error = function (message) {
    var args = [];

    for (var _i = 1; _i < arguments.length; _i++) {
      args[_i - 1] = arguments[_i];
    }

    return Record.recLog(LoggerSchemes.error, DEFAULT_LOG_RECORD_CONFIG, // @ts-ignore
    util.format.apply(util, __spreadArray([message], args, false)));
  };
  /**
   * @description: 与 `console.trace` 类似，同时会打印出调用这个函数所在的调用栈信息（即当前运行的文件、行数等信息）。
   *
   * 此函数与 `console.trace` 的主要区别在于会修正异常的行号，便于调试。同时会将调用堆栈信息存储在日志堆栈中。
   *
   * **注意！：**
   *
   * - 此函数显示的等级和 `Record.debug()` 相同。
   *
   * @param {string} [message] 主要信息。
   * @param {array} [args] 要填充的数据。
   * @return {string} 输出的日志信息。
   * @example
   * ```typescript
   * // Show me
   * //  | at line xxx, in <callerName>
   * Record.trace('Show me');
   * ```
   */


  Record.trace = function (message) {
    var args = [];

    for (var _i = 1; _i < arguments.length; _i++) {
      args[_i - 1] = arguments[_i];
    }

    var trace = sliceStackFrames(getRawStackTrace(), 1, 0);
    var parsedTrace = new (TraceCollection.bind.apply(TraceCollection, __spreadArray([void 0], parseTrace(trace), false)))(); // @ts-ignore

    message = util.format.apply(util, __spreadArray([message], args, false));
    return Record.recLog(LoggerSchemes.trace, DEFAULT_LOG_RECORD_CONFIG, "".concat(message, "\n").concat(parsedTrace.toString()));
  };
  /**
   * @description: 与 `Record.trace` 类似，会打印出调用这个函数所在的调用栈信息（即当前运行的文件、行数等信息）。
   *
   * 此函数与 `Record.trace` 的主要区别在于可以手动指定调用栈的格式，可以更个性化的显示调用栈。
   *
   * **注意！：**
   *
   * - 此函数显示的等级和 `Record.debug()` 相同。
   *
   * @param {TraceFormatter} formatter 用于规定转换后的字符串格式的回调方法，默认转换格式的默认转换格式类似 Python 。
   * @param {string} [message] 主要信息。
   * @param {array} [args] 要填充的数据。
   * @return {string} 输出的日志信息。
   * @example
   * ```typescript
   * // Show me
   * //  | callerName: #line
   * Record.trace((line, caller) => `  | ${caller}: #${line}`, 'Show me');
   * ```
   */


  Record.traceWithCustomFormatter = function (formatter, message) {
    var args = [];

    for (var _i = 2; _i < arguments.length; _i++) {
      args[_i - 2] = arguments[_i];
    }

    var trace = sliceStackFrames(getRawStackTrace(), 1, 0);
    var parsedTrace = new (TraceCollection.bind.apply(TraceCollection, __spreadArray([void 0], parseTrace(trace), false)))(); // @ts-ignore

    message = util.format.apply(util, __spreadArray([message], args, false));
    return Record.recLog(LoggerSchemes.trace, DEFAULT_LOG_RECORD_CONFIG, "".concat(message, "\n").concat(parsedTrace.toString(formatter)));
  };
  /**
   * @description: 高度自定义的日志信息接口
   * @param {LoggerScheme} scheme 日志记录方案，包括显示名称，日志等级，显示颜色等等，可以使用模块中的 `LoggerSchemes` 类来设置，也可以自己构建。
   * @param {LogRecordConfig} config 细粒度的日志设置，包括是否输出到控制台，跳过几个调用者名称等等。
   * @param {string} [message] 主要信息。
   * @param {array} [args] 要填充的数据。
   * @return {string} 输出的日志信息。
   */


  Record.customLog = function (scheme, config, message) {
    var args = [];

    for (var _i = 3; _i < arguments.length; _i++) {
      args[_i - 3] = arguments[_i];
    } // @ts-ignore


    return Record.recLog(scheme, config, util.format.apply(util, __spreadArray([message], args, false)));
  };
  /**
   * @description: 记录日志核心方法，负责记录和输出日志数据。
   * @param {LoggerScheme} scheme 日志记录方案。
   * @param {LogRecordConfig} config 日志记录设置。
   * @param {string} [logMessage] 日志信息。
   * @return {string} 输出的日志信息。
   */


  Record.recLog = function (scheme, config, logMessage) {
    var _a, _b, _c, _d; // TODO(BATU1579): 自定义日志格式


    logMessage = "[".concat(scheme.displayName, "] [").concat(getCallerName(config.skipCallerNumber), "]: ").concat(logMessage); // 向日志堆栈中添加数据

    var needRecord = (_b = (_a = config.needRecord) !== null && _a !== void 0 ? _a : scheme.needRecord) !== null && _b !== void 0 ? _b : true;

    if (needRecord && scheme.level >= Record.RECORD_LEVEL) {
      exports.LOG_STACK.push(new LogStackFrame(logMessage, scheme));
    } // 输出日志


    var needPrint = (_d = (_c = config.needPrint) !== null && _c !== void 0 ? _c : scheme.needPrint) !== null && _d !== void 0 ? _d : true;

    if (needPrint && scheme.level >= Record.DISPLAY_LEVEL) {
      scheme.logFunction(logMessage);
    }

    return logMessage;
  };
  /**
   * @description: 用来限制记录的日志级别，低于此级别的日志不会记录。
   */


  Record.RECORD_LEVEL = LogLevel.Debug;
  /**
   * @description: 用来限制显示的日志级别，低于此级别的日志不会被显示出来。
   */

  Record.DISPLAY_LEVEL = LogLevel.Debug;
  /**
   * @description: 与 `Record.log` 类似，但输出结果以灰色字体显示。输出优先级低于 `log` ，用于输出观察性质的信息。
   *
   * **注意！：**
   *
   * - 此函数是 `Record.verbose` 的别名。
   *
   * @param {string} [message] 主要信息。
   * @param {array} [args] 要填充的数据。
   * @return {string} 输出的日志信息。
   */

  Record.debug = Record.verbose;
  return Record;
}();

exports.Record = Record;
/**
 * @description: 设置 pushplus 的令牌，必须为 32 位十六进制数的字符串。
 *
 * 如果不是运行中获取的令牌，可以选择在脚本配置文件当中添加如下名为 `TOKEN` 的字段，在读取全局变量时会自动加载。
 *
 * @param {string} token 用于调用 pushplus api 的令牌。
 * @return {boolean} 是否设置成功。
 */

function setToken(token) {
  if (token.length !== 32 || /^\d*$/.test(token)) {
    return false;
  }

  _token = token;
  return true;
}

exports.setToken = setToken;
/**
 * @description: 将信息发送到远程，并带上换行符，返回是否发送成功。
 *
 * 可以一次性传入多个参数，第一个参数作为主要信息，其他参数作为类似于 [printf(3)](https://man7.org/linux/man-pages/man3/printf.3.html) 中的代替值（参数都会传给 `util.format()` ）。
 * @param {string} title 发送消息的标题。
 * @param {string} data 主要信息。
 * @param {array} [args] 要填充的数据。
 * @return {boolean} 是否发送成功。
 */

function sendMessage(title, data) {
  var args = [];

  for (var _i = 2; _i < arguments.length; _i++) {
    args[_i - 2] = arguments[_i];
  } // @ts-ignore


  data = util.format.apply(util, __spreadArray([data], args, false));
  return sendToRemote(title, data);
}

exports.sendMessage = sendMessage;
/**
 * @description: 使用 pushplus 发送日志集合。
 * @param {LogCollection} [logs] 要发送的日志集合，默认发送完整的日志堆栈。可以通过过滤方法，选择性发送。
 * @param {string} [title] 发送消息的标题（默认为 `logger` ）。
 * @param {boolean} [clear] 发送后是否清空日志堆栈（默认为 `true` ）。
 *
 * **注意！：**
 *
 * - 发送失败时并不会清空日志堆栈，不管 `clear` 参数为何值。
 * - 在选择的日志集合不为默认时需要手动清除全部日志。
 *
 * @return {boolean} 是否发送成功。
 * @example
 * ```typescript
 * // 只发送全部 log 等级的日志
 * let collection = LOG_STACK.filter((frame) => {
 *     return frame.getLevel() == LogLevel.log;
 * });
 * sendLog(collection);
 * LOG_STACK.clear();
 * ```
 */

function sendLog(logs, title, clear) {
  logs = logs !== null && logs !== void 0 ? logs : exports.LOG_STACK;
  title = title !== null && title !== void 0 ? title : 'logger';
  clear = clear !== null && clear !== void 0 ? clear : true;
  var isSend = sendToRemote(title, logs.toHtmlString());

  if (isSend && clear) {
    logs.clear();
  }

  return isSend;
}

exports.sendLog = sendLog;
/**
 * @description: 截取需要的栈帧。
 * @param {string} stackTrace 调用堆栈字符串。
 * @param {number} start 开始行（默认为 0 ），小于等于 0 时视为 0 。
 * @param {number} end 结束行（默认为 0 ），为正时表示从前计数，为负时表示从后计数。
 * @return {string} 处理后的调用堆栈字符串。
 */

function sliceStackFrames(stackTrace, start, end) {
  if (start === void 0) {
    start = 0;
  }

  if (end === void 0) {
    end = 0;
  }

  if (stackTrace === '') return '';
  var temp = stackTrace.split('\n'); // 映射负值

  if (end <= 0) end = temp.length + end; // 检查参数 start 的范围

  if (start < 0) {
    start = 0;
  } else if (start > temp.length - 1) {
    start = temp.length - 1;
  } // 检查参数 end 的范围


  if (end > temp.length) {
    end = temp.length;
  } else if (end <= start) {
    return '';
  }

  temp = temp.slice(start, end);
  return temp.join('\n');
}
/**
 * @description: 格式化调用堆栈信息。
 * @param {string} originTrace 原始调用堆栈字符串（使用异常的 `stack` 属性取得）。
 * @return {TraceStackFrame[]} 格式化后的调用堆栈数据。
 */


function parseTrace(originTrace) {
  var _a;

  var stack = [];
  var originStack = originTrace.split('\n');

  for (var _i = 0, originStack_1 = originStack; _i < originStack_1.length; _i++) {
    var item = originStack_1[_i];
    var result = /\:(\d+)(?: \((.*)\))?/.exec(item);
    stack.push(new TraceStackFrame( // 修正和源码偏移的行数
    Number(result[1]) - 3, (_a = result[2]) !== null && _a !== void 0 ? _a : 'Anonymous functions'));
  } // 修改最外层调用名称为 Outer


  stack[stack.length - 1].setCallerName("Outer");
  return stack;
}
/**
 * @description: 使用 pushplus 推送文本。
 * @param {string} title 发送消息的标题。
 * @param {string} message 要发送的消息。
 * @return {boolean} 是否发送成功。
 */


function sendToRemote(title, message) {
  // TODO: 抛出异常？
  if (_token === null) {
    return false;
  }

  var res = http.post("http://www.pushplus.plus/send", {
    title: title,
    token: _token,
    content: message,
    template: 'html'
  });
  return res.statusCode === 200;
}

function defaultFormatter(line, callerName) {
  return "  | at line ".concat(line, ", in <").concat(callerName, ">");
}

/***/ }),

/***/ 154:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";


var __createBinding = this && this.__createBinding || (Object.create ? function (o, m, k, k2) {
  if (k2 === undefined) k2 = k;
  var desc = Object.getOwnPropertyDescriptor(m, k);

  if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
    desc = {
      enumerable: true,
      get: function get() {
        return m[k];
      }
    };
  }

  Object.defineProperty(o, k2, desc);
} : function (o, m, k, k2) {
  if (k2 === undefined) k2 = k;
  o[k2] = m[k];
});

var __exportStar = this && this.__exportStar || function (m, exports) {
  for (var p in m) {
    if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
  }
};

Object.defineProperty(exports, "__esModule", ({
  value: true
}));

__exportStar(__webpack_require__(919), exports);

/***/ }),

/***/ 919:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.xyrun = void 0;

var utils_1 = __webpack_require__(4);

var tryTime = 0; // 找到商品详情并过滤数据， 进行数据的查找

function findDom() {
  console.log('-----find----'); // var list = className("android.view.View").depth(13).find();

  var list = className("android.widget.ImageView").descContains('更多').find();

  if ((list === null || list === void 0 ? void 0 : list.length) === 0) {
    list = className("android.view.View").descContains('更多').find();
  }

  console.log('-----list----', list);

  for (var i = 0; i < list.length; i++) {
    var rect = list[i].boundsInParent();

    try {
      var text = String(list[i].contentDescription); // console.log('-------------text----------',text)

      var info = (0, utils_1.getInfo)(text);

      if (info && info.title) {
        (0, utils_1.buildBookSet)(info.title, info);
      }

      if (i === list.length - 1) {
        // var scrollDowninfo = scrollDom.scrollForward()
        var swipeinfo = swipe(500, 448 * 4.5, 500, 100, 1000); // console.log('---------swipeinfo-----------', swipeinfo, text.toString())

        sleep(3000);
        console.log('---------哎呀，到底啦--------------', text.indexOf('哎呀，到底啦') !== -1);

        if (text.indexOf('哎呀，到底啦') === -1) {
          findDom();
        } else {
          console.log('-----end----');
        }
      }
    } catch (error) {
      console.log('error', error);
    }
  }
} // 获取对应的按钮
// 抵扣逻辑


function handlerDikou() {
  var list = className("android.view.View").text('立即开启').find();
  console.log('-----list----', list.length);

  for (var i = 0; i < list.length; i++) {
    var item = list[i];

    try {
      var text = String(list[i].text());
      console.log('-------------text----------', text);
      list[i].click();
      sleep(5000);

      if (i % 4 === 0) {
        var swipeinfo = swipe(500, 448 * 5, 500, 100, 1000);
        sleep(2000);
      } // console.log('-----text----', text)


      if (i === list.length - 1) {
        // var scrollDowninfo = scrollDom.scrollForward()
        // console.log('---------swipeinfo-----------', swipeinfo, text.toString())
        // 检查是否到了底部
        console.log('---------哎呀，到底啦--------------', text.indexOf('哎呀，到底啦') === -1);

        if (text.indexOf('哎呀，到底啦') === -1) {
          handlerDikou();
        } else {
          console.log('-----end----');
        }
      }
    } catch (error) {
      console.log('error', error);
    }
  }
} // 获取对应的按钮
// 金币推广


function handleTuiguang() {
  for (var i = 0; i < 20; i++) {
    try {
      var hotTitle = '【清仓包邮】正版二手 新概念51单片机C语言教程——入门';
      var listLength = 0;
      var list = className("android.view.View").textContains('去推广').find();
      var parent = list[0].parent().parent();
      var itemBoxHeight = list[0].parent().parent().bounds().height();
      console.log('-----list----', list.length, '----parent------', parent.bounds());

      while (listLength < list.length) {
        var swipeinfo;

        for (var i_1 = listLength; i_1 < list.length;) {
          swipeinfo = swipe(500, itemBoxHeight * 8, 500, 10, 100);
          sleep(1000);
          i_1 = i_1 + 6;
        }

        listLength = list.length;

        if (swipeinfo) {
          list = className("android.view.View").textContains('去推广').find();
          console.log('-----list----', list.length);
        } else {
          console.log('-----end----');
        }
      }

      for (var i_2 = 0; i_2 < list.length; i_2++) {
        var item = list[i_2];
        var parent = list[i_2].parent().parent(); // 找到info

        var info = [];
        parent.children().forEach(function (tv, index) {
          if (tv.text() != "") {
            log('-----------------text---------------', index, tv.text()); // 获取标题
            // var title = tv.text();
            // var price = 

            info.push(tv.text());
          }
        });

        if (info && info.length && info[0]) {
          // 对比数据
          var title = info[0];

          if (title.indexOf(hotTitle) !== -1) {
            // 进入设置页面
            item.click();
            sleep(2000);
            handleSetting();
            sleep(2000);
          }
        }
      }
    } catch (error) {
      console.log('------error----------', error);
      sleep(1000);
      continue;
    }
  }
} // 进入设置页面后的操作


function handleSetting() {
  // 设置1000金币的
  var btn100 = className("android.view.View").text("100人").findOne();
  btn100.click(); // 确认按钮

  var btn开始推广 = className("android.view.View").text("开始推广").findOne(); // 点击推广按钮

  btn开始推广.click();
  sleep(1000);
  var btn确认推广 = className("android.view.View").text("确认推广").findOne();
  btn确认推广.click();
  back();
} // setTimeout(()=>{
// 	findDom()
// }, 1000);


function xyrun() {
  launchApp("闲鱼");
  threads.start(function () {
    var time = setInterval(function () {}, 1000);
    var window = floaty.window("<vertical>\n                <button id=\"center\"  margin=\"0\" w=\"60\">\u63A8\u5E7F</button>\n                <button id=\"start\"   margin=\"0\" w=\"60\">\u66DD\u5149</button>\n                <button id=\"dc\"   margin=\"0\" w=\"60\">\u62B5\u6263</button>\n                <button id=\"showData\"   margin=\"0\" w=\"60\">\u6253\u5370\u6570\u636E</button>\n                <button id=\"stop\"    margin=\"0\" w=\"60\" >\u505C\u6B62</button>\n                <button id=\"console\" margin=\"0\" w=\"60\">\u8C03\u8BD5</button>\n                <button id=\"exit\"    margin=\"0\" w=\"60\">\u9000\u51FA</button>\n            </vertical>");
    window.setPosition(window.getX(), window.getY() + 200);
    var x = 0,
        y = 0,
        windowX = 0,
        windowY = 0,
        isRuning = false,
        showConsole = false,
        isShowingAll = true;
    window.center.setOnTouchListener(function (view, event) {
      switch (event.getAction()) {
        case event.ACTION_DOWN:
          x = event.getRawX();
          y = event.getRawY();
          windowX = window.getX();
          windowY = window.getY();
          break;

        case event.ACTION_MOVE:
          window.setPosition(windowX + (event.getRawX() - x), windowY + (event.getRawY() - y));
          break;

        case event.ACTION_UP:
          if (Math.abs(event.getRawY() - y) < 5 && Math.abs(event.getRawX() - x) < 5) {
            console.log('--------------推广-------------');
            isRuning = true;
            ui.run(function () {
              window.center.setVisibility('gone');
              window.stop.setVisibility('visible');
            });
            threads.start(function () {
              // xyInit()
              handleTuiguang();
            });
          }

          break;
      }

      return true;
    });
    window.start.click(function (view) {
      isRuning = true;
      ui.run(function () {
        window.start.visibility = 'gone'; // window.stop.setVisibility('visible');
      }); // threads.start(function () {
      // xyInit()
      // findDom();
      // });
    });
    window.dc.click(function (view) {
      isRuning = true;
      ui.run(function () {
        window.dc.setVisibility('gone');
        window.stop.setVisibility('visible');
      });
      threads.start(function () {
        handlerDikou();
      });
    });
    window.showData.click(function () {
      threads.start(function () {
        var storage = storages.create("book");
        console.log('---------------', storage.get("bookMaps"));
      });
    });

    function stopAuto(view) {
      isRuning = false;
      ui.run(function () {
        window.start.setVisibility('visible');
        window.dc.setVisibility('visible');
        window.center.setVisibility('visible');
        window.stop.setVisibility('gone');
      });
      threads.shutDownAll();
    }

    window.stop.click(stopAuto);
    window.console.click(function () {
      threads.start(function () {
        if (showConsole == false) {
          showConsole = true;
          console.show();
        } else {
          showConsole = false;
          console.hide();
        }
      });
    });
    window.exit.click(function () {
      // threads.shutDownAll()
      // clearInterval(time)
      // exit();
      // thread.interrupt();
      window.close();
    });
  });
}

exports.xyrun = xyrun;

/***/ }),

/***/ 4:
/***/ ((__unused_webpack_module, exports) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.xyInit = exports.buildBookSet = exports.getInfo = void 0; // 开发环境
// const host = 'http://192.168.3.3:3000'

var token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7Il9pZCI6ImI5ODM2OTg4NjQzY2M0ZDIwMDBiZTQzZDcxZTk3YzU3IiwibmFtZSI6Inlhb3ljIiwidXNlcm5hbWUiOiJ5YW95YyJ9LCJleHAiOjE3MTIxODUzMDMsImlhdCI6MTcwNDk4NTMwM30.1ymfrT0S8xdxjYPUXDPfEqM5IGGUKT9e91DfrkGpP5Y';
var header = {
  'Content-Type': 'application/json',
  'Authorization': "Bearer ".concat(token)
}; // 线上环境

var host = 'https://xfyapi.xfysj.top';
var shopNameArr = ["蓝小飞鱼", "tb133799136652"];
var storage = storages.create("shopName");
var spreadBookInfoStorage = storages.create("spreadBookInfo");
var shopIndex = storage.get('shopName') || 0;
var shopName = shopNameArr[shopIndex];

var getInfo = function getInfo(text) {
  var regex = /(【[^】]+】)?(.{10,15}\S+)/; // [\s\S]*[曝光]?(\d*)[\s\S]*[浏览]?(\d*)[\s\S]*[想要]?(\d*);  

  var bgRegex = /曝光(\d+)/;
  var llRegex = /浏览(\d+)/;
  var xyRegex = /想要(\d+)/;
  var matches = regex.exec(text);
  var bgMatches = bgRegex.exec(text);
  var llMatches = llRegex.exec(text);
  var xyMatches = xyRegex.exec(text);

  if (matches) {
    var title = matches[2] || null;
    var exposure = bgMatches && bgMatches[1] || 0;
    var views = llMatches && llMatches[1] || 0;
    var wants = xyMatches && xyMatches[1] || 0;
    console.log("标题: " + title);
    console.log("曝光次数: " + exposure);
    console.log("浏览次数: " + views);
    console.log("想要次数: " + wants);
    return {
      title: title,
      exposure: exposure,
      views: views,
      wants: wants
    };
  } else {
    console.log("未找到匹配的结果", text);
  }

  return {};
};

exports.getInfo = getInfo;
var bookMaps = {}; // 获取所有数据， 用map key进行唯一标识

var buildBookSet = function buildBookSet(key, info) {
  var bookStorage = storages.create("book");

  if (info && info.title) {
    if (bookMaps[key]) {
      Object.assign(bookMaps[key], info);
    } else {
      bookMaps[key] = info;
    }
  }

  sleep(1000);
  console.log(shopName); // 对数据进行推送

  var options = {
    'method': 'PUT',
    'headers': header,
    body: JSON.stringify({
      title: info.title,
      shopName: shopName,
      exposure: info.exposure,
      views: info.views,
      wants: info.wants
    })
  };
  console.log('info.title', info.title); // var url = "https://baidu.com";

  var res = http.request("".concat(host, "/api/updateByTitle"), options);
  console.log('------res====', res);

  if (res.statusCode === 401) {
    // 重现授权
    console.log('401');
    (0, exports.xyInit)();
  } else {
    console.log('更新成功！');
  }

  bookStorage.put("bookMaps", bookMaps);
};

exports.buildBookSet = buildBookSet;

var xyInit = function xyInit() {
  var options = {
    'method': 'POST',
    'headers': header,
    body: JSON.stringify({
      "username": "yaoyc",
      "password": "123456"
    })
  }; // var url = "https://baidu.com";

  var res = http.request("".concat(host, "/api/login"), options);

  if (res.statusCode === 200) {
    var data = res.body.json();
    console.log('-------data------', data);

    if (data.code === 0 && data.token) {
      token = data.token;
      header.Authorization = "Bearer ".concat(token);
    }
  }
};

exports.xyInit = xyInit; // 获取需要推广的数据

var spreadBookInfo = function spreadBookInfo() {
  var options = {
    'method': 'GET',
    'headers': header
  }; // var url = "https://baidu.com";

  var res = http.request("".concat(host, "/api/spreadBookInfo"), options);

  if (res.statusCode === 401) {
    // 重现授权
    console.log('401');
    (0, exports.xyInit)();
  } else if (res.statusCode === 200) {
    console.log('-------e------', res);
    var data = res.body.json();
    console.log('-------data------', data);
    spreadBookInfoStorage.put('spreadBookInfo', data.data[shopName]);
    console.log('更新成功！');
  }
}; // 收集樊登读书信息


var getFSBookInfo = function getFSBookInfo(book) {
  var options = {
    'method': 'POST',
    'headers': header,
    body: JSON.stringify(book)
  }; // var url = "https://baidu.com";

  var res = http.request("".concat(host, "/api/fsBook"), options);

  if (res.statusCode === 401) {
    // 重现授权
    console.log('401');
    (0, exports.xyInit)();
  } else if (res.statusCode === 200) {
    console.log('-------e------', res);
    var data = res.body.json();
    console.log('-------data------', data);
    console.log('更新成功！');
  }
}; // 获取当前已经存在的书籍名称


var getSavedBooks = function getSavedBooks() {
  var options = {
    'method': 'GET',
    'headers': header
  }; // var url = "https://baidu.com";

  var res = http.request("".concat(host, "/api/fsBooks?omit=recommend,wonderful,authorIntroduction,explainContent,receive&pageSize=2000"), options);

  if (res.statusCode === 200) {
    try {
      var data = res.body.json(); // console.log('-------data------', data.data)

      var names = data.data.list.map(function (item) {
        return item.title;
      }); // console.log('-------name------', names)

      return names;
    } catch (error) {
      return [];
    }
  } else {
    return [];
  }
}; // module.exports = {
//     getInfo,
//     buildBookSet,
//     xyInit,
//     spreadBookInfo,
//     getFSBookInfo,
//     getSavedBooks
// };
// var str = `更多
// 降价
// 编辑
// 【​正​版​二​手​包​邮​】​ ​沟​通​的​艺​术​（​插​图​修​订​第​1​4​版​）​：​看​入​人​里​，​
// ¥
// 22
// .82
// 曝光4
//  · 
// 想要0`
// getInfo(str)
// xyInit()
// getSavedBooks()

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
var exports = __webpack_exports__;
var __webpack_unused_export__;
"ui";
"use strict";

__webpack_unused_export__ = ({
  value: true
});

var init_1 = __webpack_require__(103);

var xianyu_1 = __webpack_require__(154);

(0, init_1.init)();
(0, xianyu_1.xyrun)();
})();

/******/ })()
;