// ==UserScript==
// @name         RateYourMusic Spotify Track ID Fetcher with Search
// @namespace    http://tampermonkey.net/
// @version      4.1
// @description  Fetch Spotify track IDs, search for missing tracks, and display progress
// @author       Saket
// @match        https://rateyourmusic.com/charts/*
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      accounts.spotify.com
// @connect      api.spotify.com
// ==/UserScript==
(async function() {
    'use strict';


    const clientId = 'CLIENT ID';
    const clientSecret = 'YOUR SECRET KEY';

    async function getAccessToken() {
        const tokenUrl = 'https://accounts.spotify.com/api/token';
        const auth = btoa(`${clientId}:${clientSecret}`);
        const token = GM_getValue('spotify_token');
        const tokenExpiry = GM_getValue('spotify_token_expiry');
        const now = new Date().getTime();

        if (token && tokenExpiry && now < tokenExpiry) {
            return token;
        }

        try {
            const response = await fetch(tokenUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({ grant_type: 'client_credentials' })
            });
            const data = await response.json();
            const newToken = data.access_token;
            const expiresIn = data.expires_in * 1000;
            GM_setValue('spotify_token', newToken);
            GM_setValue('spotify_token_expiry', now + expiresIn);
            return newToken;
        } catch (error) {
            console.error('Error fetching access token:', error);
            throw error;
        }
    }

    function sanitizeQuery(query) {
        return query.replace(/[^a-zA-Z\s]/g, ''); // Keep only alphabets and spaces
    }

    async function searchSpotify(query) {
        const accessToken = await getAccessToken();
        const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`;
        try {
            const response = await fetch(searchUrl, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            const data = await response.json();
            const track = data.tracks.items[0];
            if (track) {
                return track.external_urls.spotify;
            }
        } catch (error) {
            console.error('Error searching Spotify:', error);
        }
        return null;
    }

    async function extractTrackIDs() {
        let trackData = new Set();
        let failedSongs = '';
        const items = document.querySelectorAll('.page_charts_section_charts_item');
        const totalItems = items.length;
        let processedItems = 0;

        updateProgress(0, '', '');

        for (const item of items) {
            processedItems++;
            const titleElement = item.querySelector('.page_charts_section_charts_item_title a.song');
            const artistElement = item.querySelector('.page_charts_section_charts_item_credited_links_primary a.artist');

            if (!titleElement || !artistElement) continue;

            const title = titleElement.textContent.trim();
            const artist = artistElement.textContent.trim();
            const songInfo = `${title} - ${artist}`;

            updateProgress(Math.round((processedItems / totalItems) * 100), songInfo, '');

            let spotifyUrl = null;
            const spotifyData = item.querySelector('.page_charts_section_charts_item_media_links div[data-links]');

            if (spotifyData) {
                try {
                    const dataLinks = JSON.parse(spotifyData.getAttribute('data-links'));
                    if (dataLinks && dataLinks.spotify && Object.keys(dataLinks.spotify).length > 0) {
                        const spotifyTrackID = Object.keys(dataLinks.spotify)[0];
                        spotifyUrl = `https://open.spotify.com/track/${spotifyTrackID}`;
                    }
                } catch (error) {
                    console.log('Error parsing data-links:', error);
                }
            }

            if (!spotifyUrl) {
                const sanitizedQuery = sanitizeQuery(`${title} ${artist}`);
                spotifyUrl = await searchSpotify(sanitizedQuery);
            }

            if (spotifyUrl) {
                trackData.add(spotifyUrl); // Add URL to Set
            } else {
                failedSongs += `${songInfo}\n`;
            }
        }

        updateProgress(100, 'Completed', failedSongs);
        return Array.from(trackData).join('\n'); // Convert Set to string
    }

    function updateProgress(percentage, currentSong, failedSongs) {
        let progressBar = document.getElementById('spotifyProgressBar');
        if (!progressBar) {
            progressBar = document.createElement('div');
            progressBar.id = 'spotifyProgressBar';
            progressBar.style.position = 'fixed';
            progressBar.style.bottom = '10px';
            progressBar.style.left = '10px';
            progressBar.style.backgroundColor = '#1c1c1c';
            progressBar.style.color = '#ffffff';
            progressBar.style.padding = '15px';
            progressBar.style.borderRadius = '10px';
            progressBar.style.boxShadow = '0 4px 6px rgba(0,0,0,0.5)';
            progressBar.style.zIndex = '9999';
            progressBar.style.maxWidth = '300px';
            progressBar.style.overflowY = 'auto';
            document.body.appendChild(progressBar);
        }

        progressBar.innerHTML = `
            <div style="font-size: 16px; font-weight: bold;">Progress: ${percentage}%</div>
            <div style="margin-top: 5px;">Current Song: ${currentSong}</div>
            ${failedSongs ? `<div style="margin-top: 10px; color: #ff0000;">Failed Songs:<br>${failedSongs}</div>` : ''}
        `;
    }

    function createClipboardButton() {
        let existingButton = document.getElementById('copyTrackDataButton');
        if (existingButton) {
            existingButton.remove();
        }

        let clipboardButton = document.createElement('div');
        clipboardButton.id = 'copyTrackDataButton';
        clipboardButton.innerHTML = 'Copy Spotify URLs';
        clipboardButton.style.position = 'fixed';
        clipboardButton.style.bottom = '10px';
        clipboardButton.style.right = '10px';
        clipboardButton.style.fontSize = '16px';
        clipboardButton.style.cursor = 'pointer';
        clipboardButton.style.backgroundColor = '#007bff';
        clipboardButton.style.color = '#ffffff';
        clipboardButton.style.border = '1px solid #0056b3';
        clipboardButton.style.padding = '10px 15px';
        clipboardButton.style.borderRadius = '10px';
        clipboardButton.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
        clipboardButton.style.textAlign = 'center';
        clipboardButton.style.transition = 'background-color 0.3s, transform 0.3s';

        clipboardButton.onmouseover = () => {
            clipboardButton.style.backgroundColor = '#0056b3';
            clipboardButton.style.transform = 'scale(1.05)';
        };

        clipboardButton.onmouseout = () => {
            clipboardButton.style.backgroundColor = '#007bff';
            clipboardButton.style.transform = 'scale(1)';
        };

        clipboardButton.onclick = async () => {
            let trackData = await extractTrackIDs();
            if (trackData) {
                GM_setClipboard(trackData.trim());
                alert('Spotify URLs copied to clipboard.');
            } else {
                alert('No Spotify URLs available to copy.');
            }
        };

        document.body.appendChild(clipboardButton);
    }

    createClipboardButton();

    const observer = new MutationObserver(() => {
        if (location.href !== previousUrl) {
            previousUrl = location.href;
            createClipboardButton();
        }
    });

    let previousUrl = location.href;
    observer.observe(document, { subtree: true, childList: true });
})();

