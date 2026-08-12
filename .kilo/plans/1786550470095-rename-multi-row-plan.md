# Plan: Rename `.multi-row` to `.four-rows` and add `.three-rows`

## Context
- **File to edit:** `public/mobile-styles.css`
- **File to edit:** `public/mobile-app.js`
- **Pattern:** `.mobile-slots-area.one-row`, `.mobile-slots-area.two-rows`, `.mobile-slots-area.multi-row`

## Decisions
- Use strict row counts in JS toggle conditions
- Longest word in database takes 4 rows max; no 5+ row handling needed
- TranslateY spacing: single(-6rem), two(-4rem), three(-2rem), four(0)

## Steps

### 1. Update CSS (`public/mobile-styles.css`)
- Add `.mobile-slots-area.three-rows { transform: translateY(-2rem); }` after `.mobile-slots-area.two-rows`
- Rename `.mobile-slots-area.multi-row` to `.mobile-slots-area.four-rows` and change transform to `translateY(0)`

### 2. Update JS (`public/mobile-app.js`)
- Replace the single `multi-row` toggle with three strict toggles:
  - `slotsArea.classList.toggle("three-rows", rowCount === 3);`
  - `slotsArea.classList.toggle("four-rows", rowCount === 4);`
- Remove the old `multi-row` toggle line entirely

### 3. Validation
- Confirm no other references to `multi-row` exist in the codebase
- Verify the new classes follow the existing kebab-case naming pattern
