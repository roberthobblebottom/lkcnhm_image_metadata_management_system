// Simple script for interactive elements

document.addEventListener('DOMContentLoaded', function() {
  // Play button functionality
  const playButton = document.querySelector('.play-btn');
  if (playButton) {
      playButton.addEventListener('click', function() {
          alert('Video playback would start here');
          // In a real implementation, this would trigger a video modal or player
      });
  }

  // Navigation arrows functionality
  const leftArrow = document.querySelector('.arrow-left');
  const rightArrow = document.querySelector('.arrow-right');
  const progressFill = document.querySelector('.progress-fill');
  
  let currentPosition = 33; // Starting at 33% as shown in the design
  
  if (leftArrow && rightArrow && progressFill) {
      leftArrow.addEventListener('click', function() {
          currentPosition = Math.max(0, currentPosition - 33);
          progressFill.style.width = `${currentPosition}%`;
      });
      
      rightArrow.addEventListener('click', function() {
          currentPosition = Math.min(100, currentPosition + 33);
          progressFill.style.width = `${currentPosition}%`;
      });
  }

  // Accessibility button functionality
  const accessibilityBtn = document.querySelector('.accessibility-btn');
  if (accessibilityBtn) {
      accessibilityBtn.addEventListener('click', function() {
          alert('Accessibility options would open here');
          // In a real implementation, this would toggle accessibility features
      });
  }

  // Feature cards hover effect
  const featureCards = document.querySelectorAll('.feature-card');
  featureCards.forEach(card => {
      card.addEventListener('mouseenter', function() {
          this.style.transform = 'scale(1.02)';
          this.style.transition = 'transform 0.3s ease';
      });
      
      card.addEventListener('mouseleave', function() {
          this.style.transform = 'scale(1)';
      });
  });
});
