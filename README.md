# FL Launcher — Releases

*[Українською](README.uk.md)*

This repository contains **only the built releases** of FL Launcher.
There's no source code here.

## Screenshots

| Home ("Continue") | A build |
|---|---|
| ![Home screen](docs/img/home.png) | ![Build card](docs/img/build-card.png) |
| **Client tab: regular features and cheats are separate switches** | **Friends and chat (history stays on your computer)** |
| ![Client tab](docs/img/client-tab.png) | ![Friends and chat](docs/img/friends-chat.png) |

*The screenshots use demo accounts and the Ukrainian interface (English and Russian are available too). The in-launcher "Everything about FL Launcher" window:* [screenshot](docs/img/about-features.png).

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
(the same text is inside the launcher: the ⓘ button at the bottom of the left panel → About → Everything about FL Launcher).

## Requirements

| | |
|---|---|
| **OS** | Windows 10 / 11 (64-bit); Linux (64-bit): `.AppImage` for any distribution, `.deb` for Debian/Ubuntu-based ones |
| **Minecraft** | 1.14.4 – the newest 26.x with FL Loader; for Fabric, Quilt, Forge and NeoForge — the versions those loaders support |
| **Java** | nothing to install: the launcher downloads the right one for each game version |
| **RAM** | 8 GB in the system is comfortable (the game itself usually gets 3–6 GB depending on the build and mods) |
| **Disk** | the installer is about 100 MB; each game version with its libraries takes roughly 0.5–1 GB, plus your worlds and mods |

> **What is "26.x"?** Mojang switched to year-based version numbers: 26.1, 26.2, 26.3 … are the 2026 releases of Minecraft.

## Other parts of the project

| Repository | What's there |
|---|---|
| [fl-bridge](https://github.com/Faneraiy14/fl-bridge) | releases of `FLBridge.jar` — the mod loader the launcher downloads on its own |
| source code | in a private repository |

## Files in a release

- `FL-Launcher-Setup-X.Y.Z.exe` — the installer
- `latest.yml` — the auto-update manifest the launcher needs
- `.blockmap` — lets updates download only the changed parts

## License

The contents of this repository (documentation and the release channel) are under the [MIT License](LICENSE). The launcher is distributed free of charge and as is, without warranty; its source code is private.

## Feedback

Found a bug or want a feature? Open an [issue](https://github.com/Faneraiy14/fl-launcher/issues) — for a bug, please include the launcher version, your OS, what you did and the "🩺 Report" text from the launcher (it contains no tokens or passwords).
