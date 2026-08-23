import { CameraPanel } from "./camera-panel.js";
import * as MODULE_CONFIG from "./module-config.js";
import { registerSettings } from "./settings.js";
import { Utils } from "./utils.js";

export class HooksManager {
    /**
     * Registers hooks
     */
    static registerHooks() {
        /* ------------------- Init/Ready ------------------- */

        Hooks.once('init', function () {
            registerSettings();

            document.documentElement.style.setProperty('--camera-size', Utils.getSetting(MODULE_CONFIG.SETTING_KEYS.cameraSize));
        });

        Hooks.once("ready", () => {
            const settings = game.settings.get("core", "rtcClientSettings");
            settings.dockPosition = "bottom";
            settings.hideDock = false;
            game.settings.set("core", "rtcClientSettings", settings);

            CameraPanel.initDragControls();
        });

        Hooks.on("renderAVConfig", (app, html) => {
            const select = html.querySelector('select[name="core.rtcClientSettings.dockPosition"]');
            if (select) {
                const formGroup = select.closest('.form-group');
                if (formGroup) {
                    formGroup.style.display = "none";
                }
            }
            app.setPosition({ height: "auto" });
        });

        Hooks.on("renderCameraViews", CameraPanel.onRenderCameraViews);
    }
}