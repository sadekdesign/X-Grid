# X-Grid

**Grids and guides for Adobe Illustrator — a free tool from [X-Output](https://x-output.com/lab).**

Column, modular and baseline grids, layout systems, social-media safe zones and 40+ classic
composition guides (thirds, golden ratio, dynamic symmetry, perspective…), built as real
Illustrator guides in one click.

## What it does

- **Columns · Modular · Baseline · Layout · Comp** — five tabs, one panel.
- **Works where you are** — the grid goes on the active artboard by default, on all artboards,
  on one you pick, or **inside the selected objects**.
- **Grids stack** — columns, a baseline and safe zones can share an artboard; each tab
  regenerates only its own guides.
- **Never touches your own guides** — everything X-Grid draws lives on an `X-Grid` layer.
- **Remembers** — each grid stores its settings in the file. Pick an artboard and click its grid
  to load the values back.
- **Live grid** — resize or move an artboard and its grids rebuild to fit.
- **Match selected text** — the baseline grid takes the leading and first baseline of a text frame.
- **Social safe zones** — Instagram post / story / reel, TikTok, YouTube thumbnail.
- **Shapes** — turn columns or cells into rectangles for wireframes.
- **Snap to whole pixels**, mm / cm / in / px input, presets you can save, English and **Arabic (RTL)**.
- Fast on heavy files: a 30,000-path document regenerates in milliseconds.

Requires Illustrator CC 2015 (v19) or later, Windows or macOS.

## Install or update

The same command installs and updates. No admin rights, no debug mode.

**Windows** (PowerShell):

```powershell
irm https://raw.githubusercontent.com/sadekdesign/X-Grid/main/install/install.ps1 | iex
```

**macOS** (Terminal):

```bash
curl -fsSL https://raw.githubusercontent.com/sadekdesign/X-Grid/main/install/install.sh | bash
```

Then restart Illustrator and open **Window › Extensions › X-Grid**.

**With Claude:** give Claude (Claude Code or the desktop app) this repository's link and say
*"install X-Grid"* or *"update X-Grid"*. The steps it follows are in [`CLAUDE.md`](CLAUDE.md).

**By hand:** download `X-Grid.zxp` from [Releases](https://github.com/sadekdesign/X-Grid/releases),
rename it to `.zip`, unzip it, and put the folder (named `com.xoutput.xgrid`) in
`%APPDATA%\Adobe\CEP\extensions\` (Windows) or
`~/Library/Application Support/Adobe/CEP/extensions/` (macOS).

### Uninstall

Delete the `com.xoutput.xgrid` folder from the extensions folder above, then restart Illustrator.
Grids already in your files stay as normal guides on the `X-Grid` layer.

## Building a release (maintainers)

See [`build/release.ps1`](build/release.ps1): it stages the panel, signs it with `ZXPSignCmd`
(certificate and password come from environment variables and are never committed) and can
publish a GitHub release that the installers pick up.

## عربي

**X-Grid** إضافة مجانية لـ Illustrator من X-Output: شبكات أعمدة ووحدات وخط أساس، ومناطق آمنة
للسوشيال، وأكثر من 40 دليل تكوين. الواجهة متاحة بالعربي (من الإعدادات ← اللغة).
للتثبيت أو التحديث: أعطِ Claude رابط هذا المستودع وقل له «ثبّت X-Grid».

---

Made by [X-Output](https://x-output.com) · Fonts: SIL Open Font License 1.1 (see [`fonts/`](fonts/README.md))
