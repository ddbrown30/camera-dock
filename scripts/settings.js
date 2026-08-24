import * as MODULE_CONFIG from "./module-config.js";
import { Utils } from "./utils.js";
import { CameraPanel } from "./camera-panel.js";

export function registerSettings() {

    Utils.registerSetting(MODULE_CONFIG.SETTING_KEYS.cameraSize, {
        name: "",
        default: 2,
        type: Number,
        scope: "client",
        config: false,
        onChange: (cameraSize) => {
            document.documentElement.style.setProperty('--camera-size', cameraSize);
        },
    });

    Utils.registerSetting(MODULE_CONFIG.SETTING_KEYS.cameraOrientation, {
        name: "",
        default: "right",
        type: String,
        scope: "client",
        config: false,
        onChange: (orientation) => {
            document.documentElement.dataset.cameraOrientation = orientation;
            CameraPanel.repositionActivePopout();
        },
    });

    Utils.registerSetting(MODULE_CONFIG.SETTING_KEYS.bottomBelowVideo, {
        name: "",
        default: true,
        type: Boolean,
        scope: "client",
        config: false,
        onChange: (enabled) => {
            document.documentElement.classList.toggle("camera-dock-bottom-below-video", enabled);
        },
    });

    Utils.registerSetting(MODULE_CONFIG.SETTING_KEYS.undocked, {
        name: "",
        default: false,
        type: Boolean,
        scope: "client",
        config: false,
    });

    Utils.registerSetting(MODULE_CONFIG.SETTING_KEYS.undockedPosition, {
        name: "",
        default: { top: 100, left: 100 },
        type: Object,
        scope: "client",
        config: false,
    });
}