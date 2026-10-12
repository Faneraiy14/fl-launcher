# FL Launcher — Releases

*[Українською](README.uk.md)*

This repository contains **only the built releases** of FL Launcher.
There's no source code here.

## Download

Grab the latest version from the [Releases](https://github.com/Faneraiy14/fl-launcher/releases/latest)
page — the `FL-Launcher-Setup-*.exe` file.

After that, the launcher updates itself: it checks for new releases on
startup and offers to install them.

> Windows may show a blue "Windows protected your PC" screen — the
> project doesn't have a paid signing certificate. Click "More info",
> then "Run anyway".

## What FL Launcher is

An Electron-based Minecraft launcher: manages instances, automatically
installs Fabric, Forge, NeoForge, and Quilt, lets you search and
install mods, manage skins, and includes its own FL Loader mod loader.
On top of that: built-in optimization and a "repair the build" tool,
snapshots with rollback, trial copies and shareable build codes, an
in-game client (HUD, menu, chat) with separate switches for regular
features and cheats, cosmetics with an in-game currency, and friends with
a chat whose history is kept only on your own computer.

**Full feature list, by block: [FEATURES.md](FEATURES.md)**
(the same text is inside the launcher: About → Everything about FL Launcher).

## Other parts of the project

| Repository | What's there |
|---|---|
| [fl-bridge](https://github.com/Faneraiy14/fl-bridge) | releases of `FLBridge.jar` — the mod loader the launcher downloads on its own |
| source code | in a private repository |

## Files in a release

- `FL-Launcher-Setup-X.Y.Z.exe` — the installer
- `latest.yml` — the auto-update manifest the launcher needs
- `.blockmap` — lets updates download only the changed parts
