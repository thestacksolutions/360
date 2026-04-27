/* --- MOBILE SENSOR & VR BLOCKING --- */

// 1. Immediate listener to stop sensor data propagation
window.addEventListener('deviceorientation', function (e) {
    e.stopImmediatePropagation();
}, true);

window.addEventListener('devicemotion', function (e) {
    e.stopImmediatePropagation();
}, true);

// 2. Scene configuration (runs once the scene is ready)
const configureScene = () => {
    const sceneEl = document.querySelector('a-scene');
    if (sceneEl) {
        sceneEl.setAttribute('vr-mode-ui', 'enabled: false');
        sceneEl.setAttribute('webxr', 'referenceSpaceType: local; requiredFeatures: []; optionalFeatures: [];');
    }
};

// Check if scene is already loaded, otherwise wait for it
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    configureScene();
} else {
    document.addEventListener('DOMContentLoaded', configureScene);
}
/* ----------------------------------- */

// ... rest of your existing code (modal logic, carousel, etc.) ...




// ** 1. A-FRAME CUSTOM COMPONENTS (YOUR ORIGINAL, WORKING CODE) **

AFRAME.registerComponent('pinch-to-zoom', {
    schema: { sensitivity: { type: 'number', default: 0.05 } },
    init: function () {
        var initialDistance = 0;
        var initialFov = 50;
        var camera = this.el.components.camera;

        this.el.sceneEl.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                initialDistance = this.getDistance(e.touches);
                initialFov = camera.data.fov;
                e.preventDefault();
            }
        }, false);

        this.el.sceneEl.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                var currentDistance = this.getDistance(e.touches);
                var delta = initialDistance - currentDistance;
                var newFov = initialFov + (delta * this.data.sensitivity);
                newFov = Math.min(100, Math.max(30, newFov));
                camera.el.setAttribute('camera', 'fov', newFov);
                e.preventDefault();
            }
        }, false);
    },
    getDistance: function (touches) {
        var dx = touches[0].pageX - touches[1].pageX;
        var dy = touches[0].pageY - touches[1].pageY;
        return Math.sqrt(dx * dx + dy * dy);
    }
});

AFRAME.registerComponent('custom-touch-override', {
    init: function () {
        // Note: This component uses its own touch logic to handle rotation, 
        // which seems to be essential for your specific touch/camera setup to work.
        var previousPos = { x: null, y: null };
        var rotation = { x: 0, y: 0 };
        var sensitivity = 0.05;
        var camEl = this.el;
        var yawWrapperEl = document.getElementById('camera-wrapper');

        var updateRotation = function () {
            if (yawWrapperEl) {
                yawWrapperEl.object3D.rotation.y = THREE.MathUtils.degToRad(rotation.y);
            }
            rotation.x = Math.max(-90, Math.min(90, rotation.x));
            if (camEl.components['look-controls'] && camEl.components['look-controls'].pitchObject) {
                camEl.components['look-controls'].pitchObject.rotation.x = THREE.MathUtils.degToRad(rotation.x);
            }
        };

        camEl.sceneEl.addEventListener('touchstart', function (e) {
            if (e.touches.length === 1) {
                previousPos.x = e.touches[0].pageX;
                previousPos.y = e.touches[0].pageY;

                if (yawWrapperEl) {
                    rotation.y = THREE.MathUtils.radToDeg(yawWrapperEl.object3D.rotation.y);
                }
                if (camEl.components['look-controls'] && camEl.components['look-controls'].pitchObject) {
                    rotation.x = THREE.MathUtils.radToDeg(camEl.components['look-controls'].pitchObject.rotation.x);
                }
            }
        }, false);

        camEl.sceneEl.addEventListener('touchmove', function (e) {
            if (!camEl.getAttribute('look-controls').enabled || e.touches.length !== 1) {
                return;
            }

            var currentX = e.touches[0].pageX;
            var currentY = e.touches[0].pageY;
            var deltaX = currentX - previousPos.x;
            var deltaY = currentY - previousPos.y;

            rotation.y += deltaX * sensitivity;
            rotation.x += deltaY * sensitivity;

            previousPos.x = currentX;
            previousPos.y = currentY;

            updateRotation();
            e.preventDefault();
        }, false);
    }
});

