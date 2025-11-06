async function loadRecentActivities() {
    const activityList = document.getElementById('activity-list');
    if (!activityList) return;
    
    try {
        const events = await fetchAPI('/events?limit=6');
        
        if (!events || events.length === 0) {
            activityList.innerHTML = `
                <div class="empty-state">
                    <p>No recent timeline updates yet.</p>
                </div>
            `;
            return;
        }

        activityList.innerHTML = '';

        events.forEach(event => {
            const card = createActivityCard(event);
            activityList.appendChild(card);
        });
        
    } catch (error) {
        console.error('Error loading activities:', error);
        activityList.innerHTML = `
            <div class="error-state">
                <p>Failed to load recent activities.</p>
            </div>
        `;
    }
}

function createActivityCard(event) {
    const card = document.createElement('div');
    card.className = 'activity-card';
    card.onclick = () => {
        if (event.character_id) {
            window.location.href = `/profile/${event.character_id}?event=${event.id}`;
        }
    };
    
    const hasCharacter = event.character_id && event.character_image;
    
    card.innerHTML = `
        <div class="activity-header">
            ${hasCharacter ? `
                <img src="${event.character_image}" 
                     alt="${event.character_name || 'Character'}" 
                     class="activity-avatar"
                     onerror="this.src='/static/images/default-avatar.jpg'">
            ` : ''}
            <div class="activity-meta">
                <h3>
                    <span class="activity-era-badge era-badge" data-era="${event.era}">
                        ${event.era_display || getEraName(event.era)}
                    </span>
                    ${event.title}
                </h3>
                <p class="activity-date">${formatDate(event.event_date)}</p>
            </div>
        </div>
        <p class="activity-summary">${event.summary}</p>
        ${event.characters && event.characters.length > 0 ? `
            <div class="activity-characters">
                ${event.characters.map(charName => `
                    <span class="character-tag">${charName}</span>
                `).join('')}
            </div>
        ` : ''}
    `;
    
    return card;
}

function setupHeroParallax() {
    const hero = document.querySelector('.hero');
    if (!hero) return;
    
    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        const heroHeight = hero.offsetHeight;
        
        if (scrolled < heroHeight) {
            const opacity = 1 - (scrolled / heroHeight);
            hero.style.opacity = opacity;
        }
    });
}

function setupOrbitalEasterEgg() {
    const orbitalSystem = document.getElementById('orbital-system');
    const sun = document.getElementById('sun');
    const perihelion = document.getElementById('perihelion');
    const aphelion = document.getElementById('aphelion');
    const wanderer = document.getElementById('wanderer');
    const tooltip = document.getElementById('orbit-tooltip');
    
    if (!orbitalSystem || !sun) return;
    
    let clickSequence = [];
    const secretSequence = ['sun', 'perihelion', 'aphelion'];
    let easterEggActivated = false;
    let resetTimeout;

    const planetTooltips = {
        'sun': 'The Center ⭐ (Click to start)',
        'perihelion': 'Perihelion: Closest Point 🔴',
        'aphelion': 'Aphelion: Farthest Point 🔵',
        'wanderer': 'The Wanderer: Always Moving 💜'
    };
    
    function showTooltip(element, text) {
        if (window.innerWidth <= 480) return; // Skip on mobile
        
        const rect = element.getBoundingClientRect();
        tooltip.textContent = text;
        tooltip.style.left = `${rect.left + rect.width / 2}px`;
        tooltip.style.top = `${rect.bottom + 10}px`;
        tooltip.style.transform = 'translateX(-50%)';
        tooltip.classList.add('active');
    }
    
    function hideTooltip() {
        tooltip.classList.remove('active');
    }

    [sun, perihelion, aphelion, wanderer].forEach(element => {
        if (!element) return;
        
        element.addEventListener('mouseenter', () => {
            showTooltip(element, planetTooltips[element.id]);
        });
        
        element.addEventListener('mouseleave', hideTooltip);
    });
 
    function handlePlanetClick(planetId) {
        if (easterEggActivated) return;
        
        clickSequence.push(planetId);

        const element = document.getElementById(planetId);
        if (element) {
            element.style.transform = 'scale(1.5)';
            setTimeout(() => {
                element.style.transform = '';
            }, 300);
        }

        if (clickSequence.length === secretSequence.length) {
            if (JSON.stringify(clickSequence) === JSON.stringify(secretSequence)) {
                activateEasterEgg();
            } else {
                orbitalSystem.style.animation = 'none';
                setTimeout(() => {
                    orbitalSystem.style.animation = '';
                }, 10);
                showNotification('Not quite right... Try again! 🌟', 'info');
            }
            clickSequence = [];
        }

        clearTimeout(resetTimeout);
        resetTimeout = setTimeout(() => {
            clickSequence = [];
        }, 5000);
    }
    
    function activateEasterEgg() {
        easterEggActivated = true;
        hideTooltip();

        orbitalSystem.classList.add('easter-egg-active');

        showNotification('🌟 You\'ve unlocked the cosmic secret! The orbital dance begins! 🌟', 'success');

        createSparkles();

        setTimeout(() => {
            orbitalSystem.classList.remove('easter-egg-active');
            easterEggActivated = false;
            clickSequence = [];
        }, 2000);
    }
    
    function createSparkles() {
        const colors = ['#ffd700', '#3b82f6', '#ef4444', '#8b5cf6'];
        const heroContent = document.querySelector('.hero-content');
        
        for (let i = 0; i < 30; i++) {
            setTimeout(() => {
                const sparkle = document.createElement('div');
                sparkle.style.cssText = `
                    position: absolute;
                    width: 4px;
                    height: 4px;
                    background: ${colors[Math.floor(Math.random() * colors.length)]};
                    border-radius: 50%;
                    top: ${Math.random() * 100}%;
                    left: ${Math.random() * 100}%;
                    pointer-events: none;
                    animation: sparkleFade 1s ease-out forwards;
                    box-shadow: 0 0 10px currentColor;
                `;
                
                heroContent.appendChild(sparkle);
                
                setTimeout(() => sparkle.remove(), 1000);
            }, i * 30);
        }
    }

    if (!document.getElementById('sparkle-animation')) {
        const style = document.createElement('style');
        style.id = 'sparkle-animation';
        style.textContent = `
            @keyframes sparkleFade {
                0% {
                    opacity: 1;
                    transform: scale(0) translateY(0);
                }
                50% {
                    opacity: 1;
                    transform: scale(1) translateY(-20px);
                }
                100% {
                    opacity: 0;
                    transform: scale(0.5) translateY(-40px);
                }
            }
        `;
        document.head.appendChild(style);
    }

    sun.addEventListener('click', () => handlePlanetClick('sun'));
    perihelion.addEventListener('click', () => handlePlanetClick('perihelion'));
    aphelion.addEventListener('click', () => handlePlanetClick('aphelion'));

    wanderer.addEventListener('click', () => {
        showNotification('The Wanderer goes its own way... 💫', 'info');
        wanderer.style.animationDuration = '10s';
        setTimeout(() => {
            wanderer.style.animationDuration = '30s';
        }, 10000);
    });

    let sunClickCount = 0;
    let sunClickTimer;
    
    sun.addEventListener('click', () => {
        sunClickCount++;
        clearTimeout(sunClickTimer);
        
        if (sunClickCount === 3) {
            showNotification('💡 Hint: Sun → Closest → Farthest', 'info');
            sunClickCount = 0;
        }
        
        sunClickTimer = setTimeout(() => {
            sunClickCount = 0;
        }, 1000);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    loadRecentActivities();
    setupHeroParallax();
    setupOrbitalEasterEgg()
});
