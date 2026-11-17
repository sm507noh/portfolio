const mask = document.querySelector('.mask');
const hero = document.querySelector('.hero-image');
const image = hero.querySelector('img');

for (const link of document.querySelectorAll('.header a')) {
  const label = link.textContent.trim();
  const roll = document.createElement('span');
  roll.className = 'header-roll';
  roll.setAttribute('aria-hidden', 'true');
  Array.from(label).forEach((character, index) => {
    const letter = document.createElement('span');
    letter.textContent = character;
    letter.style.setProperty('--letter-index', index);
    roll.append(letter);
  });
  link.setAttribute('aria-label', label);
  link.replaceChildren(roll);
}

const floatingMask = createFloatingCircleMask(hero, image);
if (floatingMask) {
  mask.addEventListener('click', () => {
    const active = mask.getAttribute('aria-pressed') === 'false';
    if (active) floatingMask.start();
    else floatingMask.stop();
    mask.setAttribute('aria-pressed', String(active));
  });
}

function openAboutFromOriginalLink() {
  if (document.documentElement.classList.contains("work-page") && location.hash === "#about") {
    location.replace("about.html");
  }
}

window.addEventListener("hashchange", openAboutFromOriginalLink);
openAboutFromOriginalLink();
