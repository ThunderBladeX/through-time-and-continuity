// Get character ID from URL
const urlParams = new URLSearchParams(window.location.search);
const characterId = urlParams.get('id');
const highlightEventId = urlParams.get('event');

let currentCharacter = null;
let currentTab = 'overview';

// Load character data
async function loadCharacter() {
    if (!characterId) {
        window.location.href = '/characters.html';
        return;
    }
    
    try {
        const data = await fetchAPI(`/characters/${characterId}`);
        currentCharacter = data.character;
        
        // Set page title
        document.getElementById('page-title').textContent = `${currentCharacter.name} - DC Timeline`;
        document.title = `${currentCharacter.name} - DC Timeline`;
        
        // Apply character-specific theming
        applyCharacterTheme(currentCharacter);
        
        // Load character info
        loadCharacterInfo();
        
        // Load bio sections
        loadBioSections(data.bio_sections || []);
        
        // Load other tabs (lazy load on tab switch)
        setupTabs();
        
    } catch (error) {
        console.error('Error loading character:', error);
        showNotification('Failed to load character', 'error');
    }
}

// Load character basic info
function loadCharacterInfo() {
    // Desktop
    document.getElementById('profile-image').src = currentCharacter.profile_image_url;
    document.getElementById('profile-image').alt = currentCharacter.name;
    document.getElementById('character-name').textContent = currentCharacter.name;
    
    // Mobile
    document.getElementById('mobile-profile-image').src = currentCharacter.profile_image_url;
    document.getElementById('mobile-profile-image').alt = currentCharacter.name;
    document.getElementById('mobile-character-name').textContent = currentCharacter.name;
    
    if (currentCharacter.quote) {
        document.getElementById('character-quote').textContent = currentCharacter.quote;
    }
}

// Load bio sections
function loadBioSections(sections) {
    const identitySection = document.getElementById('bio-identity');
    const additionalSections = document.getElementById('additional-bio-sections');
    
    // Create identity grid
    const identityItems = [
        { label: 'Full Name', value: currentCharacter.full_name },
        { label: 'Alias', value: currentCharacter.nickname },
        { label: 'Birthday', value: currentCharacter.birthday ? formatDate(currentCharacter.birthday) : null },
        { label: 'Family', value: currentCharacter.family }
    ].filter(item => item.value);
    
    identitySection.innerHTML = identityItems.map(item => `
        <div class="bio-item">
            <div class="bio-label">${item.label}</div>
            <div class="bio-value">${item.value}</div>
        </div>
    `).join('');
    
    // Create additional sections from database
    if (sections && sections.length > 0) {
        sections.sort((a, b) => a.display_order - b.display_order);
        
        additionalSections.innerHTML = sections.map(section => `
            <div class="bio-section">
                <h2 class="section-header">${section.section_title}</h2>
                <div class="bio-content">
                    ${parseMarkdown(section.content)}
                </div>
            </div>
        `).join('');
    }
}

// Setup tab navigation
function setupTabs() {
    const tabs = document.querySelectorAll('.nav-tab, .mobile-nav-tab');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            switchTab(tabName);
        });
    });
}

