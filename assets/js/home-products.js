// Rotating product card on the home page (the .item-products cell in
// index.html). Shows one slide at a time and moves on every ROTATE_MS.
// Rotation pauses while the pointer is over the card or keyboard focus is
// inside it, restarts its countdown when someone picks a dot, never runs
// under prefers-reduced-motion, and idles while the tab is hidden.
(function () {
  var ROTATE_MS = 6000;
  var root = document.querySelector('[data-home-products]');
  if (!root) return;
  var slides = root.querySelectorAll('.product-slide');
  var dots = root.querySelectorAll('.product-dot');
  if (slides.length < 2) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var current = 0;
  var timer = null;
  var hovered = false;
  var focused = false;

  function show(i) {
    current = i;
    for (var n = 0; n < slides.length; n++) {
      var on = n === i;
      slides[n].classList.toggle('is-active', on);
      if (on) {
        slides[n].removeAttribute('aria-hidden');
        slides[n].removeAttribute('tabindex');
      } else {
        slides[n].setAttribute('aria-hidden', 'true');
        slides[n].setAttribute('tabindex', '-1');
      }
      dots[n].setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    // Dots sit over every slide, so they take the active slide's text colour.
    root.style.setProperty('--dot-color', slides[i].style.getPropertyValue('--product-fg'));
  }

  function schedule() {
    clearInterval(timer);
    timer = null;
    if (hovered || focused || reduce.matches || document.hidden) return;
    timer = setInterval(function () { show((current + 1) % slides.length); }, ROTATE_MS);
  }

  for (var d = 0; d < dots.length; d++) {
    dots[d].addEventListener('click', function (e) {
      show(Number(e.currentTarget.getAttribute('data-index')));
      schedule();
    });
  }
  root.addEventListener('mouseenter', function () { hovered = true; schedule(); });
  root.addEventListener('mouseleave', function () { hovered = false; schedule(); });
  // Keyboard focus only: a clicked dot keeps focus, and that must not pause.
  root.addEventListener('focusin', function (e) {
    focused = e.target.matches(':focus-visible');
    schedule();
  });
  root.addEventListener('focusout', function (e) {
    focused = root.contains(e.relatedTarget);
    schedule();
  });
  document.addEventListener('visibilitychange', schedule);
  if (reduce.addEventListener) reduce.addEventListener('change', schedule);

  root.querySelector('.product-dots').hidden = false;
  show(0);
  schedule();
})();
