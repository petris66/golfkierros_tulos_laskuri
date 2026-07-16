"use strict";

        const STORAGE_KEY = "golfTuloslaskuriV2";
        const HISTORY_KEY = "golfTuloslaskuriHistory";
        const MAX_PLAYERS = 4;

        let playerCount = 1;
        let nextHole = 1;
        let roundComplete = false;
        let frontNineAnnounced = false;
        let pendingVoiceMessage = "";
        let announceStandings = false;
        let selectedScoreInput = null;
        let speechSynthesisPrimed = false;

        const tableBody = document.getElementById("tableBody");
        const voiceStatus = document.getElementById("voiceStatus");
        const voiceButton = document.getElementById("voiceButton");
        const nextHoleElement = document.getElementById("nextHole");
        const voiceExample = document.getElementById("voiceExample");
        const roundCompleteModal = document.getElementById("roundCompleteModal");
        const roundCompleteActions = document.getElementById("roundCompleteActions");
        const savedMessage = document.getElementById("savedMessage");
        const courseNameInput = document.getElementById("courseName");
        const roundDateInput = document.getElementById("roundDate");
        const gameFormatInput = document.getElementById("gameFormat");
        const roundNotesInput = document.getElementById("roundNotes");
        const recentCoursesList = document.getElementById("recentCourses");
        const historyCard = document.getElementById("historyCard");
        const historyList = document.getElementById("historyList");
        const historyCount = document.getElementById("historyCount");
        const deleteAllRoundsButton =
            document.getElementById("deleteAllRoundsButton");
        const announceStandingsInput =
            document.getElementById("announceStandings");

        function buildScoreTable() {
            tableBody.innerHTML = "";

            for (let hole = 1; hole <= 18; hole++) {
                const row = document.createElement("tr");
                row.dataset.holeRow = hole;

                row.innerHTML = `
                    <td class="hole-cell">${hole}</td>
                    ${buildPlayerCells(hole)}
                `;

                tableBody.appendChild(row);

                if (hole === 9) {
                    tableBody.appendChild(buildSubtotalRow("Etuysi", "front"));
                }

                if (hole === 18) {
                    tableBody.appendChild(buildSubtotalRow("Takaysi", "back"));
                }
            }

            document.querySelectorAll(".score-input").forEach(input => {
                input.addEventListener("focus", () => selectScoreInput(input));
                input.addEventListener("click", () => selectScoreInput(input));

                input.addEventListener("input", () => {
                    normalizeManualScoreInput(input);
                    calculateScores();
                    saveState();
                    checkFrontNineCompletion();
                });
            });
        }

        function buildPlayerCells(hole) {
            let html = "";

            for (let player = 1; player <= MAX_PLAYERS; player++) {
                html += `
                    <td class="player-column" data-player="${player}">
                        <input
                            type="text"
                            inputmode="numeric"
                            maxlength="2"
                            class="score-input p${player}"
                            data-hole="${hole}"
                            aria-label="Pelaaja ${player}, reikä ${hole}"
                        >
                    </td>
                `;
            }

            return html;
        }

        function buildSubtotalRow(label, prefix) {
            const row = document.createElement("tr");
            row.className = "subtotal";

            let cells = `<td>${label}</td>`;

            for (let player = 1; player <= MAX_PLAYERS; player++) {
                cells += `
                    <td
                        class="player-column"
                        data-player="${player}"
                        id="${prefix}${player}"
                    >
                        0
                    </td>
                `;
            }

            row.innerHTML = cells;
            return row;
        }

        function setPlayerCount(count) {
            playerCount = Math.min(Math.max(Number(count) || 1, 1), MAX_PLAYERS);

            document.querySelectorAll("#playerCountButtons button").forEach(button => {
                button.classList.toggle(
                    "active",
                    Number(button.dataset.count) === playerCount
                );
            });

            document.querySelectorAll(".player-column").forEach(column => {
                const player = Number(column.dataset.player);
                column.classList.toggle("hidden-player", player > playerCount);
            });

            updateVoiceExample();
            calculateScores();
            saveState();
        }

        function updateVoiceExample() {
            const examples = {
                1: "Esimerkki: <strong>yks viis</strong> tai <strong>yks viiva</strong>",
                2: "Esimerkki: <strong>yks viis neljä</strong> tai <strong>yks viis viiva</strong>",
                3: "Esimerkki: <strong>yks viis neljä kuus</strong>",
                4: "Esimerkki: <strong>yks viis neljä kuus viis</strong>"
            };

            voiceExample.innerHTML = examples[playerCount];
        }

        function selectScoreInput(input) {
            document.querySelectorAll(".score-input").forEach(item => {
                item.classList.remove("selected-score");
            });

            selectedScoreInput = input;
            selectedScoreInput.classList.add("selected-score");
        }

        function setDashForSelectedScore() {
            if (!selectedScoreInput) {
                voiceStatus.textContent =
                    "Valitse ensin pelaajan tulosruutu ja paina sitten viivapainiketta.";
                speakMessage("Valitse ensin tulosruutu");
                return;
            }

            selectedScoreInput.value = "-";
            calculateScores();
            saveState();
            checkFrontNineCompletion();

            const hole = selectedScoreInput.dataset.hole;
            const playerClass = [...selectedScoreInput.classList]
                .find(className => /^p[1-4]$/.test(className));
            const player = playerClass ? Number(playerClass.slice(1)) : 1;
            const playerName =
                document.getElementById(`name${player}`).value.trim() ||
                `P${player}`;

            voiceStatus.innerHTML =
                `<strong>Viiva merkitty ✅</strong><br>` +
                `Reikä ${hole}, ${escapeHtml(playerName)}`;

            speakMessage(`Viiva merkitty reiälle ${hole}`);
        }

        function normalizeScoreValue(value) {
            const cleaned = String(value || "").trim().toLowerCase();

            if (cleaned === "-" || cleaned === "–" || cleaned === "—" || cleaned === "x") {
                return "-";
            }

            const number = Number(cleaned);

            if (Number.isFinite(number) && number >= 1 && number <= 20) {
                return number;
            }

            return "";
        }

        function normalizeManualScoreInput(input) {
            const normalized = normalizeScoreValue(input.value);

            if (normalized === "-") {
                input.value = "-";
            } else if (normalized === "") {
                input.value = "";
            } else {
                input.value = String(normalized);
            }
        }

        function calculateNineResult(player, startHole, endHole) {
            let total = 0;
            let dnf = false;

            document.querySelectorAll(`.p${player}`).forEach(input => {
                const hole = Number(input.dataset.hole);

                if (hole < startHole || hole > endHole) {
                    return;
                }

                const value = normalizeScoreValue(input.value);

                if (value === "-") {
                    dnf = true;
                } else if (typeof value === "number") {
                    total += value;
                }
            });

            return { total, dnf };
        }

        function calculateScores() {
            for (let player = 1; player <= MAX_PLAYERS; player++) {
                const front = calculateNineResult(player, 1, 9);
                const back = calculateNineResult(player, 10, 18);
                const totalDnf = front.dnf || back.dnf;

                document.getElementById(`front${player}`).textContent =
                    front.dnf ? "DNF" : front.total;

                document.getElementById(`back${player}`).textContent =
                    back.dnf ? "DNF" : back.total;

                document.getElementById(`sum${player}`).textContent =
                    totalDnf ? "DNF" : front.total + back.total;
            }
        }

        function normalizeText(text) {
            return text
                .toLowerCase()
                .replace(/[.,:;!?]/g, " ")
                .replace(/[–—−-]/g, " viiva ")
                .replace(/\s+/g, " ")
                .trim();
        }

        function wordToNumber(value) {
            const numbers = {
                "yksi": 1,
                "yks": 1,
                "kaksi": 2,
                "kaks": 2,
                "kolme": 3,
                "kolm": 3,
                "neljä": 4,
                "nelja": 4,
                "nelkku": 4,
                "viisi": 5,
                "viis": 5,
                "kuusi": 6,
                "kuus": 6,
                "seitsemän": 7,
                "seitseman": 7,
                "seiska": 7,
                "kahdeksan": 8,
                "kahdeks": 8,
                "kasi": 8,
                "yhdeksän": 9,
                "yhdeksan": 9,
                "ysi": 9,
                "kymmenen": 10,
                "kymppi": 10,
                "yksitoista": 11,
                "kaksitoista": 12,
                "kolmetoista": 13,
                "neljätoista": 14,
                "neljatoista": 14,
                "viisitoista": 15,
                "kuusitoista": 16,
                "seitsemäntoista": 17,
                "seitsemantoista": 17,
                "kahdeksantoista": 18,
                "yhdeksäntoista": 19,
                "yhdeksantoista": 19,
                "kaksikymmentä": 20,
                "kaksikymmenta": 20
            };

            if (/^\d+$/.test(value)) {
                return Number(value);
            }

            return numbers[value] ?? null;
        }

        function decodeCompactDigits(digits) {
            const digitArray = digits.split("").map(Number);

            if (digits.length === playerCount) {
                return digitArray;
            }

            if (digits.length === playerCount + 1) {
                const hole = Number(digits.slice(0, 1));
                const scores = digits.slice(1).split("").map(Number);

                if (hole >= 1 && hole <= 9) {
                    return [hole, ...scores];
                }
            }

            if (digits.length === playerCount + 2) {
                const hole = Number(digits.slice(0, 2));
                const scores = digits.slice(2).split("").map(Number);

                if (hole >= 10 && hole <= 18) {
                    return [hole, ...scores];
                }
            }

            return [Number(digits)];
        }

        function isDashWord(word) {
            const normalized = String(word || "")
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z]/g, "");

            const accepted = new Set([
                "viiva",
                "viivan",
                "viivaa",
                "viivaan",
                "viivaksi",
                "viivat",
                "viva",
                "viia",
                "viiiva",
                "viivaus",
                "miinus",
                "miinusta",
                "rasti"
            ]);

            return (
                accepted.has(normalized) ||
                normalized.startsWith("viiv")
            );
        }

        function extractVoiceTokens(spokenText) {
            const words = normalizeText(spokenText).split(" ");
            const tokens = [];

            words.forEach(word => {
                if (isDashWord(word)) {
                    tokens.push("-");
                    return;
                }

                const number = wordToNumber(word);

                if (number !== null) {
                    tokens.push({
                        raw: word,
                        number,
                        isDigits: /^\d+$/.test(word)
                    });
                }
            });

            if (
                tokens.length === 1 &&
                typeof tokens[0] === "object" &&
                tokens[0].isDigits &&
                tokens[0].raw.length >= 2
            ) {
                return decodeCompactDigits(tokens[0].raw);
            }

            if (
                tokens.length === 2 &&
                typeof tokens[0] === "object" &&
                tokens[0].number >= 1 &&
                tokens[0].number <= 18 &&
                typeof tokens[1] === "object" &&
                tokens[1].isDigits &&
                tokens[1].raw.length === playerCount
            ) {
                return [
                    tokens[0].number,
                    ...tokens[1].raw.split("").map(Number)
                ];
            }

            const mappedTokens = tokens.map(token =>
                token === "-" ? "-" : token.number
            );

            if (mappedTokens.length === 0) {
                const raw = String(spokenText || "").toLowerCase();

                if (
                    raw.includes("viiva") ||
                    raw.includes("viva") ||
                    /[–—−-]/.test(raw)
                ) {
                    return ["-"];
                }
            }

            return mappedTokens;
        }

        function parseVoiceResults(spokenText) {
            const tokens = extractVoiceTokens(spokenText);

            if (tokens.length === 0) {
                throw new Error("Tuloksia ei tunnistettu.");
            }

            const expectedWithHole = playerCount + 1;
            const expectedWithoutHole = playerCount;

            let hole;
            let scores;

            if (tokens.length === expectedWithHole && typeof tokens[0] === "number") {
                hole = tokens[0];
                scores = tokens.slice(1);
            } else if (tokens.length === expectedWithoutHole) {
                hole = nextHole;
                scores = tokens;
            } else if (tokens.length < expectedWithoutHole) {
                throw new Error("Tuloksia puuttuu.");
            } else if (tokens.length > expectedWithHole) {
                throw new Error("Liikaa tuloksia.");
            } else {
                throw new Error(
                    `Sano ${playerCount} tulosta tai reiän numero ja ${playerCount} tulosta.`
                );
            }

            if (hole < 1 || hole > 18) {
                throw new Error("Reiän numeron pitää olla 1–18.");
            }

            if (scores.length !== playerCount) {
                throw new Error("Tulosten määrä ei vastaa pelaajien määrää.");
            }

            scores.forEach(score => {
                if (score === "-") {
                    return;
                }

                if (typeof score !== "number" || score < 1 || score > 20) {
                    throw new Error("Tuloksen pitää olla 1–20 tai viiva.");
                }
            });

            const addedScores = [];

            scores.forEach((score, index) => {
                const player = index + 1;
                const input = document.querySelector(
                    `.p${player}[data-hole="${hole}"]`
                );

                if (!input) {
                    return;
                }

                input.value = score === "-" ? "-" : String(score);

                const playerName =
                    document.getElementById(`name${player}`).value.trim() ||
                    `P${player}`;

                addedScores.push(
                    `${playerName}: ${score === "-" ? "viiva" : score}`
                );
            });

            calculateScores();

            if (hole < 18) {
                nextHole = hole + 1;
            } else {
                nextHole = 18;
                roundComplete = true;
            }

            updateNextHole();
            updateRoundCompleteState();
            saveState();

            return {
                hole,
                addedScores
            };
        }


        function getPlayedHoleCount() {
            let lastPlayedHole = 0;

            for (let hole = 1; hole <= 18; hole++) {
                let complete = true;

                for (let player = 1; player <= playerCount; player++) {
                    const input = document.querySelector(
                        `.p${player}[data-hole="${hole}"]`
                    );

                    if (!input || input.value === "") {
                        complete = false;
                        break;
                    }
                }

                if (complete) {
                    lastPlayedHole = hole;
                } else {
                    break;
                }
            }

            return lastPlayedHole;
        }

        function getStandingsData() {
            const playedHoles = getPlayedHoleCount();
            const activePlayers = [];
            const dnfPlayers = [];

            for (let player = 1; player <= playerCount; player++) {
                const name =
                    document.getElementById(`name${player}`).value.trim() ||
                    `P${player}`;

                let total = 0;
                let dnf = false;

                for (let hole = 1; hole <= playedHoles; hole++) {
                    const input = document.querySelector(
                        `.p${player}[data-hole="${hole}"]`
                    );
                    const value = normalizeScoreValue(input?.value);

                    if (value === "-") {
                        dnf = true;
                        break;
                    }

                    if (typeof value === "number") {
                        total += value;
                    }
                }

                if (dnf) {
                    dnfPlayers.push({ name });
                } else {
                    activePlayers.push({ name, total });
                }
            }

            activePlayers.sort((a, b) => a.total - b.total);

            return {
                playedHoles,
                activePlayers,
                dnfPlayers
            };
        }

        function differenceInFinnishAdessive(number) {
            const words = {
                1: "yhdellä",
                2: "kahdella",
                3: "kolmella",
                4: "neljällä",
                5: "viidellä",
                6: "kuudella",
                7: "seitsemällä",
                8: "kahdeksalla",
                9: "yhdeksällä",
                10: "kymmenellä"
            };

            return words[number] || `${number}:llä`;
        }

        function buildStandingsMessage() {
            const { playedHoles, activePlayers, dnfPlayers } = getStandingsData();

            if (playedHoles === 0 || playerCount < 2) {
                return "";
            }

            const parts = [];

            if (activePlayers.length === 0) {
                parts.push("Kenelläkään ei ole enää lyöntipelitulosta.");
            } else {
                const bestScore = activePlayers[0].total;
                const leaders = activePlayers.filter(
                    player => player.total === bestScore
                );
                const followers = activePlayers.filter(
                    player => player.total > bestScore
                );

                if (leaders.length === activePlayers.length) {
                    parts.push("Kaikki pelaajat ovat tasoissa.");
                } else if (leaders.length > 1) {
                    parts.push(
                        `${leaders.map(player => player.name).join(" ja ")} ovat tasoissa johdossa.`
                    );

                    if (followers.length > 0) {
                        const followerText = followers.map(player => {
                            const difference = player.total - bestScore;
                            const differenceText = {
                                1: "yhden",
                                2: "kahden",
                                3: "kolmen",
                                4: "neljän",
                                5: "viiden",
                                6: "kuuden",
                                7: "seitsemän",
                                8: "kahdeksan",
                                9: "yhdeksän",
                                10: "kymmenen"
                            }[difference] || String(difference);

                            return `${player.name} on ${differenceText} ${difference === 1 ? "lyönnin" : "lyöntiä"} perässä`;
                        }).join(". ");

                        parts.push(followerText + ".");
                    }
                } else {
                    const leader = leaders[0];
                    const comparison = followers.map(player => {
                        const difference = player.total - leader.total;
                        return `${player.name}a ${differenceInFinnishAdessive(difference)} lyönnillä`;
                    });

                    if (comparison.length === 1) {
                        parts.push(
                            `${leader.name} johtaa ${comparison[0]}.`
                        );
                    } else {
                        const last = comparison.pop();
                        parts.push(
                            `${leader.name} johtaa ${comparison.join(", ")} ja ${last}.`
                        );
                    }
                }
            }

            dnfPlayers.forEach(player => {
                parts.push(
                    `${player.name}lla ei ole enää lyöntipelitulosta.`
                );
            });

            return parts.join(" ");
        }

        function primeSpeechSynthesis() {
            if (
                speechSynthesisPrimed ||
                !("speechSynthesis" in window)
            ) {
                return;
            }

            try {
                const silentMessage =
                    new SpeechSynthesisUtterance("\u00A0");

                silentMessage.lang = "fi-FI";
                silentMessage.volume = 0;
                silentMessage.rate = 1;

                window.speechSynthesis.speak(silentMessage);
                speechSynthesisPrimed = true;
            } catch (error) {
                console.log("Äänikanavan alustaminen epäonnistui:", error);
            }
        }

        function showSavedHoleInScorecard(hole) {
            const row = document.querySelector(
                `[data-hole-row="${hole}"]`
            );

            if (!row) {
                return;
            }

            row.classList.add("recently-saved");

            setTimeout(() => {
                row.classList.remove("recently-saved");
            }, 2200);

            requestAnimationFrame(() => {
                row.scrollIntoView({
                    behavior: "smooth",
                    block: "center"
                });
            });
        }

        function startVoiceInput() {
            primeSpeechSynthesis();

            if (roundComplete) {
                voiceStatus.textContent =
                    "Kierros on valmis. Tarkista tai tallenna kierros ennen uutta kirjausta.";
                speakMessage("Kierros on valmis");
                showRoundCompleteModal();
                return;
            }

            const SpeechRecognition =
                window.SpeechRecognition ||
                window.webkitSpeechRecognition;

            if (!SpeechRecognition) {
                voiceStatus.textContent =
                    "Tämä selain ei tue puheentunnistusta.";
                return;
            }

            const recognition = new SpeechRecognition();

            recognition.lang = "fi-FI";
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.maxAlternatives = 5;

            recognition.onstart = function() {
                voiceButton.classList.add("listening");
                voiceButton.textContent = "🎤 Kuuntelen…";
                voiceStatus.textContent = "Sano reiän numero ja tulokset.";
            };

            recognition.onspeechstart = function() {
                voiceStatus.textContent = "🎤 Kuulen puhetta…";
            };

            recognition.onresult = function(event) {
                const alternatives = event.results[0];
                let successfulResult = null;
                let heardText = alternatives[0].transcript;
                let lastError = new Error("Puhetta ei voitu käsitellä.");

                for (let i = 0; i < alternatives.length; i++) {
                    try {
                        successfulResult = parseVoiceResults(
                            alternatives[i].transcript
                        );
                        heardText = alternatives[i].transcript;
                        break;
                    } catch (error) {
                        lastError = error;
                    }
                }

                if (successfulResult) {
                    voiceStatus.innerHTML =
                        `<strong>Kuulin:</strong> ${escapeHtml(heardText)}<br>` +
                        `<strong>Reikä ${successfulResult.hole} tallennettu ✅</strong><br>` +
                        successfulResult.addedScores.join(", ");

                    showSavedHoleInScorecard(
                        successfulResult.hole
                    );

                    pendingVoiceMessage =
                        `Reikä ${successfulResult.hole} tallennettu`;

                    if (announceStandings) {
                        const standingsMessage = buildStandingsMessage();

                        if (standingsMessage) {
                            pendingVoiceMessage += `. ${standingsMessage}`;
                        }
                    }

                    checkFrontNineCompletion();

                    if (successfulResult.hole === 18) {
                        setTimeout(showRoundCompleteModal, 450);
                    }
                } else {
                    voiceStatus.innerHTML =
                        `<strong>Kuulin:</strong> ${escapeHtml(heardText)}<br>` +
                        `<strong>Virhe:</strong> ${escapeHtml(lastError.message)}`;

                    speakMessage(lastError.message);
                }
            };

            recognition.onerror = function(event) {
                const messages = {
                    "no-speech": "Puhetta ei kuulunut.",
                    "not-allowed": "Mikrofonin käyttöä ei sallittu.",
                    "audio-capture": "Mikrofonia ei löytynyt.",
                    "network": "Puheentunnistuksen verkkovirhe."
                };

                const message =
                    messages[event.error] || "Puheentunnistus epäonnistui.";

                voiceStatus.textContent = message;
                speakMessage(message);
            };

            recognition.onend = function() {
                voiceButton.classList.remove("listening");
                voiceButton.textContent = "🎤 Anna tulokset puheella";

                if (pendingVoiceMessage) {
                    const message = pendingVoiceMessage;
                    pendingVoiceMessage = "";

                    speakMessage(message);
                }
            };

            recognition.start();
        }

        function speakConfirmation(hole) {
            speakMessage(`Reikä ${hole} tallennettu`);
        }

        function speakMessage(text) {
            if (!("speechSynthesis" in window) || !text) {
                return;
            }

            const speak = () => {
                try {
                    window.speechSynthesis.cancel();
                    window.speechSynthesis.resume();

                    const message =
                        new SpeechSynthesisUtterance(text);

                    message.lang = "fi-FI";
                    message.rate = 0.9;
                    message.pitch = 1;
                    message.volume = 1;

                    window.speechSynthesis.speak(message);

                    // iOS saattaa joskus jäädyttää puhesynteesin PWA-tilassa.
                    setTimeout(() => {
                        if (window.speechSynthesis.paused) {
                            window.speechSynthesis.resume();
                        }
                    }, 250);
                } catch (error) {
                    console.log("Äänikuittaus epäonnistui:", error);
                }
            };

            // Annetaan mikrofonikanavan vapautua ennen kuittausta.
            setTimeout(speak, 850);
        }

        function updateNextHole() {
            nextHoleElement.textContent = nextHole;
        }

        function escapeHtml(text) {
            return String(text)
                .replaceAll("&", "&amp;")
                .replaceAll("<", "&lt;")
                .replaceAll(">", "&gt;")
                .replaceAll('"', "&quot;")
                .replaceAll("'", "&#039;");
        }

        function saveState() {
            const state = {
                playerCount,
                nextHole,
                roundComplete,
                frontNineAnnounced,
                announceStandings,
                names: [],
                scores: {}
            };

            for (let player = 1; player <= MAX_PLAYERS; player++) {
                state.names.push(
                    document.getElementById(`name${player}`).value
                );

                state.scores[player] = [];

                document.querySelectorAll(`.p${player}`).forEach(input => {
                    state.scores[player].push(input.value);
                });
            }

            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        }

        function loadState() {
            const raw = localStorage.getItem(STORAGE_KEY);

            if (!raw) {
                setPlayerCount(1);
                updateNextHole();
                return;
            }

            try {
                const state = JSON.parse(raw);

                playerCount = Number(state.playerCount) || 1;
                nextHole = Number(state.nextHole) || 1;
                roundComplete = Boolean(state.roundComplete);
                frontNineAnnounced = Boolean(state.frontNineAnnounced);
                announceStandings = Boolean(state.announceStandings);
                announceStandingsInput.checked = announceStandings;

                for (let player = 1; player <= MAX_PLAYERS; player++) {
                    const name = state.names?.[player - 1];

                    if (typeof name === "string") {
                        const nameInput =
                            document.getElementById(`name${player}`);

                        nameInput.value =
                            /^P[1-4]$/i.test(name.trim()) ? "" : name;
                    }

                    const scores = state.scores?.[player] || [];

                    document.querySelectorAll(`.p${player}`).forEach((input, index) => {
                        input.value = scores[index] || "";
                    });
                }

                setPlayerCount(playerCount);
                updateNextHole();
                calculateScores();
                updateRoundCompleteState();
            } catch (error) {
                localStorage.removeItem(STORAGE_KEY);
                setPlayerCount(1);
                updateNextHole();
            }
        }




        function isFrontNineComplete() {
            for (let player = 1; player <= playerCount; player++) {
                for (let hole = 1; hole <= 9; hole++) {
                    const input = document.querySelector(
                        `.p${player}[data-hole="${hole}"]`
                    );

                    if (!input || input.value === "") {
                        return false;
                    }
                }
            }

            return true;
        }

        function getFrontNineSummary() {
            const parts = [];

            for (let player = 1; player <= playerCount; player++) {
                const name =
                    document.getElementById(`name${player}`).value.trim() ||
                    `P${player}`;

                const total =
                    Number(document.getElementById(`front${player}`).textContent) || 0;

                parts.push(`${name} ${total}`);
            }

            return parts;
        }

        function checkFrontNineCompletion() {
            if (frontNineAnnounced || !isFrontNineComplete()) {
                return;
            }

            frontNineAnnounced = true;
            saveState();

            const summary = getFrontNineSummary();

            voiceStatus.innerHTML =
                "<strong>Etuysi pelattu ✅</strong><br>" +
                summary.map(escapeHtml).join(", ");

            speakMessage(
                "Etuysi pelattu. " +
                summary.join(", ")
            );

            const holeTenRow = document.querySelector('[data-hole-row="10"]');

            if (holeTenRow) {
                setTimeout(() => {
                    holeTenRow.scrollIntoView({
                        behavior: "smooth",
                        block: "start"
                    });
                }, 900);
            }
        }

        function updateRoundCompleteState() {
            voiceButton.disabled = roundComplete;
            voiceButton.textContent = roundComplete
                ? "Kierros valmis"
                : "🎤 Anna tulokset puheella";

            roundCompleteActions.classList.toggle("visible", roundComplete);
        }

        function showRoundCompleteModal() {
            savedMessage.textContent = "";
            prepareRoundMetadataForm();
            roundCompleteModal.classList.add("visible");
        }

        function hideRoundCompleteModal() {
            roundCompleteModal.classList.remove("visible");
        }

        function reviewCompletedRound() {
            hideRoundCompleteModal();

            voiceStatus.innerHTML =
                "<strong>Kierros valmis.</strong> Tarkista tulokset taulukosta ja korjaa tarvittaessa. " +
                "Tallenna sen jälkeen painikkeella “Tallenna tarkistettu kierros”.";

            document.querySelector("table").scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }

        function buildRoundSnapshot() {
            const snapshot = {
                id: crypto.randomUUID
                    ? crypto.randomUUID()
                    : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                savedAt: new Date().toISOString(),
                course: courseNameInput.value.trim() || "Kenttä nimeämättä",
                date: roundDateInput.value || getTodayDateValue(),
                gameFormat: gameFormatInput.value,
                notes: roundNotesInput.value.trim(),
                playerCount,
                names: [],
                scores: {},
                totals: {}
            };

            for (let player = 1; player <= playerCount; player++) {
                const name =
                    document.getElementById(`name${player}`).value.trim() ||
                    `P${player}`;

                snapshot.names.push(name);
                snapshot.scores[player] = [];

                document.querySelectorAll(`.p${player}`).forEach(input => {
                    snapshot.scores[player].push(Number(input.value) || 0);
                });

                const totalText =
                    document.getElementById(`sum${player}`).textContent;

                snapshot.totals[player] =
                    totalText === "DNF" ? "DNF" : Number(totalText) || 0;
            }

            return snapshot;
        }

        function saveCompletedRound() {
            const snapshot = buildRoundSnapshot();
            const history = getRoundHistory();

            history.unshift(snapshot);
            localStorage.setItem(HISTORY_KEY, JSON.stringify(history));

            rememberCourse(snapshot.course);
            hideRoundCompleteModal();
            renderHistory();

            voiceStatus.innerHTML =
                `<strong>Kierros tallennettu ✅</strong><br>` +
                `${escapeHtml(snapshot.course)}, ${formatDate(snapshot.date)}<br>` +
                snapshot.names
                    .map((name, index) =>
                        `${escapeHtml(name)}: ${snapshot.totals[index + 1]}`
                    )
                    .join(", ");

            speakMessage("Kierros tallennettu");
        }

        function getTodayDateValue() {
            const now = new Date();
            const local = new Date(
                now.getTime() - now.getTimezoneOffset() * 60000
            );

            return local.toISOString().slice(0, 10);
        }

        function prepareRoundMetadataForm() {
            if (!roundDateInput.value) {
                roundDateInput.value = getTodayDateValue();
            }

            updateRecentCoursesList();
        }

        function getRecentCourses() {
            try {
                return JSON.parse(
                    localStorage.getItem("golfRecentCourses") || "[]"
                );
            } catch (error) {
                return [];
            }
        }

        function rememberCourse(course) {
            if (!course || course === "Kenttä nimeämättä") {
                return;
            }

            const courses = getRecentCourses()
                .filter(item => item.toLowerCase() !== course.toLowerCase());

            courses.unshift(course);
            localStorage.setItem(
                "golfRecentCourses",
                JSON.stringify(courses.slice(0, 10))
            );

            updateRecentCoursesList();
        }

        function updateRecentCoursesList() {
            recentCoursesList.innerHTML = "";

            getRecentCourses().forEach(course => {
                const option = document.createElement("option");
                option.value = course;
                recentCoursesList.appendChild(option);
            });
        }

        function getRoundHistory() {
            try {
                const history = JSON.parse(
                    localStorage.getItem(HISTORY_KEY) || "[]"
                );

                let changed = false;

                history.forEach((round, index) => {
                    if (!round.id) {
                        round.id =
                            `legacy-${round.savedAt || round.date || "round"}-${index}`;
                        changed = true;
                    }
                });

                if (changed) {
                    localStorage.setItem(
                        HISTORY_KEY,
                        JSON.stringify(history)
                    );
                }

                return history;
            } catch (error) {
                return [];
            }
        }

        function formatDate(dateValue) {
            if (!dateValue) {
                return "";
            }

            const [year, month, day] = dateValue.split("-");
            return `${day}.${month}.${year}`;
        }

        function toggleHistory() {
            historyCard.classList.toggle("visible");

            if (historyCard.classList.contains("visible")) {
                renderHistory();
                historyCard.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
            }
        }

        function renderHistory() {
            const history = getRoundHistory();

            historyList.innerHTML = "";
            historyCount.textContent =
                `Tallennettuja kierroksia: ${history.length}`;
            deleteAllRoundsButton.style.display =
                history.length > 0 ? "block" : "none";

            if (history.length === 0) {
                historyList.innerHTML =
                    '<div class="history-empty">Tallennettuja kierroksia ei vielä ole.</div>';
                return;
            }

            history.forEach(round => {
                const item = document.createElement("article");
                item.className = "history-item";

                const totals = round.names
                    .map((name, index) =>
                        `${escapeHtml(name)}: ${round.totals[index + 1]}`
                    )
                    .join(", ");

                item.innerHTML = `
                    <h3>${escapeHtml(round.course || "Kenttä nimeämättä")}</h3>
                    <div class="history-meta">
                        ${formatDate(round.date)} · ${escapeHtml(round.gameFormat || "")}
                    </div>
                    <div class="history-totals">${totals}</div>
                    ${round.notes
                        ? `<div class="history-meta">${escapeHtml(round.notes)}</div>`
                        : ""}
                    <div class="history-actions">
                        <button
                            type="button"
                            class="small-button"
                            onclick="shareRound('${escapeHtml(round.id)}')"
                        >
                            Jaa tuloskortti
                        </button>
                        <button
                            type="button"
                            class="small-button danger-button"
                            onclick="deleteRound('${escapeHtml(round.id)}')"
                        >
                            Poista
                        </button>
                    </div>
                `;

                historyList.appendChild(item);
            });
        }

        function buildShareText(round) {
            const lines = [
                "Golfkierros",
                `${round.course || "Kenttä nimeämättä"} – ${formatDate(round.date)}`,
                round.gameFormat || "",
                ""
            ];

            round.names.forEach((name, index) => {
                const player = index + 1;
                const scores = round.scores[player] || [];
                const front = scores
                    .slice(0, 9)
                    .reduce((sum, value) => sum + Number(value || 0), 0);
                const back = scores
                    .slice(9, 18)
                    .reduce((sum, value) => sum + Number(value || 0), 0);

                lines.push(`${name}`);
                lines.push(
                    "1–9: " +
                    scores
                        .slice(0, 9)
                        .map((score, holeIndex) =>
                            `${holeIndex + 1}:${score || "-"}`
                        )
                        .join("  ")
                );
                lines.push(
                    "10–18: " +
                    scores
                        .slice(9, 18)
                        .map((score, holeIndex) =>
                            `${holeIndex + 10}:${score || "-"}`
                        )
                        .join("  ")
                );
                lines.push(
                    `Etuysi ${front}, takaysi ${back}, yhteensä ${round.totals[player]}`
                );
                lines.push("");
            });

            if (round.notes) {
                lines.push(`Huomautus: ${round.notes}`);
            }

            return lines.join("\n");
        }

        async function shareRound(roundId) {
            const round = getRoundHistory().find(item => item.id === roundId);

            if (!round) {
                return;
            }

            const text = buildShareText(round);

            if (navigator.share) {
                try {
                    await navigator.share({
                        title: `Golfkierros – ${round.course}`,
                        text
                    });
                    return;
                } catch (error) {
                    if (error.name === "AbortError") {
                        return;
                    }
                }
            }

            try {
                await navigator.clipboard.writeText(text);
                alert("Kierroksen tiedot kopioitiin leikepöydälle.");
            } catch (error) {
                prompt("Kopioi kierroksen tiedot:", text);
            }
        }

        function deleteRound(roundId) {
            const history = getRoundHistory();
            const round = history.find(item => item.id === roundId);

            if (!round) {
                alert("Poistettavaa kierrosta ei löytynyt.");
                return;
            }

            const confirmed = confirm(
                "Poistetaanko tämä kierros?\n\n" +
                `${round.course || "Kenttä nimeämättä"}\n` +
                `${formatDate(round.date)}`
            );

            if (!confirmed) {
                return;
            }

            const updatedHistory = history.filter(
                item => item.id !== roundId
            );

            localStorage.setItem(
                HISTORY_KEY,
                JSON.stringify(updatedHistory)
            );

            renderHistory();
        }

        function deleteAllRounds() {
            const history = getRoundHistory();

            if (history.length === 0) {
                return;
            }

            const confirmed = confirm(
                `Poistetaanko kaikki ${history.length} tallennettua kierrosta?`
            );

            if (!confirmed) {
                return;
            }

            localStorage.removeItem(HISTORY_KEY);
            renderHistory();
        }

        function processResultsFromUrl() {
            const params = new URLSearchParams(window.location.search);
            const spokenText = params.get("tulos");

            if (!spokenText) {
                return;
            }

            try {
                const result = parseVoiceResults(spokenText);

                voiceStatus.innerHTML =
                    `<strong>Reikä ${result.hole} tallennettu ✅</strong><br>` +
                    result.addedScores.join(", ");

                speakConfirmation(result.hole);
                checkFrontNineCompletion();

                if (result.hole === 18) {
                    setTimeout(showRoundCompleteModal, 450);
                }
            } catch (error) {
                voiceStatus.innerHTML =
                    `<strong>Vastaanotettu:</strong> ${escapeHtml(spokenText)}<br>` +
                    `<strong>Virhe:</strong> ${escapeHtml(error.message)}`;

                speakMessage(error.message);
            }

            // Poistetaan tulos-parametri osoitteesta, jotta sama tulos
            // ei tallennu uudelleen sivua päivitettäessä.
            const cleanUrl =
                window.location.origin +
                window.location.pathname +
                window.location.hash;

            window.history.replaceState({}, document.title, cleanUrl);
        }

        function resetRound() {
            const confirmed = confirm(
                "Haluatko varmasti aloittaa uuden kierroksen? Kaikki tulokset poistetaan."
            );

            if (!confirmed) {
                return;
            }

            document.querySelectorAll(".score-input").forEach(input => {
                input.value = "";
            });

            nextHole = 1;
            roundComplete = false;
            frontNineAnnounced = false;
            updateNextHole();
            updateRoundCompleteState();
            calculateScores();
            saveState();

            voiceStatus.textContent = "Uusi kierros aloitettu.";
            speakMessage("Uusi kierros aloitettu");
        }

        document.querySelectorAll("#playerCountButtons button").forEach(button => {
            button.addEventListener("click", () => {
                setPlayerCount(Number(button.dataset.count));
            });
        });

        document.querySelectorAll(".player-name").forEach(input => {
            input.addEventListener("focus", () => {
                const genericName = /^P[1-4]$/i.test(input.value.trim());

                if (genericName) {
                    input.value = "";
                    saveState();
                }
            });

            input.addEventListener("input", saveState);
        });

        announceStandingsInput.addEventListener("change", () => {
            announceStandings = announceStandingsInput.checked;
            saveState();
        });

        buildScoreTable();
        loadState();
        updateRoundCompleteState();
        prepareRoundMetadataForm();
        renderHistory();
        processResultsFromUrl();
