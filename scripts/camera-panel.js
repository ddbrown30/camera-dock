import * as MODULE_CONFIG from "./module-config.js";
import { registerSettings } from "./settings.js";
import { Utils } from "./utils.js";

export class CameraPanel {

    cameraViewsApp = null;
    lastUndockedPosition = null;

    static positionCameraViews(app, cameraViews, left, top) {
        app.setPosition({ left, top });
        cameraViews.style.left = `${left}px`;
        cameraViews.style.top = `${top}px`;
        CameraPanel.lastUndockedPosition = { left, top };
    }

    static applyDockState(app, cameraViews) {
        if (!cameraViews) return;
        const undocked = Utils.getSetting(MODULE_CONFIG.SETTING_KEYS.undocked);
        cameraViews.classList.toggle("undocked", undocked);
        if (undocked) {
            if (cameraViews.parentElement !== document.body) {
                document.body.appendChild(cameraViews);
            }
            const position = Utils.getSetting(MODULE_CONFIG.SETTING_KEYS.undockedPosition);
            CameraPanel.positionCameraViews(app, cameraViews, position.left, position.top);
        } else {
            const uiBottom = document.getElementById("ui-bottom");
            if (uiBottom && cameraViews.parentElement !== uiBottom) {
                uiBottom.prepend(cameraViews);
            }
        }
    }

    static initDragControls() {
        let dragState = null;

        document.addEventListener("mousedown", (e) => {
            if (e.button !== 0) return;
            const cameraViews = document.getElementById("camera-views");
            if (!cameraViews || !CameraPanel.cameraViewsApp || !cameraViews.classList.contains("undocked")) return;
            if (!cameraViews.contains(e.target)) return;
            if (e.target.closest("button, input, select, a, textarea")) return;

            const origin = CameraPanel.lastUndockedPosition ?? CameraPanel.cameraViewsApp.position;
            dragState = {
                startX: e.clientX,
                startY: e.clientY,
                origLeft: origin.left,
                origTop: origin.top,
            };
            document.body.style.userSelect = "none";
            e.preventDefault();
        });

        document.addEventListener("mousemove", (e) => {
            if (!dragState || !CameraPanel.cameraViewsApp) return;
            const cameraViews = document.getElementById("camera-views");
            if (!cameraViews) return;

            const dx = e.clientX - dragState.startX;
            const dy = e.clientY - dragState.startY;
            const maxLeft = Math.max(0, window.innerWidth - cameraViews.offsetWidth);
            const maxTop = Math.max(0, window.innerHeight - cameraViews.offsetHeight);
            const left = Math.clamp(dragState.origLeft + dx, 0, maxLeft);
            const top = Math.clamp(dragState.origTop + dy, 0, maxTop);

            CameraPanel.positionCameraViews(CameraPanel.cameraViewsApp, cameraViews, left, top);
        });

        document.addEventListener("mouseup", () => {
            if (!dragState) return;
            dragState = null;
            document.body.style.userSelect = "";
            if (CameraPanel.lastUndockedPosition) {
                Utils.setSetting(MODULE_CONFIG.SETTING_KEYS.undockedPosition, CameraPanel.lastUndockedPosition);
            }
        });
    }

    static getUserControlsNav() {
        const navs = [...document.querySelectorAll(`[data-application-part="controls"][data-user="${game.user.id}"]`)];
        if (navs.length === 0) return null;

        const primary = navs.find(nav => nav.querySelector('button[data-action="toggle-panel-dock"]')) ?? navs[navs.length - 1];
        for (const nav of navs) {
            if (nav !== primary) nav.remove();
        }

        CameraPanel.ensureNativeActionRelay(primary);
        return primary;
    }

    static ensureNativeActionRelay(nav) {
        CameraPanel.relayedNavs ??= new WeakSet();
        if (CameraPanel.relayedNavs.has(nav)) return;
        CameraPanel.relayedNavs.add(nav);

        nav.addEventListener("click", (event) => {
            const cameraViews = document.getElementById("camera-views");
            if (cameraViews?.contains(nav)) return;

            const target = event.target.closest("[data-action]");
            if (!target || target.dataset.action === "toggle-panel-dock") return;

            const app = CameraPanel.cameraViewsApp;
            const handler = app?.options?.actions?.[target.dataset.action];
            if (typeof handler === "function") {
                handler.call(app, event, target);
            }
        });
    }

    static attachUserControls(cameraViews) {
        const camContainer = cameraViews?.querySelector(".camera-container");
        const userControlsNav = CameraPanel.getUserControlsNav();
        const selfView = cameraViews?.querySelector(`.camera-view[data-user="${game.user.id}"]`);
        if (!camContainer || !userControlsNav || !selfView) return;

        CameraPanel.disconnectPopoutSync();
        userControlsNav.classList.remove("popout-controls");
        userControlsNav.style.top = "";
        userControlsNav.style.left = "";
        userControlsNav.style.height = "";

        let wrapper = camContainer.querySelector(":scope > .local-camera-group");
        if (!wrapper) {
            wrapper = document.createElement("div");
            wrapper.classList.add("local-camera-group");
        }
        wrapper.append(userControlsNav, selfView);
        camContainer.prepend(wrapper);

        const scrollable = cameraViews.querySelector(".scrollable");
        if (scrollable) {
            const gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--controls-gap")) || 0;
            const width = `${userControlsNav.getBoundingClientRect().width + gap + 5}px`;
            scrollable.style.padding = width;
        }
    }

