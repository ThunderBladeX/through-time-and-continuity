// Load recent timeline activities for homepage
async function loadRecentActivities() {
    const activityList = document.getElementById('activity-list');
    if (!activityList) return;
    
    try {
        // Fetch recent events - backend returns array directly
        const events = await fetchAPI('/events?limit=6');
        
        if (!events || events.length === 0) {
            activityList.innerHTML = `
                <div class="empty-state">
                    <p>No recent timeline updates yet.</p>
                </div>
            `;
            return;
        }
        
        // Clear skeleton
        activityList.innerHTML = '';
        
        // Render activity cards
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
        // Navigate to first character's profile with event highlighted
        if (event.character_id) {
            window.location.href = `/profile/${event.character_id}?event=${event.id}`;
        }
    };
    
    // Event data comes pre-formatted from backend with character info
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
                <h3>${event.title}</h3>
                <p class="activity-date">${formatDate(event.event_date)}</p>
            </div>
        </div>
        <span class="activity-era-badge era-badge" data-era="${event.era}">
            ${event.era_display || getEraName(event.era)}
        </span>
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

function getEraName(eraId) {
    const eraNames = {
        'pre-52': 'Classic',
        'new-52': 'New 52',
        'rebirth': 'Rebirth',
        'infinite-frontier': 'Infinite Frontier',
        'elseworlds': 'Elseworlds',
        'post-crisis': 'Post-Crisis',
        'future-state': 'Future State'
    };
    return eraNames[eraId] || eraId;
}

// Hero parallax effect
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

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadRecentActivities();
    setupHeroParallax();
});
