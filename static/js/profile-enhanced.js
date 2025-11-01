let lenis = null;
let isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

document.addEventListener('DOMContentLoaded', () => {
    initSmoothScroll();
    initParallaxEffects();
    initMouseTilt();
    initIntersectionObserver();
    initCardHoverEffects();
    optimizeAnimations();
});

function initSmoothScroll() {
    if (isReducedMotion) return;

    if (typeof Lenis !== 'undefined') {
        lenis = new Lenis({
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            orientation: 'vertical',
            gestureOrientation: 'vertical',
            smoothWheel: true,
            wheelMultiplier: 1,
            smoothTouch: false,
            touchMultiplier: 2,
            infinite: false,
        });

        function raf(time) {
            lenis.raf(time);
            requestAnimationFrame(raf);
        }

        requestAnimationFrame(raf);

        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    lenis.scrollTo(target, {
                        offset: -100,
                        duration: 1.5
                    });
                }
            });
        });
    }
}

function initParallaxEffects() {
    if (isReducedMotion) return;

    const profilePage = document.querySelector('.profile-page');
    if (!profilePage) return;

    let ticking = false;

    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                const scrolled = window.pageYOffset;
                const parallaxElements = document.querySelectorAll('.profile-page::before');

                if (profilePage.style) {
                    const yPos = scrolled * 0.3;
                    profilePage.style.backgroundPositionY = `${yPos}px`;
                }

                ticking = false;
            });
            ticking = true;
        }
    });
}

function initMouseTilt() {
    if (isReducedMotion) return;

    const tiltElements = document.querySelectorAll(
        '.profile-image-container, .bio-item, .event-card, .relationship-card, .love-interest-card'
    );

    tiltElements.forEach(element => {
        let bounds;

        element.addEventListener('mouseenter', () => {
            bounds = element.getBoundingClientRect();
        });

        element.addEventListener('mousemove', (e) => {
            if (!bounds) return;

            const mouseX = e.clientX;
            const mouseY = e.clientY;
            const leftX = mouseX - bounds.x;
            const topY = mouseY - bounds.y;
            const center = {
                x: leftX - bounds.width / 2,
                y: topY - bounds.height / 2
            };
            const distance = Math.sqrt(center.x ** 2 + center.y ** 2);

            const tiltX = (center.y / (bounds.height / 2)) * 5; 
            const tiltY = (center.x / (bounds.width / 2)) * -5;

            element.style.transform = `
                perspective(1200px)
                rotateX(${tiltX}deg)
                rotateY(${tiltY}deg)
                scale3d(1.02, 1.02, 1.02)
            `;

            const glare = element.querySelector('.tilt-glare') || createGlare(element);
            if (glare) {
                const angle = Math.atan2(center.y, center.x) * (180 / Math.PI);
                glare.style.background = `linear-gradient(${angle}deg, rgba(255,255,255,0.1) 0%, transparent 80%)`;
                glare.style.opacity = distance < 200 ? 0.3 : 0;
            }
        });

        element.addEventListener('mouseleave', () => {
            element.style.transform = '';
            const glare = element.querySelector('.tilt-glare');
            if (glare) glare.style.opacity = 0;
        });
    });
}

function createGlare(element) {
    const glare = document.createElement('div');
    glare.className = 'tilt-glare';
    glare.style.cssText = `
        position: absolute;
        inset: 0;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.3s ease;
        border-radius: inherit;
        z-index: 1;
    `;
    element.style.position = 'relative';
    element.appendChild(glare);
    return glare;
}

function initIntersectionObserver() {
    if (isReducedMotion) return;

    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0) translateZ(0)';

                const children = entry.target.querySelectorAll('.bio-item, .timeline-event, .relationship-card');
                children.forEach((child, index) => {
                    setTimeout(() => {
                        child.style.opacity = '1';
                        child.style.transform = 'translateY(0) translateZ(0)';
                    }, index * 50);
                });

                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.bio-section, .timeline-container, .relationships-grid').forEach(section => {
        section.style.opacity = '0';
        section.style.transform = 'translateY(40px) translateZ(-20px)';
        section.style.transition = 'opacity 0.6s ease, transform 0.6s cubic-bezier(0.23, 1, 0.32, 1)';
        observer.observe(section);
    });
}

