const pathParts = window.location.pathname.split('/');
const characterId = pathParts[pathParts.length - 1];
const urlParams = new URLSearchParams(window.location.search);
const highlightEventId = urlParams.get('event');

let currentCharacter = null;
let currentTab = 'overview';

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
            document.getElementById('page-title').textContent = `${charName} - Periaphe`;
        }
        document.title = `${charName} - Periaphe`;

        applyCharacterTheme(currentCharacter);

        loadCharacterInfo();

        loadBioSections(currentCharacter.bio_sections || []);

        const desktopOverviewContent = document.getElementById('overview-tab').innerHTML;
        const mobileOverviewContainer = document.getElementById('mobile-overview');
        if (mobileOverviewContainer) {
            mobileOverviewContainer.innerHTML = desktopOverviewContent;
        }

        setupTabs();

    } catch (error) {
        console.error('Error loading character:', error);
        showNotification('Failed to load character', 'error');

        setTimeout(() => window.location.href = '/characters', 2000);
    }
}

function loadCharacterInfo() {

    const charName = currentCharacter.name || 'Unknown';
    const imageSrc = currentCharacter.profile_image || '/static/images/default-avatar.jpg';

    const profileImg = document.getElementById('profile-image');
    if (profileImg) {
        profileImg.src = imageSrc;
        profileImg.alt = charName;
        profileImg.onerror = function() { this.src = '/static/images/default-avatar.jpg'; };
    }

    const charNameEl = document.getElementById('character-name');
    if (charNameEl) charNameEl.textContent = charName;

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
        quoteEl.textContent = currentCharacter.quote;
    }

    if (localStorage.getItem('admin_token')) {
        addQuickEditButton();
    }
}

function addQuickEditButton() {
    const profileSidebar = document.querySelector('.profile-sidebar');
    const mobileHeader = document.querySelector('.mobile-header');

    const editButton = document.createElement('button');
    editButton.className = 'quick-edit-btn';
    editButton.innerHTML = '⚙️ Edit Character';
    editButton.onclick = () => {
        window.location.href = `/admin?edit=character&id=${characterId}`;
    };

    if (profileSidebar) {
        profileSidebar.appendChild(editButton);
    }

    if (mobileHeader) {
        const clonedButton = editButton.cloneNode(true);
        clonedButton.onclick = editButton.onclick;
        mobileHeader.appendChild(clonedButton);
    }
}

function loadBioSections(sections) {
    const identitySection = document.getElementById('bio-identity');
    const additionalSections = document.getElementById('additional-bio-sections');
    const familyName = (currentCharacter.family && currentCharacter.family.name) || 'Unknown';

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
                <div class="bio-content" data-raw-content="${encodeURIComponent(section.content)}">
                    ${parseMarkdown(section.content)}
                </div>
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

    if (desktopContent && !desktopContent.dataset.loaded) {
        switch(tabName) {
            case 'timeline':
                loadTimeline();
                break;
            case 'relationships':
                loadRelationships();
                break;
            case 'love-interests': 
                loadLoveInterests();
                break;
            case 'gallery':
                loadGallery();
                break;
        }
        desktopContent.dataset.loaded = 'true';
    }
}

