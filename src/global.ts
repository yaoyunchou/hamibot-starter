import { EventEmitter } from 'events';
import { getConfig } from './lib/config';
import { LogLevel, LOG_STACK, Record, sendLog, setToken } from './lib/logger';
import { ConfigInvalidException } from './lib/exception';
import { sleep } from './lib/sleep';

export const PROJECT_NAME = 'xianyu Script';
export const VERSION = '1.0.4';

export const LISTENER_INTERVAL = 100;
export const SHORT_WAIT_MS = 300;
export const LONG_WAIT_MS = 1000;

export const EVENT = new EventEmitter();

Record.info(`Launching...\n\n\tCurrent script version: ${VERSION}\n`);

// ---------------------- configuration -------------------------

const cfg = getConfig();
const _TOKEN = cfg._TOKEN;
const _SHOW_CONSOLE = cfg._SHOW_CONSOLE;
Record.info('Configuration loaded ' + JSON.stringify(cfg));

// -------------------- register exit handler -------------------

process.on('exit', async () => {
    Record.info('Exit...');

    let collection = LOG_STACK.filter(frame => frame.getLevel() >= LogLevel.Log);

    if (_TOKEN && _TOKEN !== '') {
        Record.info('Sending logs to pushplus...');
        for (let i = 0; i < 3; i++) {
            if (await sendLog(collection, `[LOG] ${PROJECT_NAME}`)) {
                Record.info('Sending logs succeeds');
                return;
            }
            Record.warn(`Sending failed, retry ${i + 1}`);
        }
        Record.error('Failure to send logs!');
    }

    await sleep(LONG_WAIT_MS * 5);
});

// ------------------------ validation --------------------------

Record.info('Verifying configurations');

if (_TOKEN && _TOKEN !== '' && setToken(_TOKEN) === false) {
    throw new ConfigInvalidException('pushplus token', 'needs to be a 32-bit hexadecimal number');
}

export const SHOW_CONSOLE = _SHOW_CONSOLE === true || String(_SHOW_CONSOLE) === 'true';

Record.info('Start running script');
