import { createLogs } from './service';
import axios from 'axios';
import { getConfig } from './config';

// ─────────────────────── FrameCollection ────────────────────────

class FrameCollection<FrameType> {
    protected frames: FrameType[];

    constructor(...frames: FrameType[]) {
        this.frames = frames;
    }

    public clear(): void { this.frames.length = 0; }
    public push(frame: FrameType): void { this.frames.push(frame); }
}

class TraceCollection extends FrameCollection<TraceStackFrame> {
    public filter(fn: (f: TraceStackFrame, i: number, a: TraceStackFrame[]) => boolean): TraceCollection {
        const result = new TraceCollection();
        this.frames.forEach((f, i, a) => { if (fn(f, i, a)) result.push(f); });
        return result;
    }
    public toStringArray(format?: TraceFormatter): string[] {
        return this.frames.map(f => f.toString(format));
    }
    public toString(format?: TraceFormatter): string {
        return this.toStringArray(format).join('\n');
    }
}

class LogCollection extends FrameCollection<LogStackFrame> {
    public filter(fn: (f: LogStackFrame, i: number, a: LogStackFrame[]) => boolean): LogCollection {
        const result = new LogCollection();
        this.frames.forEach((f, i, a) => { if (fn(f, i, a)) result.push(f); });
        return result;
    }
    public toHtmlString(): string {
        const parts: string[] = [
            `<div style="font-size:15px;font-family:monospace;word-wrap:break-word;">`,
            ...this.frames.map(f => f.toHtmlString()),
            '</div>',
        ];
        return parts.join('\n');
    }
    public toStringArray(): string[] { return this.frames.map(f => f.toString()); }
    public toString(): string { return this.frames.map(f => f.toString()).join('\n'); }
}

class TraceStackFrame {
    constructor(private line: number, private callerName: string) {}
    public getLine(): number { return this.line; }
    public getCallerName(): string { return this.callerName; }
    public setCallerName(n: string): void { this.callerName = n; }
    public toString(format?: TraceFormatter): string {
        return (format ?? defaultFormatter)(this.line, this.callerName);
    }
}

class LogStackFrame {
    constructor(private data: string, private scheme: LoggerScheme = LoggerSchemes.log) {}
    public getLevel(): number { return this.scheme.level; }
    public getData(): string { return this.data; }
    public toString(): string { return this.data; }
    public toHtmlString(): string {
        const startTag = `<span style='color:${this.scheme.color};'>`;
        const endTag = `</span></br>`;
        return this.data.split('\n').map(line => {
            line = line.replace(/[<>&"'`/]/g, c => ({
                '<': '&lt;', '>': '&gt;', '&': '&amp;',
                '"': '&quot;', "'": '&#39;', '`': '&#96', '/': '&#x2F',
            }[c]!));
            return `${startTag}${line}${endTag}`;
        }).join('\n');
    }
}

// ─────────────────────── Enums & Schemes ────────────────────────

export enum LogLevel { Debug, Log, Info, Warn, Error }

export class LoggerSchemes {
    private constructor() {}
    static readonly trace  = { displayName: 'TRACE', logFunction: console.debug, color: 'lightgrey', level: LogLevel.Debug };
    static readonly debug  = { displayName: 'DEBUG', logFunction: console.debug, color: 'lightgrey', level: LogLevel.Debug };
    static readonly log    = { displayName: ' LOG ', logFunction: console.log,   color: 'black',     level: LogLevel.Log   };
    static readonly info   = { displayName: 'INFO',  logFunction: console.info,  color: 'green',     level: LogLevel.Info  };
    static readonly warn   = { displayName: 'WARN',  logFunction: console.warn,  color: 'yellow',    level: LogLevel.Warn  };
    static readonly error  = { displayName: 'ERROR', logFunction: console.error, color: 'red',       level: LogLevel.Error };
}

export interface LoggerScheme {
    readonly displayName: string;
    readonly logFunction: (...args: any[]) => void;
    readonly color: string;
    readonly level: LogLevel;
    readonly needPrint?: boolean;
    readonly needRecord?: boolean;
}

export const LOG_STACK: LogCollection = new LogCollection();

let _token: string | null = null;

// ─────────────────────── Caller Utils ────────────────────────

export function getCallerName(index = 0): string {
    const trace = sliceStackFrames(getRawStackTrace(), 1, 0);
    const frames = parseTrace(trace);
    if (index < 0) index = 0;
    if (index > frames.length - 1) index = frames.length - 1;
    return frames[index].getCallerName();
}

export function getRawStackTrace(endFunction?: Function): string {
    const obj: any = {};
    Error.captureStackTrace(obj, endFunction);
    return sliceStackFrames(obj.stack, 1, -2);
}

export function getStackTrace(endFunction?: Function): TraceCollection {
    const trace = sliceStackFrames(getRawStackTrace(endFunction), 1, 0);
    return new TraceCollection(...parseTrace(trace));
}

export interface LogRecordConfig {
    readonly needPrint?: boolean;
    readonly needRecord?: boolean;
    readonly skipCallerNumber?: number;
}

const DEFAULT_LOG_RECORD_CONFIG: LogRecordConfig = { needPrint: true, needRecord: true, skipCallerNumber: 1 };

// ─────────────────────── Record Class ────────────────────────

export class Record {
    private constructor() {}

    private static RECORD_LEVEL = LogLevel.Debug;
    private static DISPLAY_LEVEL = LogLevel.Debug;

    public static setRecordLevel(level: number): void { Record.RECORD_LEVEL = level; }
    public static setDisplayLevel(level: number): void { Record.DISPLAY_LEVEL = level; }

