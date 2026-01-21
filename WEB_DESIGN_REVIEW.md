# Web Interface Guidelines Review

Review performed against [Vercel Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines).

**Date:** 2026-01-21
**Files Reviewed:** 19 HTML files

---

## Findings

### Missing `aria-label` on icon-only buttons

```
english/typing.html:29 - Speaker button needs aria-label
english/flashcards.html - Speaker buttons need aria-label
english/quiz.html - Speaker button needs aria-label
math/fractions.html:88-91 - Buttons missing aria-label (checkAnswer, newQuestion, showHint)
math/geometry.html:96-99 - Buttons missing aria-label
math/multiplication.html:95-98 - Buttons missing aria-label
math/number-line.html:93-97 - Buttons missing aria-label
math/sequences.html:107-111 - Buttons missing aria-label
math/shop.html:122-125 - Buttons missing aria-label
```

### Form inputs missing `name` and `autocomplete` attributes

```
english/typing.html:38-44 - Input missing name, autocomplete="off" present but no name
math/multiplication.html:90 - Input missing name attribute
math/sequences.html:405-408 - Input fields created dynamically missing name attribute
math/shop.html:110 - Input missing name attribute
admin/index.html:317,345,346 - Search inputs missing name attributes
admin/index.html:423-433 - Modal form inputs missing name attributes
admin/index.html:448-479 - Hebrew modal inputs missing name attributes
stats/index.html - No form inputs
```

### Missing `<label>` elements for form controls

```
math/multiplication.html:90 - Input has no associated label
math/number-line.html - Draggable point has no label
math/sequences.html:405-408 - Dynamically created inputs have no labels
math/shop.html:106-111 - Input for change calculation has label but not using `for` attribute
admin/index.html:317-318 - Search inputs have no labels
admin/index.html:345-357 - Filter inputs have no labels
```

### Missing `prefers-reduced-motion` media query for animations

```
stats/index.html:178-180 - @keyframes spin animation should respect prefers-reduced-motion
stats/admin.html:257-259 - @keyframes spin animation should respect prefers-reduced-motion
english/flashcards.html - Card flip animations should respect prefers-reduced-motion
english/board.html - Tile animations should respect prefers-reduced-motion
hebrew/spelling-compar.html - Modal animations should respect prefers-reduced-motion
math/fractions.html - Pizza slice selection animations
math/geometry.html - Grid cell selection animations
```

### Using `onclick` handlers instead of event listeners (accessibility concern)

```
english/typing.html:29,50-58,71-74 - Using onclick handlers
english/board.html:56 - onclick handlers
math/fractions.html:23-47,88-91 - onclick handlers on buttons
math/geometry.html:23-47,96-99 - onclick handlers on buttons
math/multiplication.html:23-47,95-98 - onclick handlers on buttons
math/number-line.html:22-46,93-97 - onclick handlers on buttons
math/sequences.html:23-47,107-111 - onclick handlers on buttons
math/shop.html:23-47,122-125 - onclick handlers on buttons
```

### Missing keyboard accessibility

```
english/board.html:205 - Tile onclick but no keyboard handler (onkeydown)
math/fractions.html:169 - Pizza slice onclick but no keyboard support
math/geometry.html:177 - Grid cell onclick but no keyboard support
math/shop.html:270 - Shop item onclick but no keyboard support
```

### Non-semantic HTML

```
math/fractions.html:87-92 - div with style for centering (consider flexbox container)
math/geometry.html:85-92 - div with style for centering
math/multiplication.html:89-92 - div with style for centering
math/number-line.html:92-97 - div with style for centering
math/sequences.html:105-111 - div with style for centering
math/shop.html:121-125 - div with style for centering
```

### Modal dialogs not using `<dialog>` element

```
english/board.html:35-45 - Quiz modal using div instead of dialog element
hebrew/spelling-compar.html - Modal using div
stats/admin.html - No modal dialogs
math/fractions.html:262-275 - Game complete modal created dynamically as div
math/geometry.html:352-365 - Game complete modal
math/multiplication.html - confirm() used (acceptable)
math/sequences.html:594-607 - Game complete modal
math/shop.html:537-550 - Game complete modal
admin/index.html:417-485 - Modals using div instead of dialog
```

### Missing language/direction on Hebrew content in English pages

```
admin/index.html:429 - Hebrew input has dir="rtl" but container doesn't
admin/index.html:448,450,474,478 - Hebrew inputs have dir="rtl" correctly
```

### Using inline styles extensively

