"use strict";

        const STORAGE_KEY = "golfTuloslaskuriV2";
        const HISTORY_KEY = "golfTuloslaskuriHistory";
        const MAX_PLAYERS = 4;

        let playerCount = 1;
        let roundSetupConfirmed = false;
        let nextHole = 1;
        let startHole = 1;
        let roundComplete = false;
        let frontNineAnnounced = false;
        let pendingVoiceMessage = "";
        let announceStandings = false;
        let selectedScoreInput = null;
        let speechSynthesisPrimed = false;
        let courseData = [];
        let selectedCourseId = "";
        let selectedTee = "";
        let selectedGender = "";
        let manualNineView = null;
        let playerHandicaps = Array(MAX_PLAYERS).fill("");
        let playerTees = Array(MAX_PLAYERS).fill("");

        const tableBody = document.getElementById("tableBody");
        const voiceStatus = document.getElementById("voiceStatus");
        const voiceButton = document.getElementById("voiceButton");
        const nextHoleElement = document.getElementById("nextHole");
        const startHoleInput = document.getElementById("startHoleInput");
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
        const courseSelect = document.getElementById("courseSelect");
        const teeSelect = document.getElementById("teeSelect");
        const genderSelect = document.getElementById("genderSelect");
        const courseDataStatus = document.getElementById("courseDataStatus");
        const selectedCourseInfo = document.getElementById("selectedCourseInfo");
        const nineViewButton = document.getElementById("nineViewButton");
        const saveRoundActionButton = document.getElementById("saveRoundActionButton");
        const historyActionButton = document.getElementById("historyActionButton");
        const playerHcpInputs = Array.from({ length: MAX_PLAYERS }, (_, index) =>
            document.getElementById(`playerHcp${index + 1}`)
        );
        const playerTeeSelects = Array.from({ length: MAX_PLAYERS }, (_, index) =>
            document.getElementById(`playerTee${index + 1}`)
        );
        const playerCourseHcpElements = Array.from({ length: MAX_PLAYERS }, (_, index) =>
            document.getElementById(`playerCourseHcp${index + 1}`)
        );
        const playerSettingNames = Array.from({ length: MAX_PLAYERS }, (_, index) =>
            document.getElementById(`playerSettingName${index + 1}`)
        );
        const scorecardPlayerNames = Array.from({ length: MAX_PLAYERS }, (_, index) =>
            document.getElementById(`scorecardName${index + 1}`)
        );
        const stablefordCard = document.getElementById("stablefordCard");
        const stablefordToggleButton = document.getElementById("stablefordToggleButton");
        const stablefordTableBody = document.getElementById("stablefordTableBody");
        const stablefordHeaderRow = document.getElementById("stablefordHeaderRow");
        const stablefordTotalRow = document.getElementById("stablefordTotalRow");

        function keepStartHoleInputVisible() {
            if (!startHoleInput) return;

            const scrollInputIntoView = () => {
                startHoleInput.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                    inline: "nearest"
                });
            };

            startHoleInput.addEventListener("focus", () => {
                window.setTimeout(scrollInputIntoView, 300);
                window.setTimeout(scrollInputIntoView, 650);
            });

            startHoleInput.addEventListener("click", () => {
                window.setTimeout(scrollInputIntoView, 250);
            });
        }

        function getSavedCourseSelection() {
            try {
                const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
                return {
                    courseId: state.courseId || "",
                    tee: state.tee || "",
                    gender: state.gender || ""
                };
            } catch (error) {
                return { courseId: "", tee: "", gender: "" };
            }
        }

        async function loadCourseData() {
            courseDataStatus.textContent = "Ladataan kenttädataa…";

            try {
                const response = await fetch("data/courses_2026-08-03.json", {
                    cache: "no-store"
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json();

                if (!Array.isArray(data) || data.length === 0) {
                    throw new Error("Kenttädata on tyhjä.");
                }

                courseData = data.filter(row =>
                    row && row.courseId && row.course && row.tee && row.gender &&
                    Number(row.hole) >= 1 && Number(row.hole) <= 18
                );

                populateCourseOptions();
                restoreCourseSelection();
                courseDataStatus.textContent = `${getUniqueCourses().length} kenttää ladattu`;
            } catch (error) {
                console.error("Kenttädatan lataus epäonnistui:", error);
                courseData = [];
                courseDataStatus.textContent = "Kenttädatan lataus epäonnistui";
                courseSelect.innerHTML = '<option value="">Kenttädata ei käytettävissä</option>';
                teeSelect.innerHTML = '<option value="">—</option>';
                genderSelect.innerHTML = '<option value="">—</option>';
            }
        }

        function getUniqueCourses() {
            const map = new Map();

            courseData.forEach(row => {
                if (!map.has(row.courseId)) {
                    map.set(row.courseId, row.course);
                }
            });

            return [...map.entries()]
                .map(([id, name]) => ({ id, name }))
                .sort((a, b) => a.name.localeCompare(b.name, "fi"));
        }

        function populateCourseOptions() {
            const courses = getUniqueCourses();
            courseSelect.innerHTML = '<option value="">Valitse kenttä</option>';

            courses.forEach(course => {
                const option = document.createElement("option");
                option.value = course.id;
                option.textContent = course.name;
                courseSelect.appendChild(option);
            });
        }

        function restoreCourseSelection() {
            const saved = getSavedCourseSelection();
            const courses = getUniqueCourses();
            const courseExists = courses.some(course => course.id === saved.courseId);

            selectedCourseId = courseExists ? saved.courseId : "";
            courseSelect.value = selectedCourseId;
            populateGenderOptions(saved.gender);
            populateTeeOptions(saved.tee);
            updateSelectedCourseInfo();
        }

        function getRowsForSelectedCourse() {
            return courseData.filter(row => row.courseId === selectedCourseId);
        }

        function populateGenderOptions(preferredGender = "") {
            const genders = [...new Set(
                getRowsForSelectedCourse().map(row => row.gender).filter(Boolean)
            )].sort((a, b) => a.localeCompare(b, "fi"));

            genderSelect.innerHTML = '<option value="">Valitse</option>';
            genders.forEach(gender => {
                const option = document.createElement("option");
                option.value = gender;
                option.textContent = gender;
                genderSelect.appendChild(option);
            });

            selectedGender = genders.includes(preferredGender)
                ? preferredGender
                : (genders[0] || "");
            genderSelect.value = selectedGender;
        }

        function populateTeeOptions(preferredTee = "") {
            const tees = [...new Set(
                getRowsForSelectedCourse()
                    .filter(row => !selectedGender || row.gender === selectedGender)
                    .map(row => row.tee)
                    .filter(Boolean)
            )].sort((a, b) => a.localeCompare(b, "fi", { numeric: true }));

            teeSelect.innerHTML = '<option value="">Valitse tii</option>';
            tees.forEach(tee => {
                const option = document.createElement("option");
                option.value = tee;
                option.textContent = tee;
                teeSelect.appendChild(option);
            });

            selectedTee = tees.includes(preferredTee)
                ? preferredTee
                : (tees[0] || "");
            teeSelect.value = selectedTee;
        }

        function getSelectedCourseRows() {
            return courseData
                .filter(row =>
                    row.courseId === selectedCourseId &&
                    row.tee === selectedTee &&
                    row.gender === selectedGender
                )
                .sort((a, b) => Number(a.hole) - Number(b.hole));
        }

        function getHoleData(hole) {
            return getSelectedCourseRows().find(row => Number(row.hole) === hole) || null;
        }

        function getSelectedCourseName() {
            return getRowsForSelectedCourse()[0]?.course || "";
        }

        function updateSelectedCourseInfo() {
            const rows = getSelectedCourseRows();
            const firstRow = rows[0];

            if (!selectedCourseId || !selectedTee || !selectedGender || rows.length === 0) {
                selectedCourseInfo.textContent = "Valitse kenttä ja pelaajakohtaiset tiit.";
                return;
            }

            const cr = rows.find(row => row.CR !== null && row.CR !== "")?.CR;
            const slope = rows.find(row => row.Slope !== null && row.Slope !== "")?.Slope;
            const meters = rows.reduce((sum, row) => sum + (Number(row.meters) || 0), 0);
            const details = [
                `${getSelectedCourseName()} · ${selectedTee} · ${selectedGender}`,
                cr !== undefined ? `CR ${cr}` : "",
                slope !== undefined ? `Slope ${slope}` : "",
                meters > 0 ? `${meters} m` : ""
            ].filter(Boolean);

            selectedCourseInfo.textContent = details.join(" · ");

            if (courseNameInput && getSelectedCourseName()) {
                courseNameInput.value = getSelectedCourseName();
            }
        }

        function encodePlayerTee(gender, tee) {
            return `${String(gender || "")}|||${String(tee || "")}`;
        }

        function decodePlayerTee(value) {
            const [gender = "", tee = ""] = String(value || "").split("|||");
            return { gender, tee };
        }

        function getShortTeeLabel(tee) {
            const value = String(tee || "").trim();
            return value.length <= 2 ? value : value.slice(0, 2);
        }

        function getAvailablePlayerTees() {
            const combinations = new Map();

            getRowsForSelectedCourse().forEach(row => {
                if (!row.gender || !row.tee) return;
                const value = encodePlayerTee(row.gender, row.tee);
                if (!combinations.has(value)) {
                    combinations.set(value, {
                        value,
                        gender: row.gender,
                        tee: row.tee,
                        label: `${getShortTeeLabel(row.tee)} · ${row.gender === "Miehet" ? "M" : row.gender === "Naiset" ? "N" : row.gender}`
                    });
                }
            });

            return [...combinations.values()].sort((a, b) =>
                a.tee.localeCompare(b.tee, "fi", { numeric: true }) ||
                a.gender.localeCompare(b.gender, "fi")
            );
        }

        function applyPrimaryPlayerTeeToScorecard() {
            const firstActiveSelection = playerTees
                .slice(0, playerCount)
                .find(Boolean);

            if (!firstActiveSelection) return;

            const { gender, tee } = decodePlayerTee(firstActiveSelection);
            if (!gender || !tee) return;

            selectedGender = gender;
            selectedTee = tee;
            genderSelect.value = selectedGender;
            teeSelect.value = selectedTee;
        }

        function updatePlayerSettingNames() {
            for (let player = 1; player <= MAX_PLAYERS; player++) {
                const nameInput = document.getElementById(`name${player}`);
                const name = nameInput?.value.trim() || `P${player}`;

                if (playerSettingNames[player - 1]) {
                    playerSettingNames[player - 1].textContent = `Pelaaja ${player}`;
                }

                if (scorecardPlayerNames[player - 1]) {
                    scorecardPlayerNames[player - 1].textContent = name;
                }
            }
        }

        function resetPlayerDetailsAfterNameChange(playerIndex) {
            const hcpInput = playerHcpInputs[playerIndex];
            const teeSelect = playerTeeSelects[playerIndex];

            playerHandicaps[playerIndex] = "";
            playerTees[playerIndex] = "";

            if (hcpInput) hcpInput.value = "";
            if (teeSelect) teeSelect.value = "";

            updatePlayerTeeSelectColors();
            updatePlayerCourseHandicapsAndStrokeMarkers();
            saveState();
        }

        function getTeeColorClass(tee) {
            const normalized = String(tee || "")
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "");

            if (normalized.includes("valk")) return "tee-white";
            if (normalized.includes("kelt")) return "tee-yellow";
            if (normalized.includes("pun")) return "tee-red";
            if (normalized.includes("sin")) return "tee-blue";
            return "tee-unknown";
        }

        function updatePlayerTeeSelectColors() {
            playerTeeSelects.forEach((select, index) => {
                if (!select) return;

                const { tee } = decodePlayerTee(playerTees[index]);

                select.classList.remove(
                    "tee-white",
                    "tee-yellow",
                    "tee-red",
                    "tee-blue",
                    "tee-unknown"
                );
                select.classList.add(getTeeColorClass(tee));
            });
        }

        function populatePlayerTeeOptions() {
            const teeOptions = getAvailablePlayerTees();
            const validValues = teeOptions.map(option => option.value);
            const defaultValue = encodePlayerTee(selectedGender, selectedTee);

            playerTeeSelects.forEach((select, index) => {
                if (!select) return;

                let previous = playerTees[index] || select.value || defaultValue;

                // Vanhan version pelkkä tiin nimi muunnetaan yhdistelmäksi.
                if (previous && !String(previous).includes("|||")) {
                    const legacyMatch = teeOptions.find(option => option.tee === previous);
                    previous = legacyMatch?.value || "";
                }

                select.innerHTML = '<option value="">Valitse tii</option>';

                teeOptions.forEach(teeOption => {
                    const option = document.createElement("option");
                    option.value = teeOption.value;
                    option.textContent = teeOption.label;
                    select.appendChild(option);
                });

                const nextValue = validValues.includes(previous)
                    ? previous
                    : (validValues.includes(defaultValue) ? defaultValue : (validValues[0] || ""));

                playerTees[index] = nextValue;
                select.value = nextValue;
            });

            applyPrimaryPlayerTeeToScorecard();
            updatePlayerTeeSelectColors();
        }

        function parseExactHandicap(value) {
            const normalized = String(value ?? "")
                .trim()
                .replace(",", ".");
            const number = Number(normalized);
            return Number.isFinite(number) ? number : null;
        }

        function getPlayerSelectedCourseRows(playerIndex) {
            const selection = playerTees[playerIndex] || "";
            const { gender, tee } = decodePlayerTee(selection);

            if (!selectedCourseId || !gender || !tee) {
                return [];
            }

            return courseData
                .filter(row =>
                    row.courseId === selectedCourseId &&
                    row.gender === gender &&
                    row.tee === tee
                )
                .sort((a, b) => Number(a.hole) - Number(b.hole));
        }

        function calculatePlayerCourseHandicap(playerIndex) {
            const exactHcp = parseExactHandicap(playerHandicaps[playerIndex]);
            const rows = getPlayerSelectedCourseRows(playerIndex);

            if (exactHcp === null || rows.length !== 18) {
                return null;
            }

            const slope = Number(rows.find(row => row.Slope !== null && row.Slope !== "")?.Slope);
            const cr = Number(rows.find(row => row.CR !== null && row.CR !== "")?.CR);
            const par = rows.reduce((sum, row) => sum + (Number(row.par) || 0), 0);

            if (!Number.isFinite(slope) || !Number.isFinite(cr) || par <= 0) {
                return null;
            }

            return Math.round(exactHcp * slope / 113 + (cr - par));
        }

        function getHandicapStrokesForHole(courseHandicap, holeHcp) {
            if (!Number.isInteger(courseHandicap) || courseHandicap <= 0) {
                return 0;
            }

            const strokeIndex = Number(holeHcp);
            if (!Number.isInteger(strokeIndex) || strokeIndex < 1 || strokeIndex > 18) {
                return 0;
            }

            const fullRounds = Math.floor(courseHandicap / 18);
            const remainder = courseHandicap % 18;
            return fullRounds + (strokeIndex <= remainder ? 1 : 0);
        }

        function updatePlayerCourseHandicapsAndStrokeMarkers() {
            for (let playerIndex = 0; playerIndex < MAX_PLAYERS; playerIndex++) {
                const courseHandicap = calculatePlayerCourseHandicap(playerIndex);
                const display = playerCourseHcpElements[playerIndex];

                if (display) {
                    display.innerHTML = `
                        <span class="player-course-hcp-label">
                            <span>Kentän</span>
                            <span>HCP</span>
                        </span>
                        <strong class="player-course-hcp-value">${courseHandicap === null ? "–" : courseHandicap}</strong>
                    `;
                }

                const rows = getPlayerSelectedCourseRows(playerIndex);
                const holeHcpByHole = new Map(
                    rows.map(row => [Number(row.hole), Number(row.hcp)])
                );

                for (let hole = 1; hole <= 18; hole++) {
                    const marker = document.querySelector(
                        `[data-stroke-player="${playerIndex + 1}"][data-stroke-hole="${hole}"]`
                    );

                    if (!marker) continue;

                    const strokes = courseHandicap === null
                        ? 0
                        : getHandicapStrokesForHole(
                            courseHandicap,
                            holeHcpByHole.get(hole)
                        );

                    marker.innerHTML = strokes > 0
                        ? Array.from(
                            { length: strokes },
                            () => `
                                <svg
                                    class="handicap-golf-ball-svg"
                                    viewBox="0 0 20 20"
                                    width="16"
                                    height="16"
                                    aria-hidden="true"
                                    focusable="false"
                                >
                                    <circle cx="10" cy="10" r="8.5" fill="#ffffff" stroke="#173f18" stroke-width="1.5"/>
                                    <circle cx="7" cy="6.5" r="0.7" fill="#c7d0c5"/>
                                    <circle cx="11.5" cy="5.5" r="0.65" fill="#c7d0c5"/>
                                    <circle cx="14" cy="8.5" r="0.7" fill="#c7d0c5"/>
                                    <circle cx="6" cy="11" r="0.65" fill="#c7d0c5"/>
                                    <circle cx="10.5" cy="10" r="0.7" fill="#c7d0c5"/>
                                    <circle cx="13" cy="13" r="0.65" fill="#c7d0c5"/>
                                    <circle cx="8" cy="14" r="0.7" fill="#c7d0c5"/>
                                </svg>
                            `
                        ).join("")
                        : "";
                    marker.setAttribute(
                        "aria-label",
                        strokes > 0 ? `${strokes} tasoituslyöntiä` : ""
                    );
                }
            }

            updateHandicapStrokePlayStatus();
            updateStablefordScorecard();
        }

        function syncPlayerRoundSettingsFromInputs() {
            playerHandicaps = playerHcpInputs.map(input => input?.value.trim() || "");
            playerTees = playerTeeSelects.map(select => select?.value || "");
        }

        function restorePlayerRoundSettings() {
            playerHcpInputs.forEach((input, index) => {
                if (input) input.value = playerHandicaps[index] || "";
            });
            populatePlayerTeeOptions();
            updatePlayerSettingNames();
            updatePlayerCourseHandicapsAndStrokeMarkers();
        }

        function refreshScoreTableForCourse() {
            keepStartHoleInputVisible();
        buildScoreTable();
            setPlayerCount(playerCount);
            calculateScores();
            updateRoundLayout();
            updateSelectedCourseInfo();
            populatePlayerTeeOptions();
            updatePlayerCourseHandicapsAndStrokeMarkers();
            saveState();
        }

        function buildScoreTable() {
            tableBody.innerHTML = "";

            for (let hole = 1; hole <= 18; hole++) {
                const row = document.createElement("tr");
                row.dataset.holeRow = hole;

                const holeData = getHoleData(hole);
                const par = holeData?.par ?? "–";
                const hcp = holeData?.hcp ?? "–";

                row.innerHTML = `
                    <td class="hole-cell">${hole}</td>
                    <td class="course-stat-cell">${par}</td>
                    <td class="course-stat-cell">${hcp}</td>
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
                    <td class="player-column score-cell" data-player="${player}">
                        <span
                            class="handicap-stroke-marker"
                            data-stroke-player="${player}"
                            data-stroke-hole="${hole}"
                            aria-hidden="true"
                        ></span>
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

            let cells = `<td>${label}</td><td colspan="2"></td>`;

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

        function setPlayerCount(count, activateRound = false) {
            playerCount = Math.min(Math.max(Number(count) || 1, 1), MAX_PLAYERS);

            if (activateRound) {
                roundSetupConfirmed = true;
            }

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
            updatePlayerCourseHandicapsAndStrokeMarkers();
            updateStablefordScorecard();
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

        function getPlayedHoleOrder() {
            return Array.from(
                { length: 18 },
                (_, index) => ((startHole - 1 + index) % 18) + 1
            );
        }

        function updateHandicapStrokePlayStatus() {
            const playedHoleOrder = getPlayedHoleOrder();

            for (let playerIndex = 0; playerIndex < MAX_PLAYERS; playerIndex++) {
                const display = document.getElementById(
                    `handicapStrokeplayStatus${playerIndex + 1}`
                );

                if (!display) continue;

                const courseHandicap = calculatePlayerCourseHandicap(playerIndex);
                const rows = getPlayerSelectedCourseRows(playerIndex);
                const holeDataByHole = new Map(
                    rows.map(row => [Number(row.hole), row])
                );

                let grossTotal = 0;
                let targetTotal = 0;
                let hasScores = false;
                let dnf = false;

                for (const hole of playedHoleOrder) {
                    const scoreInput = document.querySelector(
                        `.p${playerIndex + 1}[data-hole="${hole}"]`
                    );
                    const score = normalizeScoreValue(scoreInput?.value);

                    // Kierroksen juokseva tilanne lasketaan vain yhtenäisesti
                    // aloitusreiästä eteenpäin ensimmäiseen tyhjään reikään asti.
                    if (score === "") {
                        break;
                    }

                    hasScores = true;

                    if (score === "-") {
                        dnf = true;
                        break;
                    }

                    const holeData = holeDataByHole.get(hole);
                    const par = Number(holeData?.par);
                    const holeHcp = Number(holeData?.hcp);

                    if (
                        courseHandicap === null ||
                        !Number.isFinite(par) ||
                        !Number.isInteger(holeHcp)
                    ) {
                        continue;
                    }

                    const receivedStrokes = getHandicapStrokesForHole(
                        courseHandicap,
                        holeHcp
                    );

                    grossTotal += score;
                    targetTotal += par + receivedStrokes;
                }

                display.classList.remove(
                    "handicap-status-under",
                    "handicap-status-even",
                    "handicap-status-over",
                    "handicap-status-unavailable"
                );

                if (dnf) {
                    display.textContent = "DNF";
                    display.classList.add("handicap-status-unavailable");
                    continue;
                }

                if (!hasScores) {
                    display.textContent = "0";
                    display.classList.add("handicap-status-even");
                    continue;
                }

                if (courseHandicap === null || targetTotal === 0) {
                    display.textContent = "–";
                    display.classList.add("handicap-status-unavailable");
                    continue;
                }

                const difference = grossTotal - targetTotal;
                display.textContent =
                    difference > 0 ? `+${difference}` : String(difference);

                if (difference < 0) {
                    display.classList.add("handicap-status-under");
                } else if (difference > 0) {
                    display.classList.add("handicap-status-over");
                } else {
                    display.classList.add("handicap-status-even");
                }
            }
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

            updateHandicapStrokePlayStatus();
            updateStablefordScorecard();
        }

        function getStablefordPoints(playerIndex, hole) {
            const scoreInput = document.querySelector(
                `.p${playerIndex + 1}[data-hole="${hole}"]`
            );
            const grossScore = normalizeScoreValue(scoreInput?.value);

            if (grossScore === "") {
                return null;
            }

            if (grossScore === "-") {
                return 0;
            }

            const rows = getPlayerSelectedCourseRows(playerIndex);
            const holeData = rows.find(row => Number(row.hole) === hole);
            const courseHandicap = calculatePlayerCourseHandicap(playerIndex);

            if (!holeData || courseHandicap === null) {
                return null;
            }

            const par = Number(holeData.par);
            const holeHcp = Number(holeData.hcp);

            if (!Number.isFinite(par) || !Number.isInteger(holeHcp)) {
                return null;
            }

            const handicapStrokes = getHandicapStrokesForHole(
                courseHandicap,
                holeHcp
            );
            const netScore = grossScore - handicapStrokes;

            return Math.max(0, 2 + par - netScore);
        }

        function getStablefordTotal(playerIndex, firstHole, lastHole) {
            let total = 0;

            for (let hole = firstHole; hole <= lastHole; hole++) {
                const points = getStablefordPoints(playerIndex, hole);

                if (typeof points === "number") {
                    total += points;
                }
            }

            return total;
        }

        function getStablefordPointClass(points) {
            if (points === null) return "";
            if (points <= 0) return "stableford-points-0";
            if (points === 1) return "stableford-points-1";
            if (points === 2) return "stableford-points-2";
            if (points === 3) return "stableford-points-3";
            return "stableford-points-4plus";
        }

        function buildStablefordScorecard() {
            if (!stablefordTableBody || !stablefordHeaderRow || !stablefordTotalRow) {
                return;
            }

            stablefordHeaderRow.innerHTML = `
                <th class="hole-cell">Reikä</th>
                <th class="course-stat-cell">Par</th>
                ${Array.from({ length: MAX_PLAYERS }, (_, index) => `
                    <th class="player-column" data-player="${index + 1}">
                        <span
                            class="stableford-player-name"
                            data-stableford-name="${index + 1}"
                        >
                            P${index + 1}
                        </span>
                    </th>
                `).join("")}
            `;

            stablefordTableBody.innerHTML = "";

            for (let hole = 1; hole <= 18; hole++) {
                const row = document.createElement("tr");
                row.dataset.stablefordHoleRow = hole;

                row.innerHTML = `
                    <td class="hole-cell">${hole}</td>
                    <td class="course-stat-cell stableford-par"
                        data-stableford-par="${hole}">–</td>
                    ${Array.from({ length: MAX_PLAYERS }, (_, index) => `
                        <td
                            class="player-column stableford-point-cell"
                            data-player="${index + 1}"
                            data-stableford-player="${index + 1}"
                            data-stableford-hole="${hole}"
                        ></td>
                    `).join("")}
                `;

                stablefordTableBody.appendChild(row);

                if (hole === 9 || hole === 18) {
                    const firstHole = hole === 9 ? 1 : 10;
                    const label = hole === 9 ? "Etuysi" : "Takaysi";
                    const subtotal = document.createElement("tr");
                    subtotal.className = "subtotal stableford-subtotal";
                    subtotal.innerHTML = `
                        <td>${label}</td>
                        <td></td>
                        ${Array.from({ length: MAX_PLAYERS }, (_, index) => `
                            <td
                                class="player-column"
                                data-player="${index + 1}"
                                data-stableford-subtotal-player="${index + 1}"
                                data-stableford-first-hole="${firstHole}"
                                data-stableford-last-hole="${hole}"
                            >0</td>
                        `).join("")}
                    `;
                    stablefordTableBody.appendChild(subtotal);
                }
            }

            stablefordTotalRow.innerHTML = `
                <td>Yhteensä</td>
                <td></td>
                ${Array.from({ length: MAX_PLAYERS }, (_, index) => `
                    <td
                        class="player-column"
                        data-player="${index + 1}"
                        data-stableford-total-player="${index + 1}"
                    >0</td>
                `).join("")}
            `;
        }

        function updateStablefordPlayerNames() {
            document.querySelectorAll("[data-stableford-name]").forEach(element => {
                const player = Number(element.dataset.stablefordName);
                const name = document.getElementById(`name${player}`)?.value.trim();
                element.textContent = name || `P${player}`;
            });
        }

        function updateStablefordScorecard() {
            if (!stablefordTableBody) {
                return;
            }

            updateStablefordPlayerNames();

            for (let hole = 1; hole <= 18; hole++) {
                const primaryHoleData = getHoleData(hole);
                const parCell = document.querySelector(
                    `[data-stableford-par="${hole}"]`
                );

                if (parCell) {
                    parCell.textContent = primaryHoleData?.par ?? "–";
                }

                for (let playerIndex = 0; playerIndex < MAX_PLAYERS; playerIndex++) {
                    const cell = document.querySelector(
                        `[data-stableford-player="${playerIndex + 1}"]` +
                        `[data-stableford-hole="${hole}"]`
                    );

                    if (!cell) continue;

                    const points = getStablefordPoints(playerIndex, hole);
                    cell.textContent = points === null ? "" : String(points);
                    cell.classList.remove(
                        "stableford-points-0",
                        "stableford-points-1",
                        "stableford-points-2",
                        "stableford-points-3",
                        "stableford-points-4plus"
                    );

                    const pointClass = getStablefordPointClass(points);
                    if (pointClass) {
                        cell.classList.add(pointClass);
                    }
                }
            }

            document.querySelectorAll("[data-stableford-subtotal-player]").forEach(cell => {
                const playerIndex =
                    Number(cell.dataset.stablefordSubtotalPlayer) - 1;
                const firstHole = Number(cell.dataset.stablefordFirstHole);
                const lastHole = Number(cell.dataset.stablefordLastHole);

                cell.textContent = getStablefordTotal(
                    playerIndex,
                    firstHole,
                    lastHole
                );
            });

            document.querySelectorAll("[data-stableford-total-player]").forEach(cell => {
                const playerIndex =
                    Number(cell.dataset.stablefordTotalPlayer) - 1;
                cell.textContent = getStablefordTotal(playerIndex, 1, 18);
            });
        }

        function toggleStablefordCard() {
            if (!stablefordCard || !stablefordToggleButton) {
                return;
            }

            const isVisible = stablefordCard.classList.toggle("visible");
            stablefordCard.setAttribute("aria-hidden", String(!isVisible));
            stablefordToggleButton.textContent = isVisible
                ? "Piilota Stableford-pisteet"
                : "Näytä Stableford-pisteet";

            if (isVisible) {
                updateStablefordScorecard();
                stablefordCard.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
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

        function normalizePlayerNameForVoice(value) {
            return String(value || "")
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9åäö]+/g, " ")
                .trim();
        }

        function getPlayerHolePar(playerIndex, hole) {
            const rows = getPlayerSelectedCourseRows(playerIndex);
            const row = rows.find(item => Number(item.hole) === Number(hole));
            const par = Number(row?.par);

            return Number.isFinite(par) && par > 0 ? par : null;
        }

        function extractVoiceHole(normalizedSpeech) {
            const holeMatch = normalizedSpeech.match(
                /(?:reika|reikä)\s+(\d{1,2}|[a-zåäö]+)/
            );

            if (!holeMatch) {
                return null;
            }

            const parsedHole = wordToNumber(holeMatch[1]);

            if (
                typeof parsedHole !== "number" ||
                parsedHole < 1 ||
                parsedHole > 18
            ) {
                throw new Error("Reiän tulee olla yksi - kahdeksantoista.");
            }

            return parsedHole;
        }

        function getGolfTermOffset(words, index) {
            const first = words[index] || "";
            const second = words[index + 1] || "";
            const joined = `${first} ${second}`.trim();

            const termOffsets = new Map([
                ["albatrossi", -3],
                ["albatros", -3],
                ["eagle", -2],
                ["iigle", -2],
                ["iikle", -2],
                ["kotka", -2],
                ["eagl", -2],
                ["birdie", -1],
                ["birtti", -1],
                ["bördiä", -1],
                ["pördiä", -1],
                ["bööri", -1],
                ["pööri", -1],
                ["börtti", -1],
                ["bird", -1],
                ["birdy", -1],
                ["birdi", -1],
                ["pordi", -1],
                ["pördi", -1],
                ["pördin", -1],
                ["bördin", -1],
                ["bordi", -1],
                ["bördi", -1],
                ["pöördy", -1],
                ["pöördi", -1],
                ["böördy", -1],
                ["böördi", -1],
                ["pöödi", -1],
                ["böödi", -1],
                ["börty", -1],
                ["pörty", -1],
                ["pörtti", -1],
                ["pirtti", -1],
                ["pörtsy", -1],
                ["portsy", -1],
                ["pirkku", -1],
                ["lintu", -1],
                ["sorsa", -1],
                ["par", 0],
                ["parsa", 0],
                ["bar", 0],
                ["bogey", 1],
                ["pokei", 1],
                ["bokea", 1],
                ["bogia", 1],
                ["pokey", 1],
                ["boki", 1],
                ["bogy", 1],
                ["bogi", 1],
                ["bogey", 1],
                ["bogin", 1],
                ["bogeyn", 1],
                ["boge", 1],
                ["poki", 1],
                ["poksu", 1],
                ["bogy", 1],
                ["bokkei", 1],
                ["bokki", 1],
                ["boogi", 1],
                ["bokey", 1],
                ["bokei", 1],
                ["bogei", 1],
                ["pokee", 1],
                ["tupla bogey", 2],
                ["tupla bogi", 2],
                ["tuplabogey", 2],
                ["tuplabogi", 2],
                ["tupla", 2],
                ["tripla bogey", 3],
                ["tripla bogi", 3],
                ["triplabogey", 3],
                ["triplabogi", 3],
                ["tripla", 3]
            ]);

            if (termOffsets.has(joined)) {
                return {
                    offset: termOffsets.get(joined),
                    consumed: 2,
                    term: joined
                };
            }

            if (termOffsets.has(first)) {
                return {
                    offset: termOffsets.get(first),
                    consumed: 1,
                    term: first
                };
            }

            return null;
        }

        function parseVoiceScoreAt(words, index, hole, playerIndex) {
            const word = words[index];

            if (!word) {
                return null;
            }

            if (isDashWord(word)) {
                return {
                    score: "-",
                    consumed: 1,
                    usedGolfTerm: false
                };
            }

            const number = wordToNumber(word);

            if (typeof number === "number" && number >= 1 && number <= 20) {
                return {
                    score: number,
                    consumed: 1,
                    usedGolfTerm: false
                };
            }

            const golfTerm = getGolfTermOffset(words, index);

            if (!golfTerm) {
                return null;
            }

            const par = getPlayerHolePar(playerIndex, hole);

            if (par === null) {
                throw new Error(
                    "Golftermiä ei voitu muuntaa, koska reiän Par-tieto puuttuu."
                );
            }

            const score = par + golfTerm.offset;

            if (score < 1 || score > 20) {
                throw new Error("Golftermistä laskettu tulos ei ole sallittu.");
            }

            return {
                score,
                consumed: golfTerm.consumed,
                usedGolfTerm: true
            };
        }

        function removeExplicitHoleWords(words) {
            const result = [...words];

            for (let index = 0; index < result.length - 1; index++) {
                if (result[index] === "reika" || result[index] === "reikä") {
                    result.splice(index, 2);
                    break;
                }
            }

            return result;
        }

        function parseOrderedGolfTermResults(spokenText) {
            const normalizedSpeech = normalizePlayerNameForVoice(spokenText);
            let hole = extractVoiceHole(normalizedSpeech) ?? nextHole;
            let words = removeExplicitHoleWords(
                normalizedSpeech.split(/\s+/).filter(Boolean)
            );

            // Tukee muotoa: "5 birdie par bogey".
            if (
                words.length > 1 &&
                /^\d{1,2}$/.test(words[0]) &&
                Number(words[0]) >= 1 &&
                Number(words[0]) <= 18
            ) {
                const possibleHole = Number(words[0]);
                const remainingWords = words.slice(1);
                const containsGolfTerm = remainingWords.some((_, index) =>
                    Boolean(getGolfTermOffset(remainingWords, index))
                );

                if (containsGolfTerm) {
                    hole = possibleHole;
                    words = remainingWords;
                }
            }

            const scoresByPlayer = new Map();
            let wordIndex = 0;
            let usedGolfTerm = false;

            for (let playerIndex = 0; playerIndex < playerCount; playerIndex++) {
                while (wordIndex < words.length) {
                    const parsed = parseVoiceScoreAt(
                        words,
                        wordIndex,
                        hole,
                        playerIndex
                    );

                    if (parsed) {
                        scoresByPlayer.set(playerIndex + 1, parsed.score);
                        usedGolfTerm ||= parsed.usedGolfTerm;
                        wordIndex += parsed.consumed;
                        break;
                    }

                    wordIndex += 1;
                }
            }

            if (!usedGolfTerm) {
                return null;
            }

            if (scoresByPlayer.size < playerCount) {
                throw new Error("Tuloksia puuttuu.");
            }

            // Ylimääräiset tulos- tai golftermit tulkitaan virheeksi.
            for (; wordIndex < words.length; wordIndex++) {
                const extra = parseVoiceScoreAt(
                    words,
                    wordIndex,
                    hole,
                    Math.min(playerCount - 1, 0)
                );

                if (extra) {
                    throw new Error("Liikaa tuloksia.");
                }
            }

            return { hole, scoresByPlayer };
        }

        function parseExplicitHoleOrderedResults(spokenText) {
            const normalizedSpeech = normalizePlayerNameForVoice(spokenText);

            const match = normalizedSpeech.match(
                /(?:^|\s)reika\s*(\d+)(?:\s+|$)(.*)$/i
            );

            if (!match) {
                return null;
            }

            let holeDigits = String(match[1] || "");
            let scoreText = String(match[2] || "").trim();

            // Jos Safari yhdistää reiän ja tulokset:
            // "reikä 4444" -> reikä 4 ja tulokset 444.
            if (
                !scoreText &&
                holeDigits.length > playerCount
            ) {
                const oneDigitHole = Number(holeDigits.slice(0, 1));
                const twoDigitHole = Number(holeDigits.slice(0, 2));

                if (
                    holeDigits.length === playerCount + 1 &&
                    oneDigitHole >= 1 &&
                    oneDigitHole <= 9
                ) {
                    scoreText = holeDigits.slice(1);
                    holeDigits = holeDigits.slice(0, 1);
                } else if (
                    holeDigits.length === playerCount + 2 &&
                    twoDigitHole >= 10 &&
                    twoDigitHole <= 18
                ) {
                    scoreText = holeDigits.slice(2);
                    holeDigits = holeDigits.slice(0, 2);
                }
            }

            const hole = Number(holeDigits);

            if (hole < 1 || hole > 18) {
                throw new Error("Reiän tulee olla yksi - kahdeksantoista.");
            }

            if (!scoreText) {
                throw new Error("Tuloksia puuttuu.");
            }

            // Nimellinen korjaus jätetään nykyisen nimiparserin käsiteltäväksi.
            const activeNames = Array.from(
                { length: playerCount },
                (_, index) => normalizePlayerNameForVoice(
                    document.getElementById(`name${index + 1}`)?.value || ""
                )
            ).filter(Boolean);

            if (
                activeNames.some(name =>
                    new RegExp(`(?:^|\\s)${name}(?:\\s|$)`).test(scoreText)
                )
            ) {
                return null;
            }

            let scoreWords = scoreText.split(/\s+/).filter(Boolean);

            // Tukee muotoa "reikä 2 555" kolmen pelaajan pelissä.
            if (
                scoreWords.length === 1 &&
                /^\d+$/.test(scoreWords[0]) &&
                scoreWords[0].length === playerCount
            ) {
                scoreWords = scoreWords[0].split("");
            }

            const scoresByPlayer = new Map();
            let wordIndex = 0;

            for (let playerIndex = 0; playerIndex < playerCount; playerIndex++) {
                const parsed = parseVoiceScoreAt(
                    scoreWords,
                    wordIndex,
                    hole,
                    playerIndex
                );

                if (!parsed) {
                    throw new Error("Tuloksia puuttuu.");
                }

                scoresByPlayer.set(playerIndex + 1, parsed.score);
                wordIndex += parsed.consumed;
            }

            if (wordIndex !== scoreWords.length) {
                throw new Error("Liikaa tuloksia.");
            }

            return { hole, scoresByPlayer };
        }

        function parseNamedVoiceResults(spokenText) {
            const normalizedSpeech = normalizePlayerNameForVoice(spokenText);
            const words = normalizedSpeech.split(/\s+/).filter(Boolean);
            const playerMatches = [];
            const hole = extractVoiceHole(normalizedSpeech) ?? nextHole;

            for (let player = 1; player <= playerCount; player++) {
                const inputName =
                    document.getElementById(`name${player}`).value.trim();

                if (!inputName) {
                    continue;
                }

                const normalizedName =
                    normalizePlayerNameForVoice(inputName);
                const nameWords =
                    normalizedName.split(/\s+/).filter(Boolean);

                if (nameWords.length === 0) {
                    continue;
                }

                for (
                    let index = 0;
                    index <= words.length - nameWords.length;
                    index++
                ) {
                    const matches = nameWords.every((word, offset) =>
                        words[index + offset] === word
                    );

                    if (!matches) {
                        continue;
                    }

                    const parsed = parseVoiceScoreAt(
                        words,
                        index + nameWords.length,
                        hole,
                        player - 1
                    );

                    if (parsed) {
                        playerMatches.push({
                            player,
                            score: parsed.score,
                            index
                        });
                        break;
                    }
                }
            }

            if (playerMatches.length === 0) {
                return null;
            }

            const uniquePlayers = new Map();

            playerMatches
                .sort((a, b) => a.index - b.index)
                .forEach(match =>
                    uniquePlayers.set(match.player, match.score)
                );

            if (uniquePlayers.size < playerCount) {
                throw new Error("Tuloksia puuttuu.");
            }

            return {
                hole,
                scoresByPlayer: uniquePlayers
            };
        }

        function findNextIncompleteHole() {
            const playedHoleOrder = getPlayedHoleOrder();

            for (const hole of playedHoleOrder) {
                const holeComplete = Array.from(
                    { length: playerCount },
                    (_, index) => document.querySelector(
                        `.p${index + 1}[data-hole="${hole}"]`
                    )
                ).every(input => normalizeScoreValue(input?.value) !== "");

                if (!holeComplete) {
                    return hole;
                }
            }

            return startHole;
        }

        function saveParsedScores(hole, scoresByPlayer) {
            const addedScores = [];

            for (let player = 1; player <= playerCount; player++) {
                const score = scoresByPlayer.get(player);
                const input = document.querySelector(
                    `.p${player}[data-hole="${hole}"]`
                );

                if (!input) {
                    continue;
                }

                input.value = score === "-" ? "-" : String(score);

                const playerName =
                    document.getElementById(`name${player}`).value.trim() ||
                    `P${player}`;

                addedScores.push(
                    `${playerName}: ${score === "-" ? "viiva" : score}`
                );
            }

            calculateScores();
            nextHole = findNextIncompleteHole();
            roundSetupConfirmed = true;
            updateNextHole();
            updateRoundCompleteState();
            updateRoundLayout();
            saveState();

            return { hole, addedScores };
        }

        function parseVoiceResults(spokenText) {
            const explicitHoleResult =
                parseExplicitHoleOrderedResults(spokenText);

            if (explicitHoleResult) {
                return saveParsedScores(
                    explicitHoleResult.hole,
                    explicitHoleResult.scoresByPlayer
                );
            }

            const namedResult = parseNamedVoiceResults(spokenText);

            if (namedResult) {
                return saveParsedScores(
                    namedResult.hole,
                    namedResult.scoresByPlayer
                );
            }

            const orderedGolfResult =
                parseOrderedGolfTermResults(spokenText);

            if (orderedGolfResult) {
                return saveParsedScores(
                    orderedGolfResult.hole,
                    orderedGolfResult.scoresByPlayer
                );
            }

            let tokens = extractVoiceTokens(spokenText);

            if (
                tokens.length === 1 &&
                typeof tokens[0] === "number" &&
                /^[1-9]+$/.test(String(tokens[0])) &&
                String(tokens[0]).length === playerCount
            ) {
                tokens = String(tokens[0])
                    .split("")
                    .map(Number);
            }

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
                throw new Error("Reiän tulee olla yksi - kahdeksantoista.");
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

            const scoresByPlayer = new Map();

            scores.forEach((score, index) => {
                scoresByPlayer.set(index + 1, score);
            });

            return saveParsedScores(hole, scoresByPlayer);
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

                    // 18. reikä ei päätä kierrosta automaattisesti.
                    // Käyttäjä päättää kierroksen Päätä kierros -painikkeella.
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
            // Ennen ensimmäistä kirjausta näkymä seuraa suoraan asetettua aloitusreikää.
            // Kierroksen aikana näkymä seuraa seuraavaa kirjattavaa reikää, ellei
            // käyttäjä ole vaihtanut näkymää Etuysi / Takaysi -painikkeella.
            const setupHole = Number(startHoleInput?.value);
            const visibleHole = !roundSetupConfirmed && setupHole >= 1 && setupHole <= 18
                ? setupHole
                : nextHole;
            const automaticBackNine = visibleHole >= 10 || roundComplete;
            const showBackNine = manualNineView === "back"
                ? true
                : manualNineView === "front"
                    ? false
                    : automaticBackNine;

            document.body.classList.toggle("round-active", roundSetupConfirmed || roundComplete);
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

            if (nineViewButton) {
                nineViewButton.textContent = showBackNine
                    ? "Näytä etuysi"
                    : "Näytä takaysi";
            }
        }

        function toggleNineView() {
            const showingBackNine = document.body.classList.contains("show-back-nine");
            manualNineView = showingBackNine ? "front" : "back";
            updateRoundLayout();
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
            syncPlayerRoundSettingsFromInputs();

            const state = {
                playerCount,
                roundSetupConfirmed,
                startHole,
                nextHole,
                roundComplete,
                frontNineAnnounced,
                announceStandings,
                courseId: selectedCourseId,
                tee: selectedTee,
                gender: selectedGender,
                playerHandicaps: [...playerHandicaps],
                playerTees: [...playerTees],
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
                startHole = 1;
                updateNextHole();
                updateRoundLayout();
                return;
            }

            try {
                const state = JSON.parse(raw);

                playerCount = Number(state.playerCount) || 1;
                roundSetupConfirmed = Boolean(state.roundSetupConfirmed);
                startHole = Number(state.startHole) || 1;
                nextHole = Number(state.nextHole) || 1;

                if (startHoleInput) {
                    startHoleInput.value = roundSetupConfirmed
                        ? String(startHole)
                        : (state.startHole ? String(startHole) : "");
                }
                roundComplete = Boolean(state.roundComplete);
                frontNineAnnounced = Boolean(state.frontNineAnnounced);
                announceStandings = Boolean(state.announceStandings);
                announceStandingsInput.checked = announceStandings;
                playerHandicaps = Array.from({ length: MAX_PLAYERS }, (_, index) =>
                    String(state.playerHandicaps?.[index] ?? "")
                );
                playerTees = Array.from({ length: MAX_PLAYERS }, (_, index) =>
                    String(state.playerTees?.[index] ?? "")
                );

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

                restorePlayerRoundSettings();
                setPlayerCount(playerCount);
                updateNextHole();
                calculateScores();
                updateRoundCompleteState();
                updateRoundLayout();
            } catch (error) {
                localStorage.removeItem(STORAGE_KEY);
                setPlayerCount(1);
                startHole = 1;
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
            if (startHole !== 1 || frontNineAnnounced || !isFrontNineComplete()) {
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

            if (saveRoundActionButton) {
                saveRoundActionButton.hidden = !roundComplete;
            }

            const configuredStartHole = Number(startHoleInput?.value);
            const startHoleConfirmed =
                configuredStartHole >= 1 && configuredStartHole <= 18;
            const historyAvailable =
                roundComplete || (!roundSetupConfirmed && !startHoleConfirmed);

            if (historyActionButton) {
                historyActionButton.hidden = !historyAvailable;
            }

            if (!historyAvailable && historyCard) {
                historyCard.classList.remove("visible");
            }
        }

        function finishRound() {
            const playedHoles = getPlayedHoleCount();

            if (playedHoles < 18) {
                voiceStatus.textContent =
                    "Kierros ei ole vielä valmis. Pelaa 18 reikää ennen päättämistä.";
                speakMessage("Kierros ei ole vielä valmis");
                return;
            }

            roundComplete = true;
            updateRoundCompleteState();
            saveState();
            showRoundCompleteModal();
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


        function calculateSavedStableford(scores) {
            if (!Array.isArray(scores)) return { out: 0, in: 0, total: 0 };

            const calc = (start, end) => scores
                .slice(start, end)
                .reduce((sum, value) => {
                    const score = Number(value);
                    return sum + (Number.isFinite(score) && score > 0 ? score : 0);
                }, 0);

            return {
                out: calc(0, 9),
                in: calc(9, 18),
                total: calc(0, 18)
            };
        }

        function buildRoundSnapshot() {
            const snapshot = {
                id: crypto.randomUUID
                    ? crypto.randomUUID()
                    : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                savedAt: new Date().toISOString(),
                course: courseNameInput.value.trim() || getSelectedCourseName() || "Kenttä nimeämättä",
                courseId: selectedCourseId,
                tee: selectedTee,
                gender: selectedGender,
                date: roundDateInput.value || getTodayDateValue(),
                gameFormat: gameFormatInput.value,
                notes: roundNotesInput.value.trim(),
                playerCount,
                names: [],
                scores: {},
                totals: {},
                stableford: {},
                stablefordPoints: {},
                par: Array.from({ length: 18 }, (_, index) =>
                    Number(getHoleData(index + 1)?.par) || 0
                ),
                holeHcp: Array.from({ length: 18 }, (_, index) =>
                    Number(getHoleData(index + 1)?.hcp) || 0
                ),
                playerHandicaps: playerHandicaps.slice(0, playerCount),
                playerTees: playerTees.slice(0, playerCount)
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

                snapshot.stablefordPoints[player] = Array.from(
                    { length: 18 },
                    (_, index) => {
                        const points = getStablefordPoints(player - 1, index + 1);
                        return typeof points === "number" ? points : null;
                    }
                );

                snapshot.stableford[player] = {
                    out: snapshot.stablefordPoints[player]
                        .slice(0, 9)
                        .reduce((sum, value) => sum + (Number(value) || 0), 0),
                    in: snapshot.stablefordPoints[player]
                        .slice(9, 18)
                        .reduce((sum, value) => sum + (Number(value) || 0), 0),
                    total: snapshot.stablefordPoints[player]
                        .reduce((sum, value) => sum + (Number(value) || 0), 0)
                };
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
                300,
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
                const stableford = round.stableford?.[player];
                const parTotal = Array.from({length:18}, (_,i)=>round.par?.[i] || 0).reduce((a,b)=>a+b,0);
                const strokeDiff = Number.isFinite(Number(total)) && parTotal ? Number(total)-Number(parTotal) : null;

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

                context.textAlign = "left";
                context.font = "600 17px Arial";
                context.fillStyle = "#506252";
                const diffText = strokeDiff === null ? "" : `Lyöntipeli ${strokeDiff > 0 ? "+" : ""}${strokeDiff}`;
                const stableText = stableford ? `Pistebogey ${stableford.total} p` : "";
                context.fillText(`${diffText}${diffText && stableText ? " · " : ""}${stableText}`, summaryX[0], y + 24);
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


        function getSavedStablefordPoints(round, player) {
            const saved = round.stablefordPoints?.[player];

            if (Array.isArray(saved) && saved.length >= 18) {
                return saved.slice(0, 18).map(value =>
                    value === null || value === undefined ? null : Number(value)
                );
            }

            return Array.from({ length: 18 }, () => null);
        }

        function getSharePointColors(points) {
            if (points === null || points === undefined) {
                return { background: "#ffffff", text: "#173019" };
            }
            if (points <= 0) {
                return { background: "#f3f5f2", text: "#68756a" };
            }
            if (points === 1) {
                return { background: "#fff2d6", text: "#7a5100" };
            }
            if (points === 2) {
                return { background: "#eaf5e5", text: "#173f18" };
            }
            if (points === 3) {
                return { background: "#d8efd0", text: "#173f18" };
            }
            return { background: "#c0e5b6", text: "#173f18" };
        }

        async function createAppScorecardCanvas(round, mode = "stroke") {
            const canvas = document.createElement("canvas");
            canvas.width = 1240;
            canvas.height = 1840;

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
            const soft = "#e8f1e4";

            const background = context.createLinearGradient(0, 0, 0, height);
            background.addColorStop(0, forest);
            background.addColorStop(0.22, "#315f31");
            background.addColorStop(0.58, "#d7ebcf");
            background.addColorStop(1, "#eef6e9");
            context.fillStyle = background;
            context.fillRect(0, 0, width, height);

            const logo = await loadShareLogo();
            if (logo) {
                fillRoundedRect(context, 62, 46, 106, 106, 24, white);
                context.drawImage(logo, 72, 56, 86, 86);
            }

            context.fillStyle = white;
            context.textAlign = "left";
            context.font = "700 30px Arial";
            context.fillText("GOLF VOICE", 194, 80);
            context.font = "800 52px Georgia";
            context.fillText("Scorecard AI", 194, 132);

            context.fillStyle = gold;
            context.font = "700 20px Arial";
            context.fillText("BY PETRI SUOKAS · POWERED BY AI", 194, 168);

            fillRoundedRect(context, 42, 204, width - 84, height - 250, 34, cream);

            context.fillStyle = forestTwo;
            context.font = "900 24px Arial";
            context.textAlign = "left";
            context.fillText(
                mode === "stableford" ? "STABLEFORD-PISTEET" : "TULOSKORTTI",
                76,
                258
            );

            context.fillStyle = ink;
            const course = round.course || "Kenttä nimeämättä";
            const courseSize = fitCanvasText(context, course, width - 152, 44, 28);
            context.font = `800 ${courseSize}px Georgia`;
            context.fillText(course, 76, 316);

            context.fillStyle = "#4f6451";
            context.font = "700 23px Arial";
            context.fillText(
                `${formatDate(round.date)} · ${mode === "stableford" ? "Stableford" : (round.gameFormat || "Lyöntipeli")}`,
                76,
                354
            );

            const tableLeft = 64;
            const tableTop = 394;
            const tableWidth = width - 128;
            const headerHeight = 62;
            const rowHeight = 55;
            const rows = [];

            for (let hole = 1; hole <= 18; hole++) {
                rows.push({ type: "hole", hole, label: String(hole) });

                if (hole === 9) {
                    rows.push({ type: "front", label: "Etuysi" });
                }
                if (hole === 18) {
                    rows.push({ type: "back", label: "Takaysi" });
                }
            }
            rows.push({ type: "total", label: "Yhteensä" });

            const tableHeight = headerHeight + rows.length * rowHeight;
            fillRoundedRect(context, tableLeft, tableTop, tableWidth, tableHeight, 22, white);

            context.save();
            roundedRectPath(context, tableLeft, tableTop, tableWidth, tableHeight, 22);
            context.clip();

            const fixedColumns = mode === "stableford"
                ? [112, 92]
                : [112, 82, 88];
            const fixedWidth = fixedColumns.reduce((sum, value) => sum + value, 0);
            const playerWidth = (tableWidth - fixedWidth) / round.names.length;

            context.fillStyle = forest;
            context.fillRect(tableLeft, tableTop, tableWidth, headerHeight);

            const headers = mode === "stableford"
                ? ["Reikä", "Par"]
                : ["Reikä", "Par", "HCP"];

            let x = tableLeft;
            context.fillStyle = white;
            context.textAlign = "center";
            context.font = "800 21px Arial";

            headers.forEach((header, index) => {
                const columnWidth = fixedColumns[index];
                context.fillText(header, x + columnWidth / 2, tableTop + 39);
                x += columnWidth;
            });

            round.names.forEach((name, index) => {
                const center = tableLeft + fixedWidth + playerWidth * index + playerWidth / 2;
                const size = fitCanvasText(context, name, playerWidth - 12, 21, 12);
                context.font = `800 ${size}px Arial`;
                context.fillText(name, center, tableTop + 39);
            });

            rows.forEach((row, rowIndex) => {
                const y = tableTop + headerHeight + rowIndex * rowHeight;
                const isSummary = row.type !== "hole";

                context.fillStyle = row.type === "total"
                    ? forest
                    : isSummary
                        ? mint
                        : rowIndex % 2 === 0
                            ? white
                            : "#f7faf5";
                context.fillRect(tableLeft, y, tableWidth, rowHeight);

                context.fillStyle = row.type === "total" ? white : (isSummary ? forest : ink);
                context.font = `${isSummary ? "800" : "700"} 20px Arial`;
                context.textAlign = "center";

                context.fillText(row.label, tableLeft + fixedColumns[0] / 2, y + 35);

                if (row.type === "hole") {
                    const par = Number(round.par?.[row.hole - 1]) || "–";
                    context.fillText(
                        String(par),
                        tableLeft + fixedColumns[0] + fixedColumns[1] / 2,
                        y + 35
                    );

                    if (mode === "stroke") {
                        const holeHcp = Number(round.holeHcp?.[row.hole - 1]) || "–";
                        context.fillText(
                            String(holeHcp),
                            tableLeft + fixedColumns[0] + fixedColumns[1] + fixedColumns[2] / 2,
                            y + 35
                        );
                    }
                }

                round.names.forEach((name, index) => {
                    const player = index + 1;
                    let value = "";
                    let cellBackground = null;
                    let textColor = row.type === "total" ? white : ink;

                    if (mode === "stableford") {
                        const points = getSavedStablefordPoints(round, player);

                        if (row.type === "hole") {
                            value = points[row.hole - 1];
                            const pointColors = getSharePointColors(value);
                            cellBackground = pointColors.background;
                            textColor = pointColors.text;
                            value = value === null ? "–" : String(value);
                        } else if (row.type === "front") {
                            value = points.slice(0, 9).reduce((sum, item) => sum + (Number(item) || 0), 0);
                        } else if (row.type === "back") {
                            value = points.slice(9, 18).reduce((sum, item) => sum + (Number(item) || 0), 0);
                        } else {
                            value = points.reduce((sum, item) => sum + (Number(item) || 0), 0);
                        }
                    } else {
                        const scores = round.scores[player] || [];

                        if (row.type === "hole") {
                            value = getShareScoreValue(scores[row.hole - 1]) || "–";
                        } else if (row.type === "front") {
                            value = calculateSharedNine(scores, 0, 9);
                        } else if (row.type === "back") {
                            value = calculateSharedNine(scores, 9, 18);
                        } else {
                            value = round.totals[player];
                        }
                    }

                    const cellX = tableLeft + fixedWidth + playerWidth * index;

                    if (cellBackground && row.type === "hole") {
                        context.fillStyle = cellBackground;
                        context.fillRect(cellX, y, playerWidth, rowHeight);
                    }

                    context.fillStyle = row.type === "total" ? white : textColor;
                    context.font = `${isSummary ? "800" : "700"} 22px Arial`;
                    context.fillText(
                        String(value),
                        cellX + playerWidth / 2,
                        y + 35
                    );
                });
            });

            context.strokeStyle = line;
            context.lineWidth = 2;

            for (let rowIndex = 0; rowIndex <= rows.length; rowIndex++) {
                const y = tableTop + headerHeight + rowIndex * rowHeight;
                context.beginPath();
                context.moveTo(tableLeft, y);
                context.lineTo(tableLeft + tableWidth, y);
                context.stroke();
            }

            let columnX = tableLeft;
            fixedColumns.forEach(columnWidth => {
                columnX += columnWidth;
                context.beginPath();
                context.moveTo(columnX, tableTop);
                context.lineTo(columnX, tableTop + tableHeight);
                context.stroke();
            });

            for (let player = 1; player < round.names.length; player++) {
                const playerX = tableLeft + fixedWidth + playerWidth * player;
                context.beginPath();
                context.moveTo(playerX, tableTop);
                context.lineTo(playerX, tableTop + tableHeight);
                context.stroke();
            }

            context.restore();

            context.fillStyle = "#607262";
            context.textAlign = "center";
            context.font = "600 18px Arial";
            context.fillText("Petri Suokas", width / 2, height - 54);
            context.font = "800 18px Arial";
            context.fillText("AI Golf Apps", width / 2, height - 28);

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
            const lines = [
                "Golf Voice Scorecard AI",
                "Petri Suokas · AI Golf Apps",
                `${round.course || "Kenttä nimeämättä"} – ${formatDate(round.date)}`,
                ""
            ];

            round.names.forEach((name, index) => {
                const player = index + 1;
                const stableford = round.stableford?.[player];
                lines.push(`${name}`);
                lines.push(`Lyöntipeli: ${round.totals[player]}`);
                if (stableford) {
                    lines.push(`Pistebogey: ${stableford.total} p (OUT ${stableford.out} / IN ${stableford.in})`);
                }
                lines.push("");
            });

            lines.push("Tuloskortti liitteenä.");
            return lines.join("\n");
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
                button.textContent = "Luodaan kaksi tuloskorttia…";
            });

            try {
                const strokeCanvas = await createAppScorecardCanvas(round, "stroke");
                const stablefordCanvas = await createAppScorecardCanvas(round, "stableford");

                const [strokeBlob, stablefordBlob] = await Promise.all([
                    canvasToBlob(strokeCanvas),
                    canvasToBlob(stablefordCanvas)
                ]);

                const safeCourse = String(round.course || "golfkierros")
                    .replace(/[^\p{L}\p{N}_-]+/gu, "_")
                    .replace(/^_+|_+$/g, "")
                    .slice(0, 40) || "golfkierros";

                const baseName = `Golf_Voice_${safeCourse}_${round.date || "kierros"}`;

                const strokeFile = new File(
                    [strokeBlob],
                    `${baseName}_Lyontipeli.png`,
                    { type: "image/png" }
                );

                const stablefordFile = new File(
                    [stablefordBlob],
                    `${baseName}_Stableford.png`,
                    { type: "image/png" }
                );

                const files = [strokeFile, stablefordFile];

                if (
                    navigator.share &&
                    (!navigator.canShare || navigator.canShare({ files }))
                ) {
                    try {
                        await navigator.share({
                            title: `Golfkierros – ${round.course}`,
                            files
                        });
                        return;
                    } catch (error) {
                        if (error.name === "AbortError") {
                            return;
                        }
                        console.warn("Kahden kuvan jako epäonnistui:", error);
                    }
                }

                [
                    { blob: strokeBlob, name: strokeFile.name },
                    { blob: stablefordBlob, name: stablefordFile.name }
                ].forEach(item => {
                    const imageUrl = URL.createObjectURL(item.blob);
                    const downloadLink = document.createElement("a");
                    downloadLink.href = imageUrl;
                    downloadLink.download = item.name;
                    downloadLink.rel = "noopener";
                    document.body.appendChild(downloadLink);
                    downloadLink.click();
                    downloadLink.remove();

                    window.setTimeout(() => {
                        URL.revokeObjectURL(imageUrl);
                    }, 4000);
                });
            } catch (error) {
                console.error("Tuloskorttien jakaminen epäonnistui:", error);
                alert("Kahden tuloskorttikuvan luominen epäonnistui.");
            } finally {
                shareButtons.forEach(button => {
                    button.disabled = false;
                    button.textContent = "📤 Jaa tuloskortti";
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
            roundSetupConfirmed = false;
            manualNineView = null;
            startHole = 1;
            if (startHoleInput) startHoleInput.value = "";
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
                applyPrimaryPlayerTeeToScorecard();
                updateRoundLayout();
                updateSelectedCourseInfo();
                saveState();
            });
        });

        document.querySelectorAll(".player-name").forEach(input => {
            input.dataset.previousName = input.value.trim();

            input.addEventListener("focus", () => {
                input.dataset.previousName = input.value.trim();

                const genericName = /^P[1-4]$/i.test(input.value.trim());
                if (genericName) {
                    input.value = "";
                    updatePlayerSettingNames();
                }
            });

            input.addEventListener("input", () => {
                updatePlayerSettingNames();
                updateStablefordPlayerNames();
                saveState();
            });

            input.addEventListener("change", () => {
                const playerIndex = Number(input.id.replace("name", "")) - 1;
                const previousName = String(input.dataset.previousName || "").trim();
                const currentName = input.value.trim();

                if (previousName !== currentName) {
                    resetPlayerDetailsAfterNameChange(playerIndex);
                }

                input.dataset.previousName = currentName;
                updatePlayerSettingNames();
                updateStablefordPlayerNames();
                saveState();
            });
        });

        playerHcpInputs.forEach((input, index) => {
            if (!input) return;

            input.addEventListener("input", () => {
                playerHandicaps[index] = input.value.trim();
                updatePlayerTeeSelectColors();
                updatePlayerCourseHandicapsAndStrokeMarkers();
                saveState();
            });
        });

        playerTeeSelects.forEach((select, index) => {
            if (!select) return;

            select.addEventListener("change", () => {
                playerTees[index] = select.value;
                updatePlayerTeeSelectColors();

                // Tuloskortin Par/HCP-näkymä seuraa ensimmäisen aktiivisen
                // pelaajan tii-/ryhmävalintaa. Muiden pelaajien valinnat säilyvät erillisinä.
                if (index === 0 || !playerTees[0]) {
                    applyPrimaryPlayerTeeToScorecard();
                    buildScoreTable();
                    setPlayerCount(playerCount);
                    calculateScores();
                    updateRoundLayout();
                    updateSelectedCourseInfo();
                }

                updatePlayerCourseHandicapsAndStrokeMarkers();
                saveState();
            });
        });

        courseSelect.addEventListener("change", () => {
            selectedCourseId = courseSelect.value;
            populateGenderOptions();
            populateTeeOptions();
            refreshScoreTableForCourse();
        });

        genderSelect.addEventListener("change", () => {
            selectedGender = genderSelect.value;
            populateTeeOptions();
            refreshScoreTableForCourse();
        });

        teeSelect.addEventListener("change", () => {
            selectedTee = teeSelect.value;
            refreshScoreTableForCourse();
        });

        if (startHoleInput) {
            const selectStartHoleValue = () => {
                if (startHoleInput.value) {
                    startHoleInput.select();
                }
            };

            startHoleInput.addEventListener("focus", selectStartHoleValue);
            startHoleInput.addEventListener("click", selectStartHoleValue);

            const applyStartHole = () => {
                if (startHoleInput.value === "") {
                    startHole = 1;
                    nextHole = 1;
                    updateNextHole();
                    updateRoundCompleteState();
                    updateRoundLayout();
                    saveState();
                    return;
                }

                const value = Number(startHoleInput.value);
                if (value >= 1 && value <= 18) {
                    startHole = value;
                    nextHole = value;
                    updateNextHole();
                    updateRoundCompleteState();
                    updateRoundLayout();
                    saveState();
                }
            };

            startHoleInput.addEventListener("input", applyStartHole);
            startHoleInput.addEventListener("change", applyStartHole);
            startHoleInput.addEventListener("blur", applyStartHole);
        }

        announceStandingsInput.addEventListener("change", () => {
            announceStandings = announceStandingsInput.checked;
            saveState();
        });

        async function initializeApp() {
            await loadCourseData();
            buildScoreTable();
            buildStablefordScorecard();
            loadState();
            restorePlayerRoundSettings();
            updateSelectedCourseInfo();
            updateRoundCompleteState();
            updateRoundLayout();
            prepareRoundMetadataForm();
            renderHistory();
            processResultsFromUrl();
        }

        initializeApp();