async function loadTimeline() {
    const timelineList = document.getElementById('timeline-list');
    const mobileTimelineContainer = document.getElementById('mobile-timeline');
    if (!timelineList || !mobileTimelineContainer) return;

    try {
        const events = await fetchAPI(`/characters/${characterId}/timeline`);

        let contentHTML = '<p class="empty-state">No timeline events yet.</p>';
        if (events && events.length > 0) {
            events.sort((a, b) => new Date(b.event_date) - new Date(a.event_date));
            contentHTML = events.map(event => createTimelineEvent(event)).join('');
        }

        timelineList.innerHTML = contentHTML;
        mobileTimelineContainer.innerHTML = contentHTML;

        setupEventModals();

        if (highlightEventId) {
            const eventCard = document.querySelector(`[data-event-id="${highlightEventId}"]`);
            if (eventCard) {
                eventCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                eventCard.style.animation = 'highlight 2s ease';
            }
        }

    } catch (error) {
        console.error('Error loading timeline:', error);
        const errorHTML = '<p class="error-state">Failed to load timeline.</p>';
        timelineList.innerHTML = errorHTML;
        mobileTimelineContainer.innerHTML = errorHTML;
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

        const modal = document.getElementById('event-modal');
        if (!modal) return;

        modal.querySelector('#modal-era-badge').dataset.era = event.era;
        modal.querySelector('#modal-era-badge').textContent = eraDisplay;
        modal.querySelector('#modal-event-title').textContent = event.title;
        modal.querySelector('#modal-event-date').textContent = formatDate(event.event_date);

        const imagesContainer = modal.querySelector('#modal-event-images');
        imagesContainer.innerHTML = (event.images && event.images.length > 0)
            ? event.images.map(imgUrl => `<img src="${imgUrl}" alt="${event.title}" loading="lazy" onerror="this.style.display='none'">`).join('')
            : '';

        const descContainer = modal.querySelector('#modal-event-description');
        descContainer.innerHTML = event.full_description || `<p>${event.summary || ''}</p>`;

        openModal('event-modal');
    } catch (error) {
        console.error('Error loading event details:', error);
        showNotification('Failed to load event details', 'error');
    }
}

async function loadRelationships() {
    const relationshipsList = document.getElementById('relationships-list');
    const mobileRelationshipsContainer = document.getElementById('mobile-relationships');
    if (!relationshipsList || !mobileRelationshipsContainer) return;

    try {
        const relationships = await fetchAPI(`/characters/${characterId}/relationships`);

        let contentHTML = '<p class="empty-state">No relationships defined yet.</p>';
        if (relationships && relationships.length > 0) {
            contentHTML = relationships.map(rel => `
                <div class="relationship-card" 
                     data-type="${rel.type || ''}"
                     data-related-character-id="${rel.related_character_id}">
                    <div class="relationship-clickable-area" onclick="window.location.href='/profile/${rel.related_character_id}'">
                        <img src="${rel.related_character_image || '/static/images/default-avatar.jpg'}" 
                             alt="${rel.related_character_name || 'Character'}"
                             class="relationship-avatar"
                             onerror="this.src='/static/images/default-avatar.jpg'">
                        <div class="relationship-info">
                            <div class="relationship-name">${rel.related_character_name || 'Unknown'}</div>
                            <div class="relationship-status">${rel.status || ''}</div>
                        </div>
                    </div>
                </div>
            `).join('');
        }

        relationshipsList.innerHTML = contentHTML;
        mobileRelationshipsContainer.innerHTML = contentHTML;

    } catch (error) {
        console.error('Error loading relationships:', error);
        const errorHTML = '<p class="error-state">Failed to load relationships.</p>';
        relationshipsList.innerHTML = errorHTML;
        mobileRelationshipsContainer.innerHTML = errorHTML;
    }
}

async function loadLoveInterests() {
    const container = document.getElementById('love-interests-list');
    const mobileContainer = document.getElementById('mobile-love-interests');
    if (!container || !mobileContainer) return;

    try {
        const interests = await fetchAPI(`/characters/${characterId}/love-interests`);

        let contentHTML = '<p class="empty-state">No love interests recorded.</p>';
        if (interests && interests.length > 0) {
            contentHTML = interests.map(item => {
                const partner = item.love_interest;
                const partnerName = partner.full_name || partner.name || 'Unknown';
                const partnerImage = partner.profile_image || '/static/images/default-avatar.jpg';
                const statusText = item.status ? item.status.charAt(0).toUpperCase() + item.status.slice(1) : 'Complicated';

                return `
                    <div class="love-interest-card" data-status="${item.status}">
                        <img src="${partnerImage}" alt="${partnerName}" class="love-interest-avatar" onerror="this.src='/static/images/default-avatar.jpg'">
                        <div class="love-interest-details">
                            <h3 class="love-interest-name">
                                <a href="/profile/${partner.id}">${partnerName}</a>
                            </h3>
                            <p class="love-interest-status">${statusText}</p>
                        </div>
                    </div>
                `;
            }).join('');
        }

        container.innerHTML = contentHTML;
        mobileContainer.innerHTML = contentHTML;

    } catch (error) {
        console.error('Error loading love interests:', error);
        const errorHTML = '<p class="error-state">Failed to load love interests.</p>';
        container.innerHTML = errorHTML;
        mobileContainer.innerHTML = errorHTML;
    }
}