// Component to make the entity always face the camera
AFRAME.registerComponent('billboard', {
    init: function () {
        // Cache the camera element
        this.camera = document.querySelector('a-camera');
    },
    tick: function () {
        if (this.camera) {
            // Only rotate the Y-axis (yaw) of the entity to match the camera's Y-rotation
            // This makes it always face the user horizontally
            this.el.object3D.rotation.y = this.camera.object3D.rotation.y;
        }
    }
});

// ** 2. DATA FETCHING AND DYNAMIC HTML GENERATION **

let allProductsData = {};
let currentContentId = null;
let allContentBlocks = []; // Initialize as empty array
const modalOverlay = document.getElementById('modal-overlay');

// NEW: Object to map the JSON key to the display title
/* const SELECTION_TITLES = {
    "selection-kitchen-content": "Kitchen Overhead",
    "selection-wicker-content": "Cabinet Accessory",
    "selection-midway-systems": "Midway Systems" */
// Add new areas here when you create them, e.g.:
// "selection-new-area-content": "Living Room Fixtures" 
/* }; */

// NEW FUNCTION: Dynamically creates A-Frame hotspot entities (Outer Pulsing Ring Only)
function generateHotspots(hotspotData) {
    const sceneEl = document.getElementById('my-scene');

    hotspotData.forEach(hotspot => {
        const hotspotEntity = document.createElement('a-entity');

        hotspotEntity.setAttribute('id', hotspot.id);
        hotspotEntity.setAttribute('class', 'collidable');

        // --- 1. Geometry & Appearance (The single white, pulsing ring) ---
        hotspotEntity.setAttribute('geometry', 'primitive: sphere; radius: 0.2');// Radius of 0.2m (you can adjust this size)

        // Material: White, semi-transparent, flat shader
        hotspotEntity.setAttribute('material', 'color: white; opacity: 0.8; shader: flat');

        // --- 2. Functionality & Position ---
        // Keep the entity facing the camera
        hotspotEntity.setAttribute('billboard', '');
        hotspotEntity.setAttribute('position', hotspot.position);
        hotspotEntity.setAttribute('rotation', hotspot.rotation);
        hotspotEntity.setAttribute('data-target-content', hotspot.targetContent);
        hotspotEntity.setAttribute('data-title', hotspot.title || 'Select Product'); // Use title from JSON or a default
        hotspotEntity.setAttribute('onclick', 'handleHotspotClick(this)');

        // --- 3. PULSE/BREATH ANIMATION ---
        hotspotEntity.setAttribute('animation__scale', {
            property: 'scale',
            dir: 'alternate',
            dur: 1000, // Duration of one pulse cycle
            from: '1 1 1',
            to: '1.3 1.3 1.3', // Scales up by 20%
            loop: true,
            easing: 'easeInOutSine'
        });

        // *** INNER GLOW ENTITY REMOVED ***

        sceneEl.appendChild(hotspotEntity);
    });
}


