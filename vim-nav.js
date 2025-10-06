// Vim navigation for the website
// h - navigate to previous page
// l - navigate to next page
// j - scroll down to next section
// k - scroll up to previous section
// / - open search

// Global variables for search functionality
let currentSearchResults = [];
let searchResultsNavigating = false;
let currentResultIndex = null;

document.addEventListener('DOMContentLoaded', function() {
    // Define page order for navigation
    const pageOrder = [
        'index.html',
        'blog.html',
        'reading.html',
        'latte-art.html',
        'fragrances.html',
        'graph-agents.html'
    ];
    
    // Get current page
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    // Find current page index
    const currentPageIndex = pageOrder.indexOf(currentPage);
    
    // Get all section elements for j/k navigation
    const sections = document.querySelectorAll('section[id], article, #about, #writings, #reading, #hobbies, #books, #papers');
    let currentSectionIndex = 0;
    
    // Add visual indicator for vim mode
    const vimIndicator = document.createElement('div');
    vimIndicator.id = 'vim-indicator';
    vimIndicator.textContent = '-- VIM MODE --';
    vimIndicator.style.position = 'fixed';
    vimIndicator.style.bottom = '20px';
    vimIndicator.style.right = '20px';
    vimIndicator.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    vimIndicator.style.color = 'white';
    vimIndicator.style.padding = '5px 10px';
    vimIndicator.style.borderRadius = '3px';
    vimIndicator.style.fontSize = '12px';
    vimIndicator.style.zIndex = '10000';
    vimIndicator.style.display = 'none';
    vimIndicator.style.pointerEvents = 'none';
    document.body.appendChild(vimIndicator);
    
    // Create search overlay
    const searchOverlay = document.createElement('div');
    searchOverlay.id = 'search-overlay';
    searchOverlay.innerHTML = `
        <div id="search-container">
            <input type="text" id="search-input" placeholder="Search...">
            <div id="search-results"></div>
        </div>
    `;
    searchOverlay.style.position = 'fixed';
    searchOverlay.style.top = '0';
    searchOverlay.style.left = '0';
    searchOverlay.style.width = '100%';
    searchOverlay.style.height = '100%';
    searchOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    searchOverlay.style.zIndex = '10001';
    searchOverlay.style.display = 'none';
    searchOverlay.style.justifyContent = 'center';
    searchOverlay.style.alignItems = 'flex-start';
    searchOverlay.style.paddingTop = '100px';
    document.body.appendChild(searchOverlay);
    
    const searchContainer = searchOverlay.querySelector('#search-container');
    searchContainer.style.backgroundColor = 'var(--bg-color)';
    searchContainer.style.padding = '15px';
    searchContainer.style.borderRadius = '8px';
    searchContainer.style.width = '90%';
    searchContainer.style.maxWidth = '400px';
    searchContainer.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.3)';
    
    const searchInput = searchOverlay.querySelector('#search-input');
    searchInput.style.width = '100%';
    searchInput.style.padding = '3px';
    searchInput.style.fontSize = '12px';
    searchInput.style.border = '1px solid var(--border-color)';
    searchInput.style.borderRadius = '4px';
    searchInput.style.backgroundColor = 'var(--container-bg)';
    searchInput.style.color = 'var(--text-color)';
    searchInput.style.fontFamily = "'Spectral', serif";
    searchInput.style.textAlign = 'center';
    
    const searchResults = searchOverlay.querySelector('#search-results');
    searchResults.style.maxHeight = '400px';
    searchResults.style.overflowY = 'auto';
    searchResults.style.marginTop = '15px';
    
    // Show vim mode indicator temporarily when a vim key is pressed
    let vimModeTimeout;
    
    function showVimIndicator() {
        vimIndicator.style.display = 'block';
        clearTimeout(vimModeTimeout);
        vimModeTimeout = setTimeout(() => {
            vimIndicator.style.display = 'none';
        }, 2000);
    }
    
    // Scroll to section
    function scrollToSection(index) {
        if (index >= 0 && index < sections.length && sections[index]) {
            sections[index].scrollIntoView({ behavior: 'smooth' });
            currentSectionIndex = index;
        }
    }
    
    // Navigate to next section
    function nextSection() {
        if (sections.length > 0 && currentSectionIndex < sections.length - 1) {
            scrollToSection(currentSectionIndex + 1);
        }
    }
    
    // Navigate to previous section
    function prevSection() {
        if (sections.length > 0 && currentSectionIndex > 0) {
            scrollToSection(currentSectionIndex - 1);
        }
    }
    
    // Navigate to previous page
    function prevPage() {
        if (currentPageIndex > 0) {
            window.location.href = pageOrder[currentPageIndex - 1];
        }
    }
    
    // Navigate to next page
    function nextPage() {
        if (currentPageIndex < pageOrder.length - 1 && currentPageIndex >= 0) {
            window.location.href = pageOrder[currentPageIndex + 1];
        }
    }
    
    // Open search
    function openSearch() {
        searchOverlay.style.display = 'flex';
        searchInput.value = '';
        searchResults.innerHTML = '';
        searchResultsNavigating = false;
        currentResultIndex = null;
        currentSearchResults = [];
        setTimeout(() => {
            searchInput.focus();
        }, 100);
    }
    
    // Close search
    function closeSearch() {
        searchOverlay.style.display = 'none';
        searchResultsNavigating = false;
        currentResultIndex = null;
        currentSearchResults = [];
    }
    
    // Perform search
    function performSearch(query) {
        if (!query.trim()) {
            searchResults.innerHTML = '';
            currentSearchResults = [];
            return;
        }
        
        // Get all text elements on the page
        const textElements = document.querySelectorAll('h1, h2, h3, p, li, a, .date, .command-text');
        const results = [];
        const seenElements = new Set(); // To deduplicate results based on elements
        
        textElements.forEach(element => {
            const text = element.textContent.toLowerCase();
            if (text.includes(query.toLowerCase())) {
                // Skip if we've already seen this element
                if (seenElements.has(element)) {
                    return;
                }
                seenElements.add(element);
                
                // Get the parent section or article
                let parent = element.closest('section, article');
                let parentTitle = '';
                if (parent) {
                    const header = parent.querySelector('h1, h2, h3');
                    parentTitle = header ? header.textContent : parent.id || 'Section';
                } else {
                    parentTitle = 'Page Content';
                }
                
                // Check if this element contains a link
                const hasLink = element.tagName === 'A' || element.querySelector('a');
                const linkElement = element.tagName === 'A' ? element : element.querySelector('a');
                
                results.push({
                    element: element,
                    text: element.textContent,
                    parentTitle: parentTitle,
                    section: parent,
                    hasLink: !!hasLink,
                    linkElement: linkElement,
                    priority: hasLink ? 1 : 2 // Links get higher priority (lower number)
                });
            }
        });
        
        // Sort results by priority (links first)
        results.sort((a, b) => a.priority - b.priority);
        
        // Further deduplication based on text content and parent section
        const uniqueResults = [];
        const seenCombinations = new Set();
        
        for (const result of results) {
            const combinationKey = `${result.text}|${result.parentTitle}`;
            if (!seenCombinations.has(combinationKey)) {
                seenCombinations.add(combinationKey);
                uniqueResults.push(result);
            }
        }
        
        // Display results
        currentSearchResults = uniqueResults;
        if (uniqueResults.length > 0) {
            searchResults.innerHTML = `<p style="margin: 0 0 10px 0; color: var(--secondary-text);">${uniqueResults.length} result${uniqueResults.length > 1 ? 's' : ''} found</p>`;
            uniqueResults.slice(0, 10).forEach(result => {
                const resultItem = document.createElement('div');
                resultItem.style.padding = '10px';
                resultItem.style.margin = '5px 0';
                resultItem.style.borderRadius = '4px';
                resultItem.style.cursor = 'pointer';
                resultItem.style.transition = 'background-color 0.2s';
                resultItem.style.borderBottom = '1px solid var(--border-color)';
                
                // Highlight matching text
                const regex = new RegExp(`(${query})`, 'gi');
                const highlightedText = result.text.replace(regex, '<mark style="background-color: var(--link-color); color: white;">$1</mark>');
                
                resultItem.innerHTML = `
                    <div style="font-weight: bold; margin-bottom: 4px; color: var(--header-color);">${result.parentTitle}</div>
                    <div>${highlightedText}</div>
                `;
                
                resultItem.addEventListener('click', () => {
                    const linkElement = result.element.tagName === 'A' ? result.element : result.element.querySelector('a');
                    if (linkElement) {
                        // If it's a link, open in current page
                        window.location.href = linkElement.href;
                    } else if (result.section) {
                        result.section.scrollIntoView({ behavior: 'smooth' });
                    } else {
                        result.element.scrollIntoView({ behavior: 'smooth' });
                    }
                    closeSearch();
                });
                
                resultItem.addEventListener('mouseenter', () => {
                    resultItem.style.backgroundColor = 'var(--border-color)';
                });
                
                resultItem.addEventListener('mouseleave', () => {
                    resultItem.style.backgroundColor = 'transparent';
                });
                
                searchResults.appendChild(resultItem);
            });
        } else {
            searchResults.innerHTML = '<p style="margin: 0; color: var(--secondary-text);">No results found</p>';
        }
    }
    
    // Reset search results when search changes
    searchInput.addEventListener('input', function() {
        performSearch(this.value);
        // Clear any highlighted results
        const highlightedItems = searchResults.querySelectorAll('div[style*="cursor: pointer"]');
        highlightedItems.forEach(item => {
            item.style.backgroundColor = '';
        });
        // Reset navigation state
        searchResultsNavigating = false;
        currentResultIndex = null;
    });
    
    // Handle keydown events
    document.addEventListener('keydown', function(event) {
        // Handle Escape key to close search
        if (event.key === 'Escape' && searchOverlay.style.display === 'flex') {
            closeSearch();
            event.preventDefault();
            return;
        }
        
        // Only handle vim keys when not in an input field (except when search is open and not navigating results)
        if ((event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.isContentEditable) && 
            event.target !== searchInput) {
            return;
        }
        
        // Handle search result navigation mode (after Enter is pressed in search)
        if (searchOverlay.style.display === 'flex' && searchResultsNavigating) {
            const resultItems = searchResults.querySelectorAll('div[style*="cursor: pointer"]');
            
            if (resultItems.length > 0) {
                if (event.key === 'j') {
                    // Move down in search results
                    if (typeof currentResultIndex === 'undefined' || currentResultIndex === null) {
                        currentResultIndex = 0;
                    } else {
                        // Remove highlight from current item
                        if (resultItems[currentResultIndex]) {
                            resultItems[currentResultIndex].style.backgroundColor = '';
                        }
                        currentResultIndex = (currentResultIndex + 1) % resultItems.length;
                    }
                    // Highlight new item
                    if (resultItems[currentResultIndex]) {
                        resultItems[currentResultIndex].style.backgroundColor = 'var(--border-color)';
                        resultItems[currentResultIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                    event.preventDefault();
                    return;
                } else if (event.key === 'k') {
                    // Move up in search results
                    if (typeof currentResultIndex === 'undefined' || currentResultIndex === null) {
                        currentResultIndex = resultItems.length - 1;
                    } else {
                        // Remove highlight from current item
                        if (resultItems[currentResultIndex]) {
                            resultItems[currentResultIndex].style.backgroundColor = '';
                        }
                        currentResultIndex = (currentResultIndex - 1 + resultItems.length) % resultItems.length;
                    }
                    // Highlight new item
                    if (resultItems[currentResultIndex]) {
                        resultItems[currentResultIndex].style.backgroundColor = 'var(--border-color)';
                        resultItems[currentResultIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                    event.preventDefault();
                    return;
                } else if (event.key === 'Enter') {
                    // Select highlighted result
                    if (typeof currentResultIndex !== 'undefined' && currentResultIndex !== null && resultItems[currentResultIndex]) {
                        const resultData = currentSearchResults.find(r => r.element === resultItems[currentResultIndex].element);
                        if (resultData && resultData.linkElement) {
                            // If it's a link, open in current page
                            window.location.href = resultData.linkElement.href;
                        } else {
                            // Otherwise, click the element to scroll to it
                            resultItems[currentResultIndex].click();
                        }
                        closeSearch();
                    } else if (resultItems[0]) {
                        // If no item is highlighted, select the first one
                        const resultData = currentSearchResults.find(r => r.element === resultItems[0].element);
                        if (resultData && resultData.linkElement) {
                            // If it's a link, open in current page
                            window.location.href = resultData.linkElement.href;
                        } else {
                            // Otherwise, click the element to scroll to it
                            resultItems[0].click();
                        }
                        closeSearch();
                    }
                    event.preventDefault();
                    return;
                }
                // Disable h and l during search result navigation
                else if (event.key === 'h' || event.key === 'l') {
                    event.preventDefault();
                    return;
                }
            }
        }
        
        // Handle Enter key in search to start navigation mode
        if (event.key === 'Enter' && searchOverlay.style.display === 'flex' && event.target === searchInput) {
            searchResultsNavigating = true;
            const resultItems = searchResults.querySelectorAll('div[style*="cursor: pointer"]');
            if (resultItems.length > 0) {
                currentResultIndex = 0;
                resultItems[0].style.backgroundColor = 'var(--border-color)';
                resultItems[0].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            event.preventDefault();
            return;
        }
        
        // Show vim indicator when any of the vim keys are pressed
        if (['h', 'j', 'k', 'l', '/'].includes(event.key)) {
            showVimIndicator();
        }
        
        // Handle normal navigation (when search is not open)
        if (searchOverlay.style.display !== 'flex') {
            switch (event.key) {
                case 'h':
                    // Navigate to previous page
                    prevPage();
                    break;
                case 'l':
                    // Navigate to next page
                    nextPage();
                    break;
                case 'j':
                    // Scroll to next section
                    nextSection();
                    event.preventDefault();
                    break;
                case 'k':
                    // Scroll to previous section
                    prevSection();
                    event.preventDefault();
                    break;
                case '/':
                    // Open search
                    openSearch();
                    event.preventDefault();
                    break;
            }
        }
    });
    
    // Initialize first section
    if (sections.length > 0) {
        currentSectionIndex = 0;
    }
});
