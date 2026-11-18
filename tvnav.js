(function () {
  // Selectors for everything a user can click on watchstream.app
  const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"]), .movie-card';
  let currentFocused = null;

  function getFocusableElements() {
    return Array.from(document.querySelectorAll(FOCUSABLE_SELECTOR)).filter(el => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    });
  }

  function setFocus(el) {
    if (!el) return;
    if (currentFocused) {
      currentFocused.classList.remove('tv-focused');
    }
    currentFocused = el;
    currentFocused.classList.add('tv-focused');
    currentFocused.focus({ preventScroll: true });
    
    // Smoothly scroll the movie row or page so the selected card stays in view
    currentFocused.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center'
    });
  }

  function findNextElement(direction) {
    const elements = getFocusableElements();
    if (!elements.length) return null;

    // If nothing is selected yet, select the first visible item
    if (!currentFocused || !document.body.contains(currentFocused)) {
      return elements[0];
    }

    const currentRect = currentFocused.getBoundingClientRect();
    const currentCenter = {
      x: currentRect.left + currentRect.width / 2,
      y: currentRect.top + currentRect.height / 2
    };

    let bestCandidate = null;
    let bestScore = Infinity;

    elements.forEach(el => {
      if (el === currentFocused) return;
      const rect = el.getBoundingClientRect();
      const center = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };

      const dx = center.x - currentCenter.x;
      const dy = center.y - currentCenter.y;

      // Filter by direction
      if (direction === 'ArrowRight' && dx <= 10) return;
      if (direction === 'ArrowLeft' && dx >= -10) return;
      if (direction === 'ArrowDown' && dy <= 10) return;
      if (direction === 'ArrowUp' && dy >= -10) return;

      // Weight perpendicular distance heavier so Left/Right stays on the same movie row
      let distance;
      if (direction === 'ArrowLeft' || direction === 'ArrowRight') {
        distance = Math.abs(dx) + Math.abs(dy) * 3.5;
      } else {
        distance = Math.abs(dy) + Math.abs(dx) * 2.5;
      }

      if (distance < bestScore) {
        bestScore = distance;
        bestCandidate = el;
      }
    });

    return bestCandidate;
  }

  document.addEventListener('keydown', function (e) {
    const navKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

    if (navKeys.includes(e.key)) {
      // Allow normal typing cursor movement inside text inputs unless at edges
      if (document.activeElement && document.activeElement.tagName === 'INPUT' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        return;
      }

      e.preventDefault();
      const next = findNextElement(e.key);
      if (next) setFocus(next);
    }

    // Handle TV Remote "OK" / "Enter" button (keyCode 13 or 23 on Android/Linux TVs)
    if (e.key === 'Enter' || e.keyCode === 13 || e.keyCode === 23) {
      if (currentFocused && document.activeElement !== currentFocused) {
        e.preventDefault();
        currentFocused.click();
      }
    }

    // Handle TV Remote "Back" button (Backspace or Escape)
    if (e.key === 'Escape' || e.keyCode === 461 || e.keyCode === 10009) {
      if (window.history.length > 1) {
        window.history.back();
      }
    }
  });

  // Remove TV focus ring if someone uses a touchscreen or mouse
  document.addEventListener('pointerdown', () => {
    if (currentFocused) {
      currentFocused.classList.remove('tv-focused');
      currentFocused = null;
    }
  });
})();