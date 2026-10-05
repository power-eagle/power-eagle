# Built-in Eagle tools

Power Eagle ships File Creator and Recent Libraries as ordinary new-format packages. Each built-in has a versioned `power-eagle/package` manifest, a declarative runtime document, and action exports that receive the same typed Eagle capabilities available to installed providers. Opening a built-in creates a runtime session and runs only its declared startup actions; rendering the document does not call Eagle.

## File Creator

File Creator submits a suggested file name to Eagle's save dialog and writes the file only after the user chooses a destination. A cancelled dialog reports cancellation and writes nothing. Host errors appear through the runtime action error path.

Extensions are trimmed, lowercased, and stripped of leading dots. They may contain letters, numbers, dots, plus signs, hyphens, and underscores. File names are trimmed and reject blank values, path separators, control characters, Windows-reserved punctuation, and trailing dots or spaces. The form's required-field validation prevents the host action from running when either field is empty.

Quick extensions belong to the open runtime session. Adding or removing one does not modify a package or write configuration. Initial content is deterministic:

| Extension | Initial content |
| --- | --- |
| `json` | an empty JSON object plus a newline |
| `md`, `markdown` | a heading derived from the file name |
| `html`, `htm` | a minimal HTML document with a title |
| all others | an empty file |

## Recent Libraries

Recent Libraries loads Eagle's actual history through the typed host adapter. The adapter classifies each path from filesystem evidence: an existing directory is `available`, a missing path or non-directory is `missing`, and an inspection failure is `inaccessible`. The `.library` suffix affects the display name only.

Filtering is case-insensitive and checks both the displayed name and exact path. Open is enabled only for an `available` entry and passes that entry's full path to the Eagle switch action. A host rejection is shown as an error and is never reported as a successful switch.

Remove and Clear verified missing change only the current runtime session list. Clear removes entries whose status is `missing`; it retains `inaccessible` entries because failed inspection is not evidence that a library is absent. Neither operation rewrites Eagle history, edits library metadata, or deletes files or directories. Refresh discards those session-only list changes by reading the host history again.
