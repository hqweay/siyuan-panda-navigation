> [🇨🇳 中文](./README.zh-CN.md)

# 🐼 Panda Navigation

A sleek, adaptive floating navigation bar for SiYuan Note, designed for both mobile and desktop. Makes browsing documents in SiYuan feel natural and efficient.

Repository: [GitHub - hqweay/siyuan-panda-navigation](https://github.com/hqweay/siyuan-panda-navigation)

https://github.com/user-attachments/assets/e38886d1-bf0f-4c03-95fc-914b25b09d3b

https://github.com/user-attachments/assets/b157746c-7deb-480a-aa9e-c83bbefb468a

https://github.com/user-attachments/assets/85b66ecc-f7dd-4228-8c3d-02895e31998c

https://github.com/user-attachments/assets/55950d50-a6b8-4c3c-8f0a-1f3da14294f1

## Features

- **Drag anywhere on desktop**: A minimal floating icon — no clutter, no space wasted. Drag it to any corner; the position is remembered automatically.
- **Pill-shaped nav on mobile**: Sits at the bottom, auto-collapses into a tiny pill when scrolling down so it never blocks your content. Tap to expand.
- **Smooth panel transitions**: Menus and groups glide in and out like a dynamic island, adapting width to button count.
- **Scroll to top & random roam**: One tap to jump back to the top of the current doc, or open a random note and wander your knowledge base.
- **Freely customizable menu**: No rigid hierarchy. Create groups (list or grid layout) and arrange shortcuts however you like.
- **One-tap preset switching**: Presets aren't just backups — "Switch Preset" is designed as a live button you can trigger anytime. Set up different presets for reading, writing, or exploring, then switch between them like changing channels.
- **Built-in preset templates**: Not sure where to start? Import a ready-made preset (like the basic 9-grid layout) with one click. You can also save your own setup as a custom preset for backup or scene switching.
- **Per-device visibility**: Control which buttons show on mobile, desktop, or both. Labels can be toggled independently per device.
- **One-click configuration sharing**: Share a single action button (including complex custom JS scripts) or your entire layout preset as a link. Tap the link on desktop or mobile, or paste it in settings, to import instantly.

## Quick Start

The plugin is pending marketplace review. Install it manually:

- Use the [Install Marketplace Plugin](https://github.com/TCOTC/install-package) helper and enter `hqweay/siyuan-panda-navigation`
- Or download the latest release from the [GitHub Releases page](https://github.com/hqweay/siyuan-panda-navigation/releases), unzip it, and place it in your SiYuan plugins directory

## Configuration

### Basic Appearance

- **Enable Navigation Bar**: Choose to show on mobile, desktop, or both.
- **Button Labels**: Toggle text labels below buttons on or off.

### Presets & Reset

- **Save & Load Presets**: Import built-in presets (e.g., "Basic Grid") directly from settings, or save your current navigation layout as a custom preset. When loading a custom preset, you can either **overwrite** the current menu or **append** it as a new group.
- **Restore Defaults**: Messed up your menu? Find the option in the preset dropdown and restore factory defaults instantly.

### Action Types

Create buttons as individual actions or group them. Supported action types:

| Type | Description |
|------|-------------|
| **Built-in** | Enhanced navigation features: document tree traversal (parent/child/sibling/back/forward), scroll to top, random doc, custom links / doc IDs, SQL-powered random roam, add current doc to an attribute view, execute custom JS scripts |
| **System Command** | Trigger any global SiYuan system command directly |
| **Editor Command** | Works as a floating format brush on mobile — trigger native editor actions (bold, list, heading, etc.), great for tablets and phones |
| **Plugin Command** | Trigger commands registered by **other SiYuan plugins** (e.g., open today's daily note) |

### 🤖 AI Agent Support (MCP + Skill)

Don't know how to code but want to write custom JS scripts for advanced automation? Panda Navigation has deep integration with external AI assistants (Cline, Cursor, Antigravity, etc.):

1. **Built-in AI Skill**: The plugin ships a specially tuned prompt file (`skills/siyuan-panda-navigation/SKILL.md` under the plugin directory). Tell your AI: **"Load the skill from the Panda Navigation plugin directory, then help me write a script..."** — the AI immediately enters a disciplined programming mode.
2. **MCP Tool Mounting**: Once activated by the Skill, the AI automatically calls Panda Navigation's MCP tools to read SiYuan's native TypeScript source code, the full `kits` development toolkit, and a pitfall-avoidance guide.
3. **Conversation = Code**: Describe what you want in plain language (e.g., "Write a script that counts all today's unfinished todos and shows them in a popup"). The AI generates accurate code from the complete API context — no more guessing.

Zero coding experience required. The `Skill + MCP` combo lets anyone build custom advanced actions.

---

## 🛠 Developer Guide

Panda Navigation automates the integration of new features. Extending built-in commands or adding AI capabilities is straightforward.

### 1. Add a Built-in Command

1. Create a new `.ts` file under `src/builtins/commands/`.
2. Implement and export a `BuiltinCommand` object.

You can specify the input type (text field or textarea) for user parameters. The build system automatically scans and registers your command — no manual wiring needed.

### 2. Add New AI Capabilities

The plugin wraps a `utils` library for scripts and auto-exports these tools to AI models. When you add a function in `commands/` or `panda-utils.ts`, the build system extracts its parameters and descriptions, then formats them as standard tools for AI consumption. Write the logic, and the AI learns to use it automatically.

## Feedback

Found a bug or have a suggestion? Open an issue on [GitHub](https://github.com/hqweay/siyuan-panda-navigation/issues).
