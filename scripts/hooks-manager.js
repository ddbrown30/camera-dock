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
            document.documentElement.dataset.cameraOrientation = Utils.getSetting(MODULE_CONFIG.SETTING_KEYS.cameraOrientation);
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
            const dockPositionGroup = select?.closest('.form-group');
            if (dockPositionGroup) {
                dockPositionGroup.style.display = "none";
            }

            const insertAfter = dockPositionGroup ?? html.querySelector('section[data-tab="general"]')?.lastElementChild;
            if (insertAfter) {
                const orientationGroup = document.createElement("div");
                orientationGroup.classList.add("form-group");
                orientationGroup.innerHTML = `
                    <label>Camera Orientation</label>
                    <div class="form-fields">
                        <select>
                            <option value="up">Grow Up</option>
                            <option value="down">Grow Down</option>
                            <option value="left">Grow Left</option>
                            <option value="right">Grow Right</option>
                        </select>
                    </div>
                `;
                const orientationSelect = orientationGroup.querySelector("select");
                orientationSelect.value = Utils.getSetting(MODULE_CONFIG.SETTING_KEYS.cameraOrientation);
                orientationSelect.addEventListener("change", () => {
                    Utils.setSetting(MODULE_CONFIG.SETTING_KEYS.cameraOrientation, orientationSelect.value);
                });

                const sizeGroup = document.createElement("div");
                sizeGroup.classList.add("form-group");
                sizeGroup.innerHTML = `
                    <label>Camera Size</label>
                    <div class="form-fields">
                        <input type="range" min="1" max="3" step="0.5">
                    </div>
                `;
                const sizeInput = sizeGroup.querySelector("input");
                sizeInput.value = Utils.getSetting(MODULE_CONFIG.SETTING_KEYS.cameraSize);
                sizeInput.addEventListener("input", () => {
                    Utils.setSetting(MODULE_CONFIG.SETTING_KEYS.cameraSize, Number(sizeInput.value));
                });

                insertAfter.insertAdjacentElement("afterend", orientationGroup);
                insertAfter.insertAdjacentElement("afterend", sizeGroup);
            }

            app.setPosition({ height: "auto" });
        });

        Hooks.on("renderCameraViews", CameraPanel.onRenderCameraViews);
        Hooks.on("renderCameraPopout", CameraPanel.onRenderCameraPopout);
        Hooks.on("closeCameraPopout", CameraPanel.onCloseCameraPopout);
    }
}