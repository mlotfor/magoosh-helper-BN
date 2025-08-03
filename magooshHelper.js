// ==UserScript==
// @name         Magoosh GRE Vocab Helper (On-Flip, Right 70%)
// @namespace    http://tampermonkey.net/
// @version      12.0
// @description  Finds Bangla meanings, showing them on card-flip. Panel is on the right with 70% width.
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
            position: fixed;
            top: 20px;
            /* MODIFIED: Panel moved back to the right side. */
            right: 20px;
            /* MODIFIED: Width set to 70% of the screen's width. */
            width: 70%;
            max-width: 900px; /* Added to prevent it from being too wide on large monitors */
            background-color: #ffffff;
            border: 1px solid #e0e0e0;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            padding: 0;
            z-index: 9999;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            overflow: hidden;
            display: none; /* Hidden by default */
        }
        #vocab-helper-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            background-color: #f7f7f7;
            border-bottom: 1px solid #e0e0e0;
        }
        #vocab-helper-header h3 { margin: 0; font-size: 16px; font-weight: 600; }
        #vocab-helper-close { background: none; border: none; font-size: 22px; cursor: pointer; color: #888; }
        #vocab-helper-close:hover { color: #000; }
        #vocab-helper-content { padding: 16px; max-height: 75vh; overflow-y: auto; }
        #vocab-helper-content p { margin: 0 0 12px 0; padding: 0; font-size: 14px; line-height: 1.5; color: #555; }
        #vocab-helper-content p:last-child { margin-bottom: 0; }
        #vocab-helper-content strong { color: #000; font-weight: 600; }
        .pos-header { font-weight: bold; text-transform: capitalize; margin-bottom: 4px; font-size: 15px; color: #333; }
        .meaning-list { margin: 0 0 10px 20px; padding: 0; list-style-type: decimal; }
        hr { border: 0; border-top: 1px solid #eee; margin: 16px 0; }
    `);

    // --- PANEL SETUP ---
    const panel = document.createElement('div');
    panel.id = 'vocab-helper-panel';
    document.body.appendChild(panel);
    let currentWord = '';

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

                            meaningHtml += `<div class="pos-header">${partOfSpeech}:</div>`;
                            meaningHtml += `<ol class="meaning-list">`;
                            meaningElements.forEach(span => {
                                meaningHtml += `<li>${span.innerText.trim()}</li>`;
                            });
                            meaningHtml += `</ol>`;
                        });
                        resolve(meaningHtml || null);
                    } catch (e) {
                        resolve(null);
                    }
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

    // --- OBSERVER TO START SCRIPT ---
    const checkInterval = setInterval(() => {
        const targetNode = document.querySelector('.flashcard-container');
        if (targetNode) {
            clearInterval(checkInterval);

            const observer = new MutationObserver(() => {
                const wordElement = document.querySelector('.flashcard-word');
                const flashcard = document.querySelector('.flashcard');

                if (!wordElement || !flashcard) return;

                const newWord = wordElement.innerText.trim();

                // 1. If a new word has loaded, update the state and hide the panel.
                if (newWord !== currentWord) {
                    currentWord = newWord;
                    panel.style.display = 'none';
                }

                // 2. If the card is flipped AND our panel is currently hidden, fetch the data.
                if (flashcard.classList.contains('flipped') && panel.style.display === 'none') {
                    fetchAndDisplayInfo(currentWord);
                }
            });

            // Observe the container for new cards (childList) and for class changes on cards (attributes).
            observer.observe(targetNode, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class']
            });
        }
    }, 500);

})();
