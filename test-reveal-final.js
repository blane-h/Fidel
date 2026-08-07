const { JSDOM } = require('jsdom');
const fs = require('fs');

const html = fs.readFileSync('/Users/blanehenok/Fidel/public/index.html', 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost:3000', pretendToBeVisual: true });

// Mock audio.load to prevent error
const originalAudio = dom.window.HTMLMediaElement.prototype.load;
dom.window.HTMLMediaElement.prototype.load = function() {};

const alphabetData = [
  { consonant: 'ሀ', vowels: [{ fidel: 'ሀ' }, { fidel: 'ሁ' }, { fidel: 'ሂ' }, { fidel: 'ሃ' }, { fidel: 'ሄ' }, { fidel: 'ህ' }, { fidel: 'ሆ' }] },
  { consonant: 'ለ', vowels: [{ fidel: 'ለ' }, { fidel: 'ሉ' }, { fidel: 'ሊ' }, { fidel: 'ላ' }, { fidel: 'ሌ' }, { fidel: 'ል' }, { fidel: 'ሎ' }] }
];
const wordData = { amharic: 'ሀለ', latin: 'ha la', translation: 'test', id: 1 };

dom.window.fetch = async (url) => {
  if (url === '/api/alphabet') return { json: async () => alphabetData };
  if (url === '/api/words/random') return { json: async () => wordData };
  if (url.startsWith('/api/words/')) return { json: async () => ({}) };
  return { json: async () => ({}) };
};

const appJs = fs.readFileSync('/Users/blanehenok/Fidel/public/app.js', 'utf8');
dom.window.eval(appJs);

setTimeout(() => {
  const doc = dom.window.document;
  const allConsonants = doc.querySelectorAll('.consonant-btn');
  
  let haBtn = null, laBtn = null;
  allConsonants.forEach(btn => {
    const fidel = btn.querySelector('.fidel-char')?.textContent;
    if (fidel === 'ሀ') haBtn = btn;
    if (fidel === 'ለ') laBtn = btn;
  });
  
  // Step 1: Click Reveal
  doc.getElementById('revealBtn').click();
  const haHighlighted = haBtn?.classList.contains('revealed-green') || haBtn?.classList.contains('revealed-yellow') || haBtn?.classList.contains('revealed-red');
  console.log('Step 1: First consonant (ሀ) highlighted:', haHighlighted);
  
  // Step 2: Click first consonant → should reveal its vowel
  haBtn?.click();
  let revealedCount = doc.querySelectorAll('.revealed-correct').length;
  console.log('Step 2: After clicking ሀ, revealed vowels:', revealedCount);
  
  // Step 3: Click next consonant (ለ) → should trigger its vowel reveal
  laBtn?.click();
  const laHighlighted = laBtn?.classList.contains('revealed-green') || laBtn?.classList.contains('revealed-yellow') || laBtn?.classList.contains('revealed-red');
  revealedCount = doc.querySelectorAll('.revealed-correct').length;
  console.log('Step 3: After clicking ለ, revealed vowels:', revealedCount, 'next consonant highlighted:', laHighlighted);
  
  // Verify no setTimeout in reveal functions
  const hasRevealTimer = content.includes('setTimeout(() => {') && (content.includes('highlightNextConsonant') || content.includes('revealNextVowel'));
  // Actually just check the source
  const hasTimerInReveal = appJs.match(/function reveal.*?\{[^}]*setTimeout[^}]*\}/s);
  
  console.log('\n---');
  console.log('Has timer in reveal functions:', hasTimerInReveal ? 'YES - BAD' : 'NO - GOOD');
  console.log('First consonant auto-highlighted:', haHighlighted);
  console.log('Next consonant triggers vowel reveal:', laHighlighted && revealedCount >= 2);
  
  const passed = haHighlighted && laHighlighted && revealedCount >= 2 && !hasTimerInReveal;
  console.log('\n' + (passed ? '✓ ALL TESTS PASSED' : '✗ TESTS FAILED'));
  
}, 200);
