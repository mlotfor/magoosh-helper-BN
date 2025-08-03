// ==UserScript==
// @name         Magoosh GRE Vocab Helper (Precise Scraping)
// @namespace    http://tampermonkey.net/
// @version      7.0
// @description  A precise scraper based on current Google HTML structure to find Bangla meanings.
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
            right: 20px;
            width: 320px;
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
        .pos-header { font-weight: bold; text-transform: capitalize; margin-bottom: 4px; }
        .meaning-list { margin: 0 0 10px 20px; padding: 0; list-style-type: decimal; }
    `);

    // --- PANEL SETUP ---
    const panel = document.createElement('div');
    panel.id = 'vocab-helper-panel';
    document.body.appendChild(panel);
    let lastWord = '';

    // --- PRECISE SCRAPING LOGIC ---
    async function getBanglaPrecisely(word) {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: "GET",
                url: `https://www.google.com/search?q=${encodeURIComponent(word)}+meaning+in+bangla`,
                onload: function(response) {
                    try {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(response.responseText, "text/html");

                        // Find all definition blocks based on the class you found: VNOU7b
                        const definitionBlocks = doc.querySelectorAll('div.VNOU7b');

                        if (definitionBlocks.length === 0) {
                            resolve(null); // No definition found
                            return;
                        }

                        let finalHtml = '';
                        definitionBlocks.forEach(block => {
                            // Get the part of speech (e.g., "noun", "verb")
                            const posElement = block.querySelector('.XGaHQb.YrbPuc');
                            if (!posElement) return;
                            const partOfSpeech = posElement.innerText.trim();

                            // Get all the Bangla meanings within this block
                            const meaningElements = block.querySelectorAll('span[lang="bn"]');
                            if (meaningElements.length === 0) return;

                            finalHtml += `<div class="pos-header">${partOfSpeech}:</div>`;
                            finalHtml += `<ol class="meaning-list">`;
                            meaningElements.forEach(span => {
                                finalHtml += `<li>${span.innerText.trim()}</li>`;
                            });
                            finalHtml += `</ol>`;
                        });

                        resolve(finalHtml || null); // Return the generated HTML or null if empty
                    } catch (e) {
                        resolve(null);
                    }
                },
                onerror: () => resolve(null)
            });
        });
    }

    async function fetchAndDisplayInfo(word) {
        if (word === lastWord) return;
        lastWord = word;

        panel.innerHTML = `<div id="vocab-helper-header"><h3>Vocab Helper</h3><button id="vocab-helper-close">&times;</button></div><div id="vocab-helper-content"><p><strong>Word:</strong> ${word}</p><p>Searching...</p></div>`;
        panel.style.display = 'block';
        document.getElementById('vocab-helper-close').addEventListener('click', () => panel.style.display = 'none');

        const meaningHtml = await getBanglaPrecisely(word);

        const contentDiv = panel.querySelector('#vocab-helper-content');
        if (meaningHtml) {
            contentDiv.innerHTML = `<p><strong>Word:</strong> ${word}</p><hr>${meaningHtml}`;
        } else {
            contentDiv.innerHTML = `<p><strong>Word:</strong> ${word}</p><p>Could not find a definition.</p>`;
        }
    }

    // --- OBSERVER TO START SCRIPT ---
    const checkInterval = setInterval(() => {
        const targetNode = document.querySelector('.flashcard-container');
        if (targetNode) {
            clearInterval(checkInterval);
            const observer = new MutationObserver(() => {
                const wordElement = document.querySelector('.flashcard-word');
                if (wordElement && wordElement.innerText.trim() !== lastWord) {
                    fetchAndDisplayInfo(wordElement.innerText.trim());
                }
            });
            observer.observe(targetNode, { childList: true, subtree: true });
        }
    }, 500);

})();
