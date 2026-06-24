/**
 * AutoX.js 本地配置读取器（v7 / Node.js 引擎版本）
 *
 * 配置文件存放在设备 /sdcard/scripts/xianyu/config.json
 * 若文件不存在则使用内置默认值，并自动创建示例文件。
 *
 * 配置文件示例：
 * {
 *   "_TOKEN": "",
 *   "_SHOW_CONSOLE": false,
 *   "_LOCAL_SERVER": "http://192.168.1.100:3000"
 * }
 */

import * as fs from 'fs';
import * as path from 'path';

const CONFIG_PATH = '/sdcard/scripts/xianyu/config.json';

interface XianyuConfig {
    _TOKEN: string;
    _SHOW_CONSOLE: boolean;
    _LOCAL_SERVER: string;
    [key: string]: any;
}

const DEFAULT_CONFIG: XianyuConfig = {
    _TOKEN: '',
    _SHOW_CONSOLE: false,
    _LOCAL_SERVER: 'http://10.10.30.129:3000',
};

let _cachedConfig: XianyuConfig | null = null;

/**
 * 读取并返回配置对象（带缓存，启动时读取一次）。
 */
export function getConfig(): XianyuConfig {
    if (_cachedConfig) return _cachedConfig;

    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
            const parsed = JSON.parse(raw) as Partial<XianyuConfig>;
            _cachedConfig = { ...DEFAULT_CONFIG, ...parsed };
            console.log('[config] 已从设备加载配置: ' + CONFIG_PATH);
        } else {
            _cachedConfig = { ...DEFAULT_CONFIG };
            console.log('[config] 配置文件不存在，使用默认值');
            _ensureConfigFile();
        }
    } catch (e) {
        console.error('[config] 读取配置失败，使用默认值: ' + e);
        _cachedConfig = { ...DEFAULT_CONFIG };
    }

    return _cachedConfig;
}

/**
 * 若配置文件不存在，自动在设备上创建默认配置文件，方便用户修改。
 */
function _ensureConfigFile(): void {
    try {
        const dir = path.dirname(CONFIG_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
        console.log('[config] 已创建默认配置文件: ' + CONFIG_PATH);
    } catch (e) {
        console.warn('[config] 创建配置文件失败: ' + e);
    }
}
