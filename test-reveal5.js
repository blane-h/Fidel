const { JSDOM } = require('jsdom');
const fs = require('fs');

const html = fs.readFileSync('/Users/blanehenok/Fidel/public/index.html', 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost:3000', pretendToBeVisual: true });

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
  
  // Step 2: Click first consonant
  haBtn?.click();
  let revealedCount = doc.querySelectorAll('.revealed-correct').length;
  let slots = doc.querySelectorAll('.slot');
  let filledSlots = Array.from(slots).filter(s => s.textContent.trim() !== '').length;
  console.log('Step 2: revealed:', revealedCount, 'filled slots:', filledSlots);
  
  // Step 3: Click vowel
  const vowelBtns = doc.querySelectorAll('.vowel-btn');
  vowelBtns[0]?.click();
  revealedCount = doc.querySelectorAll('.revealed-correct').length;
  filledSlots = Array.from(slots).filter(s => s.textContent.trim() !== '').length;
  console.log('Step 3: revealed:', revealedCount, 'filled slots:', filledSlots);
  
  // Step 4: Click next consonant
  laBtn?.click();
  const laHighlighted = laBtn?.classList.contains('revealed-green') || laBtn?.classList.contains('revealed-yellow') || laBtn?.classList.contains('revealed-red');
  revealedCount = doc.querySelectorAll('.revealed-correct').length;
  filledSlots = Array.from(slots).filter(s => s.textContent.trim() !== '').length;
  console.log('Step 4: revealed:', revealedCount, 'next highlighted:', laHighlighted, 'filled slots:', filledSlots);
  
  const passed = haHighlighted && laHighlighted && filledSlots >= 2;
  console.log('\n' + (passed ? '✓ ALL TESTS PASSED' : '✗ TESTS FAILED'));
  
}, 200);
