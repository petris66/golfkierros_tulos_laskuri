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
        const compactNextHoleElement =
            document.getElementById("compactNextHole");
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
                    updateRoundLayout();
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
            row.dataset.nine = prefix === "front" ? "front" : "back";

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

            calculateScores();
            saveState();
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
            updateRoundLayout();
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

        function getFinalRoundResults() {
            const finished = [];
            const dnf = [];

            for (let player = 1; player <= playerCount; player++) {
                const name =
                    document.getElementById(`name${player}`).value.trim() ||
                    `P${player}`;

                const totalText =
                    document.getElementById(`sum${player}`).textContent;

                if (totalText === "DNF") {
                    dnf.push(name);
                } else {
                    finished.push({
                        name,
                        total: Number(totalText) || 0
                    });
                }
            }

            finished.sort((a, b) => a.total - b.total);

            return { finished, dnf };
        }

        function buildWinnerMessage() {
            if (playerCount < 2) {
                const { finished } = getFinalRoundResults();

                if (finished.length === 1) {
                    return `Kierroksen tulos oli ${finished[0].total} lyöntiä.`;
                }

                return "Kierros päättyi ilman lyöntipelitulosta.";
            }

            const { finished, dnf } = getFinalRoundResults();

            if (finished.length === 0) {
                return "Kierroksella ei saatu lyöntipelitulosta.";
            }

            const bestScore = finished[0].total;
            const winners = finished.filter(
                player => player.total === bestScore
            );

            let message;

            if (winners.length === 1) {
                message =
                    `Kierroksen voitti ${winners[0].name} tuloksella ${bestScore} lyöntiä.`;
            } else {
                const winnerNames = winners
                    .map(player => player.name)
                    .join(" ja ");

                message =
                    `Kierros päättyi tasan. ${winnerNames} pelasivat tuloksen ${bestScore} lyöntiä.`;
            }

            if (dnf.length > 0) {
                message += ` ${dnf.join(" ja ")} eivät saaneet lyöntipelitulosta.`;
            }

            return message;
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

        function scrollElementBelowVoiceCard(element, extraSpace = 14) {
            if (!element) {
                return;
            }

            const voiceCard = document.getElementById("voiceCard");
            const stickyHeight = voiceCard
                ? voiceCard.getBoundingClientRect().height
                : 0;

            const elementTop =
                window.scrollY + element.getBoundingClientRect().top;

            const targetTop = Math.max(
                0,
                elementTop - stickyHeight - extraSpace
            );

            window.scrollTo({
                top: targetTop,
                behavior: "smooth"
            });
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
                        const winnerMessage = buildWinnerMessage();

                        if (winnerMessage) {
                            pendingVoiceMessage += `. ${winnerMessage}`;
                            voiceStatus.innerHTML +=
                                `<br><strong>${escapeHtml(winnerMessage)}</strong>`;
                        }

                        setTimeout(showRoundCompleteModal, 1100);
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
            compactNextHoleElement.textContent = nextHole;
        }

        function updateRoundLayout() {
            const playedHoles = getPlayedHoleCount();
            const roundStarted = playedHoles > 0 || roundComplete;
            const showBackNine = nextHole >= 10 || roundComplete;

            document.body.classList.toggle("round-active", roundStarted);
            document.body.classList.toggle("show-back-nine", showBackNine);

            document.querySelectorAll("[data-hole-row]").forEach(row => {
                const hole = Number(row.dataset.holeRow);
                const shouldShow = showBackNine
                    ? hole >= 10
                    : hole <= 9;

                row.classList.toggle("nine-hidden", !shouldShow);
            });

            document.querySelectorAll(".subtotal").forEach(row => {
                const shouldShow = showBackNine
                    ? row.dataset.nine === "back"
                    : row.dataset.nine === "front";

                row.classList.toggle("nine-hidden", !shouldShow);
            });
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
                updateRoundLayout();
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
                updateRoundLayout();
            } catch (error) {
                localStorage.removeItem(STORAGE_KEY);
                setPlayerCount(1);
                updateNextHole();
                updateRoundLayout();
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

                const totalText =
                    document.getElementById(`front${player}`).textContent;

                parts.push({
                    name,
                    result: totalText
                });
            }

            return parts;
        }

        function buildFrontNineSpeech(summary) {
            return summary.map(item => {
                if (item.result === "DNF") {
                    return `${item.name}, ei lyöntipelitulosta`;
                }

                return `${item.name} ${item.result} lyöntiä`;
            }).join(". ");
        }

        function checkFrontNineCompletion() {
            if (frontNineAnnounced || !isFrontNineComplete()) {
                return;
            }

            frontNineAnnounced = true;
            updateRoundLayout();
            saveState();

            const summary = getFrontNineSummary();
            const summaryText = summary.map(item =>
                item.result === "DNF"
                    ? `${escapeHtml(item.name)}: DNF`
                    : `${escapeHtml(item.name)}: ${item.result}`
            ).join(", ");

            voiceStatus.innerHTML =
                "<strong>Etuysi pelattu ✅</strong><br>" +
                summaryText;

            const frontNineSpeech =
                `Etuysi pelattu. ${buildFrontNineSpeech(summary)}`;

            if (pendingVoiceMessage) {
                pendingVoiceMessage += `. ${frontNineSpeech}`;
            } else {
                speakMessage(frontNineSpeech);
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
                    const value = normalizeScoreValue(input.value);

                    snapshot.scores[player].push(
                        value === "-" ? "-" : (value || 0)
                    );
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

        function getShareScoreValue(value) {
            const normalized = normalizeScoreValue(value);

            if (normalized === "-") {
                return "-";
            }

            return normalized || "";
        }

        function calculateSharedNine(scores, startIndex, endIndex) {
            const values = scores
                .slice(startIndex, endIndex)
                .map(getShareScoreValue);

            if (values.some(value => value === "-")) {
                return "DNF";
            }

            return values.reduce(
                (sum, value) => sum + (Number(value) || 0),
                0
            );
        }

        function roundedRectPath(context, x, y, width, height, radius) {
            const r = Math.min(radius, width / 2, height / 2);

            context.beginPath();
            context.moveTo(x + r, y);
            context.arcTo(x + width, y, x + width, y + height, r);
            context.arcTo(
                x + width,
                y + height,
                x,
                y + height,
                r
            );
            context.arcTo(x, y + height, x, y, r);
            context.arcTo(x, y, x + width, y, r);
            context.closePath();
        }

        function fillRoundedRect(
            context,
            x,
            y,
            width,
            height,
            radius,
            fillStyle
        ) {
            context.save();
            roundedRectPath(context, x, y, width, height, radius);
            context.fillStyle = fillStyle;
            context.fill();
            context.restore();
        }

        function drawWrappedText(
            context,
            text,
            x,
            y,
            maxWidth,
            lineHeight,
            maxLines = 3
        ) {
            const words = String(text).split(/\s+/);
            const lines = [];
            let line = "";

            words.forEach(word => {
                const testLine = line ? `${line} ${word}` : word;

                if (
                    context.measureText(testLine).width > maxWidth &&
                    line
                ) {
                    lines.push(line);
                    line = word;
                } else {
                    line = testLine;
                }
            });

            if (line) {
                lines.push(line);
            }

            const visibleLines = lines.slice(0, maxLines);

            if (lines.length > maxLines) {
                let last = visibleLines[maxLines - 1];

                while (
                    context.measureText(`${last}…`).width > maxWidth &&
                    last.length > 1
                ) {
                    last = last.slice(0, -1);
                }

                visibleLines[maxLines - 1] = `${last}…`;
            }

            visibleLines.forEach((item, index) => {
                context.fillText(item, x, y + index * lineHeight);
            });

            return visibleLines.length * lineHeight;
        }

        function fitCanvasText(context, text, maxWidth, startSize, minSize) {
            let size = startSize;

            while (size > minSize) {
                context.font = `700 ${size}px Arial`;

                if (context.measureText(text).width <= maxWidth) {
                    break;
                }

                size -= 1;
            }

            return size;
        }

        async function loadShareLogo() {
            return new Promise(resolve => {
                const image = new Image();
                image.onload = () => resolve(image);
                image.onerror = () => resolve(null);
                image.src = "icons/icon-192.png";
            });
        }

        async function createVerticalScorecardCanvas(round) {
            const canvas = document.createElement("canvas");
            canvas.width = 1080;
            canvas.height = 1760;

            const context = canvas.getContext("2d");
            const width = canvas.width;
            const height = canvas.height;

            const forest = "#173f18";
            const forestTwo = "#286f24";
            const mint = "#eaf5e5";
            const cream = "#fbfcf7";
            const gold = "#f2d178";
            const ink = "#173019";
            const line = "#bfd2ba";
            const white = "#ffffff";

            const background = context.createLinearGradient(
                0,
                0,
                0,
                height
            );
            background.addColorStop(0, forest);
            background.addColorStop(0.23, "#315f31");
            background.addColorStop(0.56, "#d7ebcf");
            background.addColorStop(1, "#eef6e9");

            context.fillStyle = background;
            context.fillRect(0, 0, width, height);

            context.globalAlpha = 0.06;
            context.strokeStyle = white;
            context.lineWidth = 3;

            for (let x = -height; x < width + height; x += 90) {
                context.beginPath();
                context.moveTo(x, 0);
                context.lineTo(x + height, height);
                context.stroke();
            }

            context.globalAlpha = 1;

            const logo = await loadShareLogo();

            if (logo) {
                fillRoundedRect(context, 72, 60, 124, 124, 28, white);
                context.drawImage(logo, 82, 70, 104, 104);
            }

            context.fillStyle = white;
            context.textAlign = "left";
            context.font = "700 34px Arial";
            context.fillText("GOLF VOICE", 224, 101);
            context.font = "800 58px Georgia";
            context.fillText("Scorecard AI", 224, 159);

            context.fillStyle = gold;
            context.font = "700 22px Arial";
            context.fillText(
                "BY PETRI SUOKAS · POWERED BY AI",
                224,
                198
            );

            fillRoundedRect(
                context,
                48,
                238,
                width - 96,
                height - 286,
                36,
                cream
            );

            context.fillStyle = ink;
            context.font = "800 46px Georgia";
            const course =
                round.course || "Kenttä nimeämättä";
            const courseSize = fitCanvasText(
                context,
                course,
                width - 160,
                46,
                28
            );
            context.font = `800 ${courseSize}px Georgia`;
            context.fillText(course, 84, 312);

            context.fillStyle = "#4f6451";
            context.font = "700 25px Arial";
            context.fillText(
                `${formatDate(round.date)} · ${round.gameFormat || "Lyöntipeli"}`,
                84,
                354
            );

            if (round.notes) {
                context.font = "400 22px Arial";
                context.fillStyle = "#5d6d5e";
                drawWrappedText(
                    context,
                    round.notes,
                    84,
                    389,
                    width - 168,
                    27,
                    2
                );
            }

            const summaryTop = round.notes ? 452 : 400;
            fillRoundedRect(
                context,
                76,
                summaryTop,
                width - 152,
                190,
                24,
                mint
            );

            context.fillStyle = forest;
            context.font = "800 25px Arial";
            context.fillText("KIERROKSEN YHTEENVETO", 102, summaryTop + 40);

            const summaryColumnWidths = [
                360,
                150,
                150,
                190
            ];
            const summaryHeaders = [
                "Pelaaja",
                "Etu",
                "Taka",
                "Yht."
            ];
            const summaryX = [102];
            summaryColumnWidths.forEach((value, index) => {
                if (index < summaryColumnWidths.length - 1) {
                    summaryX.push(summaryX[index] + value);
                }
            });

            context.font = "700 22px Arial";
            context.fillStyle = "#506252";
            summaryHeaders.forEach((header, index) => {
                context.textAlign = index === 0 ? "left" : "center";
                const x = index === 0
                    ? summaryX[index]
                    : summaryX[index] + summaryColumnWidths[index] / 2;
                context.fillText(header, x, summaryTop + 78);
            });

            round.names.forEach((name, index) => {
                const player = index + 1;
                const scores = round.scores[player] || [];
                const y = summaryTop + 112 + index * 28;
                const front = calculateSharedNine(scores, 0, 9);
                const back = calculateSharedNine(scores, 9, 18);
                const total = round.totals[player];

                context.fillStyle = ink;
                context.font = "700 21px Arial";
                context.textAlign = "left";
                const nameSize = fitCanvasText(
                    context,
                    name,
                    summaryColumnWidths[0] - 16,
                    21,
                    15
                );
                context.font = `700 ${nameSize}px Arial`;
                context.fillText(name, summaryX[0], y);

                [front, back, total].forEach((value, valueIndex) => {
                    const columnIndex = valueIndex + 1;
                    context.font = "700 21px Arial";
                    context.textAlign = "center";
                    context.fillText(
                        String(value),
                        summaryX[columnIndex] +
                            summaryColumnWidths[columnIndex] / 2,
                        y
                    );
                });
            });

            const tableTop = summaryTop + 218;
            const tableLeft = 76;
            const tableWidth = width - 152;
            const headerHeight = 54;
            const rowHeight = 42;
            const numberOfRows = 21;
            const tableHeight =
                headerHeight + numberOfRows * rowHeight;

            fillRoundedRect(
                context,
                tableLeft,
                tableTop,
                tableWidth,
                tableHeight,
                24,
                white
            );

            context.save();
            roundedRectPath(
                context,
                tableLeft,
                tableTop,
                tableWidth,
                tableHeight,
                24
            );
            context.clip();

            const holeWidth = 120;
            const playerWidth =
                (tableWidth - holeWidth) / round.names.length;

            context.fillStyle = forest;
            context.fillRect(
                tableLeft,
                tableTop,
                tableWidth,
                headerHeight
            );

            context.fillStyle = white;
            context.font = "800 22px Arial";
            context.textAlign = "center";
            context.fillText(
                "Reikä",
                tableLeft + holeWidth / 2,
                tableTop + 35
            );

            round.names.forEach((name, index) => {
                const center =
                    tableLeft +
                    holeWidth +
                    playerWidth * index +
                    playerWidth / 2;
                const size = fitCanvasText(
                    context,
                    name,
                    playerWidth - 14,
                    22,
                    13
                );
                context.font = `800 ${size}px Arial`;
                context.fillText(name, center, tableTop + 35);
            });

            const rows = [];

            for (let hole = 1; hole <= 18; hole++) {
                rows.push({
                    label: String(hole),
                    hole,
                    type: "hole"
                });

                if (hole === 9) {
                    rows.push({
                        label: "Etuysi",
                        type: "front"
                    });
                }

                if (hole === 18) {
                    rows.push({
                        label: "Takaysi",
                        type: "back"
                    });
                }
            }

            rows.push({
                label: "Yhteensä",
                type: "total"
            });

            rows.forEach((row, rowIndex) => {
                const y =
                    tableTop + headerHeight + rowIndex * rowHeight;
                const isSummary =
                    row.type === "front" ||
                    row.type === "back" ||
                    row.type === "total";

                context.fillStyle = row.type === "total"
                    ? "#dce9d7"
                    : isSummary
                        ? mint
                        : rowIndex % 2 === 0
                            ? white
                            : "#f7faf5";
                context.fillRect(
                    tableLeft,
                    y,
                    tableWidth,
                    rowHeight
                );

                context.fillStyle = isSummary ? forest : ink;
                context.font = `${isSummary ? "800" : "700"} 20px Arial`;
                context.textAlign = "center";
                context.fillText(
                    row.label,
                    tableLeft + holeWidth / 2,
                    y + 28
                );

                round.names.forEach((name, index) => {
                    const player = index + 1;
                    const scores = round.scores[player] || [];
                    let value = "";

                    if (row.type === "hole") {
                        value = getShareScoreValue(
                            scores[row.hole - 1]
                        ) || "–";
                    } else if (row.type === "front") {
                        value = calculateSharedNine(scores, 0, 9);
                    } else if (row.type === "back") {
                        value = calculateSharedNine(scores, 9, 18);
                    } else {
                        value = round.totals[player];
                    }

                    context.fillStyle = row.type === "total"
                        ? forest
                        : ink;
                    context.font =
                        `${isSummary ? "800" : "700"} 21px Arial`;
                    context.textAlign = "center";
                    context.fillText(
                        String(value),
                        tableLeft +
                            holeWidth +
                            playerWidth * index +
                            playerWidth / 2,
                        y + 28
                    );
                });
            });

            context.strokeStyle = line;
            context.lineWidth = 2;

            for (let row = 0; row <= numberOfRows; row++) {
                const y =
                    tableTop + headerHeight + row * rowHeight;
                context.beginPath();
                context.moveTo(tableLeft, y);
                context.lineTo(tableLeft + tableWidth, y);
                context.stroke();
            }

            context.beginPath();
            context.moveTo(tableLeft + holeWidth, tableTop);
            context.lineTo(
                tableLeft + holeWidth,
                tableTop + tableHeight
            );
            context.stroke();

            for (let player = 1; player < round.names.length; player++) {
                const x =
                    tableLeft + holeWidth + playerWidth * player;
                context.beginPath();
                context.moveTo(x, tableTop);
                context.lineTo(x, tableTop + tableHeight);
                context.stroke();
            }

            context.restore();

            context.fillStyle = "#607262";
            context.font = "600 18px Arial";
            context.textAlign = "center";
            context.fillText(
                "Petri Suokas",
                width / 2,
                height - 58
            );

            context.fillStyle = "#607262";
            context.font = "800 18px Arial";
            context.fillText(
                "AI Golf Apps",
                width / 2,
                height - 32
            );

            return canvas;
        }

        function canvasToBlob(canvas) {
            return new Promise((resolve, reject) => {
                canvas.toBlob(blob => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(
                            new Error("Jakokuvan luominen epäonnistui.")
                        );
                    }
                }, "image/png", 1);
            });
        }

        function buildShareText(round) {
            return [
                "Golf Voice Scorecard AI",
                "Petri Suokas · AI Golf Apps",
                `${round.course || "Kenttä nimeämättä"} – ${formatDate(round.date)}`,
                round.gameFormat || "Lyöntipeli",
                "Tuloskortti liitteenä."
            ].join("\n");
        }

        async function shareRound(roundId) {
            const round = getRoundHistory().find(item => item.id === roundId);

            if (!round) {
                return;
            }

            const shareButtons = document.querySelectorAll(
                `[onclick="shareRound('${roundId}')"]`
            );

            shareButtons.forEach(button => {
                button.disabled = true;
                button.textContent = "Luodaan jakokorttia…";
            });

            try {
                const canvas =
                    await createVerticalScorecardCanvas(round);
                const blob = await canvasToBlob(canvas);
                const safeCourse = String(
                    round.course || "golfkierros"
                )
                    .replace(/[^\p{L}\p{N}_-]+/gu, "_")
                    .replace(/^_+|_+$/g, "")
                    .slice(0, 40) || "golfkierros";
                const filename =
                    `Golf_Voice_${safeCourse}_${round.date || "kierros"}.png`;
                const file = new File(
                    [blob],
                    filename,
                    { type: "image/png" }
                );
                const shareText = buildShareText(round);

                if (
                    navigator.share &&
                    (!navigator.canShare ||
                        navigator.canShare({ files: [file] }))
                ) {
                    try {
                        await navigator.share({
                            title: `Golfkierros – ${round.course}`,
                            text: shareText,
                            files: [file]
                        });
                        return;
                    } catch (error) {
                        if (error.name === "AbortError") {
                            return;
                        }
                    }
                }

                const imageUrl = URL.createObjectURL(blob);
                const downloadLink = document.createElement("a");
                downloadLink.href = imageUrl;
                downloadLink.download = filename;
                downloadLink.rel = "noopener";
                document.body.appendChild(downloadLink);
                downloadLink.click();
                downloadLink.remove();

                setTimeout(() => {
                    URL.revokeObjectURL(imageUrl);
                }, 3000);

                alert(
                    "Tuloskortti luotiin kuvaksi. Voit jakaa sen Kuvat- tai Tiedostot-sovelluksesta."
                );
            } catch (error) {
                console.error(error);

                const text = buildShareText(round);

                try {
                    await navigator.clipboard.writeText(text);
                    alert(
                        "Jakokuvan luominen epäonnistui, joten kierroksen yhteenveto kopioitiin leikepöydälle."
                    );
                } catch (clipboardError) {
                    prompt("Kopioi kierroksen yhteenveto:", text);
                }
            } finally {
                shareButtons.forEach(button => {
                    button.disabled = false;
                    button.textContent = "Jaa tuloskortti";
                });
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
            selectedScoreInput = null;
            document.querySelectorAll(".selected-score").forEach(input => {
                input.classList.remove("selected-score");
            });

            updateNextHole();
            updateRoundCompleteState();
            calculateScores();
            updateRoundLayout();
            saveState();

            voiceStatus.textContent = "Uusi kierros aloitettu.";
            speakMessage("Uusi kierros aloitettu");

            requestAnimationFrame(() => {
                window.scrollTo({
                    top: 0,
                    left: 0,
                    behavior: "smooth"
                });
            });
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
        updateRoundLayout();
        prepareRoundMetadataForm();
        renderHistory();
        processResultsFromUrl();
