const { JSDOM } = require('jsdom');
const fs = require('fs');

const html = fs.readFileSync('/Users/blanehenok/Fidel/public/index.html', 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost:3000' });
global.window = dom.window;
global.document = dom.window.document;
global.Audio = class {};

const appJs = fs.readFileSync('/Users/blanehenok/Fidel/public/app.js', 'utf8');

// Mock fetch
const alphabetData = [
  { consonant: 'ሀ', vowels: [{ fidel: 'ሀ' }, { fidel: 'ሁ' }, { fidel: 'ሂ' }, { fidel: 'ሃ' }, { fidel: 'ሄ' }, { fidel: 'ህ' }, { fidel: 'ሆ' }] },
  { consonant: 'ለ', vowels: [{ fidel: 'ለ' }, { fidel: 'ሉ' }, { fidel: 'ሊ' }, { fidel: 'ላ' }, { fidel: 'ሌ' }, { fidel: 'ል' }, { fidel: 'ሎ' }] }
];
const wordData = { amharic: 'ሀሀ', latin: 'ha ha', translation: 'test', id: 1 };

global.fetch = async (url) => {
  if (url === '/api/alphabet') return { json: async () => alphabetData };
  if (url === '/api/words/random') return { json: async () => wordData };
  if (url.startsWith('/api/words/')) return { json: async () => ({}) };
  return { json: async () => ({}) };
};

// We need to mock DOM methods that app.js uses
const script = document.createElement('script');
script.textContent = appJs;
document.body.appendChild(script);

// Wait for init to run
setTimeout(() => {
  console.log('Reveal mode test starting...');
  
  // Click reveal button
  const revealBtn = document.getElementById('revealBtn');
  revealBtn.click();
  
  console.log('revealMode after click:', typeof revealMode !== 'undefined' ? revealMode : 'undefined');
  console.log('revealSequence length:', typeof revealSequence !== 'undefined' ? revealSequence.length : 'undefined');
  console.log('revealIndex:', typeof revealIndex !== 'undefined' ? revealIndex : 'undefined');
  
  // Check that first consonant is highlighted
  const consonants = document.querySelectorAll('.consonant-btn');
  let firstHighlighted = false;
  consonants.forEach(btn => {
    if (btn.classList.contains('revealed-green') || btn.classList.contains('revealed-yellow') || btn.classList.contains('revealed-red')) {
      firstHighlighted = true;
    }
  });
  console.log('First consonant highlighted:', firstHighlighted);
  
  // Click first consonant (ሀ)
  const haBtn = Array.from(consonants).find(btn => {
    const fidel = btn.querySelector('.fidel-char')?.textContent;
    return fidel === 'ሀ';
  });
  
  if (haBtn) {
    haBtn.click();
    console.log('After clicking first consonant:');
    console.log('  revealed-correct count:', document.querySelectorAll('.revealed-correct').length);
    console.log('  currentRevealVowelIndex:', typeof currentRevealVowelIndex !== 'undefined' ? currentRevealVowelIndex : 'undefined');
    console.log('  answer length:', typeof answer !== 'undefined' ? answer.length : 'undefined');
  }
  
  // Click vowel again (second 'ha' in word)
  const vowelBtns = document.querySelectorAll('.vowel-btn');
  if (vowelBtns.length > 0) {
    vowelBtns[0].click();
    console.log('After clicking vowel again:');
    console.log('  revealed-correct count:', document.querySelectorAll('.revealed-correct').length);
    console.log('  currentRevealVowelIndex:', typeof currentRevealVowelIndex !== 'undefined' ? currentRevealVowelIndex : 'undefined');
    console.log('  answer length:', typeof answer !== 'undefined' ? answer.length : 'undefined');
  }
  
  console.log('\nTest completed. No timers used - fully manual flow.');
}, 100);
