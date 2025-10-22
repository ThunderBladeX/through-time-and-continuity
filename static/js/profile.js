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

    // Add quick edit button for admin
    if (localStorage.getItem('admin_token')) {
        addQuickEditButton();
}

// Add quick edit button for overall character
function addQuickEditButton() {
    const profileSidebar = document.querySelector('.profile-sidebar');
    const mobileHeader = document.querySelector('.mobile-header');
    
    const editButton = document.createElement('button');
    editButton.className = 'quick-edit-btn';
    editButton.innerHTML = '⚙️ Edit Character';
    editButton.onclick = () => {
        window.location.href = `/admin.html?edit=character&id=${characterId}`;
    };
    
    if (profileSidebar) {
        profileSidebar.appendChild(editButton);
    }
    
    if (mobileHeader) {
        mobileHeader.appendChild(editButton.cloneNode(true));
        mobileHeader.lastChild.onclick = editButton.onclick;
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
                    <div class="relationship-status">${rel.status ? rel.status : ''}</div>
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
    @media (max-width:768px){@keyframes highlight{0%,100%,50%{color:transparent;display:none;visibility:hidden}}}
`;
document.head.appendChild(highlightStyle);

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadCharacter();
    setupEditButtons();
});

// Setup edit buttons for admin
function setupEditButtons() {
    // Check if user is admin
    const isAdmin = localStorage.getItem('admin_token');
    if (!isAdmin) return;
    
    // Add edit buttons on hover for editable elements
    const editableSelectors = [
        '.bio-item',
        '.bio-section',
        '.event-card',
        '.relationship-card'
    ];
    
    editableSelectors.forEach(selector => {
        document.addEventListener('mouseover', (e) => {
            const element = e.target.closest(selector);
            if (element && !element.querySelector('.edit-btn')) {
                addEditButton(element);
            }
        });
        
        document.addEventListener('mouseout', (e) => {
            const element = e.target.closest(selector);
            if (element && !element.matches(':hover')) {
                removeEditButton(element);
            }
        });
    });
}

// Add edit button to element
function addEditButton(element) {
    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.innerHTML = '✏️';
    editBtn.title = 'Edit';
    editBtn.onclick = (e) => {
        e.stopPropagation();
        handleEdit(element);
    };
    
    element.style.position = 'relative';
    element.appendChild(editBtn);
}

// Remove edit button from element
function removeEditButton(element) {
    const editBtn = element.querySelector('.edit-btn');
    if (editBtn) {
        editBtn.remove();
    }
}

// Handle edit action
function handleEdit(element) {
    // Determine what type of content is being edited
    if (element.classList.contains('bio-item')) {
        editBioItem(element);
    } else if (element.classList.contains('bio-section')) {
        editBioSection(element);
    } else if (element.classList.contains('event-card')) {
        const eventId = element.closest('.timeline-event').dataset.eventId;
        editEvent(eventId);
    } else if (element.classList.contains('relationship-card')) {
        editRelationship(element);
    }
}

// Edit bio item (inline editing)
function editBioItem(element) {
    const valueEl = element.querySelector('.bio-value');
    const currentValue = valueEl.textContent;
    const label = element.querySelector('.bio-label').textContent;
    
    // Create input
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentValue;
    input.className = 'inline-edit-input';
    
    // Replace value with input
    valueEl.textContent = '';
    valueEl.appendChild(input);
    input.focus();
    input.select();
    
    // Save on blur or enter
    const save = async () => {
        const newValue = input.value;
        if (newValue !== currentValue) {
            try {
                // Submit as pending edit
                await submitPendingEdit({
                    type: 'character_bio',
                    character_id: characterId,
                    field: label.toLowerCase().replace(/\s+/g, '_'),
                    old_value: currentValue,
                    new_value: newValue
                });
                showNotification('Edit submitted for approval', 'success');
            } catch (error) {
                showNotification('Failed to submit edit', 'error');
            }
        }
        valueEl.textContent = currentValue; // Restore original until approved
    };
    
    input.addEventListener('blur', save);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') save();
        if (e.key === 'Escape') valueEl.textContent = currentValue;
    });
}

// Edit bio section
function editBioSection(element) {
    const sectionId = element.dataset.sectionId;
    // Open modal with markdown editor
    openBioSectionModal(sectionId);
}

// Edit event
function editEvent(eventId) {
    // Redirect to admin with event pre-loaded
    window.location.href = `/admin.html?edit=event&id=${eventId}`;
}

// Edit relationship
function editRelationship(element) {
    const relationshipId = element.dataset.relationshipId;
    // Open relationship edit modal
    openRelationshipModal(relationshipId);
}

// Submit pending edit to admin for approval
async function submitPendingEdit(editData) {
    const response = await fetchAPI('/admin/pending-edits', {
        method: 'POST',
        body: JSON.stringify(editData)
    });
    return response;
}

// Add edit button styles
const editButtonStyles = document.createElement('style');
editButtonStyles.textContent = `
    .edit-btn {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 32px;
        height: 32px;
        background: rgba(59, 130, 246, 0.9);
        border: none;
        border-radius: 6px;
        color: white;
        font-size: 14px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: all 0.2s ease;
        z-index: 10;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    }
    
    .bio-item:hover .edit-btn,
    .bio-section:hover .edit-btn,
    .event-card:hover .edit-btn,
    .relationship-card:hover .edit-btn {
        opacity: 1;
    }
    
    .edit-btn:hover {
        background: rgba(59, 130, 246, 1);
        transform: scale(1.1);
    }
    
    .inline-edit-input {
        width: 100%;
        padding: 0.5rem;
        background: var(--bg-tertiary);
        border: 2px solid var(--accent);
        border-radius: 6px;
        color: var(--text-primary);
        font-size: 1.1rem;
        font-weight: 500;
    }
    
    .inline-edit-input:focus {
        outline: none;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
    }
    
    .quick-edit-btn {
        width: 100%;
        padding: 0.75rem;
        margin-top: var(--spacing-lg);
        background: rgba(59, 130, 246, 0.1);
        border: 1px solid var(--accent);
        border-radius: 8px;
        color: var(--accent);
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .quick-edit-btn:hover {
        background: var(--accent);
        color: white;
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
    }
    
    @media (max-width: 768px) {
        .quick-edit-btn {
            margin-top: var(--spacing-md);
            font-size: 0.9rem;
        }
    }
`;
document.head.appendChild(editButtonStyles);
