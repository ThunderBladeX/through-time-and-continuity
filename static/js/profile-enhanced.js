(function() {
    'use strict';

    let scene, camera, renderer, particlesMesh, shapes = [];
    let mouseX = 0, mouseY = 0;
    let time = 0;
    let animationFrameId = null;

    function initThreeBackground() {
        const canvas = document.getElementById('bg-canvas');
        if (!canvas) return;

        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );

        renderer = new THREE.WebGLRenderer({ 
            canvas, 
            alpha: true, 
            antialias: true,
            powerPreference: 'high-performance'
        });

        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        camera.position.z = 5;

        createParticles();

        createFloatingShapes();

        animate();

        document.addEventListener('mousemove', onMouseMove);
        window.addEventListener('resize', onWindowResize);

        console.log('✨ Three.js background initialized');
    }

    function createParticles() {

        const particlesCount = getOptimalParticleCount();
        const posArray = new Float32Array(particlesCount * 3);

        for(let i = 0; i < particlesCount * 3; i++) {
            posArray[i] = (Math.random() - 0.5) * 10;
        }

        const particlesGeometry = new THREE.BufferGeometry();
        particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

        const particlesMaterial = new THREE.PointsMaterial({
            size: 0.02,
            color: 0x3b82f6,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
        scene.add(particlesMesh);
    }

    function createFloatingShapes() {
        const geometries = [
            new THREE.OctahedronGeometry(0.2),
            new THREE.TetrahedronGeometry(0.2),
            new THREE.IcosahedronGeometry(0.2)
        ];

        const shapeCount = navigator.hardwareConcurrency >= 4 ? 8 : 4;

        for(let i = 0; i < shapeCount; i++) {
            const geometry = geometries[Math.floor(Math.random() * geometries.length)];
            const material = new THREE.MeshBasicMaterial({
                color: Math.random() > 0.5 ? 0x3b82f6 : 0x8b5cf6,
                wireframe: true,
                transparent: true,
                opacity: 0.3
            });
            const mesh = new THREE.Mesh(geometry, material);

            mesh.position.x = (Math.random() - 0.5) * 8;
            mesh.position.y = (Math.random() - 0.5) * 8;
            mesh.position.z = (Math.random() - 0.5) * 8;

            mesh.userData = {
                rotationSpeed: {
                    x: (Math.random() - 0.5) * 0.01,
                    y: (Math.random() - 0.5) * 0.01,
                    z: (Math.random() - 0.5) * 0.01
                },
                floatSpeed: Math.random() * 0.5 + 0.5,
                floatOffset: Math.random() * Math.PI * 2
            };

            shapes.push(mesh);
            scene.add(mesh);
        }
    }

    function animate() {
        animationFrameId = requestAnimationFrame(animate);
        time += 0.01;

        if (particlesMesh) {
            particlesMesh.rotation.y += 0.0005;
            particlesMesh.rotation.x = mouseY * 0.1;
            particlesMesh.rotation.y += mouseX * 0.05;
        }

        shapes.forEach(shape => {
            shape.rotation.x += shape.userData.rotationSpeed.x;
            shape.rotation.y += shape.userData.rotationSpeed.y;
            shape.rotation.z += shape.userData.rotationSpeed.z;

            shape.position.y += Math.sin(time * shape.userData.floatSpeed + shape.userData.floatOffset) * 0.001;
        });

        camera.position.x += (mouseX * 0.5 - camera.position.x) * 0.05;
        camera.position.y += (mouseY * 0.5 - camera.position.y) * 0.05;
        camera.lookAt(scene.position);

        renderer.render(scene, camera);
    }

    function onMouseMove(event) {
        mouseX = (event.clientX / window.innerWidth) * 2 - 1;
        mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    function getOptimalParticleCount() {
        const cores = navigator.hardwareConcurrency || 4;
        const isMobile = window.innerWidth < 768;

        if (isMobile) return 300;
        if (cores < 4) return 500;
        if (cores < 8) return 1000;
        return 1500;
    }

    function cleanup() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        if (renderer) {
            renderer.dispose();
        }
        document.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('resize', onWindowResize);
    }

    function enhanceNavTabs() {
        const navTabs = document.querySelectorAll('.nav-tab');

        navTabs.forEach(tab => {

            tab.addEventListener('mousemove', (e) => {
                const rect = tab.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 100;
                const y = ((e.clientY - rect.top) / rect.height) * 100;
                tab.style.setProperty('--mouse-x', `${x}%`);
                tab.style.setProperty('--mouse-y', `${y}%`);
            });
        });
    }

    function addRippleEffect() {
        const cards = document.querySelectorAll('.event-card, .relationship-card, .love-interest-card, .bio-section');

        cards.forEach(card => {
            card.addEventListener('click', function(e) {
                const ripple = document.createElement('span');
                const rect = this.getBoundingClientRect();
                const size = Math.max(rect.width, rect.height);
                const x = e.clientX - rect.left - size / 2;
                const y = e.clientY - rect.top - size / 2;

                ripple.style.cssText = `
                    position: absolute;
                    width: ${size}px;
                    height: ${size}px;
                    border-radius: 50%;
                    background: rgba(59, 130, 246, 0.3);
                    left: ${x}px;
                    top: ${y}px;
                    pointer-events: none;
                    animation: ripple 0.6s ease-out;
                    z-index: 1;
                `;

                this.style.position = 'relative';
                this.style.overflow = 'hidden';
                this.appendChild(ripple);

                setTimeout(() => ripple.remove(), 600);
            });
        });
    }

    function setupParallaxSidebar() {
        const sidebar = document.querySelector('.profile-sidebar');
        if (!sidebar) return;

        let ticking = false;

        window.addEventListener('scroll', () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    const scrolled = window.pageYOffset;
                    sidebar.style.transform = `translateY(${scrolled * 0.1}px)`;
                    ticking = false;
                });
                ticking = true;
            }
        });
    }

    function setupScrollReveal() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        }, observerOptions);

        document.querySelectorAll('.bio-section').forEach((section, index) => {
            section.style.opacity = '0';
            section.style.transform = 'translateY(30px)';
            section.style.transition = `all 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${index * 0.1}s`;
            observer.observe(section);
        });
    }

    function addPulsingGlow() {
        setInterval(() => {
            const glowIntensity = 10 + Math.sin(Date.now() / 500) * 5;
            const glowOpacity = 0.3 + Math.sin(Date.now() / 500) * 0.2;

            document.querySelectorAll('.era-badge, .nav-tab.active').forEach(el => {
                el.style.boxShadow = `0 0 ${glowIntensity}px rgba(59, 130, 246, ${glowOpacity})`;
            });
        }, 50);
    }

    function enhanceGalleryHover() {
        document.querySelectorAll('.masonry-item').forEach(item => {
            item.addEventListener('mouseenter', function() {
                this.style.zIndex = '10';
            });
            item.addEventListener('mouseleave', function() {
                this.style.zIndex = '1';
            });
        });
    }

    function addSmoothImageLoading() {
        const images = document.querySelectorAll('img');

        images.forEach(img => {
            if (img.complete) {
                img.style.opacity = '1';
            } else {
                img.style.opacity = '0';
                img.style.transition = 'opacity 0.5s ease';

                img.addEventListener('load', function() {
                    this.style.opacity = '1';
                });
            }
        });
    }

    function init() {

        if (window.innerWidth < 1024) {
            console.log('Mobile view detected, skipping enhanced features');
            return;
        }

        if (typeof THREE !== 'undefined') {
            initThreeBackground();
        } else {
            console.warn('Three.js not loaded, background animation disabled');
        }

        enhanceNavTabs();
        addRippleEffect();
        setupParallaxSidebar();
        setupScrollReveal();
        addPulsingGlow();
        enhanceGalleryHover();
        addSmoothImageLoading();

        if (!document.getElementById('ripple-animation')) {
            const style = document.createElement('style');
            style.id = 'ripple-animation';
            style.textContent = `
                @keyframes ripple {
                    from {
                        transform: scale(0);
                        opacity: 1;
                    }
                    to {
                        transform: scale(2);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        console.log('✨ Enhanced profile features initialized');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.addEventListener('beforeunload', cleanup);

    window.ProfileEnhancements = {
        cleanup,
        reinit: init
    };

})();