    public static log(message?: string, ...args: any[]): string {
        return Record.recLog(LoggerSchemes.log, DEFAULT_LOG_RECORD_CONFIG, format(message, ...args));
    }
    public static verbose(message?: string, ...args: any[]): string {
        return Record.recLog(LoggerSchemes.debug, DEFAULT_LOG_RECORD_CONFIG, format(message, ...args));
    }
    public static debug = Record.verbose;
    public static info(message?: string, ...args: any[]): string {
        return Record.recLog(LoggerSchemes.info, DEFAULT_LOG_RECORD_CONFIG, format(message, ...args));
    }
    public static warn(message?: string, ...args: any[]): string {
        return Record.recLog(LoggerSchemes.warn, DEFAULT_LOG_RECORD_CONFIG, format(message, ...args));
    }
    public static error(message?: string, ...args: any[]): string {
        return Record.recLog(LoggerSchemes.error, DEFAULT_LOG_RECORD_CONFIG, format(message, ...args));
    }
    public static trace(message?: string, ...args: any[]): string {
        const trace = sliceStackFrames(getRawStackTrace(), 1, 0);
        const parsedTrace = new TraceCollection(...parseTrace(trace));
        return Record.recLog(LoggerSchemes.trace, DEFAULT_LOG_RECORD_CONFIG, `${format(message, ...args)}\n${parsedTrace.toString()}`);
    }
    public static traceWithCustomFormatter(formatter: TraceFormatter, message?: string, ...args: any[]): string {
        const trace = sliceStackFrames(getRawStackTrace(), 1, 0);
        const parsedTrace = new TraceCollection(...parseTrace(trace));
        return Record.recLog(LoggerSchemes.trace, DEFAULT_LOG_RECORD_CONFIG, `${format(message, ...args)}\n${parsedTrace.toString(formatter)}`);
    }
    public static customLog(scheme: LoggerScheme, config: LogRecordConfig, message?: string, ...args: any[]): string {
        return Record.recLog(scheme, config, format(message, ...args));
    }

    private static recLog(scheme: LoggerScheme, config: LogRecordConfig, logMessage?: string): string {
        logMessage = `[${scheme.displayName}] [${getCallerName(config.skipCallerNumber)}]: ${logMessage}`;
        const msg = `[${scheme.displayName}]:${logMessage}`;
        const needRecord = config.needRecord ?? scheme.needRecord ?? true;
        if (needRecord && scheme.level >= Record.RECORD_LEVEL) {
            LOG_STACK.push(new LogStackFrame(logMessage, scheme));
        }
        const needPrint = config.needPrint ?? scheme.needPrint ?? true;
        if (needPrint && scheme.level >= Record.DISPLAY_LEVEL) {
            scheme.logFunction(logMessage);
        }
        createLogs('闲鱼', msg).catch(() => {});
        return logMessage;
    }
}

// ─────────────────────── Token / Send ────────────────────────

export function setToken(token: string): boolean {
    if (token.length !== 32 || /^\d*$/.test(token)) return false;
    _token = token;
    return true;
}

export async function sendMessage(title: string, data: string, ...args: any[]): Promise<boolean> {
    return sendToRemote(title, format(data, ...args));
}

export async function sendLog(logs?: LogCollection, title?: string, clear?: boolean): Promise<boolean> {
    logs = logs ?? LOG_STACK;
    title = title ?? 'logger';
    clear = clear ?? true;
    const isSend = await sendToRemote(title, logs.toHtmlString());
    if (isSend && clear) logs.clear();
    return isSend;
}

async function sendToRemote(title: string, message: string): Promise<boolean> {
    if (_token === null) return false;
    try {
        const res = await axios.post('http://www.pushplus.plus/send', {
            title, token: _token, content: message, template: 'html',
        });
        return res.status === 200;
    } catch {
        return false;
    }
}

// ─────────────────────── Helpers ────────────────────────

function sliceStackFrames(stackTrace: string, start = 0, end = 0): string {
    if (!stackTrace) return '';
    let temp = stackTrace.split('\n');
    if (end <= 0) end = temp.length + end;
    if (start < 0) start = 0;
    else if (start > temp.length - 1) start = temp.length - 1;
    if (end > temp.length) end = temp.length;
    else if (end <= start) return '';
    return temp.slice(start, end).join('\n');
}

function parseTrace(originTrace: string): TraceStackFrame[] {
    const stack: TraceStackFrame[] = [];
    for (const item of originTrace.split('\n')) {
        const result = /\:(\d+)(?: \((.*)\))?/.exec(item);
        if (!result) continue;
        stack.push(new TraceStackFrame(Number(result[1]) - 3, result[2] ?? 'Anonymous functions'));
    }
    if (stack.length > 0) stack[stack.length - 1].setCallerName('Outer');
    return stack;
}

function defaultFormatter(line: number, callerName: string): string {
    return `  | at line ${line}, in <${callerName}>`;
}

function format(message?: string, ...args: any[]): string {
    if (!message) return '';
    if (args.length === 0) return String(message);
    let result = String(message);
    for (const arg of args) {
        result += ' ' + (typeof arg === 'object' ? JSON.stringify(arg) : String(arg));
    }
    return result;
}

// ─────────────────────── Type exports ────────────────────────

export type LogCollectionType = LogCollection;
export type LogStackFrameType = LogStackFrame;
export type TraceCollectionType = TraceCollection;
export type TraceStackFrameType = TraceStackFrame;
export type TraceFormatter = typeof defaultFormatter;
