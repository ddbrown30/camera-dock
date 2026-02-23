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
});

Hooks.once("ready", () => {
    const settings = game.settings.get("core", "rtcClientSettings");
    settings.dockPosition = "bottom";
    settings.hideDock = false;
    Object.values(settings.users).forEach(userSettings =>  userSettings.popout = false);
    game.settings.set("core", "rtcClientSettings", settings);
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
    const uiBottom = document.getElementById("ui-bottom");
    const cameraViews = document.getElementById("camera-views");
    if (uiBottom && cameraViews) {
        uiBottom.prepend(cameraViews);
    }

    const isButton = !!document.querySelector("#camera-views > .user-controls button[data-action='cycle-video']");
    if (isButton) return;
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
    const userControlsNav = document.querySelector("#camera-views > .user-controls");
        userControlsNav.appendChild(sizeBTN);

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

    const rtcWorldSettings = game.settings.get('core', 'rtcWorldSettings');
    if (rtcWorldSettings.mode != foundry.av.AVSettings.AV_MODES.AUDIO_VIDEO) {
        if (rtcWorldSettings.mode != foundry.av.AVSettings.AV_MODES.VIDEO) {
            html.querySelector(".status-hidden")?.remove();
            html.querySelector(`[data-action="toggleVideo"]`)?.remove();
            html.querySelector(`[data-action="disableVideo"]`)?.remove();
        }

        if (rtcWorldSettings.mode != foundry.av.AVSettings.AV_MODES.AUDIO) {
            html.querySelector(".status-muted")?.remove();
            html.querySelector(`[data-action="toggleAudio"]`)?.remove();
            html.querySelector(`[data-action="mutePeers"]`)?.remove();
        }
    }
});
