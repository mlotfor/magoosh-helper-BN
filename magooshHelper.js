// ==UserScript==
// @name         Magoosh GRE Vocab Helper (Universal)
// @namespace    http://tampermonkey.net/
// @version      16.1
// @description  Finds Bangla meanings and US pronunciation. Use Space/B for next, N for unknown, and V to play audio.
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

    /**
     * Fetches the US pronunciation audio URL from Cambridge Dictionary.
     * @param {string} word The word to look up.
     * @returns {Promise<string|null>} A promise that resolves to the audio file URL or null if not found.
     */
    async function getUsPronunciation(word) {
        return new Promise((resolve) => {
            // Use GM_xmlhttpRequest to bypass CORS restrictions
            GM_xmlhttpRequest({
                method: "GET",
                // Construct the URL for the Cambridge Dictionary page for the given word
                url: `https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(word)}`,
                onload: function(response) {
                    try {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(response.responseText, "text/html");

                        // Create a selector to find the US pronunciation MP3 source.
                        // It looks for a <source> tag with type 'audio/mpeg' inside a <span> with class 'us'
                        const audioSourceElement = doc.querySelector('span.us source[type="audio/mpeg"]');

                        if (audioSourceElement) {
                            // The 'src' attribute on the site is relative (e.g., /media/english/us_pron/.../word.mp3)
                            const relativeUrl = audioSourceElement.getAttribute('src');
                            // Prepend the base URL to make it an absolute, playable URL
                            const fullUrl = `https://dictionary.cambridge.org${relativeUrl}`;
                            resolve(fullUrl);
                        } else {
                            // If the audio element is not found, resolve with null
                            resolve(null);
                        }
                    } catch (e) {
                        // In case of any parsing error, log it and resolve with null
                        console.error("Error parsing Cambridge Dictionary page:", e);
                        resolve(null);
                    }
                },
                onerror: (error) => {
                    // In case of a network error, log it and resolve with null
                    console.error("Error fetching from Cambridge Dictionary:", error);
                    resolve(null);
                }
            });
        });
    }


    async function fetchAndDisplayInfo(word) {
        // Update panel to show it's loading, now searching for multiple things
        panel.innerHTML = `<div id="vocab-helper-header"><h3>Vocab Helper</h3><button id="vocab-helper-close">&times;</button></div><div id="vocab-helper-content"><p><strong>Word:</strong> ${word}</p><p>Searching...</p></div>`;
        panel.style.display = 'block';
        document.getElementById('vocab-helper-close').addEventListener('click', () => panel.style.display = 'none');

        // Use Promise.all to fetch both the Bangla meaning and US pronunciation concurrently for speed.
        const [meaningHtml, audioUrl] = await Promise.all([
            getBanglaMeaning(word),
            getUsPronunciation(word)
        ]);

        const contentDiv = panel.querySelector('#vocab-helper-content');
        let finalHtml = `<p><strong>Word:</strong> ${word}</p>`;

        // Check if an audio URL was found
        if (audioUrl) {
            // If found, add an HTML5 audio player to the panel
            finalHtml += `<audio controls src="${audioUrl}" style="width: 100%; margin-bottom: 12px; margin-top: 8px;"></audio>`;
        }

        // Add a horizontal line to separate the audio player from the meanings
        finalHtml += `<hr>`;

        // Check if Bangla meaning HTML was found and add it
        if (meaningHtml) {
            finalHtml += meaningHtml;
        } else {
            // If not found, display a message
            finalHtml += `<p>Could not find a Bangla meaning.</p>`;
        }

        // Set the constructed HTML to the content div
        contentDiv.innerHTML = finalHtml;
    }


    // --- KEYBOARD SHORTCUTS ---
    document.addEventListener('keydown', function(e) {
        // Prevent shortcuts when typing in input fields
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        // --- B Key: Flip card first, then mark as known ---
        if (e.key === 'b') {
            e.preventDefault();
            console.log('B key pressed');
            if (isCardFlipped()) {
                // Card is flipped, mark as "I knew this word"
                const knownButton = getKnownButton();
                if (knownButton) {
                    console.log('B key: Marking as known');
                    knownButton.click();
                }
            } else {
                // Card not flipped, flip it first
                const flipElement = getFlipElement();
                if (flipElement) {
                    console.log('B key: Flipping card');
                    flipElement.click();
                }
            }
        }

        // --- Space Key: Click to see meaning (flip card) ---
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

        // --- N Key: I didn't know this word ---
        if (e.key.toLowerCase() === 'n') {
            e.preventDefault();
            console.log('N key pressed');
            const unknownButton = getUnknownButton();
            if (unknownButton) {
                console.log('Marking as unknown');
                unknownButton.click();
            } else {
                console.log('No unknown button found');
            }
        }

        // --- V Key: Play Pronunciation Audio ---
        if (e.key.toLowerCase() === 'v') {
            e.preventDefault();
            console.log('V key pressed');

            // Find the audio player inside our helper panel
            const audioPlayer = document.querySelector('#vocab-helper-content audio');

            // If the audio player exists and is visible, play the audio
            if (audioPlayer && panel.style.display !== 'none') {
                console.log('Playing audio...');
                audioPlayer.play();
            } else {
                console.log('No audio player found or panel is hidden.');
            }
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
