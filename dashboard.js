/* global SEASONS, getRaceRowsForSeason, getDriverRowsForSeason */

(function () {
  window.DATA_READY.then(() => {
    // -----------------------------
    // State
    // -----------------------------
    let selectedSeason = null;
  
    // -----------------------------
    // Elements
    // -----------------------------
    const seasonSelect = document.getElementById("seasonSelect");
  
    const tabRaces = document.getElementById("tabRaces");
    const tabDrivers = document.getElementById("tabDrivers");
    const tabTeams = document.getElementById("tabTeams");
  
    const viewRaces = document.getElementById("viewRaces");
    const viewDrivers = document.getElementById("viewDrivers");
    const viewTeams = document.getElementById("viewTeams");
  
    const racesTitle = document.getElementById("racesTitle");
    const driversTitle = document.getElementById("driversTitle");
    const teamsTitle = document.getElementById("teamsTitle");
  
    const racesTbody = document.getElementById("racesTbody");
    const driversTbody = document.getElementById("driversTbody");
    const teamsTbody = document.getElementById("teamsTbody");
  
    const raceModal = document.getElementById("raceModal");
    const raceModalTitle = document.getElementById("raceModalTitle");
    const closeModalBtn = document.getElementById("closeModalBtn");
  
    const compareDriversBtn = document.getElementById("compareDriversBtn");
  

    if (window.SeasonTimeline?.mount) {
      window.SeasonTimeline.mount("#seasonTimeline", { basePath: "Season_Timeline" });
    }

    if (window.CircuitMap?.mount) {
      window.CircuitMap.mount("#circuitMap", { basePath: "Circuit_Map", initialYear: selectedSeason });
    }

    // -----------------------------
    // Init dropdown
    // -----------------------------
    SEASONS.forEach((y) => {
      const opt = document.createElement("option");
      opt.value = y;
      opt.textContent = y;
      seasonSelect.appendChild(opt);
    });
  
    selectedSeason = Math.max(...SEASONS);
    seasonSelect.value = selectedSeason;
  
    seasonSelect.addEventListener("change", (e) => {
      selectedSeason = Number(e.target.value);
      renderAll();
    });
  
    // -----------------------------
    // Tabs
    // -----------------------------
    tabRaces.addEventListener("click", () => activateTab("races"));
    tabDrivers.addEventListener("click", () => activateTab("drivers"));
    tabTeams.addEventListener("click", () => activateTab("teams"));
  
    function activateTab(which) {
      const isRaces = which === "races";
      const isDrivers = which === "drivers";
      const isTeams = which === "teams";
    
      tabRaces?.classList.toggle("active", isRaces);
      tabDrivers?.classList.toggle("active", isDrivers);
      tabTeams?.classList.toggle("active", isTeams);
    
      tabRaces?.setAttribute("aria-selected", String(isRaces));
      tabDrivers?.setAttribute("aria-selected", String(isDrivers));
      tabTeams?.setAttribute("aria-selected", String(isTeams));
    
      viewRaces?.classList.toggle("active", isRaces);
      viewDrivers?.classList.toggle("active", isDrivers);
      viewTeams?.classList.toggle("active", isTeams);
    
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    
  
    // -----------------------------
    // Titles
    // -----------------------------
    function setTitles() {
      if (!selectedSeason) {
        racesTitle.textContent = `Race Results`;
        driversTitle.textContent = `Driver Standings`;
        teamsTitle.textContent = `Team Standings`;
      } else {
        racesTitle.textContent = `${selectedSeason} Race Results`;
        driversTitle.textContent = `${selectedSeason} Driver Standings`;
        teamsTitle.textContent = `${selectedSeason} Team Standings`;
      }
    }
  
    // -----------------------------
    // Tables
    // -----------------------------
    function renderRacesTable() {
      racesTbody.innerHTML = "";
      const rows = getRaceRowsForSeason(selectedSeason);
  
      rows.forEach((r) => {
        const tr = document.createElement("tr");
        tr.dataset.raceId = r.id;
  
        tr.innerHTML = `
          <td>
            <div class="cell-main">
              <span class="flag" aria-hidden="true"></span>
              <span style="font-weight:900;">${r.gp}</span>
            </div>
          </td>
          <td class="muted">${r.date}</td>
          <td>
            <div class="cell-main">
              <span class="driver-dot" aria-hidden="true"></span>
              <span style="font-weight:900;">${r.winner}</span>
            </div>
          </td>
          <td class="muted">${r.team}</td>
          <td class="num">${r.laps}</td>
          <td class="time">${r.time}</td>
        `;
  
        tr.addEventListener("click", () => openRaceModal(r));
        racesTbody.appendChild(tr);
      });
    }
  
    function renderDriversTable() {
      driversTbody.innerHTML = "";
      const rows = getDriverRowsForSeason(selectedSeason);
  
      rows.forEach((d) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td style="font-weight:1000;">${d.pos}</td>
          <td>
            <div class="cell-main">
              <span class="driver-dot" aria-hidden="true"></span>
              <span style="font-weight:900;">${d.driver}</span>
            </div>
          </td>
          <td class="muted">${d.nat}</td>
          <td class="muted">${d.team}</td>
          <td class="pts">${d.pts}</td>
        `;
        driversTbody.appendChild(tr);
      });
    }

    function renderTeamsTable() {
      if (!teamsTbody || !selectedSeason) return;
    
      teamsTbody.innerHTML = "";
    
      const rows = getConstructorRowsForSeason(selectedSeason);
    
      rows.forEach(r => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td style="font-weight:1000;">${r.pos}</td>
          <td style="font-weight:900;">${r.team}</td>
          <td>${r.nationality}</td>
          <td class="pts">${r.pts}</td>
        `;
        teamsTbody.appendChild(tr);
      });
    }

    function highlightRaceRow(raceId) {
      // Remove previous highlight
      document
        .querySelectorAll("#racesTbody tr.race-highlight")
        .forEach(tr => tr.classList.remove("race-highlight"));

      const row = document.querySelector(
        `#racesTbody tr[data-race-id="${raceId}"]`
      );
      if (!row) return;
      // Add highlight
      row.classList.add("race-highlight");
    }    

    function clearRaceHighlight() {
      document
        .querySelectorAll("#racesTbody tr.race-highlight")
        .forEach(tr => tr.classList.remove("race-highlight"));
    }
  
    // Viz placeholders
    function renderVizPlaceholders() {}
  
    function renderFrame(sel, subtitle) {
      const root = d3.select(sel);
      root.selectAll("svg").remove();
  
      const node = root.node();
      const w = node.clientWidth;
      const h = node.clientHeight;
  
      const svg = root.append("svg").attr("width", w).attr("height", h);
  
      svg.append("rect")
        .attr("x", 16).attr("y", 16)
        .attr("width", w - 32).attr("height", h - 32)
        .attr("rx", 14)
        .attr("fill", "transparent")
        .attr("stroke", "rgba(255,255,255,0.18)")
        .attr("stroke-dasharray", "6 6");
  
      svg.append("text")
        .attr("x", w / 2).attr("y", h / 2 - 6)
        .attr("text-anchor", "middle")
        .attr("font-weight", 900)
        .attr("fill", "rgba(255,255,255,0.85)")
        .text("D3 Placeholder Frame");
  
      svg.append("text")
        .attr("x", w / 2).attr("y", h / 2 + 18)
        .attr("text-anchor", "middle")
        .attr("font-size", 12)
        .attr("fill", "rgba(255,255,255,0.60)")
        .text(subtitle);
    }
  
    // -----------------------------
    // Modal: Starting vs Finishing Grid placeholder
    // -----------------------------
    closeModalBtn.addEventListener("click", closeRaceModal);
    raceModal.addEventListener("click", (e) => {
      if (e.target === raceModal) closeRaceModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && raceModal.classList.contains("open")) closeRaceModal();
    });
  
    function openRaceModal(raceRow) {
      raceModalTitle.textContent = `${selectedSeason} ${raceRow.gp} — Starting vs Finishing Grid`;
      raceModal.classList.add("open");
      raceModal.setAttribute("aria-hidden", "false");
      
      localStorage.setItem("f1_selected_year", String(selectedSeason));
      localStorage.setItem("f1_selected_raceId",String(raceRow.id));

      const iframe = document.getElementById("gridIframe");
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.dispatchEvent(new Event("storage"));
      }
      //console.log("Row object:", raceRow);
    }
  
    function closeRaceModal() {
      raceModal.classList.remove("open");
      raceModal.setAttribute("aria-hidden", "true");
    }
  
    // -----------------------------
    // Compare Drivers button
    // -----------------------------
    compareDriversBtn.addEventListener("click", () => {
      window.open(`Driver_Comparison/index.html?season=${encodeURIComponent(selectedSeason)}`, "_blank");
    });    
    
    
    // -----------------------------
    // Render everything
    // -----------------------------
    function renderAll() {
      setTitles();
      renderVizPlaceholders();
      renderRacesTable();
      renderDriversTable();
    
      try {
        renderTeamsTable();
      } catch (e) {
        console.error("Teams table failed:", e);
      }
    
      if (window.SeasonTimeline?.setSeason && selectedSeason != null) {
        window.SeasonTimeline.setSeason(selectedSeason);
      }
      if (window.CircuitMap?.setSeason && selectedSeason != null) {
        window.CircuitMap.setSeason(selectedSeason);
      }
    }
    
  
    // Keep placeholder frames responsive
    window.addEventListener("resize", () => {
      clearTimeout(window.__rz);
      window.__rz = setTimeout(renderVizPlaceholders, 120);
    });

    // -----------------------------
    // Full-page viz expand
    // -----------------------------
    let fullscreenPanel = null;
    let panelPlaceholder = null;

    document.querySelectorAll(".expand-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const panel = btn.closest(".panel");

        if (panel.classList.contains("fullscreen")) {
          exitFullscreen(panel, btn);
        } else {
          enterFullscreen(panel, btn);
        }
      });
    });

    function enterFullscreen(panel, btn) {
      fullscreenPanel = panel;

      // Create placeholder to preserve layout
      panelPlaceholder = document.createElement("div");
      panelPlaceholder.style.height = `${panel.offsetHeight}px`;
      panelPlaceholder.style.width = "100%";

      panel.parentNode.insertBefore(panelPlaceholder, panel);

      panel.classList.add("fullscreen");
      document.body.classList.add("viz-fullscreen");

      btn.textContent = "Collapse";

      // Force D3 resize
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event("resize"));
      });
    }

    function exitFullscreen(panel, btn) {
      panel.classList.remove("fullscreen");
      document.body.classList.remove("viz-fullscreen");

      // Restore panel to original position
      panelPlaceholder.replaceWith(panel);
      panelPlaceholder = null;
      fullscreenPanel = null;

      btn.textContent = "Expand";

      requestAnimationFrame(() => {
        window.dispatchEvent(new Event("resize"));
      });
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && fullscreenPanel) {
        const btn = fullscreenPanel.querySelector(".expand-btn");
        exitFullscreen(fullscreenPanel, btn);
      }
    });

    window.addEventListener("timeline:raceSelected", (e) => {
      const { raceId, season } = e.detail;
    
      // Only react if we're on the same season
      if (season !== selectedSeason) return;
    
      highlightRaceRow(raceId);
    });

    document.addEventListener("click", (event) => {
      const timeline = document.getElementById("seasonTimeline");
      const racesTable = document.querySelector(".table-wrap");
    
      if (timeline && timeline.contains(event.target)) return;
    
      if (racesTable && racesTable.contains(event.target)) return;
    
      clearRaceHighlight();
    });
  
    renderAll();

  });

  window.addEventListener("message", (event) => {
    if (event.data?.type === "gridviz:resize") {
      const iframe = document.getElementById("gridIframe");
      if (!iframe) return;
  
      iframe.style.height = `${event.data.height}px`;
    }
  });
  
  
})();

  