    static positionPopoutControls(nav, el) {
        const rect = el.getBoundingClientRect();
        const gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--controls-gap")) || 0;
        const orientation = document.documentElement.dataset.cameraOrientation;

        nav.style.top = `${rect.top}px`;
        nav.style.height = `${rect.height}px`;
        if (orientation === "left") {
            nav.style.left = `${rect.right + gap}px`;
        } else {
            nav.style.left = `${rect.left - nav.getBoundingClientRect().width - gap}px`;
        }
    }

    static disconnectPopoutSync() {
        if (CameraPanel.popoutSync) {
            CameraPanel.popoutSync.observer.disconnect();
            CameraPanel.popoutSync.resizeObserver.disconnect();
            CameraPanel.popoutSync = null;
        }
    }

    static onRenderCameraPopout(app, html) {
        CameraPanel.attachUserControlsToPopout(app, html);
    }

    static attachUserControlsToPopout(app, html) {
        if (app.id !== `camera-view-${game.user.id}`) return;

        const bottomControls = html.querySelector(".bottom .user-controls");
        if (bottomControls) {
            bottomControls.remove();
        }

        const userControlsNav = CameraPanel.getUserControlsNav();
        if (!userControlsNav) return;

        const el = app.element;
        if (userControlsNav.parentElement !== document.body) {
            document.body.append(userControlsNav);
        }
        userControlsNav.classList.add("popout-controls");

        CameraPanel.disconnectPopoutSync();
        const reposition = () => CameraPanel.positionPopoutControls(userControlsNav, el);
        reposition();

        const observer = new MutationObserver(reposition);
        observer.observe(el, { attributes: true, attributeFilter: ["style"] });
        const resizeObserver = new ResizeObserver(reposition);
        resizeObserver.observe(el);
        CameraPanel.popoutSync = { observer, resizeObserver, reposition };
    }

    static repositionActivePopout() {
        CameraPanel.popoutSync?.reposition();
    }

    static onCloseCameraPopout(app) {
        if (app.id !== `camera-view-${game.user.id}`) return;
        CameraPanel.disconnectPopoutSync();
    }

    static onRenderCameraViews(app, html) {
        CameraPanel.cameraViewsApp = app;

        const cameraViews = document.getElementById("camera-views");
        CameraPanel.applyDockState(app, cameraViews);
        CameraPanel.attachUserControls(cameraViews);

        const userControlsNav = CameraPanel.getUserControlsNav();
        const hasUndockButton = !!userControlsNav?.querySelector('button[data-action="toggle-panel-dock"]');
        if (!hasUndockButton && userControlsNav) {
            const floatBTN = document.createElement("button");
            floatBTN.type = "button";
            floatBTN.classList.add("av-control", "inline-control", "icon", "fa-solid", "fa-fw", "fa-thumbtack");
            floatBTN.dataset.action = "toggle-panel-dock";
            const initiallyUndocked = Utils.getSetting(MODULE_CONFIG.SETTING_KEYS.undocked);
            floatBTN.dataset.tooltip = initiallyUndocked ? "Dock" : "Undock";
            floatBTN.classList.toggle("is-undocked", initiallyUndocked);

            floatBTN.addEventListener("click", () => {
                const cv = document.getElementById("camera-views");
                const undocked = !Utils.getSetting(MODULE_CONFIG.SETTING_KEYS.undocked);
                if (undocked && cv && CameraPanel.cameraViewsApp) {
                    const rect = cv.getBoundingClientRect();
                    Utils.setSetting(MODULE_CONFIG.SETTING_KEYS.undockedPosition, { top: rect.top, left: rect.left });
                }
                Utils.setSetting(MODULE_CONFIG.SETTING_KEYS.undocked, undocked);
                floatBTN.dataset.tooltip = undocked ? "Dock" : "Undock";
                floatBTN.classList.toggle("is-undocked", undocked);
                if (CameraPanel.cameraViewsApp) CameraPanel.applyDockState(CameraPanel.cameraViewsApp, cv);
            });

            userControlsNav.appendChild(floatBTN);

            const playerNames = html.querySelectorAll(".player-name");
            playerNames.forEach((el) => {
                el.addEventListener("click", (e) => {
                    try {
                        const userId = e.currentTarget.closest(".camera-view")?.dataset.user;
                        const user = game.users.get(userId);
                        user.character.sheet.render(true);
                    } catch (err) {
                        ui.notifications.warn("No assigned Character found for this player");
                    }
                });
            });
        }

        const rtcWorldSettings = game.settings.get('core', 'rtcWorldSettings');
        if (rtcWorldSettings.mode != foundry.av.AVSettings.AV_MODES.AUDIO_VIDEO) {
            if (rtcWorldSettings.mode != foundry.av.AVSettings.AV_MODES.VIDEO) {
                html.querySelectorAll(".status-hidden").forEach(el => el.remove());
                html.querySelector(`[data-action="toggleVideo"]`)?.remove();
                html.querySelector(`[data-action="disableVideo"]`)?.remove();
            }

            if (rtcWorldSettings.mode != foundry.av.AVSettings.AV_MODES.AUDIO) {
                html.querySelectorAll(".status-muted").forEach(el => el.remove());
                html.querySelector(`[data-action="toggleAudio"]`)?.remove();
                html.querySelector(`[data-action="mutePeers"]`)?.remove();
            }
        }
    }
}