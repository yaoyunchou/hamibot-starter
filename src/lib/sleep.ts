/**
 * v7 Node.js 异步 sleep 工具
 */
export const sleep = (ms: number): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, ms));
