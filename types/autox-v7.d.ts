/**
 * AutoX.js v7 全局类型声明
 * 为 autox-v7-api 模块提供 Autox/android 命名空间
 */


declare namespace Autox {
    interface UiObject {
        id(): string;
        text(): string;
        desc(): string;
        contentDescription: string;
        className: string;
        bounds(): { left: number; top: number; right: number; bottom: number; centerX(): number; centerY(): number; width(): number; height(): number };
        clickable: boolean;
        scrollable: boolean;
        longClickable: boolean;
        enabled: boolean;
        selected: boolean;
        focusable: boolean;
        editable(): boolean;
        checkable: boolean;
        checked: boolean;
        childCount(): number;
        child(index: number): UiObject;
        parent(): UiObject | null;
        click(): boolean;
        longClick(): boolean;
        depth(): number;
        drawingOrder(): number;
        indexInParent(): number;
        packageName: string;
        [key: string]: any;
    }

    interface UiCollection {
        length: number;
        [index: number]: UiObject;
        find(): UiCollection;
        filter(fn: (node: UiObject) => boolean): UiCollection;
        map<T>(fn: (node: UiObject) => T): T[];
    }

    interface UiSelector {
        id(id: string): UiSelector;
        text(text: string): UiSelector;
        textContains(text: string): UiSelector;
        textMatches(regex: RegExp | string): UiSelector;
        textStartsWith(prefix: string): UiSelector;
        desc(desc: string): UiSelector;
        descContains(desc: string): UiSelector;
        descMatches(regex: RegExp | string): UiSelector;
        className(className: string): UiSelector;
        clickable(b?: boolean): UiSelector;
        scrollable(b?: boolean): UiSelector;
        enabled(b?: boolean): UiSelector;
        depth(d: number): UiSelector;
        packageName(pkg: string): UiSelector;
        findOne(timeout?: number): UiObject | null;
        findOnce(): UiObject | null;
        find(): UiCollection;
        exists(): boolean;
        waitFor(): void;
    }

    interface Image {
        getWidth(): number;
        getHeight(): number;
        toBase64(format?: string, quality?: number): string;
        recycle(): void;
        [key: string]: any;
    }
}

declare namespace android {
    interface PackageInfo { packageName: string; versionName: string; [key: string]: any; }
    interface Uri { toString(): string; [key: string]: any; }
}