// Switch between tabs
function switchTab(tabName) {
    currentTab = tabName;
    
    // Update active tab buttons
    document.querySelectorAll('.nav-tab, .mobile-nav-tab').forEach(tab => {
        if (tab.dataset.tab === tabName) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    // Update active content
    document.querySelectorAll('.tab-content, .mobile-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    const desktopContent = document.getElementById(`${tabName}-tab`);
    const mobileContent = document.getElementById(`mobile-${tabName}`);
    
    if (desktopContent) desktopContent.classList.add('active');
    if (mobileContent) mobileContent.classList.add('active');
    
    // Load content if not loaded yet
    switch(tabName) {
        case 'timeline':
            if (!desktopContent.dataset.loaded) {
                loadTimeline();
                desktopContent.dataset.loaded = 'true';
            }
            break;
        case 'relationships':
            if (!desktopContent.dataset.loaded) {
                loadRelationships();
                desktopContent.dataset.loaded = 'true';
            }
            break;
        case 'gallery':
            if (!desktopContent.dataset.loaded) {
                loadGallery();
                desktopContent.dataset.loaded = 'true';
            }
            break;
    }
}

// Load timeline events
async function loadTimeline() {
    const timelineList = document.getElementById('timeline-list');
    
    try {
        const data = await fetchAPI(`/timeline/character/${characterId}`);
        const events = data.events || [];
        
        if (events.length === 0) {
            timelineList.innerHTML = '<p class="empty-state">No timeline events yet.</p>';
            return;
        }
        
        // Sort by date (newest first)
        events.sort((a, b) => new Date(b.event_date) - new Date(a.event_date));
        
        timelineList.innerHTML = events.map(event => createTimelineEvent(event)).join('');
        
        // Setup event modal triggers
        setupEventModals();
        
        // Highlight specific event if in URL
        if (highlightEventId) {
            const eventCard = document.querySelector(`[data-event-id="${highlightEventId}"]`);
            if (eventCard) {
                eventCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                eventCard.style.animation = 'highlight 2s ease';
            }
        }
        
    } catch (error) {
        console.error('Error loading timeline:', error);
        timelineList.innerHTML = '<p class="error-state">Failed to load timeline.</p>';
    }
}

// Create timeline event HTML
function createTimelineEvent(event) {
    return `
        <div class="timeline-event" data-event-id="${event.id}">
            <div class="event-card" data-era="${event.era}" onclick="openEventModal('${event.id}')">
                <div class="event-header">
                    <span class="era-badge" data-era="${event.era}">${getEraName(event.era)}</span>
                    <span class="event-date">${formatDate(event.event_date)}</span>
                </div>
                <h3 class="event-title">${event.title}</h3>
                <p class="event-summary">${event.summary}</p>
            </div>
        </div>
    `;
}

// Open event modal with full details
async function openEventModal(eventId) {
    try {
        const data = await fetchAPI(`/timeline/event/${eventId}`);
        const event = data.event;
        
        // Populate modal
        document.getElementById('modal-era-badge').dataset.era = event.era;
        document.getElementById('modal-era-badge').textContent = getEraName(event.era);
        document.getElementById('modal-event-title').textContent = event.title;
        document.getElementById('modal-event-date').textContent = formatDate(event.event_date);
        
        // Load images
        const imagesContainer = document.getElementById('modal-event-images');
        if (event.images && event.images.length > 0) {
            imagesContainer.innerHTML = event.images.map(img => `
                <img src="${img.image_url}" alt="${img.caption || event.title}" loading="lazy">
            `).join('');
        } else {
            imagesContainer.innerHTML = '';
        }
        
        // Load description
        const descContainer = document.getElementById('modal-event-description');
        descContainer.innerHTML = parseMarkdown(event.full_description || event.summary);
        
        openModal('event-modal');
        
    } catch (error) {
        console.error('Error loading event details:', error);
        showNotification('Failed to load event details', 'error');
    }
}

// Load relationships
async function loadRelationships() {
    const relationshipsList = document.getElementById('relationships-list');
    
    try {
        const data = await fetchAPI(`/relationships/character/${characterId}`);
        const relationships = data.relationships || [];
        
        if (relationships.length === 0) {
            relationshipsList.innerHTML = '<p class="empty-state">No relationships defined yet.</p>';
            return;
        }
        
        // Sort by display order
        relationships.sort((a, b) => a.display_order - b.display_order);
        
        relationshipsList.innerHTML = relationships.map(rel => `
            <div class="relationship-card" 
                 data-type="${rel.relationship_type}"
                 onclick="window.location.href='/profile.html?id=${rel.related_character.id}'">
                <img src="${rel.related_character.profile_image_url}" 
                     alt="${rel.related_character.name}"
                     class="relationship-avatar">
                <div class="relationship-info">
                    <div class="relationship-name">${rel.related_character.name}</div>
                    <div class="relationship-status">${rel.relationship_label}</div>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading relationships:', error);
        relationshipsList.innerHTML = '<p class="error-state">Failed to load relationships.</p>';
    }
}

// Load gallery (handled by gallery.js)
function loadGallery() {
    // Gallery initialization handled by gallery.js
    if (typeof initGallery === 'function') {
        initGallery(characterId);
    }
}

// Setup event modal triggers
function setupEventModals() {
    document.querySelectorAll('.event-card').forEach(card => {
        card.addEventListener('click', (e) => {
            const eventId = card.closest('.timeline-event').dataset.eventId;
            openEventModal(eventId);
        });
    });
}

// Apply character-specific theme
async function applyCharacterTheme(character) {
    // Set body attributes
    document.body.dataset.characterId = character.id;
    
    // Convert character name to CSS filename format
    // "Damian Wayne" -> "damian-wayne.css"
    const cssFileName = character.name.toLowerCase().replace(/\s+/g, '-') + '.css';
    const cssPath = `/styles/characters/${cssFileName}`;
    
    // Set character data attribute for CSS targeting
    document.body.dataset.character = character.name.toLowerCase().replace(/\s+/g, '-');
    
    // Try to load character-specific CSS file
    const themeLink = document.getElementById('character-theme');
    
    // Check if CSS file exists
    const cssExists = await checkFileExists(cssPath);
    
    if (cssExists) {
        // Load custom CSS file
        themeLink.href = cssPath;
    } else {
        // Apply dynamic theme from database colors
        applyDynamicTheme(character);
    }
}

// Check if a file exists
async function checkFileExists(url) {
    try {
        const response = await fetch(url, { method: 'HEAD' });
        return response.ok;
    } catch (error) {
        return false;
    }
}

// Apply dynamic theme from database colors
function applyDynamicTheme(character) {
    const root = document.documentElement;
    
    if (character.color_primary) {
        root.style.setProperty('--character-primary', character.color_primary);
    }
    if (character.color_secondary) {
        root.style.setProperty('--character-secondary', character.color_secondary);
    }
    if (character.color_accent) {
        root.style.setProperty('--character-accent', character.color_accent);
    }
    if (character.color_bg) {
        root.style.setProperty('--character-bg', character.color_bg);
    }
    
    // Apply theme data if available (custom cursor, effects, etc.)
    if (character.theme_data) {
        applyAdvancedTheme(character.theme_data);
    }
}

// Apply advanced theme options from theme_data JSON
function applyAdvancedTheme(themeData) {
    if (!themeData) return;
    
    // Custom cursor
    if (themeData.cursor) {
        document.body.style.cursor = `url('${themeData.cursor}'), auto`;
    }
    
    // Background effects
    if (themeData.background_pattern) {
        document.body.style.backgroundImage = `url('${themeData.background_pattern}')`;
    }
    
    // Additional custom properties
    if (themeData.custom_css) {
        const styleEl = document.createElement('style');
        styleEl.textContent = themeData.custom_css;
        document.head.appendChild(styleEl);
    }
}

// Helper to get era display name
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

// Add highlight animation
const highlightStyle = document.createElement('style');
highlightStyle.textContent = `
    @keyframes highlight {
        0%, 100% { box-shadow: var(--shadow-lg); }
        50% { box-shadow: 0 0 30px rgba(59, 130, 246, 0.8); }
    }
`;
document.head.appendChild(highlightStyle);

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadCharacter();
});