// Modify fetchProductData to handle the new JSON structure
async function fetchProductData(jsonPath) {
    if (!jsonPath) {
        console.error("Error: No JSON path provided!");
        return;
    }
    try {
        const response = await fetch(jsonPath);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        // --- NEW: 1. Set the 360 Environment Image from JSON ---
        if (data.sceneConfig) {
            const sky = document.querySelector('#main-environment-asset');
            if (sky) {
                // Change the 360 image source
                if (data.sceneConfig.panorama) {
                    sky.setAttribute('src', data.sceneConfig.panorama);
                }
                // Change the initial rotation (optional)
                if (data.sceneConfig.rotation) {
                    sky.setAttribute('rotation', data.sceneConfig.rotation);
                }
            }
        }

        // 2. Generate Hotspots (existing logic)
        if (data.hotspots) {
            generateHotspots(data.hotspots);
        }

        // 3. Separate hotspot data from product data (existing logic)
        const { hotspots, sceneConfig, ...productData } = data; // Added sceneConfig here to keep productData clean
        allProductsData = productData;

        // 4. Generate UI (existing logic)
        generateInitialHTML(allProductsData);
        initCarousels();

    } catch (error) {
        console.error("Could not fetch product data. Check if json file exists and if you are using a local web server:", error);
    }
}

// Function to dynamically build the entire HTML structure from the JSON
// CORRECTED FUNCTION TO READ JSON-CONTROLLED TITLE
// Function to dynamically build the entire HTML structure from the JSON
function generateInitialHTML(data) {
    const dynamicArea = document.getElementById('dynamic-content-area');
    let htmlContent = '';
    const allProductLookups = {};

    // 1. GENERATE SELECTION VIEWS (TIER 1)
    for (const selectionKey in data) {

        const selectionWrapper = data[selectionKey];

        // Skip the hotspots array, as it's not a product selection view
        if (selectionKey === 'hotspots') continue;

        // Ensure the wrapper object and products array exist in the new structure
        if (!selectionWrapper || !selectionWrapper.products || !Array.isArray(selectionWrapper.products)) {
            console.warn(`Skipping invalid content block: ${selectionKey}. Check JSON structure.`);
            continue;
        }

        // --- READ DYNAMIC DATA FROM NEW JSON STRUCTURE ---
        const products = selectionWrapper.products; // Accesses the array
        const selectionTitle = selectionWrapper.title; // Accesses the title
        // --------------------------------------------------

        let selectionGrid = '';

        products.forEach(product => {
            allProductLookups[product.id] = product;

            selectionGrid += `
                <div class="product-card" data-target-content="${product.id}"
                    data-prev-content="${selectionKey}" onclick="handleProductSelect(this)">
                    <img src="${product.cardImg}" alt="${product.title}" class="card-image">
                    <p class="card-title">${product.title}</p>
                </div>
            `;
        });

        htmlContent += `
            <div id="${selectionKey}" class="modal-content-block selection-view">
                <p class="card-heading">${selectionTitle}</p>
                <div class="product-selection-grid">${selectionGrid}</div>
            </div>
        `;
    }

    // 2. GENERATE DETAIL VIEWS (TIER 2)
    for (const productKey in allProductLookups) {
        const product = allProductLookups[productKey];

        let slidesHtml = product.images.map(src => `<img class="carousel-slide" src="${src}" alt="${product.title}">`).join('');
        let featuresHtml = product.features.map(feature => `<li>${feature}</li>`).join('');

        htmlContent += `
        <div id="${product.id}" class="modal-content-block product-detail-content"
            data-prev-content="${product.prevContent}">
            <span class="back-button" onclick="handleBackButtonClick(this)">&#8592;</span>
            
            <div class="modal-flex-container">
            
                <div class="modal-left-column">
                
                    <div class="image-carousel" id="${product.carouselId}">
                        <div class="slides-container">${slidesHtml}</div>
                        <button class="prev-btn" onclick="plusSlides(-1, '${product.carouselId}')">&#10094;</button>
                        <button class="next-btn" onclick="plusSlides(1, '${product.carouselId}')">&#10095;</button>
                    </div>
                </div>
                <div class="modal-right-column">
                    <h3 style="font-weight: bold; margin-top: 5px; font-size: 2rem;">${product.title}</h3>
                    <ul class="feature-list">${featuresHtml}</ul>                    
                </div>
            </div>
        </div>
    `;
    }

    dynamicArea.innerHTML = htmlContent;
    allContentBlocks = document.querySelectorAll('.modal-content-block');
}


