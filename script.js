// Wait for the DOM to be fully loaded before hiding the modal
document.addEventListener('DOMContentLoaded', () => {
    const cardModal = document.getElementById('cardModal');
    if (cardModal) {
        // Removed initial hidden class setting here as CSS transition handles it
    }
});

// API Configuration
const API_BASE_URL = 'https://api.pokemontcg.io/v2';
const API_KEY = '7d93d3f4-83cd-4540-a119-a88bbfc9aee8'; // You'll need to get an API key from https://dev.pokemontcg.io/

// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const setFilter = document.getElementById('setFilter');
const typeFilter = document.getElementById('typeFilter');
const cardsContainer = document.getElementById('cardsContainer');
const loadingSpinner = document.getElementById('loadingSpinner');
const cardModal = document.getElementById('cardModal');
const modalCardImage = document.getElementById('modalCardImage'); // Get the image element
const currencyDropdown = document.getElementById('currencyDropdown'); // Get the currency dropdown
const sortByRarityButton = document.getElementById('sortByRarityButton'); // Get the sort by rarity button
const sortByPriceButton = document.getElementById('sortByPriceButton'); // Get the sort by price button
const resetFiltersButton = document.getElementById('resetFiltersButton'); // Get the reset filters button
const excludeMissingCheckbox = document.getElementById('excludeMissingCheckbox'); // Get the exclude missing checkbox
const raritySortArrow = sortByRarityButton.querySelector('.sort-arrow'); // Get the arrow span for rarity
const priceSortArrow = sortByPriceButton.querySelector('.sort-arrow'); // Get the arrow span for price

// State
let currentPage = 1;
let isLoading = false;
let currentFilters = {
    name: '',
    set: '',
    type: '',
    excludeMissing: false
};

let exchangeRates = {}; // Object to store exchange rates
const EXCHANGE_RATE_API_URL = 'https://open.er-api.com/v6/latest/USD';

let allSets = []; // Array to store all sets
let allTypes = []; // Array to store all types
let currentCardsData = []; // Array to store currently displayed card data
const POKEMON_TCG_SETS_URL = `${API_BASE_URL}/sets`;
const POKEMON_TCG_TYPES_URL = `${API_BASE_URL}/types`;

// State for sorting
let currentSort = { criteria: null, direction: 'asc' }; // { criteria: 'rarity' or 'price', direction: 'asc' or 'desc' }

// Define rarity order based on official API
const rarityOrder = [
  "Rare Secret",
  "Rare Rainbow",
  "Special Illustration Rare",
  "Illustration Rare",
  "Rare Shiny GX",
  "Rare Shiny",
  "Shiny Ultra Rare",
  "Shiny Rare",
  "Rare Ultra",
  "Ultra Rare",
  "Rare Holo VSTAR",
  "Rare Holo VMAX",
  "Rare Holo V",
  "Rare Holo GX",
  "Rare Holo EX",
  "Rare Holo LV.X",
  "Rare Holo Star",
  "Rare Prime",
  "Rare BREAK",
  "Rare ACE",
  "Rare Prism Star",
  "Rare Shining",
  "Radiant Rare",
  "Amazing Rare",
  "ACE SPEC Rare",
  "LEGEND",
  "Trainer Gallery Rare Holo",
  "Classic Collection",
  "Promo",
  "Rare Holo",
  "Rare",
  "Double Rare",
  "Uncommon",
  "Common"
];

// Function to get rarity index for sorting
function getRarityIndex(rarity) {
    if (!rarity) return -1; // Return -1 for missing rarities
    const index = rarityOrder.indexOf(rarity);
    // Put unknown rarities at the end
    return index === -1 ? rarityOrder.length : index;
}

// Event Listeners
searchButton.addEventListener('click', () => {
    currentFilters.name = searchInput.value;
    currentPage = 1;
    currentCardsData = []; // Clear stored data on new search
    currentSort = { criteria: null, direction: 'asc' }; // Reset sort state
    updateSortArrows(null); // Clear sort arrows
    fetchCards();
});

searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        // Prevent default form submission if inside a form
        e.preventDefault();
        currentFilters.name = searchInput.value;
        currentPage = 1;
        currentCardsData = []; // Clear stored data on new search
        currentSort = { criteria: null, direction: 'asc' }; // Reset sort state
        updateSortArrows(null); // Clear sort arrows
        fetchCards();
    }
});

// Debounce function to limit API calls while typing
function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

