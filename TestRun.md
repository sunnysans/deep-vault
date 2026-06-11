# Deep Vault — Manual Test Run

**Version under test:** 4.0.0
**Date:** _______________
**Tester:** _______________
**Platform (primary):** _______________

---

## Pre-Test Setup

Before running any test case:

1. Build the plugin: `npm run build`
2. Deploy to vault: `npm run deploy -- /path/to/vault`
3. Reload Obsidian: `Ctrl+P` → "Reload app without saving"
4. Confirm plugin version in Settings → Community Plugins matches `4.0.0`

---

## Summary — Sign-off Table

| ID | Test Case | Result | Notes |
|:---|:---|:---:|:---|
| TC-01 | Setup Wizard | `[ ] Pass  [ ] Fail` | |
| TC-02 | API Error Handling | `[ ] Pass  [ ] Fail` | |
| TC-03 | Research — Summarise | `[ ] Pass  [ ] Fail` | |
| TC-04 | Chat — Web Search Toggle | `[ ] Pass  [ ] Fail` | |
| TC-05 | Auto-Tag | `[ ] Pass  [ ] Fail` | |
| TC-06 | Daily Digest | `[ ] Pass  [ ] Fail` | |
| TC-07 | Synthesis — Compare | `[ ] Pass  [ ] Fail` | |
| TC-08 | Mobile Touch & Layout | `[ ] Pass  [ ] Fail` | |
| TC-09 | Keyboard Shortcuts | `[ ] Pass  [ ] Fail` | |
| P0-05 | Empty Vault | `[ ] Pass  [ ] Fail` | |
| P0-06 | No API Key Set | `[ ] Pass  [ ] Fail` | |
| P0-07 | Invalid API Key | `[ ] Pass  [ ] Fail` | |
| P0-03 | Linux Desktop | `[ ] Pass  [ ] Fail` | |
| P0-04 | Obsidian Mobile | `[ ] Pass  [ ] Fail` | |

**Overall sign-off:** `[ ] Ready to release` &nbsp; `[ ] Blocked — see failures below`

---

## Detailed Test Cases

---

### TC-01 — Setup Wizard

**Pre-condition:** Plugin has never been configured, or `data.json` has been deleted.

**Setup steps:**
1. Locate `.obsidian/plugins/deep-vault/data.json` in your vault
2. Delete the file (or rename it to `data.json.bak`)
3. In Obsidian → Settings → Community Plugins, disable Deep Vault
4. Re-enable Deep Vault

| # | Action | Expected |
|:--|:--|:--|
| 1 | Re-enable the plugin | Wizard opens automatically — no manual trigger needed |
| 2 | Progress through each wizard step | All steps are navigable, no crashes or blank screens |
| 3 | Enter a valid API key on the key step | Key is accepted, no error shown |
| 4 | Complete the wizard | Panel opens normally after wizard closes |

**Result:** `[ ] Pass` &nbsp; `[ ] Fail`

**Notes / Errors / Improvements:**
>

---

### TC-02 — API Error Handling

**Pre-condition:** Plugin is installed and working.

**Setup steps:**
1. Open Deep Vault → Settings
2. Replace the real API key with `sk-ant-fake-key-for-testing`
3. Open any markdown note with some text content

| # | Action | Expected |
|:--|:--|:--|
| 1 | Click **Summarise** on the Research tab | A clear warning notice appears — e.g. "Invalid API key" or "Authentication failed" |
| 2 | Observe the panel state | Panel stays open, no crash, no blank screen |
| 3 | Observe the notice message | Message is descriptive enough for a user to know what to fix |
| 4 | Restore the real API key and run Summarise again | Works normally — confirms the error was key-specific |

**Result:** `[ ] Pass` &nbsp; `[ ] Fail`

**Notes / Errors / Improvements:**
>

---

### TC-03 — Research — Summarise

**Pre-condition:** Valid API key set. A markdown note with at least 3 paragraphs of content is open.

| # | Action | Expected |
|:--|:--|:--|
| 1 | Open Deep Vault → Research tab | Tab loads with 6 action cards visible |
| 2 | Click **Summarise** | Loading indicator appears |
| 3 | Wait for response | Response area renders a structured 5-bullet summary |
| 4 | Inspect the output | Bullets are coherent, relate to the note content, no raw JSON or error text |
| 5 | Click **Save as Note** | New note is created in the export folder with the summary content |

**Result:** `[ ] Pass` &nbsp; `[ ] Fail`

**Notes / Errors / Improvements:**
>

---

### TC-04 — Chat — Web Search Toggle