function initCardHoverEffects() {
    if (isReducedMotion) return;

    const cards = document.querySelectorAll('.bio-item, .event-card, .relationship-card, .love-interest-card');

    cards.forEach(card => {
        let bounds;

        card.addEventListener('mouseenter', () => {
            bounds = card.getBoundingClientRect();
        });

        card.addEventListener('mousemove', (e) => {
            if (!bounds) return;

            const mouseX = e.clientX;
            const mouseY = e.clientY;
            const leftX = mouseX - bounds.x;
            const topY = mouseY - bounds.y;
            const center = {
                x: leftX - bounds.width / 2,
                y: topY - bounds.height / 2
            };

            const moveX = center.x * 0.05;
            const moveY = center.y * 0.05;

            const currentTransform = window.getComputedStyle(card).transform;
            card.style.transform = `${currentTransform} translate(${moveX}px, ${moveY}px)`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
        });
    });

    cards.forEach(card => {
        card.addEventListener('click', function(e) {
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;

            ripple.style.cssText = `
                position: absolute;
                width: ${size}px;
                height: ${size}px;
                border-radius: 50%;
                background: radial-gradient(circle, rgba(59, 130, 246, 0.4) 0%, transparent 70%);
                left: ${x}px;
                top: ${y}px;
                pointer-events: none;
                animation: ripple 0.8s ease-out;
            `;

            this.style.position = 'relative';
            this.style.overflow = 'hidden';
            this.appendChild(ripple);

            setTimeout(() => ripple.remove(), 800);
        });
    });

    const style = document.createElement('style');
    style.textContent = `
        @keyframes ripple {
            from {
                transform: scale(0);
                opacity: 1;
            }
            to {
                transform: scale(4);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

function initTimelineDotAnimation() {
    if (isReducedMotion) return;

    const timelineEvents = document.querySelectorAll('.timeline-event');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('dot-active');

                const style = document.createElement('style');
                style.textContent = `
                    .timeline-event.dot-active::before {
                        animation: dotPulse 1.5s ease-in-out infinite;
                    }
                    @keyframes dotPulse {
                        0%, 100% { 
                            transform: translateZ(5px) scale(1);
                            box-shadow: 0 0 0 6px rgba(59, 130, 246, 0.2);
                        }
                        50% { 
                            transform: translateZ(10px) scale(1.2);
                            box-shadow: 0 0 0 12px rgba(59, 130, 246, 0.4);
                        }
                    }
                `;
                if (!document.querySelector('#timeline-dot-animation')) {
                    style.id = 'timeline-dot-animation';
                    document.head.appendChild(style);
                }
            }
        });
    }, {
        threshold: 0.5
    });

    timelineEvents.forEach(event => observer.observe(event));
}

function initProfileImageDepth() {
    if (isReducedMotion) return;

    const profileContainer = document.querySelector('.profile-image-container');
    if (!profileContainer) return;

    const profileImage = profileContainer.querySelector('.profile-image');
    const nameOverlay = profileContainer.querySelector('.profile-name-overlay');

    if (!profileImage || !nameOverlay) return;

    profileContainer.addEventListener('mousemove', (e) => {
        const rect = profileContainer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const percentX = (x - centerX) / centerX;
        const percentY = (y - centerY) / centerY;

        const moveX = percentX * 15;
        const moveY = percentY * 15;

        profileImage.style.transform = `scale(1.08) translate(${moveX}px, ${moveY}px)`;
        nameOverlay.style.transform = `translateZ(15px) translate(${moveX * 0.5}px, ${moveY * 0.5}px)`;
    });

    profileContainer.addEventListener('mouseleave', () => {
        profileImage.style.transform = 'scale(1.02)';
        nameOverlay.style.transform = 'translateZ(10px)';
    });
}

function enhanceNavTabs() {
    const navTabs = document.querySelectorAll('.nav-tab');
    const profileNav = document.querySelector('.profile-nav');

    if (!profileNav) return;

    const indicator = document.createElement('div');
    indicator.className = 'nav-indicator';
    indicator.style.cssText = `
        position: absolute;
        right: 0;
        width: 4px;
        background: linear-gradient(180deg, var(--accent), rgba(59, 130, 246, 0.5));
        transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        pointer-events: none;
        z-index: 10;
        box-shadow: 0 0 20px rgba(59, 130, 246, 0.6);
        border-radius: 2px 0 0 2px;
    `;
    profileNav.style.position = 'relative';
    profileNav.appendChild(indicator);

    function updateIndicator() {
        const activeTab = document.querySelector('.nav-tab.active');
        if (activeTab) {
            const rect = activeTab.getBoundingClientRect();
            const navRect = profileNav.getBoundingClientRect();
            const top = rect.top - navRect.top;

            indicator.style.top = `${top}px`;
            indicator.style.height = `${rect.height}px`;
        }
    }

    updateIndicator();

    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            setTimeout(updateIndicator, 50);
        });
    });

    window.addEventListener('resize', updateIndicator);
}

function initGalleryEffects() {
    if (isReducedMotion) return;

    const galleryItems = document.querySelectorAll('.gallery-item');

    galleryItems.forEach(item => {
        const img = item.querySelector('img');
        if (!img) return;

        item.addEventListener('mouseenter', () => {

            const siblings = Array.from(item.parentElement.children);
            const index = siblings.indexOf(item);

            siblings.forEach((sibling, i) => {
                if (Math.abs(i - index) === 1) {
                    sibling.style.transform = 'scale(1.02)';
                    sibling.style.transition = 'transform 0.4s ease';
                }
            });
        });

        item.addEventListener('mouseleave', () => {
            const siblings = Array.from(item.parentElement.children);
            siblings.forEach(sibling => {
                sibling.style.transform = '';
            });
        });
    });
}

function optimizeAnimations() {

    const lazyAnimElements = document.querySelectorAll('[data-animate]');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animated');
                observer.unobserve(entry.target);
            }
        });
    }, {
        rootMargin: '50px'
    });

    lazyAnimElements.forEach(el => observer.observe(el));

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {

            if (typeof enhanceNavTabs === 'function') {
                const updateEvent = new Event('nav-update');
                document.dispatchEvent(updateEvent);
            }
        }, 250);
    });

    let scrollTicking = false;
    window.addEventListener('scroll', () => {
        if (!scrollTicking) {
            window.requestAnimationFrame(() => {

                scrollTicking = false;
            });
            scrollTicking = true;
        }
    }, { passive: true });
}

function initCursorTrail() {
    if (isReducedMotion || window.innerWidth < 1024) return;

    const canvas = document.createElement('canvas');
    canvas.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 9999;
    `;
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const maxParticles = 20;

    class Particle {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.size = Math.random() * 3 + 1;
            this.speedX = Math.random() * 2 - 1;
            this.speedY = Math.random() * 2 - 1;
            this.life = 1;
        }

        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            this.life -= 0.02;
            if (this.size > 0.1) this.size -= 0.05;
        }

        draw() {
            ctx.fillStyle = `rgba(59, 130, 246, ${this.life * 0.5})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    document.addEventListener('mousemove', (e) => {
        if (particles.length < maxParticles) {
            particles.push(new Particle(e.clientX, e.clientY));
        }
    });

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (let i = particles.length - 1; i >= 0; i--) {
            particles[i].update();
            particles[i].draw();

            if (particles[i].life <= 0) {
                particles.splice(i, 1);
            }
        }

        requestAnimationFrame(animate);
    }

    animate();

    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });
}

function initAll3DEffects() {
    initProfileImageDepth();
    enhanceNavTabs();
    initTimelineDotAnimation();
    initGalleryEffects();
    initCursorTrail(); 
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll3DEffects);
} else {
    initAll3DEffects();
}

document.addEventListener('tab-switched', () => {
    setTimeout(initAll3DEffects, 100);
});
