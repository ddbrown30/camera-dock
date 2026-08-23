Hooks.once('init', function () {
    game.settings.register("camera-dock", "camera-size", {
        name: "",
        default: 2,
        type: Number,
        scope: "client",
        config: false,
        onChange: () => {
            document.documentElement.style.setProperty('--camera-size', game.settings.get("camera-dock", "camera-size"));
        },
    });
    document.documentElement.style.setProperty('--camera-size', game.settings.get("camera-dock", "camera-size"));

    game.settings.register("camera-dock", "floating", {
        name: "",
        default: false,
        type: Boolean,
        scope: "client",
        config: false,
    });

    game.settings.register("camera-dock", "floating-position", {
        name: "",
        default: { top: 100, left: 100 },
        type: Object,
        scope: "client",
        config: false,
    });
});

let cameraViewsApp = null;
let lastFloatingPosition = null;

function positionCameraViews(app, cameraViews, left, top) {
    app.setPosition({ left, top });
    cameraViews.style.left = `${left}px`;
    cameraViews.style.top = `${top}px`;
    lastFloatingPosition = { left, top };
}

function applyDockState(app, cameraViews) {
    if (!cameraViews) return;
    const floating = game.settings.get("camera-dock", "floating");
    cameraViews.classList.toggle("floating", floating);
    if (floating) {
        if (cameraViews.parentElement !== document.body) {
            document.body.appendChild(cameraViews);
        }
        const position = game.settings.get("camera-dock", "floating-position");
        positionCameraViews(app, cameraViews, position.left, position.top);
    } else {
        const uiBottom = document.getElementById("ui-bottom");
        if (uiBottom && cameraViews.parentElement !== uiBottom) {
            uiBottom.prepend(cameraViews);
        }
    }
}

Hooks.once("ready", () => {
    const settings = game.settings.get("core", "rtcClientSettings");
    settings.dockPosition = "bottom";
    settings.hideDock = false;
    Object.values(settings.users).forEach(userSettings => userSettings.popout = false);
    game.settings.set("core", "rtcClientSettings", settings);

    let dragState = null;

    document.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        const cameraViews = document.getElementById("camera-views");
        if (!cameraViews || !cameraViewsApp || !cameraViews.classList.contains("floating")) return;
        if (!cameraViews.contains(e.target)) return;
        if (e.target.closest("button, input, select, a, textarea")) return;

        const origin = lastFloatingPosition ?? cameraViewsApp.position;
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
        if (!dragState || !cameraViewsApp) return;
        const cameraViews = document.getElementById("camera-views");
        if (!cameraViews) return;

        const dx = e.clientX - dragState.startX;
        const dy = e.clientY - dragState.startY;
        const maxLeft = Math.max(0, window.innerWidth - cameraViews.offsetWidth);
        const maxTop = Math.max(0, window.innerHeight - cameraViews.offsetHeight);
        const left = Math.clamp(dragState.origLeft + dx, 0, maxLeft);
        const top = Math.clamp(dragState.origTop + dy, 0, maxTop);

        positionCameraViews(cameraViewsApp, cameraViews, left, top);
    });

    document.addEventListener("mouseup", () => {
        if (!dragState) return;
        dragState = null;
        document.body.style.userSelect = "";
        if (lastFloatingPosition) {
            game.settings.set("camera-dock", "floating-position", lastFloatingPosition);
        }
    });
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

Hooks.on("renderCameraViews", (app, html) => {
    cameraViewsApp = app;

    const cameraViews = document.getElementById("camera-views");
    applyDockState(app, cameraViews);

    const isButton = !!document.querySelector("#camera-views > .user-controls button[data-action='cycle-video']");
    if (!isButton) {
        const sizeBTN = document.createElement("button");
        sizeBTN.type = "button";
        sizeBTN.classList.add("av-control", "inline-control", "icon", "fa-solid", "fa-fw", "fa-arrows-alt-h");
        sizeBTN.dataset.action = "cycle-video";
        sizeBTN.dataset.tooltip = "Cycle Size";

        sizeBTN.addEventListener("mouseup", (e) => {
            const size = game.settings.get("camera-dock", "camera-size");
            const diff = e.button === 0 ? 0.5 : -0.5;
            game.settings.set("camera-dock", "camera-size", Math.max(1, (size + diff) % 3.5));
        });

        const floatBTN = document.createElement("button");
        floatBTN.type = "button";
        floatBTN.classList.add("av-control", "inline-control", "icon", "fa-solid", "fa-fw", "fa-thumbtack");
        floatBTN.dataset.action = "toggle-float";
        floatBTN.dataset.tooltip = game.settings.get("camera-dock", "floating") ? "Dock" : "Undock";

        floatBTN.addEventListener("click", () => {
            const cv = document.getElementById("camera-views");
            const floating = !game.settings.get("camera-dock", "floating");
            if (floating && cv && cameraViewsApp) {
                const rect = cv.getBoundingClientRect();
                game.settings.set("camera-dock", "floating-position", { top: rect.top, left: rect.left });
            }
            game.settings.set("camera-dock", "floating", floating);
            floatBTN.dataset.tooltip = floating ? "Dock" : "Undock";
            if (cameraViewsApp) applyDockState(cameraViewsApp, cv);
        });

        const userControlsNav = document.querySelector("#camera-views > .user-controls");
        userControlsNav.appendChild(sizeBTN);
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
});
