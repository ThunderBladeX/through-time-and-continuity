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

document.addEventListener('DOMContentLoaded', () => {
    loadRecentActivities();
    setupHeroParallax();
});