// ** 3. MODAL LOGIC (SEAMLESS AND DATA-DRIVEN) **

function showContent(contentId) {
    if (!allContentBlocks || allContentBlocks.length === 0) return;

    const master = document.getElementById('content-master-container');

    // 1. Always ensure the Close Button is there
    if (!master.querySelector('.close-button')) {
        const btn = document.createElement('span');
        btn.className = 'close-button';
        btn.innerHTML = '&times;';
        btn.onclick = hideAllModals;
        master.prepend(btn); // Puts it in the master box immediately
    }

    // 2. Your existing logic to show the specific block
    allContentBlocks.forEach(block => { block.style.display = 'none'; });
    const target = document.getElementById(contentId);
    if (target) target.style.display = 'block';
    
    currentContentId = contentId;
    

    allContentBlocks.forEach(block => {
        block.style.display = 'none';
    });

    const targetContent = document.getElementById(contentId);
    if (!targetContent) return;

    // Show the content block
    targetContent.style.display = 'block';
    currentContentId = contentId;

    // CRITICAL FIX: Add a small delay for the browser to render the slides before cycling them
    setTimeout(() => {
        const carousel = targetContent.querySelector('.image-carousel');
        if (carousel && carousel.id) {
            slideIndex[carousel.id] = 1;
            showSlides(1, carousel.id);
        }
    }, 50); // 50ms delay is usually enough to ensure the browser processes the 'display: block'

}

function handleHotspotClick(hotspotElement) {
    const targetContentId = hotspotElement.getAttribute('data-target-content');

    showContent(targetContentId);

    // Show the main overlay and disable A-Frame controls
    modalOverlay.style.display = 'block';
    setTimeout(() => {
        modalOverlay.style.opacity = 1;
    }, 50);

    document.querySelector('a-camera').setAttribute('look-controls', 'enabled', false);
}

function handleProductSelect(cardElement) {
    
    const targetContentId = cardElement.getAttribute('data-target-content');

    const currentContentBlock = document.getElementById(currentContentId);
    if (currentContentBlock) {
        currentContentBlock.style.opacity = 0;
    }

    setTimeout(() => {
        if (currentContentBlock) {
            currentContentBlock.style.display = 'none';
            currentContentBlock.style.opacity = 1;
        }

        showContent(targetContentId);
    }, 300);
}

function handleBackButtonClick(buttonElement) {
    const currentContentBlock = document.getElementById(currentContentId);
    if (!currentContentBlock) return;

    const prevContentId = currentContentBlock.getAttribute('data-prev-content');

    currentContentBlock.style.opacity = 0;

    setTimeout(() => {
        currentContentBlock.style.display = 'none';
        currentContentBlock.style.opacity = 1;

        showContent(prevContentId);
    }, 300);
}

function hideAllModals() {
    modalOverlay.style.opacity = 0;

    setTimeout(() => {
        modalOverlay.style.display = 'none';

        if (currentContentId) {
            document.getElementById(currentContentId).style.display = 'none';
            currentContentId = null;
        }
    }, 300);

    document.querySelector('a-camera').setAttribute('look-controls', 'enabled', true);
}


// ** 4. CAROUSEL LOGIC **
var slideIndex = {};

function initCarousels() {
    var carousels = document.querySelectorAll('.image-carousel');
    carousels.forEach(function (carousel) {
        var id = carousel.id;
        slideIndex[id] = 1;
        showSlides(1, id);
        setupCarouselSwipe(id);
    });
}

function plusSlides(n, carouselId) {
    showSlides(slideIndex[carouselId] += n, carouselId);
}

