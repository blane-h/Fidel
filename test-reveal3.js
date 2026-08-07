const { JSDOM } = require('jsdom');
const fs = require('fs');

const html = fs.readFileSync('/Users/blanehenok/Fidel/public/index.html', 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost:3000', pretendToBeVisual: true });

// Word with two different consonants: ሀለ (ha la)
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
  
  // Click reveal
  doc.getElementById('revealBtn').click();
  
  // Check first consonant highlighted
  const allConsonants = doc.querySelectorAll('.consonant-btn');
  let firstBtn = null;
  allConsonants.forEach(btn => {
    if (btn.querySelector('.fidel-char')?.textContent === 'ሀ') firstBtn = btn;
  });
  
  console.log('Step 1: First consonant (ሀ) highlighted:', firstBtn?.classList.contains('revealed-green') || firstBtn?.classList.contains('revealed-yellow') || firstBtn?.classList.contains('revealed-red'));
  
  // Click first consonant
  firstBtn?.click();
  let revealedCount = doc.querySelectorAll('.revealed-correct').length;
  console.log('Step 2: After clicking ሀ, revealed vowels:', revealedCount);
  
  // Click vowel (first one)
  const vowelBtns = doc.querySelectorAll('.vowel-btn');
  if (vowelBtns.length > 0) {
    vowelBtns[0].click();
    revealedCount = doc.querySelectorAll('.revealed-correct').length;
    console.log('Step 3: After clicking vowel, revealed vowels:', revealedCount);
  }
  
  // Now click next consonant (ለ)
  let nextBtn = null;
  allConsonants.forEach(btn => {
    if (btn.querySelector('.fidel-char')?.textContent === 'ለ') nextBtn = btn;
  });
  
  nextBtn?.click();
  revealedCount = doc.querySelectorAll('.revealed-correct').length;
  
  const state = dom.window.eval(`
    ({
      revealIndex: typeof revealIndex !== 'undefined' ? revealIndex : 'undef',
      currentRevealVowelIndex: typeof currentRevealVowelIndex !== 'undefined' ? currentRevealVowelIndex : 'undef',
      answerLength: typeof answer !== 'undefined' ? answer.length : 'undef'
    })
  `);
  
  console.log('Step 4: After clicking next consonant (ለ):');
  console.log('  revealed vowels:', revealedCount);
  console.log('  state:', state);
  
  const nextHighlighted = nextBtn?.classList.contains('revealed-green') || nextBtn?.classList.contains('revealed-yellow') || nextBtn?.classList.contains('revealed-red');
  console.log('  next consonant highlighted:', nextHighlighted);
  
  if (revealedCount >= 2 && nextHighlighted) {
    console.log('\n✓ TEST PASSED: Manual reveal flow works correctly');
  } else {
    console.log('\n✗ TEST FAILED: Expected 2+ revealed vowels and next consonant highlighted');
  }
  
}, 200);
