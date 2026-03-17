/* ── scroll-reveal ── */
const obs = new IntersectionObserver(
  entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
  { threshold: 0.12 }
);
document.querySelectorAll('[data-anim]').forEach(el => obs.observe(el));

/* ── faq accordion ── */
document.querySelectorAll('.faq__item').forEach(item => {
  item.addEventListener('toggle', () => {
    if (item.open)
      document.querySelectorAll('.faq__item').forEach(o => { if (o !== item) o.removeAttribute('open'); });
  });
});

/* ── terminal typing demo ── */
(function runTerminal() {
  const body = document.getElementById('termBody');
  if (!body) return;

  const lines = [
    { cls: 'term-bot', text: 'Generating your betslip with 15 matches...' },
    { cls: 'term-bot', text: 'Scraping NerdyTips Trust BestTip...' },
    { cls: 'term-bot', text: 'Found 47 matches. Placing 15 on SportyBet...' },
    { cls: 'term-bot', text: '' },
    { cls: 'term-bot', text: '1. Arsenal vs Chelsea \u2014 Over 2.5 (Trust 9/10)' },
    { cls: 'term-bot', text: '2. Man City vs Liverpool \u2014 GG (Trust 8/10)' },
    { cls: 'term-bot', text: '3. Napoli vs Inter \u2014 Under 2.5 (Trust 7/10)' },
    { cls: 'term-bot', text: '4. Barca vs Real Madrid \u2014 Home (Trust 9/10)' },
    { cls: 'term-bot', text: '5. Bayern vs Dortmund \u2014 Over 3.5 (Trust 8/10)' },
    { cls: 'term-bot', text: '...' },
    { cls: 'term-bot', text: '' },
    { cls: 'term-bot term-code', text: 'SPORTYBET CODE: K7XMRP' },
    { cls: 'term-bot', text: '15 matches on slip \u2022 Avg Trust 8.2/10' },
  ];

  const typing = document.getElementById('termTyping');
  if (typing) typing.remove();

  let i = 0;
  function addLine() {
    if (i >= lines.length) return;
    const div = document.createElement('div');
    div.className = 'term-line ' + lines[i].cls;
    div.textContent = lines[i].text;
    div.style.opacity = '0';
    div.style.transform = 'translateY(6px)';
    body.appendChild(div);
    requestAnimationFrame(() => {
      div.style.transition = 'opacity .3s, transform .3s';
      div.style.opacity = '1';
      div.style.transform = 'translateY(0)';
    });
    i++;
    setTimeout(addLine, 350 + Math.random() * 250);
  }

  const termObs = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      termObs.disconnect();
      setTimeout(addLine, 600);
    }
  }, { threshold: 0.3 });
  termObs.observe(body);
})();