/* function showSlides(n, carouselId) {
    var carouselElement = document.getElementById(carouselId);
    if (!carouselElement) return;

    var slides = carouselElement.querySelectorAll('.carousel-slide');
    if (slides.length === 0) return;

    if (!slideIndex[carouselId]) {
        slideIndex[carouselId] = 1;
    }

    if (n > slides.length) {
        slideIndex[carouselId] = 1;
    }
    if (n < 1) {
        slideIndex[carouselId] = slides.length;
    }

    for (var i = 0; i < slides.length; i++) {
        slides[i].style.display = "none";
    }
    slides[slideIndex[carouselId] - 1].style.display = "block";
} */

function showSlides(n, carouselId) {
    var carouselElement = document.getElementById(carouselId);
    if (!carouselElement) return;

    var slides = carouselElement.querySelectorAll('.carousel-slide');
    if (slides.length === 0) return;

    if (!slideIndex[carouselId]) {
        slideIndex[carouselId] = 1;
    }

    // --- Original Logic for Index Management (Keep this) ---
    if (n > slides.length) {
        slideIndex[carouselId] = 1;
    }
    if (n < 1) {
        slideIndex[carouselId] = slides.length;
    }

    // --- MODIFIED LOGIC: Use .active class instead of display: none/block ---

    // 1. Remove .active class from ALL slides
    for (var i = 0; i < slides.length; i++) {
        // We no longer need to set display = "none"
        slides[i].classList.remove('active');
    }

    // 2. Add .active class to the current slide to trigger fade-in
    slides[slideIndex[carouselId] - 1].classList.add('active');
}

function setupCarouselSwipe(carouselId) {
    const carousel = document.getElementById(carouselId);
    if (!carousel) return;

    let startX = 0;
    let endX = 0;
    const threshold = 50;

    carousel.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            startX = e.touches[0].clientX;
            endX = startX;
        }
    });

    carousel.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1) {
            endX = e.touches[0].clientX;
        }
    });

    carousel.addEventListener('touchend', () => {
        const deltaX = endX - startX;

        if (Math.abs(deltaX) > threshold) {
            if (deltaX < 0) {
                plusSlides(1, carouselId);
            } else if (deltaX > 0) {
                plusSlides(-1, carouselId);
            }
        }
        startX = 0;
        endX = 0;
    });
}

// ** 5. ACCESSIBILITY / USER EXPERIENCE ENHANCEMENTS **

// Function to close the modal when the Escape key is pressed
document.addEventListener('keydown', function (event) {
    // Check if the key pressed is the Escape key (key code 'Escape' or 'Esc')
    if (event.key === 'Escape') {
        // Call the existing function to hide the overlay and enable camera controls
        hideAllModals();
    }
});

// Function to run when the entire A-Frame scene (including the 360 image) is ready
const initializeApp = () => {
    const loaderEl = document.getElementById('scene-loader');

    /* Uncomment below for testing purpose */
    /* console.log("A-Frame scene and 360 image are fully rendered. Unlocking application."); */

    // 1. Fetch data and generate hotspots/modals (Hotspots appear on scene)
    /* fetchProductData(); */

    // 2. Hide the loader seamlessly
    window.requestAnimationFrame(() => {
        if (loaderEl) {
            loaderEl.classList.add('hidden');

            // Add a small buffer timeout to ensure the fade animation completes
            setTimeout(() => {
                loaderEl.remove();
            }, 500);
        }
    });
};

document.addEventListener('DOMContentLoaded', () => {
    
    const sceneEl = document.getElementById('my-scene');

    if (!sceneEl) {
        console.error("A-Frame scene element not found. Cannot proceed.");
        return;
    }

    // --- CRITICAL FIX: Check if the scene is already loaded/rendered ---
    if (sceneEl.hasLoaded) {
        // Case 1: Scene is ready (very common when running locally/cached)
        initializeApp();
    } else {
        // Case 2: Scene is still loading. Wait for A-Frame's official 'loaded' event.
        // This event guarantees all assets have finished loading.
        sceneEl.addEventListener('loaded', initializeApp, { once: true });
    }
});

