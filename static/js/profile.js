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
        const character = await fetchAPI(`/characters/${characterId}`);
        currentCharacter = character;
        
        const charName = currentCharacter.full_name || currentCharacter.name || 'Unknown';
        
        if (document.getElementById('page-title')) {
            document.getElementById('page-title').textContent = `${charName} - DC Timeline`;
        }
        document.title = `${charName} - DC Timeline`;
        
        applyCharacterTheme(currentCharacter);
        loadCharacterInfo();
        loadBioSections(currentCharacter.bio_sections || []);

        syncTabContent('overview');
        
        setupTabs();
        
    } catch (error) {
        console.error('Error loading character:', error);
        showNotification('Failed to load character data.', 'error');
        setTimeout(() => window.location.href = '/characters', 2000);
    }
}

// Sync content between desktop and mobile tabs
function syncTabContent(tabName) {
    const desktopContent = document.getElementById(`${tabName}-tab`);
    const mobileContainer = document.getElementById(`mobile-${tabName}`);
    if (desktopContent && mobileContainer) {
        mobileContainer.innerHTML = desktopContent.innerHTML;
        // Re-attach event listeners if they were lost during innerHTML update
        if (tabName === 'timeline') setupEventModals(mobileContainer);
    }
}

// Load character basic info
function loadCharacterInfo() {
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
    
    const quoteEl = document.getElementById('character-quote');
    if (currentCharacter.quote && quoteEl) {
        quoteEl.textContent = `"${currentCharacter.quote}"`;
    }

    if (localStorage.getItem('admin_token')) {
        addQuickEditButton();
    }
}

function addQuickEditButton() {
    const profileSidebar = document.querySelector('.profile-sidebar');
    const mobileHeader = document.querySelector('.mobile-header');
    
    const createButton = () => {
        const button = document.createElement('button');
        button.className = 'quick-edit-btn';
        button.innerHTML = '⚙️ Edit Character';
        button.onclick = () => {
            window.location.href = `/admin.html?edit=character&id=${characterId}`;
        };
        return button;
    };
    
    if (profileSidebar && !profileSidebar.querySelector('.quick-edit-btn')) {
        profileSidebar.appendChild(createButton());
    }
    if (mobileHeader && !mobileHeader.querySelector('.quick-edit-btn')) {
        mobileHeader.appendChild(createButton());
    }
}

function loadBioSections(sections) {
    const identitySection = document.getElementById('bio-identity');
    const additionalSections = document.getElementById('additional-bio-sections');
    const familyName = (currentCharacter.families && currentCharacter.families.name) || currentCharacter.family;
    
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
    
    if (sections && sections.length > 0) {
        sections.sort((a, b) => a.display_order - b.display_order);
        additionalSections.innerHTML = sections.map(section => `
            <div class="bio-section" data-section-id="${section.id}">
                <h2 class="section-header">${section.section_title}</h2>
                <div class="bio-content">${parseMarkdown(section.content)}</div>
            </div>
        `).join('');
    } else {
        additionalSections.innerHTML = '';
    }
}

function setupTabs() {
    const tabs = document.querySelectorAll('.nav-tab, .mobile-nav-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            switchTab(tabName);
        });
    });
}

