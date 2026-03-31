/*
 * @Author: BATU1579
 * @CreateDate: 2022-02-04 20:58:39
 * @LastEditor: BATU1579
 * @LastTime: 2023-08-07 08:06:24
 * @FilePath: \\src\\lib\\init.ts
 * @Description: 脚本初始化
 */
import { Record } from "./logger";
import { SHOW_CONSOLE, SHORT_WAIT_MS } from "../global";
import { PermissionException } from "./exception";
import { ensureScreenSize, getScreenWidth, getScreenHeight } from "./screenSize";

export function init() {
    // check accessibility permission
    if (auto.service === null) {
        if (!confirm('Please enable accessibility permission')) {
            throw new PermissionException("Accessibility permission obtaining failure.");
        }
        auto.waitFor();
    } else {
        Record.verbose("Accessibility permissions enabled");
    }

    const { w, h } = ensureScreenSize();
    const fromDevice = device.width > 0 && device.height > 0;
    Record.debug(
        "Screen size: " + h + " x " + w + (fromDevice ? "" : " (DisplayMetrics 或默认 1080×2400)")
    );

    // show console
    if (SHOW_CONSOLE) {
        console.show();
        sleep(SHORT_WAIT_MS);
        console.setPosition(0, 100);
        console.setSize(getScreenWidth(), Math.floor(getScreenHeight() / 4));
    }

    setScreenMetrics(1080, 2400);
}