**Pre-condition:** Valid API key set.

| # | Action | Expected |
|:--|:--|:--|
| 1 | Open Deep Vault → Chat tab | Chat input and history area visible |
| 2 | Toggle the **Web** button ON | Button shows active/highlighted state |
| 3 | Send query: *"What is the latest Claude model from Anthropic?"* | Response includes citations or references to current information |
| 4 | Toggle **Web** OFF | Button returns to inactive state |
| 5 | Send the same query again | Response is more general — no live citations |
| 6 | Send a follow-up message | Chat remembers the previous message — multi-turn working |

**Result:** `[ ] Pass` &nbsp; `[ ] Fail`

**Notes / Errors / Improvements:**
>

---

### TC-05 — Auto-Tag

**Pre-condition:** Valid API key set. Open a note that has NO existing tags in its frontmatter.

| # | Action | Expected |
|:--|:--|:--|
| 1 | With the note open, click **Auto-Tag** (Research tab or `Ctrl+P`) | Tag picker modal opens |
| 2 | Inspect suggested tags | 5–8 tags are shown, relevant to the note content |
| 3 | Select 2–3 tags using the checkboxes | Selected tags are visually highlighted |
| 4 | Click **Apply** | Modal closes |
| 5 | Check the note's frontmatter | `tags:` field now contains the selected tags |
| 6 | Open a note that already HAS tags | Picker should show existing vault tags and avoid duplicating them |

**Result:** `[ ] Pass` &nbsp; `[ ] Fail`

**Notes / Errors / Improvements:**
>

---

### TC-06 — Daily Digest

**Pre-condition:** Valid API key. Vault has at least a few notes modified in the last 7 days.

| # | Action | Expected |
|:--|:--|:--|
| 1 | Open Deep Vault → Research tab | Research tab visible |
| 2 | Click **Daily Digest** | Time range selector appears |
| 3 | Select **Last 7 days** and click **Generate** | Loading indicator appears |
| 4 | Inspect the output | Digest has structured sections: overview, key ideas, connections, open questions, next steps |
| 5 | Verify vault context | Output references actual note titles from your vault — not generic |
| 6 | Repeat with **Last 24 hours** | Generates a narrower digest for the shorter range |

**Result:** `[ ] Pass` &nbsp; `[ ] Fail`

**Notes / Errors / Improvements:**
>

---

### TC-07 — Synthesis — Compare

**Pre-condition:** Valid API key. At least 2 notes available in the vault.

| # | Action | Expected |
|:--|:--|:--|
| 1 | Open Deep Vault → Synthesis tab | Note picker and action buttons visible |
| 2 | Add 2 notes using the note picker | Both notes listed in the synthesis panel |
| 3 | Click **Compare** | Loading indicator appears |
| 4 | Inspect the output | Output has clear similarities and differences sections, references both note titles |
| 5 | Click **Save as Note** | New note created with the comparison output |
| 6 | Remove one note, add a third | Works correctly with a different pair |

**Result:** `[ ] Pass` &nbsp; `[ ] Fail`

**Notes / Errors / Improvements:**
>

---

### TC-08 — Mobile Touch & Layout

**Pre-condition:** Either Obsidian Mobile (iOS/Android) or browser DevTools in responsive mode (375px width).

| # | Action | Expected |
|:--|:--|:--|
| 1 | Open Deep Vault panel on a narrow screen | Tab bar collapses to icons only (no text labels) |
| 2 | Swipe left across the panel | Moves to the next tab smoothly |
| 3 | Swipe right across the panel | Returns to the previous tab smoothly |
| 4 | Tap each tab icon | Correct tab opens, no mis-taps on adjacent targets |
| 5 | Scroll content within a tab | No accidental tab switches while scrolling vertically |
| 6 | On iPhone: check top and bottom edges | Content not hidden behind notch or home indicator (safe-area respected) |

**Result:** `[ ] Pass` &nbsp; `[ ] Fail`

**Notes / Errors / Improvements:**
>

---

### TC-09 — Keyboard Shortcuts

**Pre-condition:** Plugin enabled. A note is open.

| # | Action | Expected |
|:--|:--|:--|
| 1 | Press `Ctrl+P` / `Cmd+P` | Command palette opens |
| 2 | Type "Deep Vault" | At least 10 Deep Vault commands listed |
| 3 | Trigger **Open Deep Vault panel** | Panel opens in sidebar |
| 4 | Trigger **Go to Research tab** | Panel switches to Research tab |
| 5 | Trigger **Go to Chat tab** | Panel switches to Chat tab |
| 6 | Trigger **Summarise current note** | Summarise runs directly without clicking in the UI |
| 7 | Trigger **Auto-tag current note** | Auto-tag picker opens |
| 8 | Trigger **Open setup wizard** | Wizard opens |
| 9 | Go to Settings → Hotkeys, search "Deep Vault" | All 14 commands appear and are assignable |

