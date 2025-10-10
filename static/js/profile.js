// Profile page functionality

document.addEventListener('DOMContentLoaded', async () => {
    const characterId = document.body.dataset.characterId || getCharacterIdFromURL();
    if (characterId) {
        await loadCharacterProfile(characterId);
        setupTabs();
    }
});

function getCharacterIdFromURL() {
    const path = window.location.pathname;
    const match = path.match(/\/profile\/(\d+)/);
    return match ? match[1] : null;
}

async function loadCharacterProfile(characterId) {
    try {
        const character = await fetchAPI(`/characters/${characterId}`);
        
        // Update page title
        document.getElementById('page-title').textContent = `${character.full_name} - DC Timeline`;
        document.getElementById('character-name').textContent = character.full_name;
        document.body.dataset.characterId = characterId;
        
        // Load profile image
        const profileImg = document.getElementById('profile-image');
        profileImg.src = character.profile_image || '/static/images/default-profile.jpg';
        profileImg.alt = character.full_name;
        
        // Load bio/overview
        await loadOverview(character);
        
        // Load timeline
        await loadTimeline(characterId);
        
        // Load relationships
        await loadRelationships(characterId);
        
        // Load gallery
        await loadGallery(characterId);
        
    } catch (error) {
        console.error('Failed to load character:', error);
    }
}

async function loadOverview(character) {
    const bioGrid = document.getElementById('bio-identity');
    
    const bioItems = [
        { label: 'Nickname', value: character.nickname },
        { label: 'Full Name', value: character.full_name },
        { label: 'Birthday', value: character.birthday ? formatDate(character.birthday) : 'Unknown' },
        { label: 'Family', value: character.family },
    ];
    
    bioGrid.innerHTML = bioItems.map(item => `
        <div class="bio-item">
            <div class="bio-label">${item.label}</div>
            <div class="bio-value">${item.value || 'N/A'}</div>
        </div>
    `).join('');
}

async function loadTimeline(characterId) {
    const timelineList = document.getElementById('timeline-list');
    
    try {
        const events = await fetchAPI(`/characters/${characterId}/timeline`);
        
        if (events.length === 0) {
            timelineList.innerHTML = '<p>No timeline events yet.</p>';
            return;
        }
        
        timelineList.innerHTML = events.map(event => `
            <div class="timeline-event" onclick="showEventModal(${event.id})">
                <div class="event-card">
                    <div class="event-header">
                        <span class="event-date">${formatDate(event.event_date)}</span>
                        <span class="era-badge" data-era="${event.era}">${event.era_display}</span>
                    </div>
                    <h3 class="event-title">${event.title}</h3>
                    <p class="event-summary">${event.summary}</p>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Failed to load timeline:', error);
    }
}

async function loadRelationships(characterId) {
    const relationshipsList = document.getElementById('relationships-list');
    
    try {
        const relationships = await fetchAPI(`/characters/${characterId}/relationships`);
        
        if (relationships.length === 0) {
            relationshipsList.innerHTML = '<p>No relationships defined yet.</p>';
            return;
        }
        
        relationshipsList.innerHTML = relationships.map(rel => `
            <div class="relationship-card" data-type="${rel.type}" 
                 onclick="window.location.href='/profile/${rel.related_character_id}'">
                <img src="${rel.related_character_image}" 
                     alt="${rel.related_character_name}" 
                     class="relationship-avatar">
                <div class="relationship-info">
                    <div class="relationship-name">${rel.related_character_name}</div>
                    <div class="relationship-status">${rel.status}</div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Failed to load relationships:', error);
    }
}

async function loadGallery(characterId) {
    const galleryGrid = document.getElementById('gallery-masonry');
    
    try {
        const images = await fetchAPI(`/characters/${characterId}/gallery`);
        
        if (images.length === 0) {
            galleryGrid.innerHTML = '<p>No images in gallery yet.</p>';
            return;
        }
        
        galleryGrid.innerHTML = images.map(img => `
            <div class="gallery-item">
                <img src="${img.url}" alt="${img.alt || 'Gallery image'}" loading="lazy">
            </div>
        `).join('');
    } catch (error) {
        console.error('Failed to load gallery:', error);
    }
}

function setupTabs() {
    const tabs = document.querySelectorAll('.nav-tab');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Show corresponding content
            const tabName = tab.dataset.tab;
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(`${tabName}-tab`).classList.add('active');
        });
    });
}

async function showEventModal(eventId) {
    const modal = document.getElementById('event-modal');
    
    try {
        const event = await fetchAPI(`/events/${eventId}`);
        
        document.getElementById('modal-era-badge').dataset.era = event.era;
        document.getElementById('modal-era-badge').textContent = event.era_display;
        document.getElementById('modal-event-title').textContent = event.title;
        document.getElementById('modal-event-date').textContent = formatDate(event.event_date);
        document.getElementById('modal-event-description').innerHTML = event.full_description || event.summary;
        
        // Load event images
        const imagesContainer = document.getElementById('modal-event-images');
        if (event.images && event.images.length > 0) {
            imagesContainer.innerHTML = event.images.map(img => 
                `<img src="${img}" alt="Event image">`
            ).join('');
        } else {
            imagesContainer.innerHTML = '';
        }
        
        openModal('event-modal');
    } catch (error) {
        console.error('Failed to load event details:', error);
    }
}
