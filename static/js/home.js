// Load recent timeline activities for homepage
async function loadRecentActivities() {
    const activityList = document.getElementById('activity-list');
    if (!activityList) return;
    
    try {
        // Fetch recent events
        const data = await fetchAPI('/timeline/recent?limit=6');
        
        if (!data.events || data.events.length === 0) {
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
        data.events.forEach(event => {
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
        if (event.characters && event.characters.length > 0) {
            window.location.href = `/profile.html?id=${event.characters[0].id}&event=${event.id}`;
        }
    };
    
    // Get first character for avatar
    const character = event.characters && event.characters.length > 0 ? event.characters[0] : null;
    
    card.innerHTML = `
        <div class="activity-header">
            ${character ? `
                <img src="${character.profile_image_url}" 
                     alt="${character.name}" 
                     class="activity-avatar">
            ` : ''}
            <div class="activity-meta">
                <h3>${event.title}</h3>
                <p class="activity-date">${formatDate(event.event_date)}</p>
            </div>
        </div>
        <span class="activity-era-badge" data-era="${event.era}">
            ${getEraName(event.era)}
        </span>
        <p class="activity-summary">${event.summary}</p>
        ${event.characters && event.characters.length > 0 ? `
            <div class="activity-characters">
                ${event.characters.map(char => `
                    <span class="character-tag">${char.name}</span>
                `).join('')}
            </div>
        ` : ''}
    `;
    
    return card;
}

function getEraName(eraId) {
    const eraNames = {
        'pre-52': 'Pre-New 52',
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