**Result:** `[ ] Pass` &nbsp; `[ ] Fail`

**Notes / Errors / Improvements:**
>

---

### P0-05 — Empty Vault

**Pre-condition:** A vault with zero notes. Create a new empty vault if needed.

| # | Action | Expected |
|:--|:--|:--|
| 1 | Run Summarise with no note open | Graceful message — "No note open" or similar — no crash |
| 2 | Run Auto-Tag with no note open | Same — clear empty state, no crash |
| 3 | Open Daily Digest → Generate | Graceful message — "No recent notes found" or similar |
| 4 | Open Synthesis tab | Empty note list shown, no crash |
| 5 | Open Search tab, run a query | Returns empty results with a message, not an error |

**Result:** `[ ] Pass` &nbsp; `[ ] Fail`

**Notes / Errors / Improvements:**
>

---

### P0-06 — No API Key Set

**Pre-condition:** Clear the API key field in Settings completely (empty string).

| # | Action | Expected |
|:--|:--|:--|
| 1 | Click Summarise | Notice: "Please set your API key in plugin settings" (or similar) |
| 2 | Send a Chat message | Same notice — no silent failure |
| 3 | Run Auto-Tag | Same notice |
| 4 | Notice message has a useful call to action | Ideally links to or names the settings panel |

**Result:** `[ ] Pass` &nbsp; `[ ] Fail`

**Notes / Errors / Improvements:**
>

---

### P0-07 — Invalid API Key

**Pre-condition:** Set API key to `sk-ant-invalid-key-test`.

| # | Action | Expected |
|:--|:--|:--|
| 1 | Click Summarise | Clear error notice — "Invalid API key" or "Authentication failed" |
| 2 | Send a Chat message | Same error — consistent message across all actions |
| 3 | Run Auto-Tag | Same error |
| 4 | Run Vault Search | Same error |
| 5 | Confirm no crash on any of the above | Plugin remains usable after each error |

**Result:** `[ ] Pass` &nbsp; `[ ] Fail`

**Notes / Errors / Improvements:**
>

---

### P0-03 — Linux Desktop

**Pre-condition:** Linux machine with Obsidian installed.

**Setup:**
```bash
chmod +x build.sh
./build.sh /path/to/vault
```
Then reload Obsidian.

| # | Action | Expected |
|:--|:--|:--|
| 1 | Run TC-03 (Summarise) | Passes on Linux |
| 2 | Run TC-04 (Chat + Web Search) | Passes on Linux |
| 3 | Run TC-09 (Keyboard Shortcuts) | All commands work on Linux keybindings |
| 4 | Toggle plugin enable → disable → enable | No errors in Obsidian developer console |

**Result:** `[ ] Pass` &nbsp; `[ ] Fail`

**Notes / Errors / Improvements:**
>

---

### P0-04 — Obsidian Mobile

**Pre-condition:** Obsidian installed on iOS or Android, vault synced.

| # | Action | Expected |
|:--|:--|:--|
| 1 | Run TC-03 (Summarise) on mobile | API call works, response renders correctly |
| 2 | Run TC-08 (Touch & Layout) in full | Swipe, icons, safe-area all pass |
| 3 | Run TC-05 (Auto-Tag) | Picker is tappable, frontmatter updated |
| 4 | Toggle plugin enable → disable → enable | Clean lifecycle on mobile |

**Result:** `[ ] Pass` &nbsp; `[ ] Fail`

**Notes / Errors / Improvements:**
>

---

## Post-Testing Actions

**If all tests pass:**
1. Update each `[ ]` in the Summary table above to `[x]`
2. Update `TESTING.md` regression matrix rows TC-01 → TC-09 to `[x]`
3. Update `MyNextSteps.md` — mark P0-02 through P0-07 as `[x]`
4. Run the release:
```bash
git checkout main
git merge dev
git push origin main
git tag v4.0.0
git push origin v4.0.0
```

**If any test fails:**
1. Mark the test `[ ] Fail` and fill in the Notes field
2. Create a `fix/<issue-description>` branch off `dev`
3. Fix, re-run the failed test case only, then re-run the full suite before releasing

---

*Test run file for Deep Vault v4.0.0*