// Event listener for input changes with debounce
searchInput.addEventListener('input', debounce(() => {
    console.log('Search input changed, fetching cards...', searchInput.value);
    currentFilters.name = searchInput.value;
    currentPage = 1; // Reset to first page on new search
    currentCardsData = []; // Clear stored data on new search
    currentSort = { criteria: null, direction: 'asc' }; // Reset sort state
    updateSortArrows(null); // Clear sort arrows
    fetchCards();
}, 300)); // 300ms delay after typing stops

setFilter.addEventListener('change', () => {
    currentFilters.set = setFilter.value;
    currentPage = 1;
    currentCardsData = []; // Clear stored data on filter change
    currentSort = { criteria: null, direction: 'asc' }; // Reset sort state
    updateSortArrows(null); // Clear sort arrows
    console.log('Set filter changed:', currentFilters.set);
    fetchCards();
});

typeFilter.addEventListener('change', () => {
    currentFilters.type = typeFilter.value;
    currentPage = 1;
    currentCardsData = []; // Clear stored data on filter change
    currentSort = { criteria: null, direction: 'asc' }; // Reset sort state
    updateSortArrows(null); // Clear sort arrows
    console.log('Type filter changed:', currentFilters.type);
    fetchCards();
});

// Close modal when clicking outside the image
cardModal.addEventListener('click', (e) => {
    if (e.target === cardModal) { // Check if the click was directly on the modal background
        hideCardDetails();
    }
});

// Event listener for currency dropdown change
currencyDropdown.addEventListener('change', () => {
    const selectedCurrency = currencyDropdown.value;
    localStorage.setItem('selectedCurrency', selectedCurrency); // Save preference to Local Storage
    updateDisplayedPrices(); // Update prices when currency changes
});

// Add Event Listeners for Sort Buttons
sortByRarityButton.addEventListener('click', () => {
    if (currentSort.criteria === 'rarity') {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.criteria = 'rarity';
        currentSort.direction = 'asc';
    }
    currentPage = 1; // Reset to first page for new sorted results
    currentCardsData = []; // Clear data to load sorted results
    updateSortArrows('rarity'); // Update arrow display
    fetchCards(); // Fetch cards with new sort order
});

sortByPriceButton.addEventListener('click', () => {
    if (currentSort.criteria === 'price') {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.criteria = 'price';
        currentSort.direction = 'asc';
    }
    currentPage = 1; // Reset to first page for new sorted results
    currentCardsData = []; // Clear data to load sorted results
    updateSortArrows('price'); // Update arrow display
    fetchCards(); // Fetch cards with new sort order
});

// Add Event Listener for Exclude Missing Checkbox
excludeMissingCheckbox.addEventListener('change', () => {
    currentFilters.excludeMissing = excludeMissingCheckbox.checked;
    currentPage = 1;
    currentCardsData = [];
    fetchCards();
});

// Add Event Listener for Reset Filters Button
resetFiltersButton.addEventListener('click', () => {
    // Reset all filters
    currentFilters = {
        name: '',
        set: '',
        type: '',
        excludeMissing: false
    };
    
    // Reset search input
    searchInput.value = '';
    
    // Reset select elements
    setFilter.value = '';
    typeFilter.value = '';
    
    // Reset checkbox
    excludeMissingCheckbox.checked = false;
    
    // Reset sort state
    currentSort = { criteria: null, direction: 'asc' };
    updateSortArrows(null);
    
    // Reset page and fetch cards
    currentPage = 1;
    currentCardsData = [];
    fetchCards();
});

// Function to update sort arrow display
function updateSortArrows(activeSortCriteria) {
    // Reset all arrows first
    raritySortArrow.textContent = '';
    priceSortArrow.textContent = '';

    // Set the arrow for the active sort button based on its direction
    if (activeSortCriteria === 'rarity') {
        raritySortArrow.textContent = currentSort.direction === 'asc' ? ' ▲' : ' ▼';
    } else if (activeSortCriteria === 'price') {
        priceSortArrow.textContent = currentSort.direction === 'asc' ? ' ▲' : ' ▼';
    }
}

