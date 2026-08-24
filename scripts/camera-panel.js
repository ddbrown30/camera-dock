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
        if (CameraPanel.getDetachedWindow()) {
            cameraViews.classList.remove("undocked");
            return;
        }
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
        const searchDoc = CameraPanel.cameraViewsApp?.element?.ownerDocument ?? document;
        const navs = [...searchDoc.querySelectorAll(`[data-application-part="controls"][data-user="${game.user.id}"]`)];
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
            const cameraViews = CameraPanel.cameraViewsApp?.element;
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

    static getDetachedWindow() {
        if (CameraPanel.detachedWin && !CameraPanel.detachedWin.closed) {
            return CameraPanel.detachedWin;
        }
        return null;
    }

    static isElementInMainDocument() {
        const win = CameraPanel.cameraViewsApp?.element?.ownerDocument?.defaultView;
        return !win || win === window;
    }

    static syncDetachedDocumentState() {
        const win = CameraPanel.getDetachedWindow();
        if (!win) return;

        win.document.documentElement.style.setProperty('--camera-size', Utils.getSetting(MODULE_CONFIG.SETTING_KEYS.cameraSize));
        win.document.documentElement.dataset.cameraOrientation = Utils.getSetting(MODULE_CONFIG.SETTING_KEYS.cameraOrientation);
        win.document.documentElement.classList.toggle("camera-dock-bottom-below-video", Utils.getSetting(MODULE_CONFIG.SETTING_KEYS.bottomBelowVideo));

        const cameraViews = CameraPanel.cameraViewsApp?.element;
        if (cameraViews) {
            cameraViews.style.maxWidth = "none";
            cameraViews.style.maxHeight = "none";
        }
    }

    static updateDetachButtonState(btn) {
        if (!btn) return;
        const detached = !!CameraPanel.getDetachedWindow();
        btn.classList.toggle("fa-arrow-up-right-from-square", !detached);
        btn.classList.toggle("fa-arrow-down-to-square", detached);
        btn.dataset.tooltip = detached ? "Re-attach" : "Detach into Window";
    }

    static updateFloatButtonState(btn) {
        if (!btn) return;
        const detached = !!CameraPanel.getDetachedWindow();
        btn.hidden = detached;
        btn.disabled = detached;
    }

    static async sizeDetachedWindow(win) {
        if (!win) return;
        // Let layout settle after syncDetachedDocumentState()'s class/attribute changes
        await new Promise(resolve => win.requestAnimationFrame(() => win.requestAnimationFrame(resolve)));

        const scrollable = win.document.querySelector(".scrollable");
        const container = win.document.querySelector(".camera-container");
        if (!scrollable || !container) return;

        const horizontalPadding = parseFloat(win.getComputedStyle(scrollable).paddingLeft)
            + parseFloat(win.getComputedStyle(scrollable).paddingRight);
        const contentWidth = Math.ceil(container.getBoundingClientRect().width + horizontalPadding);
        const contentHeight = Math.ceil(scrollable.getBoundingClientRect().height);

        const chromeWidth = Math.max(0, win.outerWidth - win.innerWidth);
        const chromeHeight = Math.max(0, win.outerHeight - win.innerHeight);
        const width = contentWidth + chromeWidth;
        const height = contentHeight + chromeHeight;

        try {
            win.resizeTo(width, height);
            win.moveTo(
                Math.round((screen.width - width) / 2),
                Math.round((screen.height - height) / 2)
            );
        } catch (err) {
            // Some browsers restrict resizeTo/moveTo; not critical if it's a no-op.
        }
    }

    static async waitForDetachedWindow(timeout = 5000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const win = CameraPanel.cameraViewsApp?.element?.ownerDocument?.defaultView;
            if (win && win !== window && win.document?.readyState === "complete") return win;
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        return null;
    }

    static registerDetachedWindowAutoReattach(win) {
        CameraPanel.clearDetachedWindowAutoReattach();
        const handler = () => {
            if (CameraPanel.getDetachedWindow() === win) {
                CameraPanel.reattach();
            }
        };
        win.addEventListener("pagehide", handler);
        CameraPanel.detachedWindowUnload = { win, handler };
    }

    static clearDetachedWindowAutoReattach() {
        if (CameraPanel.detachedWindowUnload) {
            const { win, handler } = CameraPanel.detachedWindowUnload;
            win.removeEventListener("pagehide", handler);
            CameraPanel.detachedWindowUnload = null;
        }
    }

    static async waitUntilReattached(timeout = 5000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            if (CameraPanel.isElementInMainDocument()) return true;
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        return CameraPanel.isElementInMainDocument();
    }

    static async reattach() {
        const app = CameraPanel.cameraViewsApp;
        if (!app) return;

        await app.attachWindow();
        await CameraPanel.waitUntilReattached();
        CameraPanel.detachedWin = null;
        CameraPanel.detachedParent = null;
        CameraPanel.onRenderCameraViews(app, app.element);
    }

    static reclaimDetachedElement(cameraViews) {
        const detachedWin = CameraPanel.getDetachedWindow();
        if (!detachedWin || !CameraPanel.isElementInMainDocument()) return;

        const parent = CameraPanel.detachedParent ?? detachedWin.document.body;
        parent?.appendChild(cameraViews);
    }

    static onRenderCameraViews(app, html) {
        CameraPanel.cameraViewsApp = app;

        const cameraViews = app.element;
        CameraPanel.reclaimDetachedElement(cameraViews);
        CameraPanel.applyDockState(app, cameraViews);
        CameraPanel.attachUserControls(cameraViews);
        CameraPanel.syncDetachedDocumentState();

        const userControlsNav = CameraPanel.getUserControlsNav();
        CameraPanel.updateDetachButtonState(userControlsNav?.querySelector('button[data-action="detach-panel-dock"]'));
        CameraPanel.updateFloatButtonState(userControlsNav?.querySelector('button[data-action="toggle-panel-dock"]'));

        const hasUndockButton = !!userControlsNav?.querySelector('button[data-action="toggle-panel-dock"]');
        if (!hasUndockButton && userControlsNav) {
            const floatBTN = document.createElement("button");
            floatBTN.type = "button";
            floatBTN.classList.add("av-control", "inline-control", "icon", "fa-solid", "fa-fw", "fa-thumbtack");
            floatBTN.dataset.action = "toggle-panel-dock";
            const initiallyUndocked = Utils.getSetting(MODULE_CONFIG.SETTING_KEYS.undocked);
            floatBTN.dataset.tooltip = initiallyUndocked ? "Dock" : "Undock";
            floatBTN.classList.toggle("is-undocked", initiallyUndocked);
            CameraPanel.updateFloatButtonState(floatBTN);

            floatBTN.addEventListener("click", () => {
                if (CameraPanel.getDetachedWindow()) return;
                const cv = CameraPanel.cameraViewsApp?.element;
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

            const detachBTN = document.createElement("button");
            detachBTN.type = "button";
            detachBTN.classList.add("av-control", "inline-control", "icon", "fa-solid", "fa-fw");
            detachBTN.dataset.action = "detach-panel-dock";
            CameraPanel.updateDetachButtonState(detachBTN);

            detachBTN.addEventListener("click", async () => {
                const app = CameraPanel.cameraViewsApp;
                if (!app) return;

                const currentWin = CameraPanel.getDetachedWindow();
                if (currentWin) {
                    CameraPanel.clearDetachedWindowAutoReattach();
                    await CameraPanel.reattach();
                    currentWin.close();
                } else {
                    // Foundry's detach positioning math (#getVisibleBoundingBox) requires the app's element to be not static
                    // Switch our panel to relative only for the duration of the detach call so the bounding box can be computed.
                    const cameraViews = app.element;
                    cameraViews.style.setProperty("position", "relative", "important");
                    try {
                        await app.detachWindow();
                    } finally {
                        cameraViews.style.removeProperty("position");
                    }

                    const newWin = await CameraPanel.waitForDetachedWindow();
                    if (newWin) {
                        CameraPanel.detachedWin = newWin;
                        CameraPanel.detachedParent = app.element.parentElement;
                        CameraPanel.registerDetachedWindowAutoReattach(newWin);
                        CameraPanel.syncDetachedDocumentState();
                        await CameraPanel.sizeDetachedWindow(newWin);
                    }
                }
                CameraPanel.syncDetachedDocumentState();
                CameraPanel.updateDetachButtonState(detachBTN);
                CameraPanel.updateFloatButtonState(floatBTN);
            });

            userControlsNav.appendChild(detachBTN);

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