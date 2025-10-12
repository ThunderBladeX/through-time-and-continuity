// Get character ID from URL path (Flask uses /profile/<id>, not query params)
const pathParts = window.location.pathname.split('/');
const characterId = pathParts[pathParts.length - 1];
const urlParams = new URLSearchParams(window.location.search);
const highlightEventId = urlParams.get('event');

let currentCharacter = null;
let currentTab = 'overview';

// Load character data
async function loadCharacter() {
    if (!characterId || isNaN(characterId)) {
        window.location.href = '/characters';
        return;
    }
    
    try {
        // Backend returns character object directly, now includes bio_sections
        const character = await fetchAPI(`/characters/${characterId}`);
        currentCharacter = character;
        
        // Use correct field name
        const charName = currentCharacter.full_name || currentCharacter.name || 'Unknown';
        
        // Set page title
        if (document.getElementById('page-title')) {
            document.getElementById('page-title').textContent = `${charName} - DC Timeline`;
        }
        document.title = `${charName} - DC Timeline`;
        
        // Apply character-specific theming
        applyCharacterTheme(currentCharacter);
        
        // Load character info
        loadCharacterInfo();
        
        // Load bio sections
        loadBioSections(currentCharacter.bio_sections || []);

        const desktopOverviewContent = document.getElementById('overview-tab').innerHTML;
        const mobileOverviewContainer = document.getElementById('mobile-overview');
        if (mobileOverviewContainer) {
            mobileOverviewContainer.innerHTML = desktopOverviewContent;
        }
        
        // Load other tabs (lazy load on tab switch)
        setupTabs();
        
    } catch (error) {
        console.error('Error loading character:', error);
        showNotification('Failed to load character', 'error');
        // Redirect to characters page on error
        setTimeout(() => window.location.href = '/characters', 2000);
    }
}

// Load character basic info
function loadCharacterInfo() {
    // Use correct field names from database
    const charName = currentCharacter.name || 'Unknown';
    const imageSrc = currentCharacter.profile_image || '/static/images/default-avatar.jpg';
    
    // Desktop
    const profileImg = document.getElementById('profile-image');
    if (profileImg) {
        profileImg.src = imageSrc;
        profileImg.alt = charName;
        profileImg.onerror = function() { this.src = '/static/images/default-avatar.jpg'; };
    }
    
    const charNameEl = document.getElementById('character-name');
    if (charNameEl) charNameEl.textContent = charName;
    
    // Mobile
    const mobileImg = document.getElementById('mobile-profile-image');
    if (mobileImg) {
        mobileImg.src = imageSrc;
        mobileImg.alt = charName;
        mobileImg.onerror = function() { this.src = '/static/images/default-avatar.jpg'; };
    }
    
    const mobileNameEl = document.getElementById('mobile-character-name');
    if (mobileNameEl) mobileNameEl.textContent = charName;
    
    // Quote
    const quoteEl = document.getElementById('character-quote');
    if (currentCharacter.quote && quoteEl) {
        quoteEl.textContent = currentCharacter.quote;
    }
}