// Functions
async function fetchCards() {
    if (isLoading) return;
    
    // Clear cards container only if it's a new search, filter change, or sort change (page 1)
    if (currentPage === 1 && !isLoading) {
         cardsContainer.innerHTML = '';
    }

    isLoading = true;
    loadingSpinner.classList.remove('hidden');
    
    try {
        // Increase page size for initial load when sorting/filtering
        const pageSize = (currentPage === 1 && (currentFilters.name || currentFilters.set || currentFilters.type || currentSort.criteria)) ? 250 : 20;
        let url = `${API_BASE_URL}/cards?page=${currentPage}&pageSize=${pageSize}`;
        
        if (currentFilters.name) {
            // Add wildcard for partial matching (names starting with the input)
            url += `&q=name:${currentFilters.name}*`;
        }
        if (currentFilters.set) {
            url += `&q=set.id:${currentFilters.set}`;
        }
        if (currentFilters.type) {
            url += `&q=types:${currentFilters.type}`;
        }

        // Add orderBy parameter if a sort criteria is selected
        if (currentSort.criteria) {
            let orderByField = '';
            if (currentSort.criteria === 'rarity') {
                 // Sorting by rarity might require client-side handling for custom order,
                 // but we can try the API's default string sort first.
                 orderByField = 'rarity';
            } else if (currentSort.criteria === 'price') {
                 // Use the nested field for average sell price
                 orderByField = 'cardmarket.prices.averageSellPrice';
            }

            if (orderByField) {
                // Add hyphen for descending order
                const orderDirection = currentSort.direction === 'desc' ? `-${orderByField}` : orderByField;
                 // Append to the URL. If there's already a query, use &; otherwise use ?
                 url += `&orderBy=${orderDirection}`;
            }
        }

        console.log('Current filters before fetch:', currentFilters);
        console.log('Fetching cards with URL:', url);

        const response = await fetch(url, {
            headers: {
                'X-Api-Key': API_KEY
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch cards: ${response.status}`);
        }

        const data = await response.json();
        console.log('Cards fetched successfully:', data);
        
        // Log the total number of cards fetched before any filtering
        console.log('Total cards fetched in this batch:', data.data.length);
        
        // Store fetched data
        if (currentPage === 1) {
            currentCardsData = data.data; // Replace data on first page
            console.log('Initial fetch data:', currentCardsData);
        } else {
            // For infinite scroll, append new data
            currentCardsData = currentCardsData.concat(data.data);
            console.log('Appended data:', data.data);
        }
        
        // Sort the combined data if sorting is active (apply to both initial load and infinite scroll data)
        if (currentSort.criteria) {
            console.log('Applying sort criteria:', currentSort.criteria, 'direction:', currentSort.direction);
            currentCardsData.sort((a, b) => {
                if (currentSort.criteria === 'rarity') {
                    const rarityAIndex = getRarityIndex(a.rarity);
                    const rarityBIndex = getRarityIndex(b.rarity);

                    if (currentSort.direction === 'asc') {
                        // Ascending sort: Lowest Rarity (highest index) to Highest Rarity (lowest index)
                        // Sort by increasing index. If A's index is higher (lower rarity), it should come after B.
                        // Return positive if A after B (indexA > indexB)
                        return rarityBIndex - rarityAIndex; // Corrected for ascending
                    } else {
                        // Descending sort: Highest Rarity (lowest index) to Lowest Rarity (highest index)
                        // Sort by decreasing index. If A's index is lower (higher rarity), it should come before B.
                        // Return negative if A before B (indexA < indexB)
                        return rarityAIndex - rarityBIndex; // Corrected for descending
                    }
                } else if (currentSort.criteria === 'price') {
                    // Price sorting logic (assuming price is available)
                    const priceA = a.cardmarket?.prices?.averageSellPrice || 0;
                    const priceB = b.cardmarket?.prices?.averageSellPrice || 0;
                    return currentSort.direction === 'asc' ? priceA - priceB : priceB - priceA;
                } else {
                    return 0;
                }
            });
        }
        
        // Log the state of currentCardsData before displaying
        console.log('currentCardsData before display:', currentCardsData);

        // Display the fetched cards
        // Display the full currentCardsData array after sorting/filtering
        displayCards(currentCardsData);
        
        // Update filters if it's the first page
        if (currentPage === 1) {
            updateFilters(data.data); // Use the data from the first page to update filters
        }
    } catch (error) {
        console.error('Error fetching cards:', error);
        cardsContainer.innerHTML = '<p class="error">Failed to load cards. Please try again later.</p>';
    } finally {
        isLoading = false;
        loadingSpinner.classList.add('hidden');
    }
}

function displayCards(cardsToDisplay) {
    // Log the number of cards passed to displayCards
    console.log('displayCards called with', cardsToDisplay.length, 'cards');

    // Clear the container before displaying the sorted/filtered list
    cardsContainer.innerHTML = '';

    // Filter out cards with missing information if the checkbox is checked
    if (currentFilters.excludeMissing) {
        const initialCardCount = cardsToDisplay.length;
        cardsToDisplay = cardsToDisplay.filter(card => {
            const hasPrice = card.cardmarket?.prices?.averageSellPrice !== undefined;
            const hasRarity = card.rarity !== undefined;
            // Log details of cards being excluded
            if (!hasPrice || !hasRarity) {
                console.log('Excluding card:', card.name, 'Missing Price:', !hasPrice, 'Missing Rarity:', !hasRarity);
            }
            return hasPrice && hasRarity;
        });
        // Log the number of cards after filtering
        console.log('Cards remaining after filtering:', cardsToDisplay.length, 'Excluded:', initialCardCount - cardsToDisplay.length);
    }

    // Sorting is now handled in fetchCards before calling displayCards
    // The displayCards function just needs to render the provided (already sorted and filtered) list.

    cardsToDisplay.forEach(card => {
        const cardElement = createCardElement(card);
        cardsContainer.appendChild(cardElement);
    });
}

function createCardElement(card) {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card';
    
    const cardImage = document.createElement('img');
    cardImage.src = card.images.small;
    cardImage.alt = card.name;
    
    const cardInfo = document.createElement('div');
    cardInfo.className = 'card-info';
    
    const cardName = document.createElement('h3');
    cardName.className = 'card-name';
    cardName.textContent = card.name;
    
    const cardSet = document.createElement('p');
    cardSet.textContent = `Set: ${card.set.name}`;
    
    const cardPrice = document.createElement('p');
    cardPrice.className = 'card-price';
    // Store the original USD price in a data attribute
    const usdPrice = card.cardmarket?.prices?.averageSellPrice;
    if (usdPrice) {
        cardPrice.dataset.usdPrice = usdPrice;
        // Calculate and display the price in the initially selected currency
        const selectedCurrency = currencyDropdown.value;
        const rate = exchangeRates[selectedCurrency];
        
        if (rate) {
            const convertedPrice = (parseFloat(usdPrice) * rate).toFixed(2);
             let symbol = selectedCurrency;
             if (selectedCurrency === 'USD') symbol = '$';
             if (selectedCurrency === 'INR') symbol = '₹'; // Example symbol for INR
            cardPrice.textContent = `Price: ${symbol}${convertedPrice}`;
        } else {
            // Fallback to displaying USD if exchange rates are not yet available
            cardPrice.textContent = `Price: $${parseFloat(usdPrice).toFixed(2)}`;
        }
        
    } else {
        cardPrice.textContent = 'Price: N/A';
    }

    // Add Rarity information
    const cardRarity = document.createElement('div');
    cardRarity.className = 'card-rarity';
    if (card.rarity) {
        // Add a class based on rarity for specific styling
        const rarityClass = card.rarity.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        cardRarity.classList.add(`rarity-${rarityClass}`);

        // Add the SVG icon
        cardRarity.innerHTML += `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-activity w-3 h-3 rarity-icon">
                <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"></path>
            </svg>
        `;
        
        // Add the rarity text
        const rarityText = document.createElement('span');
        rarityText.textContent = card.rarity;
        cardRarity.appendChild(rarityText);

    } else {
        const rarityText = document.createElement('span');
        rarityText.textContent = 'Rarity: N/A';
        cardRarity.appendChild(rarityText);
    }

    cardInfo.appendChild(cardName);
    cardInfo.appendChild(cardSet);
    cardInfo.appendChild(cardPrice);
    cardInfo.appendChild(cardRarity);
    
    cardDiv.appendChild(cardImage);
    cardDiv.appendChild(cardInfo);
    
    cardDiv.addEventListener('click', () => showCardDetails(card));
    
    return cardDiv;
}

function showCardDetails(card) {
    console.log('Attempting to show modal for card:', card.name);
    
    // Set the image source for the modal image element
    modalCardImage.src = card.images.large;
    modalCardImage.alt = card.name;
    
    console.log('Modal image source set.');
    
    // Add a small delay to allow the display: flex to be applied before transition
    setTimeout(() => {
        cardModal.classList.remove('hidden');
        cardModal.classList.add('visible');
    }, 10);
    
}

function hideCardDetails() {
    cardModal.classList.remove('visible');
    // Add a delay before hiding completely to allow zoom out animation
    setTimeout(() => {
        cardModal.classList.add('hidden');
        modalCardImage.src = ''; // Clear image source
        modalCardImage.alt = '';
    }, 300); // Match the transition duration in CSS
}

async function updateFilters(cards) {
    // Store the currently selected values
    const selectedSetId = setFilter.value;
    const selectedType = typeFilter.value;

    // Update set filter using all sets
    setFilter.innerHTML = '<option value="">All Sets</option>';
    allSets.forEach(set => { // Use the allSets array
        const option = document.createElement('option');
        option.value = set.id;
        option.textContent = set.name;
        setFilter.appendChild(option);
    });
    
    // Restore the previously selected set value
    if (selectedSetId) {
        setFilter.value = selectedSetId;
    }

    // Update type filter using all types
    typeFilter.innerHTML = '<option value="">All Types</option>';
    allTypes.forEach(type => { // Use the allTypes array
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        typeFilter.appendChild(option);
    });

    // Restore the previously selected type value
    if (selectedType) {
        typeFilter.value = selectedType;
    }
}

// Infinite scroll
window.addEventListener('scroll', () => {
    // Calculate the scroll position percentage
    const scrollableHeight = document.body.offsetHeight - window.innerHeight;
    if (scrollableHeight <= 0) return; // Avoid division by zero or negative values
    const scrollPercentage = (window.scrollY / scrollableHeight) * 100;

    // Trigger fetchCards if the user has scrolled past 70% and not currently loading
    // Infinite scroll should work with filters and sorting
    if (scrollPercentage > 70 && !isLoading) {
        currentPage++;
        console.log('Scrolled past 70%, fetching page:', currentPage);
        fetchCards();
    }
});

async function fetchExchangeRates() {
    try {
        const response = await fetch(EXCHANGE_RATE_API_URL);
        if (!response.ok) {
            throw new Error('Failed to fetch exchange rates');
        }
        const data = await response.json();
        exchangeRates = data.rates; // Store the rates
        console.log('Exchange rates fetched:', exchangeRates);
        // Now that rates are fetched, we can update prices if cards are already loaded
        updateDisplayedPrices();
    } catch (error) {
        console.error('Error fetching exchange rates:', error);
        // Optionally display an error message to the user
    }
}

// Function to update displayed prices based on selected currency
function updateDisplayedPrices() {
    const selectedCurrency = currencyDropdown.value;
    const rate = exchangeRates[selectedCurrency];

    if (!rate) {
        console.warn('Exchange rate not available for:', selectedCurrency);
        return; // Cannot convert if rate is not available
    }

    // Iterate through all displayed card price elements
    cardsContainer.querySelectorAll('.card-price').forEach(priceElement => {
        const usdPrice = priceElement.dataset.usdPrice;

        if (usdPrice) {
            const convertedPrice = (parseFloat(usdPrice) * rate).toFixed(2);
            let symbol = selectedCurrency;
            // Add currency symbols if desired (basic example)
            if (selectedCurrency === 'USD') symbol = '$';
            if (selectedCurrency === 'INR') symbol = '₹'; // Example symbol for INR

            priceElement.textContent = `Price: ${symbol}${convertedPrice}`;
        } else if (priceElement.textContent !== 'Price: N/A') {
             // If there was no USD price initially, keep it as N/A
             priceElement.textContent = 'Price: N/A';
        }
    });

     // Also update the price in the modal if it's open (optional, depending on desired behavior)
     // This part would require accessing the modal's price element if you added one back.
     // For now, the modal only shows the image as per the last request.
}

async function fetchAllSets() {
    try {
        const response = await fetch(POKEMON_TCG_SETS_URL, {
            headers: {
                'X-Api-Key': API_KEY
            }
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch sets: ${response.status}`);
        }
        const data = await response.json();
        allSets = data.data; // Store all sets
        console.log('All sets fetched:', allSets);
    } catch (error) {
        console.error('Error fetching all sets:', error);
        // Optionally display an error message
    }
}

async function fetchAllTypes() {
    try {
        const response = await fetch(POKEMON_TCG_TYPES_URL, {
            headers: {
                'X-Api-Key': API_KEY
            }
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch types: ${response.status}`);
        }
        const data = await response.json();
        allTypes = data.data; // Store all types
        console.log('All types fetched:', allTypes);
    } catch (error) {
        console.error('Error fetching all types:', error);
        // Optionally display an error message
    }
}

// Initial load
// Fetch exchange rates first, then fetch cards

// Load saved currency preference from Local Storage
const savedCurrency = localStorage.getItem('selectedCurrency');
if (savedCurrency) {
    currencyDropdown.value = savedCurrency;
} else {
    currencyDropdown.value = 'USD'; // Explicitly set to USD if no saved preference
}

async function initializeApp() {
    await fetchExchangeRates(); // Wait for exchange rates
    await fetchAllSets(); // Wait for all sets
    await fetchAllTypes(); // Wait for all types
    updateFilters([]); // Populate filters initially with empty cards (or we can fetch cards first and then update filters based on initial load)
    fetchCards(); // Then fetch and display initial cards
}

initializeApp();

// Initial display of sort arrows (optional, defaults to no arrows initially)
updateSortArrows(null); 