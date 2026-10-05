# Eagle host capabilities

Power Eagle keeps host access under `src/host`. Runtime documents and compiled providers receive typed capabilities or registered callable adapters; presentation components do not read or modify Eagle data while rendering.

## Supported boundary

The supported Eagle target remains the environment observed by the provider-host checkpoint: Eagle 4.0.0 build 23 on Windows x64, Electron 22.3.7, Node 16.17.1, with both the `eagle` plugin API global and CommonJS `require` bridge present. `observeEagleCapabilities` performs a read-only surface check for the individual plugin APIs. It does not invoke an operation or treat a method's presence as proof that a later call succeeded.

The adapter exposes these operation groups:

| Group | Host boundary | Result rule |
| --- | --- | --- |
| assets | `eagle.item` | Queries return inert typed records. Selection and `Item.save()` must return true. Imports return Eagle's item id. |
| folders and tags | `eagle.folder`, `eagle.tag` | Results are copied into typed records; errors propagate. |
| current library | `eagle.library.info()` | Name and path are required in the host response. |
| library history and switch | Eagle local Web API v1 | History must be a string array. Switch returns the response data and a failed HTTP or Eagle response rejects. |
| clipboard | `eagle.clipboard` | Reads return Eagle's text. Writes complete only after the host call returns. |
| file picker and save dialog | `eagle.dialog` | Cancellation is a normal explicit result. Rejections remain failures. |
| filesystem | Eagle's CommonJS Node bridge | Inspection and writes use the injected filesystem adapter, so development tests never touch a live library. |
| runtime requests | injected `fetch` | JSON stays typed, text stays text, 204 becomes null, and non-2xx responses reject. |

The plugin API is the primary boundary for library content. [Eagle's Item API](https://developer.eagle.cool/plugin-api/api/item) requires callers to modify returned items and call `save()`; [the Folder API](https://developer.eagle.cool/plugin-api/api/folder) follows the same rule. Power Eagle never edits `metadata.json`, `index.json`, or another library metadata file directly.

The plugin API can inspect the current library but has no recent-history or switch method. The retained local Web API bridge therefore handles those two operations. It reads the developer token once from `application/info`, sends literal JSON with `fetch`, validates the response envelope, and reports HTTP, transport, and protocol failures. General runtime HTTP requests use a separate adapter and do not inherit Eagle's local token.

## Errors and cancellation

Unavailable and failed operations throw `HostCapabilityError` with `capability`, `operation`, and one of `unavailable`, `failed`, or `invalid-result`. The original error remains available as `cause`. Callers must use the action error path; a rejection never triggers a success notification.

File-open and file-save cancellation are expected outcomes. File selection returns `null`; text creation returns `{ "status": "cancelled" }`. Neither path writes a file. Active view abort signals are passed to file selection and HTTP requests so scope replacement can prevent a late result from mutating the replacement view.

## Library history validity

History remains read-only at the adapter layer. Each returned path is checked through injected filesystem evidence:

- an existing directory is `available`;
- a missing path or non-directory is `missing`;
- an inspection error is `inaccessible` with its reason.

The `.library` suffix is used only to derive a display name. It never determines validity. Removing an entry or clearing invalid entries in the Recent Libraries tool changes that tool's current list only; it does not rewrite Eagle settings, alter persisted history, or delete a directory.

## Declarative Eagle widgets

The built-in `power-eagle.eagle-actions` contribution exposes typed folder listing/opening, tag listing, library history/switching, metadata update, and batch import calls. Runtime documents pair those calls with FolderTree, TagPicker, LibraryPicker, MetadataEditor, and ImportQueue. Choice cancellation emits a local event and does not invoke Eagle. Metadata submission calls `assets.updateMetadata`, which uses the supported `Item.save()` path described above.

Batch import preserves request order and records each actual path or URL result independently, so one rejection cannot be displayed as a successful batch. Runtime activation signals are checked after host completion; disposing or replacing a view aborts its action scope and prevents a late result from writing into the disposed view. Eagle's current item import methods do not expose cancellation, so an already-started host import may still finish inside Eagle even though its disposed view ignores the result.

## Build examples

The catalog's image, audio, and video fixtures ship under `dist/assets` through Vite's public directory. The deterministic 8×8 H.264 fixture is the public compatibility sample from [A Very Tiny MP4](https://gist.github.com/dmlap/5643609). These local assets prevent the packaged catalog from requesting the old missing `preview.png`, `missing-gallery-image.png`, `example-audio.mp3`, and root-level `example-video.mp4` paths.
