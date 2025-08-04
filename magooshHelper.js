// ==UserScript==
// @name         Magoosh GRE Vocab Helper (Universal)
// @namespace    http://tampermonkey.net/
// @version      15.1
// @description  Finds Bangla meanings. Works on multiple Magoosh UIs with Space/Alt/Ctrl/B/M/N shortcuts.
// @author       You & Gemini
// @match        https://gre.magoosh.com/flashcards/vocabulary*
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

    // --- STYLES ---
    GM_addStyle(`
        #vocab-helper-panel {
            position: fixed; top: 20px; right: 5px; width: 70%; max-width: 200px;
            background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1); padding: 0; z-index: 9999;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            overflow: hidden; display: none;
        }
        #vocab-helper-header {
            display: flex; justify-content: space-between; align-items: center;
            padding: 12px 16px; background-color: #f7f7f7; border-bottom: 1px solid #e0e0e0;
        }
        #vocab-helper-header h3 { margin: 0; font-size: 16px; font-weight: 600; }
        #vocab-helper-close { background: none; border: none; font-size: 22px; cursor: pointer; color: #888; }
        #vocab-helper-close:hover { color: #000; }
        #vocab-helper-content { padding: 16px; max-height: 75vh; overflow-y: auto; }
        #vocab-helper-content p { margin: 0 0 12px 0; font-size: 14px; line-height: 1.5; color: #555; }
        #vocab-helper-content strong { color: #000; font-weight: 600; }
        .pos-header { font-weight: bold; text-transform: capitalize; margin-bottom: 4px; font-size: 15px; color: #333; }
        .meaning-list { margin: 0 0 10px 20px; padding: 0; list-style-type: decimal; }
        hr { border: 0; border-top: 1px solid #eee; margin: 16px 0; }
    `);

    // --- PANEL AND STATE ---
    const panel = document.createElement('div');
    panel.id = 'vocab-helper-panel';
    document.body.appendChild(panel);
    let currentWord = '';

    // --- UNIVERSAL ELEMENT FINDERS (to support multiple Magoosh UIs) ---
    const getWord = () => document.querySelector('.card-front h1.h2, .flashcard-word');
    const getFlipElement = () => {
        // Try multiple selectors to find the flip button
        const selectors = [
            'a.card-footer[href*="#back"]',
            'a[data-loading-text*="definition"]',
            'a.card-footer:not(.card-footer-success):not(.card-footer-danger)',
            '.flashcard:not(.flipped)'
        ];

        for (let selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
                console.log('Found flip element with selector:', selector);
                return element;
            }
        }

        // Fallback: look for any link containing "meaning" text
        const links = document.querySelectorAll('a');
        for (let link of links) {
            if (link.textContent.toLowerCase().includes('meaning')) {
                console.log('Found flip element by text content:', link.textContent);
                return link;
            }
        }

        console.log('No flip element found');
        return null;
    };
    const getKnownButton = () => document.querySelector('a.card-footer-success, .flashcard-button--known');
    const getUnknownButton = () => document.querySelector('a.card-footer-danger, .flashcard-button--unknown');
    const isCardFlipped = () => document.querySelector('.flashcard.flipped, a.card-footer-success, .flashcard-button--known');

    // --- SCRAPING LOGIC ---
    async function getBanglaMeaning(word) {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: "GET",
                url: `https://www.google.com/search?q=${encodeURIComponent(word)}+define&hl=en`,
                onload: function(response) {
                    try {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(response.responseText, "text/html");
                        let meaningHtml = '';
                        const definitionBlocks = doc.querySelectorAll('div.VNOU7b');
                        definitionBlocks.forEach(block => {
                            const posElement = block.querySelector('.XGaHQb.YrbPuc');
                            if (!posElement) return;
                            const partOfSpeech = posElement.innerText.trim();
                            const meaningElements = block.querySelectorAll('span[lang="bn"]');
                            if (meaningElements.length === 0) return;
                            meaningHtml += `<div class="pos-header">${partOfSpeech}:</div><ol class="meaning-list">`;
                            meaningElements.forEach(span => { meaningHtml += `<li>${span.innerText.trim()}</li>`; });
                            meaningHtml += `</ol>`;
                        });
                        resolve(meaningHtml || null);
                    } catch (e) { resolve(null); }
                },
                onerror: () => resolve(null)
            });
        });
    }

    async function fetchAndDisplayInfo(word) {
        panel.innerHTML = `<div id="vocab-helper-header"><h3>Vocab Helper</h3><button id="vocab-helper-close">&times;</button></div><div id="vocab-helper-content"><p><strong>Word:</strong> ${word}</p><p>Searching for Bangla meaning...</p></div>`;
        panel.style.display = 'block';
        document.getElementById('vocab-helper-close').addEventListener('click', () => panel.style.display = 'none');

        const meaningHtml = await getBanglaMeaning(word);
        const contentDiv = panel.querySelector('#vocab-helper-content');

        if (meaningHtml) {
            contentDiv.innerHTML = `<p><strong>Word:</strong> ${word}</p><hr>${meaningHtml}`;
        } else {
            contentDiv.innerHTML = `<p><strong>Word:</strong> ${word}</p><hr><p>Could not find a Bangla meaning.</p>`;
        }
    }

    // --- KEYBOARD SHORTCUTS ---
    document.addEventListener('keydown', function(e) {
        // Prevent shortcuts when typing in input fields
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        // --- Space Key (existing functionality) ---


        // --- NEW SHORTCUTS ---

        // --- B Key: Click to see meaning (flip card) ---
        if (e.key.toLowerCase() === ' ') {
            e.preventDefault();
            console.log('Space key pressed');
            const flipElement = getFlipElement();
            console.log('Flip element found:', flipElement);
            if (flipElement) {
                console.log('Clicking flip element');
                flipElement.click();
            } else {
                console.log('No flip element found');
            }
        }

        // --- M Key: I knew this word ---
        if (e.key.toLowerCase() === 'b') {
            e.preventDefault();
            const knownButton = getKnownButton();
            if (knownButton) knownButton.click();
        }

        // --- N Key: I didn't know this word ---
        if (e.key.toLowerCase() === 'n') {
            e.preventDefault();
            const unknownButton = getUnknownButton();
            if (unknownButton) unknownButton.click();
        }
    });

    // --- OBSERVER TO DETECT CARD CHANGES ---
    const checkInterval = setInterval(() => {
        const targetNode = document.querySelector('#flashcard-container, .flashcard-container');
        if (targetNode) {
            clearInterval(checkInterval);

            const observer = new MutationObserver(() => {
                const wordElement = getWord();
                if (!wordElement) return;

                const newWord = wordElement.innerText.trim();

                // 1. If a new word is loaded, hide the panel and update the word state.
                if (newWord && newWord !== currentWord) {
                    currentWord = newWord;
                    panel.style.display = 'none';
                }

                // 2. If the card is flipped and the panel is hidden, show the panel.
                if (isCardFlipped() && panel.style.display === 'none') {
                    if (currentWord) { // Ensure we have a word to search for
                        fetchAndDisplayInfo(currentWord);
                    }
                }
            });

            observer.observe(targetNode, {
                childList: true,
                subtree: true,
                attributes: true, // Needed for class changes in some UIs
                attributeFilter: ['class']
            });
        }
    }, 500);

})();// ==UserScript==
// @name         Magoosh GRE Vocab Helper (Universal)
// @namespace    http://tampermonkey.net/
// @version      15.1
// @description  Finds Bangla meanings. Works on multiple Magoosh UIs with Space/Alt/Ctrl/B/M/N shortcuts.
// @author       You & Gemini
// @match        https://gre.magoosh.com/flashcards/vocabulary*
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

    // --- STYLES ---
    GM_addStyle(`
        #vocab-helper-panel {
            position: fixed; top: 20px; right: 5px; width: 70%; max-width: 200px;
            background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1); padding: 0; z-index: 9999;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            overflow: hidden; display: none;
        }
        #vocab-helper-header {
            display: flex; justify-content: space-between; align-items: center;
            padding: 12px 16px; background-color: #f7f7f7; border-bottom: 1px solid #e0e0e0;
        }
        #vocab-helper-header h3 { margin: 0; font-size: 16px; font-weight: 600; }
        #vocab-helper-close { background: none; border: none; font-size: 22px; cursor: pointer; color: #888; }
        #vocab-helper-close:hover { color: #000; }
        #vocab-helper-content { padding: 16px; max-height: 75vh; overflow-y: auto; }
        #vocab-helper-content p { margin: 0 0 12px 0; font-size: 14px; line-height: 1.5; color: #555; }
        #vocab-helper-content strong { color: #000; font-weight: 600; }
        .pos-header { font-weight: bold; text-transform: capitalize; margin-bottom: 4px; font-size: 15px; color: #333; }
        .meaning-list { margin: 0 0 10px 20px; padding: 0; list-style-type: decimal; }
        hr { border: 0; border-top: 1px solid #eee; margin: 16px 0; }
    `);

    // --- PANEL AND STATE ---
    const panel = document.createElement('div');
    panel.id = 'vocab-helper-panel';
    document.body.appendChild(panel);
    let currentWord = '';

    // --- UNIVERSAL ELEMENT FINDERS (to support multiple Magoosh UIs) ---
    const getWord = () => document.querySelector('.card-front h1.h2, .flashcard-word');
    const getFlipElement = () => {
        // Try multiple selectors to find the flip button
        const selectors = [
            'a.card-footer[href*="#back"]',
            'a[data-loading-text*="definition"]',
            'a.card-footer:not(.card-footer-success):not(.card-footer-danger)',
            '.flashcard:not(.flipped)'
        ];

        for (let selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
                console.log('Found flip element with selector:', selector);
                return element;
            }
        }

        // Fallback: look for any link containing "meaning" text
        const links = document.querySelectorAll('a');
        for (let link of links) {
            if (link.textContent.toLowerCase().includes('meaning')) {
                console.log('Found flip element by text content:', link.textContent);
                return link;
            }
        }

        console.log('No flip element found');
        return null;
    };
    const getKnownButton = () => document.querySelector('a.card-footer-success, .flashcard-button--known');
    const getUnknownButton = () => document.querySelector('a.card-footer-danger, .flashcard-button--unknown');
    const isCardFlipped = () => document.querySelector('.flashcard.flipped, a.card-footer-success, .flashcard-button--known');

    // --- SCRAPING LOGIC ---
    async function getBanglaMeaning(word) {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: "GET",
                url: `https://www.google.com/search?q=${encodeURIComponent(word)}+define&hl=en`,
                onload: function(response) {
                    try {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(response.responseText, "text/html");
                        let meaningHtml = '';
                        const definitionBlocks = doc.querySelectorAll('div.VNOU7b');
                        definitionBlocks.forEach(block => {
                            const posElement = block.querySelector('.XGaHQb.YrbPuc');
                            if (!posElement) return;
                            const partOfSpeech = posElement.innerText.trim();
                            const meaningElements = block.querySelectorAll('span[lang="bn"]');
                            if (meaningElements.length === 0) return;
                            meaningHtml += `<div class="pos-header">${partOfSpeech}:</div><ol class="meaning-list">`;
                            meaningElements.forEach(span => { meaningHtml += `<li>${span.innerText.trim()}</li>`; });
                            meaningHtml += `</ol>`;
                        });
                        resolve(meaningHtml || null);
                    } catch (e) { resolve(null); }
                },
                onerror: () => resolve(null)
            });
        });
    }

    async function fetchAndDisplayInfo(word) {
        panel.innerHTML = `<div id="vocab-helper-header"><h3>Vocab Helper</h3><button id="vocab-helper-close">&times;</button></div><div id="vocab-helper-content"><p><strong>Word:</strong> ${word}</p><p>Searching for Bangla meaning...</p></div>`;
        panel.style.display = 'block';
        document.getElementById('vocab-helper-close').addEventListener('click', () => panel.style.display = 'none');

        const meaningHtml = await getBanglaMeaning(word);
        const contentDiv = panel.querySelector('#vocab-helper-content');

        if (meaningHtml) {
            contentDiv.innerHTML = `<p><strong>Word:</strong> ${word}</p><hr>${meaningHtml}`;
        } else {
            contentDiv.innerHTML = `<p><strong>Word:</strong> ${word}</p><hr><p>Could not find a Bangla meaning.</p>`;
        }
    }

    // --- KEYBOARD SHORTCUTS ---
    document.addEventListener('keydown', function(e) {
        // Prevent shortcuts when typing in input fields
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        // --- Space Key (existing functionality) ---


        // --- NEW SHORTCUTS ---

        // --- B Key: Click to see meaning (flip card) ---
        if (e.key.toLowerCase() === ' ') {
            e.preventDefault();
            console.log('Space key pressed');
            const flipElement = getFlipElement();
            console.log('Flip element found:', flipElement);
            if (flipElement) {
                console.log('Clicking flip element');
                flipElement.click();
            } else {
                console.log('No flip element found');
            }
        }

        // --- M Key: I knew this word ---
        if (e.key.toLowerCase() === 'b') {
            e.preventDefault();
            const knownButton = getKnownButton();
            if (knownButton) knownButton.click();
        }

        // --- N Key: I didn't know this word ---
        if (e.key.toLowerCase() === 'n') {
            e.preventDefault();
            const unknownButton = getUnknownButton();
            if (unknownButton) unknownButton.click();
        }
    });

    // --- OBSERVER TO DETECT CARD CHANGES ---
    const checkInterval = setInterval(() => {
        const targetNode = document.querySelector('#flashcard-container, .flashcard-container');
        if (targetNode) {
            clearInterval(checkInterval);

            const observer = new MutationObserver(() => {
                const wordElement = getWord();
                if (!wordElement) return;

                const newWord = wordElement.innerText.trim();

                // 1. If a new word is loaded, hide the panel and update the word state.
                if (newWord && newWord !== currentWord) {
                    currentWord = newWord;
                    panel.style.display = 'none';
                }

                // 2. If the card is flipped and the panel is hidden, show the panel.
                if (isCardFlipped() && panel.style.display === 'none') {
                    if (currentWord) { // Ensure we have a word to search for
                        fetchAndDisplayInfo(currentWord);
                    }
                }
            });

            observer.observe(targetNode, {
                childList: true,
                subtree: true,
                attributes: true, // Needed for class changes in some UIs
                attributeFilter: ['class']
            });
        }
    }, 500);

})();