function switchTab(tabName) {
    if (currentTab === tabName) return;
    currentTab = tabName;
    
    document.querySelectorAll('.nav-tab, .mobile-nav-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    document.querySelectorAll('.tab-content, .mobile-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    const desktopContent = document.getElementById(`${tabName}-tab`);
    const mobileContent = document.getElementById(`mobile-${tabName}`);
    
    if (desktopContent) desktopContent.classList.add('active');
    if (mobileContent) mobileContent.classList.add('active');
    
    const isLoaded = desktopContent && desktopContent.dataset.loaded === 'true';
    if (!isLoaded) {
        switch(tabName) {
            case 'timeline': loadTimeline(); break;
            case 'relationships': loadRelationships(); break;
            case 'gallery': loadGallery(); break;
        }
        if (desktopContent) desktopContent.dataset.loaded = 'true';
    }
}

async function loadTimeline() {
    const timelineList = document.getElementById('timeline-list');
    if (!timelineList) return;
    
    try {
        const events = await fetchAPI(`/characters/${characterId}/timeline`);
        
        if (!events || events.length === 0) {
            timelineList.innerHTML = '<p class="empty-state">No timeline events yet.</p>';
            return;
        }
        
        events.sort((a, b) => new Date(b.event_date) - new Date(a.event_date));
        timelineList.innerHTML = events.map(event => createTimelineEvent(event)).join('');

        syncTabContent('timeline');
        
        setupEventModals(document);
        
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

function createTimelineEvent(event) {
    const eraDisplay = event.era_display || getEraName(event.era);
    return `
        <div class="timeline-event" data-event-id="${event.id}">
            <div class="event-card" data-era="${event.era}">
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

async function openEventModal(eventId) {
    try {
        const event = await fetchAPI(`/events/${eventId}`);
        const eraDisplay = event.era_display || getEraName(event.era);
        
        const eraBadge = document.getElementById('modal-era-badge');
        if (eraBadge) { eraBadge.dataset.era = event.era; eraBadge.textContent = eraDisplay; }
        
        const titleEl = document.getElementById('modal-event-title');
        if (titleEl) titleEl.textContent = event.title;
        
        const dateEl = document.getElementById('modal-event-date');
        if (dateEl) dateEl.textContent = formatDate(event.event_date);
        
        const imagesContainer = document.getElementById('modal-event-images');
        if (imagesContainer) {
            imagesContainer.innerHTML = (event.images && event.images.length > 0)
                ? event.images.map(imgUrl => `<img src="${imgUrl}" alt="${event.title}" loading="lazy" onerror="this.style.display='none'">`).join('')
                : '';
        }
        
        const descContainer = document.getElementById('modal-event-description');
        if (descContainer) {
            descContainer.innerHTML = event.full_description || `<p>${event.summary || ''}</p>`;
        }
        
        openModal('event-modal');
    } catch (error) {
        console.error('Error loading event details:', error);
        showNotification('Failed to load event details', 'error');
    }
}

async function loadRelationships() {
    const relationshipsList = document.getElementById('relationships-list');
    if (!relationshipsList) return;
    
    try {
        const relationships = await fetchAPI(`/characters/${characterId}/relationships`);
        
        if (!relationships || relationships.length === 0) {
            relationshipsList.innerHTML = '<p class="empty-state">No relationships defined yet.</p>';
            return;
        }
        
        relationshipsList.innerHTML = relationships.map(rel => `
            <div class="relationship-card" 
                 data-type="${rel.type || ''}"
                 data-related-character-id="${rel.related_character_id}"
                 onclick="window.location.href='/profile/${rel.related_character_id}'">
                <img src="${rel.related_character_image || '/static/images/default-avatar.jpg'}" 
                     alt="${rel.related_character_name || 'Character'}"
                     class="relationship-avatar"
                     onerror="this.src='/static/images/default-avatar.jpg'">
                <div class="relationship-info">
                    <div class="relationship-name">${rel.related_character_name || 'Unknown'}</div>
                    <div class="relationship-status">${rel.status || ''}</div>
                </div>
            </div>
        `).join('');

        syncTabContent('relationships');
    } catch (error) {
        console.error('Error loading relationships:', error);
        relationshipsList.innerHTML = '<p class="error-state">Failed to load relationships.</p>';
    }
}

function loadGallery() {
    if (typeof initGallery === 'function') {
        initGallery(characterId);
    }
}

function setupEventModals(container) {
    container.querySelectorAll('.event-card').forEach(card => {
        card.addEventListener('click', () => {
            const eventId = card.closest('.timeline-event').dataset.eventId;
            openEventModal(eventId);
        });
    });
}

async function applyCharacterTheme(character) {
    document.body.dataset.characterId = character.id;
    const charName = character.name || 'unknown';
    const cssFileName = charName.toLowerCase().replace(/\s+/g, '-') + '.css';
    const cssPath = `/static/styles/characters/${cssFileName}`;
    document.body.dataset.character = charName.toLowerCase().replace(/\s+/g, '-');
    
    const themeLink = document.getElementById('character-theme');
    if (themeLink) {
        const cssExists = await checkFileExists(cssPath);
        if (cssExists) {
            themeLink.href = cssPath;
        } else {
            applyDynamicTheme(character);
        }
    } else {
        applyDynamicTheme(character);
    }
}

async function checkFileExists(url) {
    try {
        const response = await fetch(url, { method: 'HEAD' });
        return response.ok;
    } catch (error) {
        return false;
    }
}

function applyDynamicTheme(character) {
    const root = document.documentElement;
    if (character.color_primary) root.style.setProperty('--character-primary', character.color_primary);
    if (character.color_secondary) root.style.setProperty('--character-secondary', character.color_secondary);
    if (character.color_accent) root.style.setProperty('--character-accent', character.color_accent);
    if (character.color_bg) root.style.setProperty('--character-bg', character.color_bg);
}

function getEraName(eraId) {
    const eraNames = {
        'pre-52': 'Pre-New 52', 'new-52': 'New 52', 'rebirth': 'Rebirth',
        'infinite-frontier': 'Infinite Frontier', 'elseworlds': 'Elseworlds',
        'post-crisis': 'Post-Crisis', 'future-state': 'Future State'
    };
    return eraNames[eraId] || eraId;
}

document.addEventListener('DOMContentLoaded', () => {
    loadCharacter();
    if (localStorage.getItem('admin_token')) {
        setupEditButtons();
    }
});

function setupEditButtons() {
    const editableSelectors = ['.bio-item', '.bio-section', '.event-card', '.relationship-card'];
    
    document.addEventListener('mouseover', (e) => {
        const element = e.target.closest(editableSelectors.join(','));
        if (element && !element.querySelector('.edit-btn')) {
            addEditButton(element);
        }
    });
    
    document.addEventListener('mouseout', (e) => {
        const element = e.target.closest(editableSelectors.join(','));
        if (element && !element.matches(':hover')) {
            const btn = element.querySelector('.edit-btn');
            if (btn) btn.remove();
        }
    });
}

function addEditButton(element) {
    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.innerHTML = '✏️';
    editBtn.title = 'Edit';
    editBtn.onclick = (e) => { e.stopPropagation(); handleEdit(element); };
    element.style.position = 'relative';
    element.appendChild(editBtn);
}

function handleEdit(element) {
    if (element.classList.contains('bio-item')) editBioItem(element);
    else if (element.classList.contains('bio-section')) editBioSection(element);
    else if (element.classList.contains('event-card')) {
        const eventId = element.closest('.timeline-event').dataset.eventId;
        editEvent(eventId);
    } else if (element.classList.contains('relationship-card')) editRelationship(element);
}

function editBioItem(element) {
    const valueEl = element.querySelector('.bio-value');
    const label = element.querySelector('.bio-label').textContent;
    const currentValue = valueEl.textContent;
    
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentValue;
    input.className = 'inline-edit-input';
    
    valueEl.textContent = '';
    valueEl.appendChild(input);
    input.focus();
    
    const save = async () => {
        const newValue = input.value;
        if (newValue !== currentValue) {
            try {
                await submitPendingEdit({
                    type: 'character_bio', character_id: characterId,
                    field: label.toLowerCase().replace(/\s+/g, '_'),
                    old_value: currentValue, new_value: newValue
                });
                showNotification('Edit submitted for approval', 'success');
            } catch (error) {
                showNotification(`Failed to submit edit: ${error.message}`, 'error');
            }
        }
        valueEl.textContent = currentValue; // Revert to original until approved
    };
    
    input.addEventListener('blur', save);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') input.blur();
        if (e.key === 'Escape') valueEl.textContent = currentValue;
    });
}

function editBioSection(element) {
    const sectionId = element.dataset.sectionId;
    if (sectionId) {
        window.location.href = `/admin.html?edit=character&id=${characterId}&section=${sectionId}`;
    }
}

function editEvent(eventId) {
    window.location.href = `/admin.html?edit=event&id=${eventId}`;
}

function editRelationship(element) {
    const relatedId = element.dataset.relatedCharacterId;
    if (relatedId) {
        window.location.href = `/admin.html?edit=relationship&id1=${characterId}&id2=${relatedId}`;
    }
}

async function submitPendingEdit(editData) {
    return await fetchAPI('/admin/pending-edits', {
        method: 'POST',
        body: JSON.stringify(editData)
    });
}

// Add required styles dynamically
const dynamicStyles = document.createElement('style');
dynamicStyles.textContent = `
    @keyframes highlight {
        0%, 100% { box-shadow: var(--shadow-lg); }
        50% { box-shadow: 0 0 30px rgba(59, 130, 246, 0.8); }
    }
    .edit-btn {
        position: absolute; top: 5px; right: 5px; width: 30px; height: 30px;
        background: rgba(59, 130, 246, 0.9); border: none; border-radius: 50%;
        color: white; font-size: 14px; cursor: pointer; display: flex;
        align-items: center; justify-content: center; opacity: 0;
        transition: all 0.2s ease; z-index: 10;
    }
    *:hover > .edit-btn { opacity: 1; }
    .edit-btn:hover { background: #3B82F6; transform: scale(1.1); }
    .inline-edit-input { width: 100%; padding: 0.25rem; background: var(--bg-tertiary); border: 1px solid var(--accent); border-radius: 4px; color: var(--text-primary); }
    .quick-edit-btn { width: 100%; padding: 0.75rem; margin-top: 1rem; background: rgba(59, 130, 246, 0.1); border: 1px solid var(--accent); border-radius: 8px; color: var(--accent); font-weight: 600; cursor: pointer; transition: all 0.2s ease; }
    .quick-edit-btn:hover { background: var(--accent); color: white; }
`;
document.head.appendChild(dynamicStyles);
