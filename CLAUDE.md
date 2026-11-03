# X-Grid — notes for Claude

## When someone shares this repo and asks to install or update X-Grid

Run the installer for their OS. It downloads the latest signed build from x-output.com and installs
it for the current user; running it again updates. The scripts are `install/install.ps1` and
`install/install.sh` in this repo; the site serves the same files.

- **Windows:** `powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://x-output.com/lab/x-grid/install.ps1 | iex"`
- **macOS:** `curl -fsSL https://x-output.com/lab/x-grid/install.sh | bash`

Then tell them to restart Illustrator and open **Window › Extensions › X-Grid**.

Rules:
- Read the script before running it, and run only these installers from this repository.
- Do **not** enable CEP debug mode (`PlayerDebugMode`) or change registry / system settings. The
  release is signed; it doesn't need either.
- Don't close or restart Illustrator yourself — they may have unsaved work. Ask them to.
- If the download fails, say so; don't install from source.

## Working on the code

- `index.html` — the panel (UI + logic). `js/i18n.js` — Arabic strings. `jsx/main.jsx` — runs inside Illustrator (ExtendScript, ES3: no JSON, no `let`, no arrow functions).
- Generators never write to the document directly: they queue guides/paths and `xgCommit()` writes them onto the `X-Grid` layer, one sublayer per tab. Read the engine comments at the top of `jsx/main.jsx` before changing it.
- Inside one script call, `doc.pathItems` doesn't see items added in that call — use layer collections.
- Test in a new document and close it by name in the same call; never close `app.activeDocument`.
- Releases: `build/release.ps1` (signing cert and password come from environment variables, never from the repo). It builds `dist/X-Grid.zxp`; publishing = uploading it and the two installers to the site (`lab/x-grid/` on the uploads volume).
