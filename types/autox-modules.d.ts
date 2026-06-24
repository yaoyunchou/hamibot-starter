/**
 * AutoX.js v7 模块类型声明（覆盖 autox-v7-api ESM 包，避免 CommonJS 兼容性问题）
 */

declare module 'accessibility' {
    export interface Point { x: number; y: number; }
    export interface GestureOp { points: Point[]; duration: number; delay?: number; }
    export function back(): Promise<boolean>;
    export function click(x: number, y: number): Promise<boolean>;
    export function clickText(text: string, index?: number): Promise<boolean>;
    export function currentActivity(): string | null;
    export function currentPackage(): string | null;
    export function home(): Promise<boolean>;
    export function inputText(text: string, index?: number): Promise<boolean>;
    export function lockScreen(): Promise<boolean>;
    export function longClick(x: number, y: number): Promise<boolean>;
    export function openNotifications(): Promise<boolean>;
    export function openQuickSettings(): Promise<boolean>;
    export function performGesture(points: Point[], duration: number, delay?: number): Promise<boolean>;
    export function performGestures(gestures: GestureOp[]): Promise<boolean>;
    export function performGlobalAction(): void;
    export function press(x: number, y: number, duration: number): Promise<boolean>;
    export function select(): Autox.UiSelector;
    export function setText(text: string, index?: number): Promise<boolean>;
    export function swipe(x1: number, y1: number, x2: number, y2: number, duration: number): Promise<boolean>;
    export function takeScreenshot(): Promise<Autox.Image>;
    export function togglePowerDialog(): Promise<boolean>;
    export function toggleRecents(): Promise<boolean>;
}

declare module 'app' {
    export const packageName: string;
    export function launch(packageName: string): boolean;
    export function launchApp(targetAppName: string): boolean;
    export function getAppName(packageName: string): string | null;
    export function getPackageName(targetAppName: string): string | null;
    export function openAppSettings(packageName: string): boolean;
    export function openUrl(url: string): void;
    export function uninstall(packageName: string): void;
    export function viewFile(file: string): void;
    export function editFile(file: string): void;
    export function startActivity(target: any): void;
    export function startService(target: any): void;
    export function sendBroadcast(target: any): any;
    export function sendEmail(options: any): void;
    export function makeIntent(options: any): any;
    export function getApkInfo(file: string, flags?: any): any;
    export function getInstalledPackages(flags?: any): any[];
    export const getInstalledApps: typeof getInstalledPackages;
    export function getUriForFile(pathOrUri: string): any;
    export function parseUri(uri: string): any;
}

declare module 'toast' {
    export function makeText(text: string, duration?: number): void;
    export function show(text: string): void;
}

declare module 'dialogs' {
    export function alert(title: string, content?: string): Promise<void>;
    export function confirm(title: string, content?: string): Promise<boolean>;
    export function prompt(title: string, content?: string, defaultValue?: string): Promise<string>;
    export function input(title: string, content?: string, defaultValue?: string): Promise<string>;
    export function select(title: string, items: string[]): Promise<number>;
    export function singleChoice(title: string, items: string[], index?: number): Promise<number>;
    export function multiChoice(title: string, items: string[], indices?: number[]): Promise<number[]>;
}

declare module 'media' {
    export function scanFile(path: string): void;
    export function playMusic(path: string, onComplete?: () => void): void;
    export function stopMusic(): void;
    export function isMusicPlaying(): boolean;
}

declare module 'engines' {
    export function myEngine(): any;
    export function all(): any[];
    export function stopAll(): void;
    export function stopAllAndToast(): void;
}

declare module 'clip_manager' {
    export function getClip(): string;
    export function setClip(text: string): void;
    export function listen(listener: (text: string) => void): void;
}