function loadGallery() {
    if (typeof initGallery === 'function') {
        initGallery(characterId);
    }
}

function setupEventModals() {
    document.querySelectorAll('.event-card').forEach(card => {
        card.addEventListener('click', (e) => {
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
    if (character.theme_data) applyAdvancedTheme(character.theme_data);
}

function applyAdvancedTheme(themeData) {
    if (!themeData) return;
    if (themeData.cursor) document.body.style.cursor = `url('${themeData.cursor}'), auto`;
    if (themeData.background_pattern) document.body.style.backgroundImage = `url('${themeData.background_pattern}')`;
    if (themeData.custom_css) {
        const styleEl = document.createElement('style');
        styleEl.textContent = themeData.custom_css;
        document.head.appendChild(styleEl);
    }
}

const highlightStyle = document.createElement('style');
highlightStyle.textContent = `
    @keyframes highlight { 0%, 100% { box-shadow: var(--shadow-lg); } 50% { box-shadow: 0 0 30px rgba(59, 130, 246, 0.8); } }
`;
document.head.appendChild(highlightStyle);

document.addEventListener('DOMContentLoaded', () => {
    loadCharacter();

    setupContributionButtons();

    document.addEventListener('touchstart', (e) => {
        document.querySelectorAll('.edit-btn').forEach(btn => {
            const parentElement = btn.parentElement;

            if (parentElement && !parentElement.contains(e.target)) {
                btn.remove();
            }
        });
    }, { passive: true });
});

function setupContributionButtons() {

    const editableSelectors = ['.bio-item', '.bio-section'];

    document.body.addEventListener('mouseover', (e) => {

        const bioItem = e.target.closest('.bio-item');
        const bioSection = e.target.closest('.bio-section');

        let targetElement = null;

        if (bioItem) {
            targetElement = bioItem;
        } 

        else if (bioSection) {
            if (!bioSection.querySelector('#bio-identity')) {
                targetElement = bioSection;
            }
        }
        if (targetElement && !targetElement.querySelector('.edit-btn')) {
            addEditButton(targetElement);
        }
    });
}

function addEditButton(element) {
    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.innerHTML = '✏️';
    editBtn.title = 'Suggest an Edit';
    editBtn.onclick = (e) => {
        e.stopPropagation();
        handleEdit(element);
    };

    element.style.position = 'relative';
    element.appendChild(editBtn);

    element.addEventListener('mouseout', (e) => {
        if (!element.contains(e.relatedTarget)) {
            editBtn.remove();
        }
    }, { once: true });
}

function handleEdit(element) {
    if (element.classList.contains('bio-item')) {
        editBioItem(element);
    } else if (element.classList.contains('bio-section')) {
        const sectionId = element.dataset.sectionId;
        editBioSection(element, sectionId);
    }
}

function editBioItem(element) {
    const valueEl = element.querySelector('.bio-value');
    const currentValue = valueEl.textContent;
    const label = element.querySelector('.bio-label').textContent;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentValue;
    input.className = 'inline-edit-input';

    valueEl.innerHTML = '';
    valueEl.appendChild(input);
    input.focus();
    input.select();

    const save = async () => {
        const newValue = input.value;
        if (newValue !== currentValue && newValue.trim() !== '') {
            try {
                await submitPendingEdit({
                    type: 'character', 
                    record_id: characterId,
                    field: label.toLowerCase().replace(/\s+/g, '_'),
                    old_value: currentValue,
                    new_value: newValue
                });
                showNotification('Edit submitted for approval', 'success');
            } catch (error) {
                showNotification('Failed to submit edit', 'error');
            }
        }
        valueEl.textContent = currentValue; 
    };

    input.addEventListener('blur', save);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            input.removeEventListener('blur', save); 
            valueEl.textContent = currentValue; 
        }
    });
}

function editBioSection(element, sectionId) {
    const modal = document.getElementById('bio-edit-modal');
    const form = document.getElementById('bio-edit-form');
    if (!modal || !form) return;

    const currentTitle = element.querySelector('.section-header').textContent;
    const contentDiv = element.querySelector('.bio-content');
    const rawContent = contentDiv.dataset.rawContent ? decodeURIComponent(contentDiv.dataset.rawContent) : '';

    form.elements['section_id'].value = sectionId;
    form.elements['old_value_title'].value = currentTitle;
    form.elements['old_value_content'].value = rawContent;
    form.elements['new_value_title'].value = currentTitle;
    form.elements['new_value_content'].value = rawContent;

    const handleSubmit = async (e) => {
        e.preventDefault();
        const newTitle = form.elements['new_value_title'].value;
        const newContent = form.elements['new_value_content'].value;
        let editsSubmitted = 0;

        if (newTitle.trim() && newTitle !== currentTitle) {
            try {
                await submitPendingEdit({
                    type: 'character_bio', 
                    record_id: sectionId,
                    field: 'section_title',
                    old_value: currentTitle,
                    new_value: newTitle
                });
                editsSubmitted++;
            } catch (error) {
                showNotification('Failed to submit title edit', 'error');
            }
        }

        if (newContent.trim() && newContent !== rawContent) {
            try {
                await submitPendingEdit({
                    type: 'character_bio', 
                    record_id: sectionId,
                    field: 'content',
                    old_value: rawContent,
                    new_value: newContent
                });
                editsSubmitted++;
            } catch (error) {
                showNotification('Failed to submit content edit', 'error');
            }
        }

        if (editsSubmitted > 0) {
            showNotification('Edit(s) submitted for approval!', 'success');
        } else {
            showNotification('No changes were made.', 'info');
        }
        closeModal('bio-edit-modal');
    };

    form.onsubmit = handleSubmit; 
    openModal('bio-edit-modal');
}

async function submitPendingEdit(editData) {

    return await fetchAPI('/admin/pending-edits', {
        method: 'POST',
        body: JSON.stringify(editData)
    });
}

const editButtonStyles = document.createElement('style');
editButtonStyles.textContent = `
    .edit-btn { position: absolute; top: 8px; right: 8px; width: 32px; height: 32px; background: transparent; border: none; border-radius: 6px; color: white; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; opacity: 1; transition: all 0.2s ease; z-index: 10; }
    .edit-btn:hover { text-shadow: 0 0 8px var(--glow); transform: scale(1.1); }
    .relationship-card .edit-btn { top: 50%; transform: translateY(-50%); }
    .inline-edit-input { width: 100%; padding: 0.5rem; background: var(--bg-tertiary); border: 2px solid var(--accent); border-radius: 6px; color: var(--text-primary); font-size: 1rem; font-weight: 500; }
    .inline-edit-input:focus { outline: none; box-shadow: 0 0 0 3px var(--glow); }
    .quick-edit-btn { width: 100%; padding: 0.75rem; margin-top: var(--spacing-lg); background: var(--glow); border: 1px solid var(--accent); border-radius: 8px; color: var(--accent); font-weight: 600; cursor: pointer; transition: all 0.2s ease; }
    .quick-edit-btn:hover { background: var(--accent); color: white; transform: translateY(-2px); box-shadow: 0 4px 12px var(--glow); }
    @media (max-width: 768px) { .quick-edit-btn { margin-top: var(--spacing-md); font-size: 0.9rem; } }
    .relationship-clickable-area { display: flex; align-items: center; width: 100%; text-decoration: none; color: inherit; }
`;
document.head.appendChild(editButtonStyles);
