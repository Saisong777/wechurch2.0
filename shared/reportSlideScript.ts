// Fixed controller shared by report exports and the server CSP hash.
export const reportSlideScript = `
          let currentSlide = 0;
          const slides = document.querySelectorAll('.slide');
          const counter = document.querySelector('.slide-counter');

          function showSlide(n) {
            slides.forEach((s, i) => {
              s.style.display = i === n ? 'flex' : 'none';
            });
            counter.textContent = (n + 1) + ' / ' + slides.length;
          }

          document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight' || e.key === ' ') {
              currentSlide = Math.min(currentSlide + 1, slides.length - 1);
              showSlide(currentSlide);
            } else if (e.key === 'ArrowLeft') {
              currentSlide = Math.max(currentSlide - 1, 0);
              showSlide(currentSlide);
            }
          });

          document.body.addEventListener('click', () => {
            currentSlide = Math.min(currentSlide + 1, slides.length - 1);
            showSlide(currentSlide);
          });

          showSlide(0);
        `;
