# What FL Launcher can do

*[Українською](FEATURES.uk.md)*

The full list of features, by block. The same description is inside the launcher (“About” → “Everything about FL Launcher”).

## 🚀 Launcher

- Left navigation rail (collapsible to icons); the green “Create” button opens a menu: new build, new group, **import by code**
- **“Continue” home screen**: the last played build, “Play” and “⚡ Boost FPS” buttons, recent builds, total play time
- **Play time**: per build (a chip in the card header) and overall across all builds, shown in minutes, hours and days
- Build window mode: by default a plain **× in the top-right corner**; single panel, tabs or a single tab are available too
- Dark and light themes, accent colour, interface scale, languages: Ukrainian, English, Russian
- Simple mode and custom field-visibility profiles; a short guided tour (skippable, reopenable)
- The game runs as a separate process, so the launcher can be closed after launch; offline launch when everything needed is already on disk
- Auto-updates for the launcher and the FL Bridge component; a running game is not closed by an update
- A game started BEFORE a restart for an update is picked up again afterwards: “Stop” keeps working
- The game version list is cached on disk: without internet the launcher still shows previously loaded versions
- OS notifications about mod installs and errors, plain-language explanations of typical launch errors

## 🎮 Builds

- Many separate builds: own folder, mods, worlds and settings; groups, drag-and-drop ordering, duplication
- Automatic install of **Fabric, Quilt, Forge, NeoForge** and the own **FL Loader**; loader version picker (recommended one marked); Java is chosen automatically
- A **“Build settings”** window with tabs: General, Optimization, Diagnostics, Snapshots, Client
- **Snapshots and rollback**: before optimizing, installing FPS mods or repairing, the launcher saves mods, config, options.txt and settings; rolling back deletes nothing and can itself be undone
- **Trial copy**: mods as hard links, no worlds; try mods and updates safely, then “Apply to the original” (with a snapshot first)
- **Impact measurement**: frame comparison between the original and the copy (main-menu benchmark, three runs with a warm-up)
- **Build code**: a short code (version, loader, Modrinth mods); a friend pastes it into “Import by code” and gets the same build
- Several copies of the same or different builds can run at the same time
- **Voxelin** is the author’s own game (a separate project, not Minecraft). In the launcher it is a separate build type: versions come from the Voxelin releases and no mod loader is needed

## ⚡ Optimization and diagnostics


### Profiles

- **Balanced / Max FPS / Quality**: memory and JVM flags chosen from your hardware (RAM, CPU, HDD/SSD)
- Safe options.txt edits with a backup and undo

### GPU and benchmark

- Choose the GPU for the game (integrated or discrete)
- A **two-GPU benchmark**: the launcher measures frame evenness and recommends the better one

### FPS mods

- Sodium, Lithium and others in one click — only after a preview of the list and your confirmation

### Bottleneck indicator

- An indicator in the report: memory, garbage-collector pauses, GPU, mods, disk
- The “🩺 Report” button copies diagnostics without tokens — easy to show to whoever is helping

### Repair the build

- Recognises out-of-memory, damaged natives, graphics init errors, a mod made for another version, a mod that crashed on load (even nested inside another), missing dependencies
- Deletes nothing: mods are disabled by renaming, and every change can be undone

## 🧩 Mods, shaders, resource packs

- Search and install mods, shader packs and resource packs from **Modrinth** (and CurseForge with an API key)
- Automatic required-library check before launch, plus a “Check dependencies” button
- Mod bundles (ready-made and your own), search among installed mods, system notifications about results

## 🎯 FL Client (in game)

- Menu on **Right Shift**: HUD (FPS, keys, CPS, armor, coordinates, clock, minimap, speed, direction, RAM, world day, session time) with a layout editor
- Utilities: toggle sprint, auto-respawn, streamer mode, chat time, slow mouse, hotbar slot locking
- **Friends chat and photos right in the game** (“Friends” and “Photos” tabs): works through the launcher’s local broker, the account token never reaches the game
- **Two separate parts with separate switches in build settings**: “regular features” and “cheats” (zoom, fullbright, free look). Cheats are off by default and are not even loaded until you enable them
- ⚠️ Servers may forbid third-party clients and cheats are forbidden almost everywhere: you can be banned. The launcher shows warnings and **is not responsible for punishments or bans**
- The client is **built into** the launcher (nothing to install separately): a global switch in launcher Settings (“Cosmetics and client”) and, per build, the “Client” tab in “Build settings”. The client code itself ships with the [fl-bridge](https://github.com/Faneraiy14/fl-bridge/releases) releases
- Works on Vanilla, FL Loader and, via `-javaagent`, on Fabric, Quilt, Forge, NeoForge (depends on the game version; details in the fl-bridge releases)

## 🪙 Cosmetics and the launcher account (FL Hub)

- A separate **launcher account** (nick + password) with a **recovery code**: forgot the password — reset it yourself, no owner needed
- Coins for play time, a daily bonus, achievements; cases and a prize wheel with cosmetics (capes, wings, halos, overlays), honest odds
- Cosmetics are visible in game on all supported loaders (built-in mechanism, can be turned off in settings)
- The server stores only the account, coins and cosmetics — **not your chats**

## 💬 Friends, chat and photos

- **Friends**: requests, accepting, status “in game / in launcher / offline”, blocking
- **Chat**: text, message reactions (6 emoji), photos (paste, file, drag-and-drop; compressed to JPEG ≤ 700 KB without metadata), unread counter
- **History stays on your computer only** (the `chats` folder next to the launcher): the hub just relays messages and deletes them after delivery. You can turn saving off or delete everything in settings
- **In-game photos**: a gallery of screenshots from all builds, preview, “Send to a friend”, “Show in folder”

## 👤 Game account and skins

- Offline by default; optional **Microsoft/Mojang** or **Ely.by** sign-in (with authlib-injector, everyone sees your skin on any server)
- Skin source: your own PNG, ely.by or Mojang; skins work on all loaders (via CustomSkinLoader)

## 🛡️ Security

- Every mod is scanned for suspicious bytecode; mods/resourcepacks/datapacks are re-checked before each launch; nothing is blocked silently — details are shown and you confirm (for example, a mod able to run external OS commands shows which file and what was found in it)
- Chat images are validated by content, not extension; the in-game broker listens only on 127.0.0.1 and requires a per-launch secret
- Tokens and passwords never go into reports, and the account token never goes into the game

## ⚙️ Settings

- Language, theme, accent, scale, build window mode, grouping, simple mode, custom profiles
- Cosmetics and in-game client, game window on Linux (X11), update interval, datapack scanning
- Chat: keep chats on this computer or not, delete all saved chats

## 📋 Requirements and supported versions

- **OS:** Windows 10 / 11 (64-bit) and Linux (64-bit): `.AppImage` for any distribution, `.deb` for Debian/Ubuntu-based ones
- **Minecraft versions:** from 1.14.4 up to the newest 26.x for FL Loader; for Fabric, Quilt, Forge, NeoForge — the versions the loader itself supports
- **What is “26.x”?** Mojang switched to year-based version numbers: 26.1, 26.2, 26.3 … are the 2026 releases of Minecraft
- **RAM and disk:** 8 GB of system RAM is comfortable (the game usually gets 3–6 GB); the installer is about 100 MB, each game version with libraries roughly 0.5–1 GB, plus worlds and mods
- **Loaders:** Vanilla, Fabric, Quilt, Forge, NeoForge, FL Loader
- **Java:** nothing to install — the launcher picks and downloads the right one for the game version
- Some client features depend on the game version; details are in the [fl-bridge](https://github.com/Faneraiy14/fl-bridge/releases) releases
