(function() {
    'use strict';

    const pathParts = window.location.pathname.split('/');
    const characterId = pathParts[pathParts.length - 1];
    const urlParams = new URLSearchParams(window.location.search);
    const highlightEventId = urlParams.get('event');

    let isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let currentCharacter = null;
    let currentTab = 'overview';
    let lenis = null;

    document.addEventListener('DOMContentLoaded', async function() {
        console.log('Profile page initializing...');

        initSmoothScroll();
        init3DBackground();
        initBubbleGenerator();
        initHeroParallax();

        await loadCharacter();

        setupNavigation();
        setupModals();
        setupScrollToTop();
        setupEraTooltips();
        setupContributionButtons();

        setTimeout(function() {
            setupScrollAnimations();
        }, 500);

        if (localStorage.getItem('admin_token')) {
            const adminBtn = document.getElementById('admin-edit-btn');
            if (adminBtn) {
                adminBtn.style.display = 'flex';
                adminBtn.onclick = function() {
                    window.location.href = `/admin?edit=character&id=${characterId}`;
                };
            }
        }

        const scrollIndicator = document.querySelector('.scroll-indicator');
        if (scrollIndicator) {
            scrollIndicator.addEventListener('click', function() {
                if (lenis) {
                    lenis.scrollTo('.profile-grid', { offset: -50, duration: 1.5 });
                } else {
                    document.querySelector('.profile-grid').scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'start' 
                    });
                }
            });
        }
    });

    function initBubbleGenerator() {
        if (isReducedMotion) return;

        const heroSection = document.querySelector('.hero-section');
        if (!heroSection) return;

        heroSection.addEventListener('click', function(e) {
            for (let i = 0; i < 5; i++) {
                setTimeout(function() {
                    const bubble = document.createElement('div');
                    bubble.className = 'bubble';
                    
                    const size = Math.random() * 60 + 20;
                    bubble.style.width = size + 'px';
                    bubble.style.height = size + 'px';
                    bubble.style.left = e.clientX + (Math.random() - 0.5) * 100 + 'px';
                    bubble.style.top = e.clientY + (Math.random() - 0.5) * 100 + 'px';

                    document.body.appendChild(bubble);

                    setTimeout(function() {
                        bubble.remove();
                    }, 2000);
                }, i * 50);
            }
        });
    }

    function initSmoothScroll() {
        if (window.innerWidth < 1024) return;

        if (typeof Lenis === 'undefined') {
            console.warn('Lenis not loaded, skipping smooth scroll');
            return;
        }

        lenis = new Lenis({
            duration: 1.2,
            easing: function(t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
            orientation: 'vertical',
            gestureOrientation: 'vertical',
            smoothWheel: true,
            wheelMultiplier: 1,
            smoothTouch: false,
            touchMultiplier: 2,
            infinite: false,
        });

        function raf(time) {
            lenis.raf(time);
            requestAnimationFrame(raf);
        }
        requestAnimationFrame(raf);

        if (typeof gsap !== 'undefined' && gsap.registerPlugin) {
            gsap.registerPlugin(ScrollTrigger);
            lenis.on('scroll', ScrollTrigger.update);
            gsap.ticker.add(function(time) {
                lenis.raf(time * 1000);
            });
            gsap.ticker.lagSmoothing(0);
        }

        console.log('Smooth scroll initialized');
    }

    function init3DBackground() {
        if (isReducedMotion) return;

        if (typeof THREE === 'undefined') {
            console.warn('THREE.js not loaded, skipping 3D background');
            return;
        }

        const canvas = document.getElementById('bg-canvas');
        if (!canvas) return;

        try {
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });

            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            camera.position.z = 5;

            const particlesGeometry = new THREE.BufferGeometry();
            const particlesCount = 2000;
            const posArray = new Float32Array(particlesCount * 3);

            for (let i = 0; i < particlesCount * 3; i++) {
                posArray[i] = (Math.random() - 0.5) * 15;
            }

            particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

            const particlesMaterial = new THREE.PointsMaterial({
                size: 0.02,
                color: 0x3b82f6,
                transparent: true,
                opacity: 0.6,
                blending: THREE.AdditiveBlending,
            });

            const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
            scene.add(particlesMesh);

            let mouseX = 0;
            let mouseY = 0;
            document.addEventListener('mousemove', function(e) {
                mouseX = (e.clientX / window.innerWidth) * 2 - 1;
                mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
            });

            function animate() {
                requestAnimationFrame(animate);

                particlesMesh.rotation.y += 0.0005;
                particlesMesh.rotation.x += 0.0003;

                camera.position.x = mouseX * 0.5;
                camera.position.y = mouseY * 0.5;

                renderer.render(scene, camera);
            }
            animate();

            window.addEventListener('resize', function() {
                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(window.innerWidth, window.innerHeight);
            });

            canvas.classList.add('loaded');
            console.log('3D background initialized');
        } catch (error) {
            console.error('Error initializing 3D background:', error);
        }
    }

    async function loadCharacter() {
        if (!characterId || isNaN(characterId)) {
            console.error('Invalid character ID');
            window.location.href = '/characters';
            return;
        }

        try {
            currentCharacter = await fetchAPI(`/characters/${characterId}`);
            console.log('Character loaded:', currentCharacter);

            const name = currentCharacter.name || currentCharacter.full_name || 'Unknown';
            document.title = `${name} - Periaphe`;
            const pageTitle = document.getElementById('page-title');
            if (pageTitle) pageTitle.textContent = `${name} - Periaphe`;

            document.body.dataset.characterId = currentCharacter.id;

            loadHeroSection();
            loadIdentitySection();
            loadBioSections();
            applyCharacterTheme();

        } catch (error) {
            console.error('Error loading character:', error);
            showNotification('Failed to load character', 'error');
            setTimeout(function() { window.location.href = '/characters'; }, 2000);
        }
    }

    function loadHeroSection() {
        const heroImage = document.getElementById('hero-image');
        const heroName = document.getElementById('hero-name');
        const heroQuote = document.getElementById('hero-quote');

        if (!heroImage || !heroName || !heroQuote) {
            console.error('Hero elements not found');
            return;
        }

        const imageSrc = currentCharacter.profile_image || '/static/images/default-avatar.jpg';
        console.log('Loading hero image:', imageSrc);

        heroImage.src = imageSrc;
        heroImage.alt = currentCharacter.name || 'Character';

        heroImage.onerror = function() {
            console.log('Hero image failed, trying default');
            if (this.src.indexOf('default-avatar.jpg') === -1) {
                this.src = '/static/images/default-avatar.jpg';
            } else {
                console.log('Default image also failed, using gradient');
                this.style.display = 'none';
                const wrapper = document.querySelector('.hero-image-wrapper');
                if (wrapper) {
                    wrapper.style.background = 'linear-gradient(135deg, #1a1a1a 0%, #3b82f6 50%, #8b5cf6 100%)';
                    wrapper.style.backgroundSize = '200% 200%';
                    wrapper.style.animation = 'gradientShift 15s ease infinite';
                }
            }
        };

        heroName.textContent = currentCharacter.name || currentCharacter.full_name || 'Unknown Character';

        if (currentCharacter.quote && currentCharacter.quote.trim()) {
            heroQuote.textContent = currentCharacter.quote;
            heroQuote.style.display = 'block';
        } else {
            heroQuote.style.display = 'none';
        }
        console.log('Hero section loaded');
    }

    function initHeroParallax() {
        if (isReducedMotion) return;
        if (window.innerWidth < 768) return;

        const heroSection = document.querySelector('.hero-section');
        const heroImageWrapper = document.querySelector('.hero-image-wrapper');
        const heroImage = document.getElementById('hero-image');
        const heroContent = document.querySelector('.hero-content');
    
        if (!heroSection || !heroImageWrapper || !heroImage) return;

        heroSection.addEventListener('mousemove', function(e) {
            const rect = heroSection.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const percentX = (x - centerX) / centerX;
            const percentY = (y - centerY) / centerY;

            const moveX = percentX * -40;
            const moveY = percentY * -40;

            heroImage.style.transform = `translate(${moveX}px, ${moveY}px)`;
            heroImage.style.transition = 'transform 0.1s ease-out';
        
            if (heroContent) {
                heroContent.style.transform = `translate(${moveX * 0.3}px, ${moveY * 0.3}px)`;
                heroContent.style.transition = 'transform 0.1s ease-out';
            }
        });

        heroSection.addEventListener('mouseleave', function() {
            heroImage.style.transform = 'translate(0, 0)';
            heroImage.style.transition = 'transform 0.4s ease';
        
            if (heroContent) {
                heroContent.style.transform = 'translate(0, 0)';
                heroContent.style.transition = 'transform 0.4s ease';
            }
        });
    }

    function loadIdentitySection() {
        const identityGrid = document.getElementById('identity-grid');
        if (!identityGrid) return;

        const familyName = (currentCharacter.family && currentCharacter.family.name) || 'Unknown';

        const identityItems = [
            { label: 'Full Name', value: currentCharacter.full_name },
            { label: 'Alias', value: currentCharacter.nickname },
            { label: 'Birthday', value: currentCharacter.birthday ? formatDate(currentCharacter.birthday) : null },
            { label: 'Family', value: familyName }
        ].filter(function(item) { return item.value; });

        identityGrid.innerHTML = identityItems.map(function(item) {
            return `
                <div class="info-item">
                    <span class="info-label">${item.label}</span>
                    <span class="info-value">${item.value}</span>
                </div>
            `;
        }).join('');

        console.log('Identity section loaded');
    }

    function loadBioSections() {
        const bioContainer = document.getElementById('bio-sections');
        if (!bioContainer) return;

        const sections = currentCharacter.bio_sections || [];

        if (sections.length === 0) {
            bioContainer.innerHTML = '<p class="empty-state">No additional information available.</p>';
            return;
        }

        sections.sort(function(a, b) { return a.display_order - b.display_order; });

        bioContainer.innerHTML = sections.map(function(section) {
            const content = typeof parseMarkdown === 'function' 
                ? parseMarkdown(section.content) 
                : section.content.replace(/\n/g, '<br>');

            return `
                <div class="bio-section glass-card" data-section-id="${section.id}">
                    <h2 class="section-title">${section.section_title}</h2>
                    <div class="bio-content" data-raw-content="${encodeURIComponent(section.content)}">
                        ${content}
                    </div>
                </div>
            `;
        }).join('');

        console.log('Bio sections loaded:', sections.length);
    }

    function setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');

        navItems.forEach(function(item) {
            item.addEventListener('click', function() {
                const tabName = this.dataset.tab;
                switchTab(tabName);
            });
        });

        console.log('Navigation setup complete');
    }

    function switchTab(tabName) {
        console.log('Switching to tab:', tabName);
        currentTab = tabName;

        document.querySelectorAll('.nav-item').forEach(function(item) {
            if (item.dataset.tab === tabName) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        document.querySelectorAll('.tab-panel').forEach(function(panel) {
            panel.classList.remove('active');
        });

        const activePanel = document.getElementById(`${tabName}-tab`);
        if (activePanel) {
            activePanel.classList.add('active');

            if (!activePanel.dataset.loaded) {
                loadTabContent(tabName);
                activePanel.dataset.loaded = 'true';
            }
        }

        setTimeout(function() {
            if (lenis) {
                lenis.scrollTo('.content-area', { offset: -100, duration: 0.8 });
            } else {
                window.scrollTo({ top: 600, behavior: 'smooth' });
            }
        }, 100);
    }

    async function loadTabContent(tabName) {
        try {
            switch(tabName) {
                case 'timeline':
                    await loadTimeline();
                    break;
                case 'relationships':
                    await loadRelationships();
                    break;
                case 'love-interests':
                    await loadLoveInterests();
                    break;
                case 'gallery':
                    await loadGallery();
                    break;
            }
        } catch (error) {
            console.error(`Error loading ${tabName}:`, error);
            showNotification(`Failed to load ${tabName}`, 'error');
        }
    }

    async function loadTimeline() {
        const container = document.getElementById('timeline-container');
        if (!container) return;

        try {
            const events = await fetchAPI(`/characters/${characterId}/timeline`);

            if (!events || events.length === 0) {
                container.innerHTML = '<p class="empty-state">No timeline events yet.</p>';
                return;
            }

            events.sort(function(a, b) { 
                return new Date(b.event_date) - new Date(a.event_date);
            });

            container.innerHTML = events.map(function(event) {
                const eraDisplay = event.era_display || getEraName(event.era);
                return `
                    <div class="timeline-item" data-event-id="${event.id}">
                        <div class="timeline-card" data-era="${event.era}">
                            <div class="timeline-header-card">
                                <span class="era-badge" data-era="${event.era}">${eraDisplay}</span>
                                <time class="timeline-date">${formatDate(event.event_date)}</time>
                            </div>
                            <h3 class="timeline-title">${event.title}</h3>
                            <p class="timeline-summary">${event.summary || ''}</p>
                        </div>
                    </div>
                `;
            }).join('');

            document.querySelectorAll('.timeline-card').forEach(function(card) {
                card.addEventListener('click', function() {
                    const eventId = this.closest('.timeline-item').dataset.eventId;
                    openEventModal(eventId);
                });
            });

            if (highlightEventId) {
                setTimeout(function() {
                    const eventCard = document.querySelector(`[data-event-id="${highlightEventId}"]`);
                    if (eventCard) {
                        eventCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        eventCard.style.animation = 'highlight 2s ease 3';
                    }
                }, 500);
            }

            if (typeof gsap !== 'undefined' && gsap.utils) {
                gsap.utils.toArray('.timeline-item').forEach(function(item) {
                    gsap.to(item, {
                        opacity: 1,
                        x: 0,
                        duration: 0.8,
                        scrollTrigger: {
                            trigger: item,
                            start: 'top 85%',
                            toggleClass: 'visible',
                        }
                    });
                });
            }

            console.log('Timeline loaded:', events.length, 'events');
        } catch (error) {
            container.innerHTML = '<p class="error-state">Failed to load timeline.</p>';
            throw error;
        }
    }

    async function loadRelationships() {
        const container = document.getElementById('relationships-grid');
        if (!container) return;

        try {
            const relationships = await fetchAPI(`/characters/${characterId}/relationships`);

            if (!relationships || relationships.length === 0) {
                container.innerHTML = '<p class="empty-state">No relationships defined yet.</p>';
                return;
            }

            container.innerHTML = relationships.map(function(rel) {
                const dataType = rel.type || '';
                return `
                    <div class="relationship-card" data-type="${dataType}" onclick="window.location.href='/profile/${rel.related_character_id}'">
                        <img src="${rel.related_character_image || '/static/images/default-avatar.jpg'}" 
                             alt="${rel.related_character_name}"
                             class="relationship-avatar"
                             data-type="${dataType}"
                             onerror="this.src='/static/images/default-avatar.jpg'">
                        <div class="relationship-info">
                            <div class="relationship-name">${rel.related_character_name || 'Unknown'}</div>
                            <div class="relationship-status">${rel.status || ''}</div>
                        </div>
                    </div>
                `;
            }).join('');

            console.log('Relationships loaded:', relationships.length);
        } catch (error) {
            container.innerHTML = '<p class="error-state">Failed to load relationships.</p>';
            throw error;
        }
    }

    async function loadLoveInterests() {
        const container = document.getElementById('love-interests-content');
        if (!container) return;

        try {
            const interests = await fetchAPI(`/characters/${characterId}/love-interests`);

            if (!interests || interests.length === 0) {
                container.innerHTML = '<p class="empty-state">No love interests defined yet.</p>';
                return;
            }

            const grouped = interests.reduce(function(acc, item) {
                if (!acc[item.category]) acc[item.category] = [];
                acc[item.category].push(item);
                return acc;
            }, {});

            const categoryTitles = {
                'canon': 'Canon Darlings',
                'once_dated': 'Once Dated',
                'implied': 'Implied Fondness',
                'unrequited': 'Unrequited Crush',
                'au_lovers': 'Lovers In Another Life',
                'au_exes': 'Exes In Another Life'
            };

            const categoryOrder = ['canon', 'once_dated', 'implied', 'unrequited', 'au_lovers', 'au_exes'];

            let html = '';
            categoryOrder.forEach(function(category) {
                if (grouped[category]) {
                    html += `
                        <div class="love-category glass-card">
                            <h2 class="section-title">${categoryTitles[category]}</h2>
                            <div class="love-grid">
                                ${grouped[category].map(function(interest) {
                                    return `
                                        <div class="love-card">
                                            <img src="${interest.partner.profile_image || '/static/images/default-avatar.jpg'}" 
                                                 alt="${interest.partner.name}"
                                                 class="love-avatar"
                                                 onerror="this.src='/static/images/default-avatar.jpg'">
                                            <div class="love-info">
                                                <a href="/profile/${interest.partner.id}" class="love-name">${interest.partner.name}</a>
                                                ${interest.description ? `<p class="love-description">${interest.description}</p>` : ''}
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    `;
                }
            });

            container.innerHTML = html;
            console.log('Love interests loaded');
        } catch (error) {
            container.innerHTML = '<p class="error-state">Failed to load love interests.</p>';
            throw error;
        }
    }

    async function loadGallery() {
        const container = document.getElementById('gallery-grid');
        if (!container) return;

        if (typeof initGallery === 'function') {
            initGallery(characterId);
            console.log('Gallery initialized');
        } else {
            container.innerHTML = '<p class="empty-state">Gallery functionality not available.</p>';
        }
    }

    function setupModals() {

        document.querySelectorAll('.modal-backdrop').forEach(function(backdrop) {
            backdrop.addEventListener('click', function() {
                this.closest('.modal').classList.remove('active');
            });
        });

        document.querySelectorAll('.modal-close').forEach(function(btn) {
            btn.addEventListener('click', function() {
                this.closest('.modal').classList.remove('active');
            });
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal.active').forEach(function(modal) {
                    modal.classList.remove('active');
                });
            }
        });

        console.log('Modals setup complete');
    }

    async function openEventModal(eventId) {
        try {
            const event = await fetchAPI(`/events/${eventId}`);
            const modal = document.getElementById('event-modal');
            if (!modal) return;

            const eraDisplay = event.era_display || getEraName(event.era);

            modal.querySelector('#modal-era').textContent = eraDisplay;
            modal.querySelector('#modal-era').dataset.era = event.era;
            modal.querySelector('#modal-title').textContent = event.title;
            modal.querySelector('#modal-date').textContent = formatDate(event.event_date);

            const imagesContainer = modal.querySelector('#modal-images');
            imagesContainer.innerHTML = (event.images && event.images.length > 0)
                ? event.images.map(function(img) {
                    return `<img src="${img}" alt="${event.title}" loading="lazy" onerror="this.style.display='none'">`;
                  }).join('')
                : '';

            const descContainer = modal.querySelector('#modal-description');
            descContainer.innerHTML = event.full_description || `<p>${event.summary || ''}</p>`;

            modal.classList.add('active');

        } catch (error) {
            console.error('Error loading event:', error);
            showNotification('Failed to load event details', 'error');
        }
    }

    window.openEventModal = openEventModal;

    function setupScrollToTop() {
        let scrollBtn = document.querySelector('.scroll-to-top');
        if (!scrollBtn) {
            scrollBtn = document.createElement('button');
            scrollBtn.className = 'scroll-to-top';
            scrollBtn.setAttribute('aria-label', 'Scroll to top');
            document.body.appendChild(scrollBtn);
        }

        window.addEventListener('scroll', function() {
            if (window.scrollY > 800) {
                scrollBtn.classList.add('visible');
            } else {
                scrollBtn.classList.remove('visible');
            }
        });

        scrollBtn.addEventListener('click', function() {
            if (lenis) {
                lenis.scrollTo(0, { duration: 1.5 });
            } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
        console.log('Scroll to top button setup');
    }

    function setupEraTooltips() {
        const tooltip = document.getElementById('era-tooltip');
        if (!tooltip) {

            const newTooltip = document.createElement('div');
            newTooltip.id = 'era-tooltip';
            newTooltip.className = 'tooltip';
            document.body.appendChild(newTooltip);
            return setupEraTooltips(); 
        }

        const eraDescriptions = {
            'pre-52': 'Classic: The original DC timeline before the 2011 reboot',
            'new-52': 'New 52: DC Comics reboot starting in 2011',
            'rebirth': 'Rebirth: Restoration of legacy and hope starting in 2016',
            'infinite-frontier': 'Infinite Frontier: Omniverse storytelling post-2021',
            'elseworlds': 'Elseworlds: Non-canon alternate reality stories',
            'post-crisis': 'Post-Crisis: Following Crisis on Infinite Earths (1985-2011)',
            'future-state': 'Future State: Dystopian future timeline'
        };

        document.addEventListener('mouseover', function(e) {
            const badge = e.target.closest('.era-badge');
            if (badge) {
                const era = badge.dataset.era;
                if (era && eraDescriptions[era]) {
                    tooltip.textContent = eraDescriptions[era];
                    tooltip.classList.add('active');
                    updateTooltipPosition(e);
                }
            }
        });

        document.addEventListener('mousemove', function(e) {
            if (tooltip.classList.contains('active')) {
                updateTooltipPosition(e);
            }
        });

        document.addEventListener('mouseout', function(e) {
            const badge = e.target.closest('.era-badge');
            if (badge) {
                tooltip.classList.remove('active');
            }
        });

        function updateTooltipPosition(e) {
            tooltip.style.left = e.pageX + 15 + 'px';
            tooltip.style.top = e.pageY + 15 + 'px';
        }

        console.log('Era tooltips setup');
    }

    function setupContributionButtons() {
        const editableSelectors = ['.info-item', '.bio-section'];

        document.body.addEventListener('mouseover', function(e) {
            const infoItem = e.target.closest('.info-item');
            const bioSection = e.target.closest('.bio-section');

            let targetElement = null;

            if (infoItem) {
                targetElement = infoItem;
            } else if (bioSection) {
                const identitySection = bioSection.querySelector('#identity-grid');
                if (!identitySection) {
                    targetElement = bioSection;
                }
            }

            if (targetElement && !targetElement.querySelector('.edit-btn')) {
                addEditButton(targetElement);
            }
        });

        console.log('Contribution buttons setup');
    }

    function addEditButton(element) {
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn';
        editBtn.innerHTML = '✎';
        editBtn.title = 'Suggest an Edit';
        editBtn.setAttribute('aria-label', 'Suggest an Edit');
        editBtn.onclick = function(e) {
            e.stopPropagation();
            handleEdit(element);
        };

        element.style.position = 'relative';
        element.appendChild(editBtn);

        element.addEventListener('mouseout', function(e) {
            if (!element.contains(e.relatedTarget)) {
                editBtn.remove();
            }
        }, { once: true });
    }

    function handleEdit(element) {
        if (element.classList.contains('info-item')) {
            editBioItem(element);
        } else if (element.classList.contains('bio-section')) {
            const sectionId = element.dataset.sectionId;
            editBioSection(element, sectionId);
        }
    }

    function editBioItem(element) {
        const valueEl = element.querySelector('.info-value');
        const currentValue = valueEl.textContent;
        const label = element.querySelector('.info-label').textContent;

        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentValue;
        input.className = 'inline-edit-input';

        valueEl.innerHTML = '';
        valueEl.appendChild(input);
        input.focus();
        input.select();

        const save = async function() {
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
        input.addEventListener('keydown', function(e) {
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

        const currentTitle = element.querySelector('.section-title').textContent;
        const contentDiv = element.querySelector('.bio-content');
        const rawContent = contentDiv.dataset.rawContent ? decodeURIComponent(contentDiv.dataset.rawContent) : '';

        form.elements['section_id'].value = sectionId;
        form.elements['old_value_title'].value = currentTitle;
        form.elements['old_value_content'].value = rawContent;
        form.elements['new_value_title'].value = currentTitle;
        form.elements['new_value_content'].value = rawContent;

        const handleSubmit = async function(e) {
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
            modal.classList.remove('active');
        };

        form.onsubmit = handleSubmit;
        modal.classList.add('active');
    }

    async function submitPendingEdit(editData) {
        return await fetchAPI('/admin/pending-edits', {
            method: 'POST',
            body: editData
        });
    }

    function setupScrollAnimations() {
        if (isReducedMotion) return;

        if (typeof gsap === 'undefined' || !gsap.utils) {
            console.log('GSAP not available, skipping scroll animations');
            return;
        }

        gsap.utils.toArray('.glass-card').forEach(function(card, index) {
            gsap.from(card, {
                opacity: 0,
                y: 60,
                duration: 1,
                delay: index * 0.1,
                scrollTrigger: {
                    trigger: card,
                    start: 'top 85%',
                    toggleActions: 'play none none reverse',
                }
            });
        });

        gsap.utils.toArray('.info-item').forEach(function(item, index) {
            gsap.from(item, {
                opacity: 0,
                scale: 0.9,
                duration: 0.6,
                delay: index * 0.05,
                scrollTrigger: {
                    trigger: item,
                    start: 'top 90%',
                }
            });
        });

        gsap.utils.toArray('.relationship-card').forEach(function(card, index) {
            gsap.from(card, {
                opacity: 0,
                x: -40,
                duration: 0.7,
                delay: index * 0.08,
                scrollTrigger: {
                    trigger: card,
                    start: 'top 88%',
                }
            });
        });

        gsap.utils.toArray('.love-card').forEach(function(card, index) {
            gsap.from(card, {
                opacity: 0,
                scale: 0.8,
                duration: 0.6,
                delay: index * 0.06,
                scrollTrigger: {
                    trigger: card,
                    start: 'top 88%',
                }
            });
        });

        gsap.utils.toArray('.gallery-item').forEach(function(item, index) {
            gsap.from(item, {
                opacity: 0,
                y: 30,
                duration: 0.5,
                delay: index * 0.04,
                scrollTrigger: {
                    trigger: item,
                    start: 'top 90%',
                }
            });
        });

        console.log('Scroll animations setup');
    }

    function applyCharacterTheme() {
        const root = document.documentElement;

        if (currentCharacter.color_primary) {
            root.style.setProperty('--accent', currentCharacter.color_primary);

            const hex = currentCharacter.color_primary.replace('#', '');
            const r = parseInt(hex.substr(0, 2), 16);
            const g = parseInt(hex.substr(2, 2), 16);
            const b = parseInt(hex.substr(4, 2), 16);
            root.style.setProperty('--accent-rgb', r + ', ' + g + ', ' + b);

            console.log('Character theme applied:', currentCharacter.color_primary);
        }
        applyCharacterCSSFile();
    }

    async function applyCharacterCSSFile() {
        const charName = currentCharacter.name || 'unknown';
        const cssChar = charName.toLowerCase().replace(/\s+/g, '-');
        const cssFileName = cssChar + '.css';
        const cssPath = '/static/styles/characters/' + cssFileName;
        const charElement = document.querySelector('#pfp');

        if (charElement) {
            charElement.dataset.character = cssChar;
        }

        try {
            const response = await fetch(cssPath, { method: 'HEAD' });
            if (response.ok) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = cssPath;
                document.head.appendChild(link);
                console.log('Character CSS loaded:', cssPath);
            }
        } catch (error) {
            console.log('No character-specific CSS found');
        }
    }

    function setupLazyLoading() {
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver(function(entries, observer) {
                entries.forEach(function(entry) {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        if (img.dataset.src) {
                            img.src = img.dataset.src;
                            img.classList.remove('lazy');
                            observer.unobserve(img);
                        }
                    }
                });
            });

            document.querySelectorAll('img.lazy').forEach(function(img) {
                imageObserver.observe(img);
            });

            console.log('Lazy loading setup');
        }
    }

    document.addEventListener('keydown', function(e) {

        if (e.altKey && !e.ctrlKey && !e.shiftKey) {
            const tabs = ['overview', 'timeline', 'relationships', 'love-interests', 'gallery'];
            const num = parseInt(e.key);
            if (num >= 1 && num <= tabs.length) {
                e.preventDefault();
                switchTab(tabs[num - 1]);
            }
        }

        if (e.altKey && e.key.toLowerCase() === 't') {
            e.preventDefault();
            if (lenis) {
                lenis.scrollTo(0, { duration: 1.5 });
            } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }
    });

    if (typeof getEraName === 'undefined') {
        window.getEraName = function(eraId) {
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
        };
    }

    if (window.performance && window.performance.mark) {
        window.addEventListener('load', function() {
            performance.mark('profile-page-loaded');

            const perfData = performance.getEntriesByType('navigation')[0];
            if (perfData) {
                console.log('Page Load Performance:');
                console.log('- DOM Content Loaded:', Math.round(perfData.domContentLoadedEventEnd), 'ms');
                console.log('- Load Complete:', Math.round(perfData.loadEventEnd), 'ms');
            }
        });
    }

    window.addEventListener('error', function(e) {
        console.error('Global error caught:', e.error);

    });

    window.addEventListener('unhandledrejection', function(e) {
        console.error('Unhandled promise rejection:', e.reason);

    });

    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {

            console.log('Tab hidden - pausing animations');
        } else {

            console.log('Tab visible - resuming');
        }
    });

    let konamiCode = [];
    const konamiSequence = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

    document.addEventListener('keydown', function(e) {
        konamiCode.push(e.key);
        konamiCode = konamiCode.slice(-10);

        if (konamiCode.join(',') === konamiSequence.join(',')) {
            activateEasterEgg();
            konamiCode = [];
        }
    });

    function activateEasterEgg() {
        console.log('🎮 Konami Code activated!');
        showNotification('You found a secret! 🎉', 'success');

        const heroName = document.querySelector('.hero-name');
        if (heroName) {
            heroName.style.background = 'linear-gradient(90deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #9400d3)';
            heroName.style.backgroundSize = '200% auto';
            heroName.style.animation = 'gradientFlow 2s linear infinite';
            heroName.style.webkitBackgroundClip = 'text';
            heroName.style.webkitTextFillColor = 'transparent';

            setTimeout(function() {
                heroName.style.background = '';
                heroName.style.animation = '';
                applyCharacterTheme();
            }, 10000);
        }

        const canvas = document.getElementById('bg-canvas');
        if (canvas) {
            canvas.style.opacity = '0.8';
            setTimeout(function() {
                canvas.style.opacity = '0.4';
            }, 3000);
        }
    }

    window.profileModern = {
        switchTab: switchTab,
        openEventModal: openEventModal,
        loadCharacter: loadCharacter,
        currentCharacter: function() { return currentCharacter; },
        currentTab: function() { return currentTab; }
    };

    console.log('Profile page fully initialized!');
    console.log('Keyboard shortcuts:');
    console.log('- Alt + 1-5: Switch tabs');
    console.log('- Alt + T: Scroll to top');
    console.log('- Hover over elements to edit');

})();

if (!document.querySelector('style[data-gradient-shift]')) {
    const style = document.createElement('style');
    style.setAttribute('data-gradient-shift', 'true');
    style.textContent = `
        @keyframes gradientShift {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
        }

        @keyframes highlight {
            0%, 100% { 
                box-shadow: 0 10px 20px rgba(0, 0, 0, 0.5); 
                border-color: rgba(59, 130, 246, 0.3);
            }
            50% { 
                box-shadow: 0 0 40px rgba(59, 130, 246, 0.8), 0 0 80px rgba(59, 130, 246, 0.4);
                border-color: rgba(59, 130, 246, 1);
            }
        }
    `;
    document.head.appendChild(style);
}