```
stats/index.html:247 - Inline styles for flexbox layout
stats/admin.html - Extensive inline styles in generated HTML
math/fractions.html:87,94 - Inline styles
math/geometry.html:85-92 - Inline styles
math/multiplication.html:89,94 - Inline styles
math/number-line.html:92,107 - Inline styles
math/sequences.html:105 - Inline styles
math/shop.html:78-79,106,121 - Inline styles
admin/index.html - Well-structured CSS in style block
```

### Button elements missing type attribute

```
english/typing.html:50-58,71-74 - Buttons should have type="button"
english/board.html:56 - restart-btn missing type
math/fractions.html:51,88-91 - Buttons missing type attribute
math/geometry.html:51,96-99 - Buttons missing type attribute
math/multiplication.html:51,95-98 - Buttons missing type attribute
math/number-line.html:49,93-97,108-109 - Buttons missing type attribute
math/sequences.html:51,107-111 - Buttons missing type attribute
math/shop.html:51,96,122-125 - Buttons missing type attribute
admin/index.html:29-39,87-105,321-322 - Many buttons missing explicit type
```

---

## Summary

| Category | Count |
|----------|-------|
| Missing aria-label | 9 files |
| Missing input name/autocomplete | 6 files |
| Missing form labels | 6 files |
| Missing prefers-reduced-motion | 7 files |
| Keyboard accessibility issues | 4 files |
| Non-semantic modals (div vs dialog) | 7 files |
| Missing button type attribute | 10 files |

---

## Priority Fixes

1. **Add `aria-label` to icon-only buttons** - Speaker buttons, emoji buttons need descriptive labels for screen readers
2. **Add `name` attributes to all form inputs** - Required for proper form handling and accessibility
3. **Add `prefers-reduced-motion` media query** - Disable/reduce animations for users who prefer reduced motion
4. **Convert modal divs to `<dialog>` elements** - Better accessibility, focus trapping, and escape key handling
5. **Add `type="button"` to all non-submit buttons** - Prevents accidental form submissions

---

## Code Duplication Analysis

### Repeated Components Identified

| Component | Files Using It | Lines Duplicated |
|-----------|---------------|------------------|
| Game Setup Screen (level buttons) | 6 math games | ~50 lines each |
| Score Board (points, level, accuracy, streak) | All games | ~20 lines each |
| Progress Bar | All games | ~5 lines each |
| Feedback Display | All games | ~5 lines each |
| Back Link / Navigation | All pages | ~3 lines each |
| Modal Dialog | 7 games | ~20 lines each |
| Level Selection JS | 6 math games | ~30 lines each |
| Stats Update JS | All games | ~15 lines each |

**Estimated duplicated code:** ~800-1000 lines across all games

### Refactoring Options

| Approach | Pros | Cons |
|----------|------|------|
| **Web Components** | Native, no build tools, encapsulated | Requires JS knowledge |
| **JS Template Module** | Simple, works everywhere | HTML in JS strings |
| **Static Site Generator** | Full templating, partials | Requires build step |

### Recommended: Web Components

For this project, **Web Components** would work well - no build tools needed, modern browser support.

#### Proposed Components

1. **`<game-setup>`** - Level selection screen with configurable levels
2. **`<score-board>`** - Score display (points, level, accuracy, streak)
3. **`<progress-bar>`** - Progress indicator with configurable max
4. **`<game-feedback>`** - Feedback messages (correct/incorrect)
5. **`<game-modal>`** - Modal dialogs (game complete, etc.)
6. **`<back-link>`** - Navigation back button

#### Example Usage (After Refactoring)

```html
<!-- Before: ~50 lines of setup HTML -->
<!-- After: -->
<game-setup levels="5" on-start="startGame"></game-setup>

<!-- Before: ~20 lines of score board -->
<!-- After: -->
<score-board id="scores"></score-board>

<!-- Before: ~20 lines of modal HTML -->
<!-- After: -->
<game-modal id="completeModal">
  <h2>Game Complete!</h2>
  <p>Your score: <slot name="score"></slot></p>
</game-modal>
```

#### Proposed File Structure

```
shared/
├── components.js          # Web Components definitions
├── game-base.js           # Base game class with common logic
├── statistics-service.js  # (existing)
├── player-service.js      # (existing)
└── firebase-config.js     # (existing)
```

#### Expected Benefits

- Reduce each game file from ~300-600 lines to ~100-150 lines
- Single source of truth for UI components
- Easier to maintain consistent styling
- Accessibility fixes apply to all games at once
