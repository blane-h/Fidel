# TODO - Fix first sound not playing on Study page load

## Problem
On the Study page, `loadAlphabet()` → `cycleCurrentSet()` → `updateCard()` → `playSound()`
fires during initial page load. Browsers block `audio.play()` before any user gesture
(autoplay policy), so the first vowel's sound is silently dropped. Sound works on
subsequent interactions because the user has already engaged with the page.

## Steps
- [x] 1. Identify root cause (browser autoplay policy blocks the first play() call)
- [x] 2. Track when the initial autoplay is blocked (`pendingAutoplay`)
- [x] 3. Replay the current character sound on the first user gesture (click/key/touch)
- [x] 4. Trigger the cycle button on initial page load so the first character's sound is played
- [ ] 5. Verify: first vowel sound plays on initial Study page load (via the cycle button trigger)
