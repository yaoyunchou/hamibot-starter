/**
 * hamibot.d.ts — AutoX.js 迁移存根
 *
 * 原 Hamibot 全局对象已移除；此文件保留空声明以防止旧引用
 * 产生 TS 编译错误（迁移过渡期使用）。
 *
 * 正式配置读取请使用 src/lib/config.ts 中的 getConfig()。
 */

declare module 'hamibot' {
    global {
        /**
         * @deprecated 迁移至 AutoX.js 后不再可用。
         * 请使用 src/lib/config.ts 的 getConfig() 代替。
         */
        const hamibot: never;

        function exit(): void;
    }
}
