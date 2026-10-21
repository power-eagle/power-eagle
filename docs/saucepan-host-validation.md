# Saucepan workbench host validation

On 2026-10-21 the final integration passed in the running Windows x64 Eagle host using independently installed Saucepan `0.10.0+v0.10.0` and packaged SDK `0.2.0`.

The fixture copied production `dist` into a fresh temporary directory outside the checkout, bundled the current workbench UI into an acceptance page, and loaded the copied `saucepan-host.cjs` through Eagle's real Node bridge. Its workspace, source and manager root were isolated. It did not initialize or change the shared manager store or live Power Eagle workspace. No development server or runtime dependency installation was used.

The fixture installed and activated a local runtime package, rendered the package controls, disposed the catalog, and reloaded the actual Eagle renderer. After restart it rediscovered the same instance, refreshed to revision 2, rejected an invalid replacement while preserving the active revision, duplicated the package, removed the installation, and verified that the duplicate and source survived while the installation pin was released. Invalid candidate receipts remain inspectable by design.

The [recorded report](saucepan-host-validation.json) contains both the final-build checks and the host version observed in the first run of the same Eagle window. Eagle's API returned empty app-version fields on subsequent navigation, while Node/Electron versions remained available. The observed host was Eagle **4.0.0 build 23**, Electron **22.3.7**, Chrome **108.0.5359.215**, Node **16.17.1**, ABI **110**, Windows x64. The final copied host bundle SHA256 was `267c1af3f52a02901db8e579a3f27ea5516e014bf40f2ee0797fdff906a04e21`.

This establishes the acquisition lifecycle in the real Eagle runtime with packaged host code and the current workbench. It does not establish installation of a release `.eagleplugin` archive, a complete Eagle process restart, macOS/Linux support, or guaranteed asynchronous cleanup after renderer termination. Explicit preview closure is tested; page-exit cleanup is best effort and failures preserve retention.

## Reproduce

1. Run `npm run build`.
2. Set `POWER_EAGLE_TEST_SAUCEPAN` to a separately installed compatible executable if it is not in the default location.
3. Run `node scripts/prepare-saucepan-eagle.mjs`. It prints a new isolated page and result path.
4. Open the generated page in an Eagle plugin renderer through its `eagleplugin:` URL. It checks the real Eagle bridge before running.
5. After installation, click **Restart acceptance renderer**. Read the completed `result.json` and inspect the rendered workbench.

The fixture retains its temporary root for review. Never substitute live user state. A completed fixture should not be rerun in the same root; prepare a fresh fixture instead.

## Automated checks

- Production typecheck, built-in assembly, Vite build and CommonJS host build passed. Vite reports the existing large main-chunk warning.
- 165 tests across install, workspace, application and feature suites passed with the real manager enabled.
- Focused ESLint and `git diff --check` passed.
- The outside-checkout Node16 host harness passed install, restart, failed replacement, cross-window reader/reclaim and explicit removal checks.
- Strict OpenSpec validation passed for `adopt-saucepan-sdk`.

The real-provider regression first exposed stale CommonJS code when a failed candidate's directory was reused. Failed candidate paths now remain reserved, and the verified retry publishes the next unused revision. A separate disposal-failure test verifies that repeated preview close cannot release uncertain retention.

After acceptance, the production `dist/index.html` was restored in the original Eagle window. Its existing nine sources loaded, eight were active, and Add package / Package store setup were visible with no manager initialization.
