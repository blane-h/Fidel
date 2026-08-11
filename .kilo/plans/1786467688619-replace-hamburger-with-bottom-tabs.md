# Replace Mobile Hamburger Menu with Bottom Tab Bar

## Goal
Replace the hamburger menu + nav drawer in the mobile views (`mobile-study.html`, `mobile-spell.html`, `mobile-draw.html`) with a fixed bottom tab bar containing **Study**, **Spell**, and **Draw** tabs, matching the Figma design. Desktop views are unaffected.

## Current State
- Each mobile page has a `#mobileHamburger` button in `.mobile-top-nav`
- A `#mobileNavDrawer` slide-out panel contains nav links
- `MobileCommon.initMobileNav()` wires up the drawer in `mobile-study.js`, `mobile-draw.js`, and `mobile-app.js`

## Changes Required

### 1. `mobile-styles.css` — Add bottom tab bar styles

Add a new `.mobile-bottom-tab-bar` component and `.mobile-tab-btn` styles:

```css
.mobile-bottom-tab-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px));
  background: #ffffff;
  border-top: 1px solid #f0f0f0;
  z-index: 100;
}

.mobile-tab-btn {
  flex: 1;
  max-width: 160px;
  border: none;
  cursor: pointer;
  padding: 0.6rem 1rem;
  border-radius: 999px;
  font-size: 1rem;
  font-weight: 600;
  text-align: center;
  transition: background 0.15s, color 0.15s, transform 0.1s;
  background: #efefef;
  color: #333;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.mobile-tab-btn.active {
  background: #111111;
  color: #ffffff;
}

.mobile-tab-btn:active {
  transform: scale(0.95);
}
```

Update `.mobile-page` bottom padding to prevent content from being hidden behind the tab bar:

```css
.mobile-page {
  /* existing styles... */
  padding-bottom: calc(100px + env(safe-area-inset-bottom, 0px));
}
```

### 2. HTML — Remove hamburger/drawer, add tab bar

For each of `mobile-study.html`, `mobile-spell.html`, `mobile-draw.html`:

- **Remove** the `<button id="mobileHamburger"...>` from `<header class="mobile-top-nav">`
- **Remove** the entire `<div id="mobileNavDrawer"...>` block
- **Add** a new bottom tab bar before `</main>`:

```html
<div class="mobile-bottom-tab-bar">
  <a href="/study" class="mobile-tab-btn active">Study</a>
  <a href="/" class="mobile-tab-btn">Spell</a>
  <a href="/draw" class="mobile-tab-btn">Draw</a>
</div>
```

Hardcode the `active` class per page:
- `mobile-study.html` → Study is active
- `mobile-spell.html` → Spell is active
- `mobile-draw.html` → Draw is active

### 3. `mobile-common.js` — Remove nav drawer utilities

Remove the following exports and their implementations:
- `openNav`
- `closeNav`
- `initMobileNav`

Update the returned object to exclude these three keys.

### 4. `mobile-study.js` — Remove nav init

- Remove `openNav`, `closeNav`, `initMobileNav` from the `MobileCommon` destructuring
- Remove the `initMobileNav(...)` call

### 5. `mobile-draw.js` — Remove nav init

- Remove `openNav`, `closeNav`, `initMobileNav` from the `MobileCommon` destructuring
- Remove the `initMobileNav(...)` call

### 6. `mobile-app.js` — Remove nav init

- Remove `openNav`, `closeNav`, `initMobileNav` from the `MobileCommon` destructuring
- Remove the `initMobileNav(...)` call

## Validation
- Load each mobile page in a mobile viewport (or browser dev tools responsive mode)
- Verify the hamburger icon is gone
- Verify the bottom tab bar shows with Study/Spell/Draw tabs
- Verify the active tab highlights correctly per page
- Verify tab taps navigate to the correct page
- Verify desktop view is unchanged (desktop uses `styles.css` with its own top nav)
- Verify existing page functionality (study cards, spell keyboard, draw canvas) still works

## Out of Scope
- Desktop view changes (uses `styles.css` / `index.html`)
- Animations or transitions beyond what's specified
- Any new pages or routes