// Load bio sections
function loadBioSections(sections) {
    const identitySection = document.getElementById('bio-identity');
    const additionalSections = document.getElementById('additional-bio-sections');
    const familyName = (currentCharacter.families && currentCharacter.families.name) || currentCharacter.family;
    
    // Create identity grid
    const identityItems = [
        { label: 'Full Name', value: currentCharacter.full_name },
        { label: 'Alias', value: currentCharacter.nickname },
        { label: 'Birthday', value: currentCharacter.birthday ? formatDate(currentCharacter.birthday) : null },
        { label: 'Family', value: familyName }
    ].filter(item => item.value);
    
    identitySection.innerHTML = identityItems.map(item => `
        <div class="bio-item">
            <div class="bio-label">${item.label}</div>
            <div class="bio-value">${item.value}</div>
        </div>
    `).join('');
    
    // Create additional sections from database
    if (sections && sections.length > 0) {
        // The database query already sorts by display_order, this is a fallback.
        sections.sort((a, b) => a.display_order - b.display_order);
        
        additionalSections.innerHTML = sections.map(section => `
            <div class="bio-section">
                <h2 class="section-header">${section.section_title}</h2>
                <div class="bio-content">
                    ${parseMarkdown(section.content)}
                </div>
            </div>
        `).join('');
    } else {
        additionalSections.innerHTML = '';
    }
    const desktopOverviewContent = document.getElementById('overview-tab').innerHTML;
    const mobileOverviewContainer = document.getElementById('mobile-overview');
    if (mobileOverviewContainer) {
        mobileOverviewContainer.innerHTML = desktopOverviewContent;
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
    if (!timelineList) return;
    
    try {
        // Use correct API endpoint - backend returns array directly
        const events = await fetchAPI(`/characters/${characterId}/timeline`);
        
        if (!events || events.length === 0) {
            timelineList.innerHTML = '<p class="empty-state">No timeline events yet.</p>';
            return;
        }
        
        // Sort by date (newest first)
        events.sort((a, b) => new Date(b.event_date) - new Date(a.event_date));
        
        timelineList.innerHTML = events.map(event => createTimelineEvent(event)).join('');

        const desktopTimelineContent = document.getElementById('timeline-tab').innerHTML;
        const mobileTimelineContainer = document.getElementById('mobile-timeline');
        if (mobileTimelineContainer) {
            mobileTimelineContainer.innerHTML = desktopTimelineContent;
        }
        
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
    const eraDisplay = event.era_display || getEraName(event.era);
    return `
        <div class="timeline-event" data-event-id="${event.id}">
            <div class="event-card" data-era="${event.era}" onclick="openEventModal(${event.id})">
                <div class="event-header">
                    <span class="era-badge" data-era="${event.era}">${eraDisplay}</span>
                    <span class="event-date">${formatDate(event.event_date)}</span>
                </div>
                <h3 class="event-title">${event.title}</h3>
                <p class="event-summary">${event.summary || ''}</p>
            </div>
        </div>
    `;
}

// Open event modal with full details
async function openEventModal(eventId) {
    try {
        // Use correct API endpoint - backend returns event directly
        const event = await fetchAPI(`/events/${eventId}`);
        
        const eraDisplay = event.era_display || getEraName(event.era);
        
        // Populate modal (with safety checks for missing elements)
        const eraBadge = document.getElementById('modal-era-badge');
        if (eraBadge) {
            eraBadge.dataset.era = event.era;
            eraBadge.textContent = eraDisplay;
        }
        
        const titleEl = document.getElementById('modal-event-title');
        if (titleEl) titleEl.textContent = event.title;
        
        const dateEl = document.getElementById('modal-event-date');
        if (dateEl) dateEl.textContent = formatDate(event.event_date);
        
        // Load images
        const imagesContainer = document.getElementById('modal-event-images');
        if (imagesContainer) {
            if (event.images && event.images.length > 0) {
                imagesContainer.innerHTML = event.images.map(imgUrl => `
                    <img src="${imgUrl}" alt="${event.title}" loading="lazy" onerror="this.style.display='none'">
                `).join('');
            } else {
                imagesContainer.innerHTML = '';
            }
        }
        
        // Load description - note: backend already converts markdown to HTML
        const descContainer = document.getElementById('modal-event-description');
        if (descContainer) {
            if (event.full_description) {
                // Backend already converted to HTML
                descContainer.innerHTML = event.full_description;
            } else {
                descContainer.innerHTML = `<p>${event.summary || ''}</p>`;
            }
        }
        
        openModal('event-modal');
        
    } catch (error) {
        console.error('Error loading event details:', error);
        showNotification('Failed to load event details', 'error');
    }
}

// Load relationships
async function loadRelationships() {
    const relationshipsList = document.getElementById('relationships-list');
    if (!relationshipsList) return;
    
    try {
        // Use correct API endpoint - backend returns formatted array
        const relationships = await fetchAPI(`/characters/${characterId}/relationships`);
        
        if (!relationships || relationships.length === 0) {
            relationshipsList.innerHTML = '<p class="empty-state">No relationships defined yet.</p>';
            return;
        }
        
        relationshipsList.innerHTML = relationships.map(rel => `
            <div class="relationship-card" 
                 data-type="${rel.type || ''}"
                 onclick="window.location.href='/profile/${rel.related_character_id}'">
                <img src="${rel.related_character_image || '/static/images/default-avatar.jpg'}" 
                     alt="${rel.related_character_name || 'Character'}"
                     class="relationship-avatar"
                     onerror="this.src='/static/images/default-avatar.jpg'">
                <div class="relationship-info">
                    <div class="relationship-name">${rel.related_character_name || 'Unknown'}</div>
                    <div class="relationship-status">${rel.status ? '•' + rel.status : ''}</div>
                </div>
            </div>
        `).join('');

        const desktopRelationshipsContent = document.getElementById('relationships-tab').innerHTML;
        const mobileRelationshipsContainer = document.getElementById('mobile-relationships');
        if (mobileRelationshipsContainer) {
            mobileRelationshipsContainer.innerHTML = desktopRelationshipsContent;
        }
        
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
    
    // Use correct field name
    const charName = character.name || 'unknown';
    
    // Convert character name to CSS filename format
    // "Damian Wayne" -> "damian-wayne.css"
    const cssFileName = charName.toLowerCase().replace(/\s+/g, '-') + '.css';
    const cssPath = `/static/styles/characters/${cssFileName}`;
    
    // Set character data attribute for CSS targeting
    document.body.dataset.character = charName.toLowerCase().replace(/\s+/g, '-');
    
    // Try to load character-specific CSS file
    const themeLink = document.getElementById('character-theme');
    
    if (themeLink) {
        // Check if CSS file exists
        const cssExists = await checkFileExists(cssPath);
        
        if (cssExists) {
            // Load custom CSS file
            themeLink.href = cssPath;
        } else {
            // Apply dynamic theme from database colors
            applyDynamicTheme(character);
        }
    } else {
        // Apply dynamic theme if no theme link element
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
