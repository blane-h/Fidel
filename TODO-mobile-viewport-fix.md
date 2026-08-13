# Mobile Safari Viewport Fix Plan

## Problem
On Safari (iOS), the dynamic browser toolbar and bottom tab bar change the available viewport height during scrolling. Elements positioned with fixed pixel values or `100vh` overlap each other because the layout doesn't adapt to Safari's changing viewport.

## Root Causes (from code analysis)

| # | File:Line | Issue | Impact |
|---|-----------|-------|--------|
| 1 | `mobile-styles.css:194-195` | `height: 100dvh` is overridden by `height: 100vh` (later declaration wins) | Page container uses static `vh`, not dynamic `dvh`; height doesn't shrink when Safari toolbars collapse |
| 2 | `mobile-spell.html:5`, `mobile-draw.html:5`, `mobile-study.html:5` | Missing `viewport-fit=cover` in meta viewport | `env(safe-area-inset-*)` returns 0, layout can't extend into safe areas |
| 3 | `mobile-styles.css:1102-1103` | `.mobile-bottom-tab-bar` uses `bottom: 2.05rem` without safe-area compensation | Bottom tab bar overlaps page content when Safari's tab bar is visible |
| 4 | `mobile-styles.css:672` | `#mobileStatusMessage` uses hardcoded `bottom: 340px` | Status message position is wrong on any screen size other than the one it was designed for |
| 5 | `mobile-styles.css:681` | `.mobile-keyboard-wrapper` uses `bottom: 110px` | No safe-area or dynamic toolbar compensation |
| 6 | `mobile-styles.css:386` | `.mobile-card-area` uses `max-height: 50vh` | Uses static `vh` instead of `dvh`; doesn't adapt to Safari's dynamic viewport |
| 7 | `mobile-styles.css:366-376` | `.mobile-prompt` has no `min-height` or `line-height` | Placeholder "fidel" (1 line) shifts downward when API word loads and wraps to 2+ lines at `font-size: 40px` |
| 8 | `mobile-styles.css:380-385` | `.mobile-prompt.hint` shares base `.mobile-prompt` styles | If `min-height` added to `.mobile-prompt`, hint text (0.8rem font) needs override |

## Fix Plan

### Phase 1: Viewport Units (Critical)

**1a.** Fix `.mobile-page` height declaration order — remove the `100vh` override and use the proper fallback chain:
```css
.mobile-page {
  height: 100vh;          /* fallback for older browsers */
  height: 100svh;         /* standard dynamic small viewport */
  height: 100dvh;         /* supported dynamic viewport height */
}
```

**1b.** Fix `.mobile-card-area` `max-height` from `50vh` to `50dvh`.

### Phase 2: Safe Area Insets (Critical)

**2a.** Add `viewport-fit=cover` to the meta viewport tag in all three mobile HTML files:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
```

**2b.** Fix `.mobile-bottom-tab-bar` — use `env(safe-area-inset-bottom)` for bottom positioning:
```css
.mobile-bottom-tab-bar {
  bottom: calc(2.05rem + env(safe-area-inset-bottom, 0px));
}
```

**2c.** Fix `.mobile-keyboard-wrapper` — account for bottom tab bar + safe area:
```css
.mobile-keyboard-wrapper {
  bottom: calc(110px + env(safe-area-inset-bottom, 0px));
}
```

**2d.** Fix `#mobileStatusMessage` — replace hardcoded `bottom: 340px` with natural flow positioning:
```css
#mobileStatusMessage {
  position: relative;
  /* bottom: 340px removed; flows naturally within .mobile-slots-area flex column */
}
```

### Phase 2.5: Layout Shift Prevention (Content Reflow)

**2e.** Fix `.mobile-prompt` — reserve `min-height` so the placeholder "fidel" (1 line at 40px) doesn't shift downward when the API word loads and wraps to 2+ lines:
```css
.mobile-prompt {
  line-height: 1.2;
  min-height: 6rem;       /* 2 lines at 40px * 1.2 = 96px ≈ 6rem */
}

.mobile-prompt.hint {
  min-height: auto;       /* override for small hint text */
  line-height: normal;
}
```

### Phase 3: Dynamic Viewport JS Fallback

**3a.** Add a small JS snippet to set a custom `--vh` CSS variable that tracks `window.innerHeight` in real-time. This provides a JavaScript-based fallback that works even on Safari versions that don't fully support `dvh`:
```js
function setViewportProperty() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}
window.addEventListener('resize', setViewportProperty);
window.addEventListener('orientationchange', setViewportProperty);
setViewportProperty();
```
Then use `height: calc(var(--vh, 1vh) * 100)` as an additional fallback.

### Phase 4: Testing Matrix

| Device | Browser Bar State | Expected Behavior |
|--------|------------------|-------------------|
| iPhone SE (390×844) | Bars visible | No overlapping content; bottom tab bar above safe area |
| iPhone SE (390×844) | Bars collapsed | Content expands; bottom tab bar stays positioned |
| iPhone 14 Pro (393×852) | Bars visible | Same as above, different dimensions |
| iPhone 14 Pro (393×852) | Bars collapsed + notched safe area | No overlap with notch or home indicator |
| iPhone 15 Pro Max (430×932) | Bars visible/collapsed | Layout scales proportionally |
| On-screen keyboard visible | Keyboard pushes content | Keyboard wrapper and status message stay above keyboard |
| Spell page load | Placeholder "fidel" → API word | No vertical shift; prompt stays in same position |
| Spell page: prompt toggle | Latin → Fidel, Fidel → Latin | No additional shift (min-height already reserved) |

## Implementation Order
1. Add `viewport-fit=cover` to HTML files
2. Fix `100vh`/`100dvh` ordering and fallbacks in CSS (body + .mobile-page)
3. Fix `50vh` → `50dvh` on card-area
4. Fix fixed positioning with safe-area insets (bottom tab bar, keyboard wrapper)
5. Fix `#mobileStatusMessage` hardcoded `bottom: 340px` — use natural flow
6. Fix layout shift: add `min-height` + `line-height` to `.mobile-prompt`
7. Add JS viewport-height tracking (`--vh` variable)
8. Bump cache-busting version on mobile-spell.html CSS link
9. Verify CSS syntax and JS syntax
