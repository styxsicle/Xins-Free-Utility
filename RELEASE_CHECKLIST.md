# XTweaks Free — Release Checklist

## Dev workflow

```bash
# Run in development
npm start

# Build Windows installer (output → dist/)
npm run dist

# Build unpacked (no installer, faster — for local smoke testing)
npm run pack
```

## Build output

After `npm run dist`, the installer appears at:

```
dist/XTweaks Free Setup 1.0.0.exe
```

This is the file users download.

## TODO before first public release

- [ ] **Add icon** — place a 256×256 ICO at `assets/icon.ico` before building.
      A usable placeholder exists but verify it looks correct in the installer and
      on the desktop shortcut.
- [ ] **Code signing** — unsigned builds trigger Windows SmartScreen on first run
      (see warning below). Obtain an EV or OV code-signing certificate and add it
      to the `win` block in `package.json` when ready.
- [ ] **Bump version** — update `"version"` in `package.json` before each release
      (e.g. `1.0.1`, `1.1.0`). The version appears in the installer filename and
      the Add/Remove Programs entry.
- [ ] **Test on a clean Windows machine** — ideally one that has never had XTweaks
      installed. Confirms no dev-machine artifacts sneak into the build.

---

## Manual test checklist

Run through this before uploading to GitHub Releases.

### Startup
- [ ] Fresh app launch shows loading screen immediately
- [ ] Loading screen stays visible for ~1 second then fades out smoothly
- [ ] Home entrance animation plays automatically after loader disappears
- [ ] Home animation does **not** play behind the loader

### Navigation
- [ ] Clicking Home tab replays animation on the **first** click (not second)
- [ ] Cleanup page opens and displays cards
- [ ] Startup page opens and auto-scans on first visit
- [ ] Restore Point page opens and shows cards
- [ ] Settings page opens
- [ ] All other nav tabs open without errors

### Functionality
- [ ] Tweaks on Home page either apply successfully or show a clear "requires admin" message
- [ ] Cleanup scan runs (no fake results)
- [ ] Startup page scan shows real startup entries
- [ ] Restore point creation works or shows honest error/admin prompt
- [ ] No login page, auth modal, or Discord login anywhere in the app
- [ ] No fake backend loading or fabricated scan results

### Packaged installer
- [ ] Installer launches without immediate SmartScreen block (or user can click through)
- [ ] Install wizard allows choosing install directory
- [ ] Desktop shortcut created after install
- [ ] Start Menu shortcut created after install
- [ ] App launches from desktop shortcut
- [ ] App launches from Start Menu
- [ ] App closes normally
- [ ] App reopens normally after close

---

## Release steps

1. Commit all changes to git:
   ```bash
   git add -A
   git commit -m "release: v1.0.0"
   ```

2. Build the installer:
   ```bash
   npm run dist
   ```

3. Verify `dist/XTweaks Free Setup 1.0.0.exe` exists and is non-zero in size.

4. Create a GitHub Release:
   - Go to your repo → **Releases** → **Draft a new release**
   - Tag: `v1.0.0`
   - Title: `XTweaks Free v1.0.0`
   - Upload: `dist/XTweaks Free Setup 1.0.0.exe`
   - Publish

---

## Windows SmartScreen warning

> **Unsigned builds will show a SmartScreen "Windows protected your PC" warning
> on first run.** This is normal for any new, unsigned Windows executable.
>
> Users can click **"More info" → "Run anyway"** to proceed. This warning goes
> away after enough users have run the installer (reputation-based) or after you
> add a code-signing certificate.
>
> Code signing can be added to `package.json` under `win.certificateFile` and
> `win.certificatePassword` when you have a certificate.
