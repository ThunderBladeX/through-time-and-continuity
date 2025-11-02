(function() {
    'use strict';

    const pathParts = window.location.pathname.split('/');
    const characterId = pathParts[pathParts.length - 1];
    let currentCharacter = null;
    let lenis = null;

    document.addEventListener('DOMContentLoaded', async function() {
        console.log('Profile page initializing...');

        initSmoothScroll();

        init3DBackground();

        await loadCharacter();

        setupNavigation();
        setupModals();

        setTimeout(() => {
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
    });

    function initSmoothScroll() {
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
    }

    function init3DBackground() {
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

            const geometry = new THREE.IcosahedronGeometry(1, 0);
            const material = new THREE.MeshBasicMaterial({
                color: 0x3b82f6,
                wireframe: true,
                transparent: true,
                opacity: 0.1,
            });
            const mesh = new THREE.Mesh(geometry, material);
            scene.add(mesh);

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

                mesh.rotation.x += 0.001;
                mesh.rotation.y += 0.002;

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
            if (this.src !== '/static/images/default-avatar.jpg') {
                this.src = '/static/images/default-avatar.jpg';
            } else {
                console.log('Default image also failed, using gradient');
                this.style.display = 'none';
                const wrapper = document.querySelector('.hero-image-wrapper');
                if (wrapper) {
                    wrapper.style.background = 'linear-gradient(135deg, #1a1a1a 0%, #3b82f6 100%)';
                }
            }
        };

        heroName.textContent = currentCharacter.name || currentCharacter.full_name || 'Unknown Character';

        if (currentCharacter.quote && currentCharacter.quote.trim()) {
            heroQuote.textContent = `"${currentCharacter.quote}"`;
            heroQuote.style.display = 'block';
        } else {
            heroQuote.style.display = 'none';
        }

        if (typeof gsap !== 'undefined' && gsap.to) {
            heroImage.addEventListener('load', function() {
                gsap.to('.hero-image-wrapper', {
                    yPercent: 20,
                    ease: 'none',
                    scrollTrigger: {
                        trigger: '.hero-section',
                        start: 'top top',
                        end: 'bottom top',
                        scrub: true,
                    }
                });
            });

            if (heroImage.complete && heroImage.naturalHeight !== 0) {
                gsap.to('.hero-image-wrapper', {
                    yPercent: 20,
                    ease: 'none',
                    scrollTrigger: {
                        trigger: '.hero-section',
                        start: 'top top',
                        end: 'bottom top',
                        scrub: true,
                    }
                });
            }
        }
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
    }

    function setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');

        navItems.forEach(function(item) {
            item.addEventListener('click', function() {
                const tabName = this.dataset.tab;
                switchTab(tabName);
            });
        });
    }

    function switchTab(tabName) {
        console.log('Switching to tab:', tabName);

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

        if (lenis && lenis.scrollTo) {
            lenis.scrollTo('.content-area', { offset: -100, duration: 0.8 });
        } else {
            window.scrollTo({ top: 500, behavior: 'smooth' });
        }
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
                        <div class="timeline-card">
                            <div class="timeline-header">
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
                return `
                    <div class="relationship-card" onclick="window.location.href='/profile/${rel.related_character_id}'">
                        <img src="${rel.related_character_image || '/static/images/default-avatar.jpg'}" 
                             alt="${rel.related_character_name}"
                             class="relationship-avatar"
                             onerror="this.src='/static/images/default-avatar.jpg'">
                        <div class="relationship-info">
                            <div class="relationship-name">${rel.related_character_name || 'Unknown'}</div>
                            <div class="relationship-status">${rel.status || ''}</div>
                        </div>
                    </div>
                `;
            }).join('');

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
                    return `<img src="${img}" alt="${event.title}" loading="lazy">`;
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

    function setupScrollAnimations() {
        if (typeof gsap === 'undefined' || !gsap.utils) {
            console.log('GSAP not available, skipping scroll animations');
            return;
        }

        gsap.utils.toArray('.glass-card').forEach(function(card) {
            gsap.from(card, {
                opacity: 0,
                y: 50,
                duration: 1,
                scrollTrigger: {
                    trigger: card,
                    start: 'top 85%',
                    toggleActions: 'play none none reverse',
                }
            });
        });
    }

    function applyCharacterTheme() {
        const root = document.documentElement;

        if (currentCharacter.color_primary) {
            root.style.setProperty('--accent', currentCharacter.color_primary);

            const hex = currentCharacter.color_primary.replace('#', '');
            const r = parseInt(hex.substr(0, 2), 16);
            const g = parseInt(hex.substr(2, 2), 16);
            const b = parseInt(hex.substr(4, 2), 16);
            root.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);
        }
    }

})();
