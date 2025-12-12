//
// The Dark Mode System with Animation
//

// Helper function to set the theme and save preference
function setTheme(theme) {
  localStorage.setItem('theme', theme);
  if (theme === 'dark') {
      document.body.classList.add('dark-mode');
  } else {
      document.body.classList.remove('dark-mode');
  }
}

// Determines a new user's dark mode preferences on page load
function detectColourScheme() {
  let theme = 'light'; // Default to light theme
  // Check local storage for a saved theme
  if (localStorage.getItem('theme')) {
      theme = localStorage.getItem('theme');
  // If not, check for the user's OS preference
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      theme = 'dark';
  }
  // Apply the determined theme
  setTheme(theme);
}

// Run color scheme detection on page load
detectColourScheme();

// Set up variables for the theme toggle button and icons
const themeToggle = document.querySelector('.theme-toggle');
const sunIcon = document.querySelector('.icon-sun');
const moonIcon = document.querySelector('.icon-moon');

// Add click event listener to the toggle button
if (themeToggle) {
  themeToggle.addEventListener('click', () => {
      const isDark = document.body.classList.contains('dark-mode');
      const iconToAnimateOut = isDark ? sunIcon : moonIcon;
      const iconToAnimateIn = isDark ? moonIcon : sunIcon;

      // Start the animation out
      iconToAnimateOut.classList.add('animating-out');

      // When the out-animation ends, switch the theme and start the in-animation
      iconToAnimateOut.addEventListener('animationend', () => {
          // Toggle the theme
          setTheme(isDark ? 'light' : 'dark');

          // Clean up old animation class and add the new one
          iconToAnimateOut.classList.remove('animating-out');
          iconToAnimateIn.classList.add('animating-in');

          // Clean up the in-animation class after it's done
          iconToAnimateIn.addEventListener('animationend', () => {
              iconToAnimateIn.classList.remove('animating-in');
          }, { once: true });

      }, { once: true });
  });
}