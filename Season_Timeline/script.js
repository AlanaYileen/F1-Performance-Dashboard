let racesData, resultsData, driversData, constructorsData, circuitsData;
let driversById, constructorNameById, circuitById;

let currentYear = null;
let svg, g, legend, seasonTitle;
let detailsTooltip, detailsContent, detailsClose;

const margin = { left: 40, right: 40, top: 10, bottom: 40 };
const rowHeight = 80;
const minSpacing = 70;
const labelOffset = 28;

let innerWidth = 0;
let innerHeight = 0;

let __mounted = false;
let __dataLoaded = false;


/* ------------------ Color Palette ------------------ */

const constructorPalette = [
  "#FF0000", "#00A1FF", "#00FF00", "#FF9A00", "#8A2BE2",
  "#FFD700", "#FF00FF", "#00FFFF", "#A52A2A", "#228B22",
  "#1E90FF", "#FF1493", "#7FFF00", "#DC143C", "#00CED1",
  "#FF4500", "#2F4F4F", "#DA70D6", "#87CE00", "#8B0000",
  "#20B2AA", "#4169E1", "#C71585", "#6B8E23", "#708090"
];

let constructorColors = new Map();
const winnerByRaceId = new Map();

window.SeasonTimeline = window.SeasonTimeline || {};

window.SeasonTimeline.mount = function (containerSelector, opts = {}) {
  if (__mounted) return;
  __mounted = true;

  const root = d3.select(containerSelector);

  // Build internal DOM
  root.html(`
    <div id="legend"></div>
    <svg id="timeline" width="100%"></svg>
  `);

  // Floating tooltip
  if (!document.getElementById("race-details")) {
    d3.select("body")
      .append("div")
      .attr("id", "race-details")
      .style("position", "absolute")
      .style("display", "none")
      .style("background", "rgba(0,0,0,0.9)")
      .style("color", "#ffffff")
      .style("padding", "14px 16px 18px")
      .style("border", "1px solid rgba(255,255,255,0.2)")
      .style("border-radius", "10px")
      .style("box-shadow", "0 12px 28px rgba(0,0,0,0.35)")
      .style("max-width", "360px")
      .style("z-index", 100000)
      .html(`
        <button id="race-details-close">&times;</button>
        <div id="race-details-content"></div>
      `);
  }

  initTimeline();
};


window.SeasonTimeline.setSeason = function (year) {
  if (!__dataLoaded) {
    window.SeasonTimeline.__pendingYear = year;
    return;
  }
  updateSeason(+year);
};

/* ------------------ Initialization ------------------ */

function initTimeline() {
  svg = d3.select("#timeline");
  legend = d3.select("#legend");

  detailsTooltip = d3.select("#race-details");
  detailsContent = d3.select("#race-details-content");
  detailsClose = d3.select("#race-details-close");

  detailsClose.on("click", hideRaceDetails);

  svg.selectAll("*").remove();
  g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);


  Promise.all([
    d3.csv(`data/races.csv`, d3.autoType),
    d3.csv(`data/results.csv`, d3.autoType),
    d3.csv(`data/drivers.csv`, d3.autoType),
    d3.csv(`data/constructors.csv`, d3.autoType),
    d3.csv(`data/circuits.csv`, d3.autoType),
  ]).then(([races, results, drivers, constructors, circuits]) => {
    racesData = races;
    resultsData = results;
    driversData = drivers;
    constructorsData = constructors;
    circuitsData = circuits;

    driversById = new Map(drivers.map(d => [d.driverId, d]));
    constructorNameById = new Map(constructors.map(d => [d.constructorId, d.name]));
    circuitById = new Map(circuits.map(d => [d.circuitId, d]));

    __dataLoaded = true;

    const seasons = Array.from(new Set(racesData.map(d => d.year))).sort((a,b)=>a-b);
    if (window.SeasonTimeline.__pendingYear != null) {
      updateSeason(window.SeasonTimeline.__pendingYear);
    }

    window.addEventListener("resize", () => {
      if (currentYear) updateSeason(currentYear);
    });
  });
  document.addEventListener("click", (event) => {
    const tooltipNode = detailsTooltip.node();
    if (!tooltipNode) return;
  
    // If click is NOT inside tooltip, close it
    if (!tooltipNode.contains(event.target)) {
      hideRaceDetails();
    }
  });
}

/* ------------------ Main Render ------------------ */

function updateSeason(year) {
  currentYear = year;
  hideRaceDetails();

  // get available width from container
  const containerWidth = svg.node().getBoundingClientRect().width || 900;
  innerWidth = Math.max(300, containerWidth - margin.left - margin.right);

  const seasonRaces = racesData
    .filter(d => d.year === year)
    .sort((a, b) => d3.ascending(a.round, b.round));

  if (seasonRaces.length === 0) {
    g.selectAll("*").remove();
    g.append("text")
      .attr("x", innerWidth / 2)
      .attr("y", 40)
      .attr("text-anchor", "middle")
      .attr("fill", "rgba(255,255,255,0.6)")
      .text("No data available for this season");
    return;
  }

  const constructorsInSeason = getConstructorsInSeason(seasonRaces);
  assignSeasonColors(constructorsInSeason);

  // Compute layout
  const maxPerRow = Math.max(1, Math.floor(innerWidth / minSpacing));
  const numRows = Math.max(1, Math.ceil(seasonRaces.length / maxPerRow));
  const baseSize = Math.floor(seasonRaces.length / numRows);
  const extra = seasonRaces.length % numRows;

  const rows = [];
  let cursor = 0;
  for (let r = 0; r < numRows; r++) {
    const size = baseSize + (r < extra ? 1 : 0);
    rows.push(seasonRaces.slice(cursor, cursor + size));
    cursor += size;
  }

  innerHeight = rows.length * rowHeight;
  const totalHeight = innerHeight + margin.top + margin.bottom;

  svg
    .attr("height", totalHeight)
    .attr("viewBox", `0 0 ${containerWidth} ${totalHeight}`);

  g.selectAll("*").remove();

  const rowMeta = [];

  // Draw rows
  rows.forEach((rowRaces, rowIndex) => {
    const y = rowIndex * rowHeight + rowHeight / 2;
    const reversed = rowIndex % 2 === 1;

    const x = d3.scalePoint()
      .domain(rowRaces.map((_, i) => i))
      .range(reversed ? [innerWidth, 0] : [0, innerWidth])
      .padding(0.5);

    rowMeta.push({ y, x, reversed, length: rowRaces.length });

    // Base line
    g.append("line")
      .attr("x1", x(0))
      .attr("x2", x(rowRaces.length - 1))
      .attr("y1", y)
      .attr("y2", y)
      .attr("stroke", "#999")
      .attr("stroke-width", 2);

    const raceGroups = g.append("g")
      .attr("class", "race-row")
      .attr("transform", `translate(0,${y})`)
      .selectAll(".race")
      .data(rowRaces, d => d.raceId)
      .join("g")
      .attr("class", "race")
      .attr("transform", (d, i) => `translate(${x(i)},0)`);

    raceGroups.append("circle")
      .attr("class", "race-circle")
      .attr("r", 8)
      .attr("fill", d => getWinnerColor(d.raceId))
      .on("click", (event, d) => {
        event.stopPropagation();
        showRaceDetails(d, event);
      
        // 🔗 COORDINATED VIEW EVENT
        window.dispatchEvent(
          new CustomEvent("timeline:raceSelected", {
            detail: {
              raceId: d.raceId,
              season: d.year
            }
          })
        );
      });

    raceGroups.append("text")
      .attr("class", "race-label")
      .attr("transform", `translate(0,${labelOffset}) rotate(-32)`)
      .attr("fill", "#ffffff") 
      .attr("opacity", 0.9)
      .text(d => getCircuitLocationLabel(d));
  });

  // Connect rows
  const connectorGroup = g.append("g").attr("class", "row-connectors");
  rowMeta.slice(0, -1).forEach((row, idx) => {
    const next = rowMeta[idx + 1];
    const startX = row.x(row.length - 1);
    const endX = next.x(0);
    const startY = row.y;
    const endY = next.y;
    const dist = Math.hypot(endX - startX, endY - startY);
    const r = dist / 2;
    const sweepFlag = idx % 2 === 0 ? 1 : 0;

    const d = `M${startX},${startY} A${r},${r} 0 0 ${sweepFlag} ${endX},${endY}`;

    connectorGroup.append("path")
      .attr("d", d)
      .attr("stroke", "#999")
      .attr("fill", "none")
      .attr("stroke-width", 2);
  });

  renderLegend(constructorsInSeason);
}

/* ------------------ Helpers ------------------ */

function getCircuitLocationLabel(race) {
  const circuit = circuitById.get(race.circuitId);
  if (!circuit) return "Unknown";
  const parts = [circuit.location, circuit.country].filter(Boolean);
  return parts.join(", ");
}

function getWinnerResult(raceId) {
  if (winnerByRaceId.has(raceId)) return winnerByRaceId.get(raceId);
  const raceResults = resultsData.filter(r => r.raceId === raceId);
  const winnerResult = raceResults.find(r =>
    r.position === 1 || r.positionText === "1"
  ) || null;
  winnerByRaceId.set(raceId, winnerResult);
  return winnerResult;
}

function getWinnerColor(raceId) {
  const winnerResult = getWinnerResult(raceId);
  if (!winnerResult) return "#888";
  return constructorColors.get(winnerResult.constructorId) || "#888";
}

function getRaceResults(raceId) {
    return resultsData
      .filter(r => r.raceId === raceId)
      .sort((a, b) => d3.ascending(a.positionOrder, b.positionOrder));
  }
  
  function formatDriverName(driverId) {
    const d = driversById.get(driverId);
    if (!d) return "Unknown";
    const abbr = (d.driverRef || "").toUpperCase();
    return abbr ? `${d.forename} ${d.surname} (${abbr.slice(0,3)})` : `${d.forename} ${d.surname}`;
  }
  
  function formatDateISO(dateVal) {
    // races.csv date is usually "YYYY-MM-DD"
    try {
      const dt = new Date(dateVal);
      return dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
    } catch {
      return String(dateVal);
    }
  }
  
  function getFastestLapInfo(raceId) {
    const raceResults = getRaceResults(raceId);
  
    let fl = raceResults.find(r => String(r.rank) === "1");
  
    // Fallback: if rank isn't present, sometimes fastest lap is the lowest fastestLapTime among those with values
    if (!fl) {
      const withTime = raceResults.filter(r => r.fastestLapTime);
      if (withTime.length) {
        fl = withTime.reduce((best, cur) => {
          if (!best) return cur;
          return String(cur.fastestLapTime) < String(best.fastestLapTime) ? cur : best;
        }, null);
      }
    }
  
    if (!fl) return null;
  
    const driver = driversById.get(fl.driverId);
    const name = driver ? `${driver.forename} ${driver.surname}` : "Unknown";
    const time = fl.fastestLapTime || "—";
    const lap = fl.fastestLap || fl.lap || "—";
    const speed = fl.fastestLapSpeed ? `${fl.fastestLapSpeed} km/h` : null;
  
    return { name, time, lap, speed };
  }
  
  function getPodium(raceId) {
    const raceResults = getRaceResults(raceId);
    const top3 = raceResults.filter(r => r.positionOrder <= 3).slice(0, 3);
    return top3.map(r => ({
      pos: r.positionOrder,
      name: formatDriverName(r.driverId),
    }));
  }  

function renderLegend(constructorsInSeason) {
  legend.selectAll(".legend-item")
    .data(constructorsInSeason, d => d)
    .join(
      enter => {
        const item = enter.append("div").attr("class", "legend-item");
        item.append("span").attr("class", "legend-swatch");
        item.append("span");
        return item;
      },
      update => update,
      exit => exit.remove()
    )
    .each(function(d) {
      const sel = d3.select(this);
      sel.select(".legend-swatch")
        .style("background-color", constructorColors.get(d) || "#888");
      sel.select("span:last-child")
        .text(constructorNameById.get(d) || d);
    });
}

function getConstructorsInSeason(seasonRaces) {
  const raceIds = new Set(seasonRaces.map(r => r.raceId));
  const ids = new Set(
    resultsData
      .filter(r => raceIds.has(r.raceId))
      .map(r => r.constructorId)
      .filter(Boolean)
  );
  return Array.from(ids).sort((a, b) => d3.ascending(a, b));
}

function assignSeasonColors(constructorsInSeason) {
  constructorColors = new Map();
  constructorsInSeason.forEach((id, idx) => {
    constructorColors.set(id, constructorPalette[idx]);
  });
}

/* ------------------ Tooltip ------------------ */

function showRaceDetails(race, clickEvent) {
    const winnerResult = getWinnerResult(race.raceId);
  
    let winnerText = "Unknown";
    let winnerTeamText = "Unknown";
  
    if (winnerResult) {
      winnerText = formatDriverName(winnerResult.driverId);
      winnerTeamText = constructorNameById.get(winnerResult.constructorId) || "Unknown";
    }
  
    const dateText = race.date ? formatDateISO(race.date) : "—";
    const fastest = getFastestLapInfo(race.raceId);
    const podium = getPodium(race.raceId);
  
    const fastestHtml = fastest
    ? `
        <p><strong>Fastest lap:</strong>
        ${fastest.name}
        — ${fastest.time}
        ${fastest.lap !== "—" ? ` · lap ${fastest.lap}` : ""}
        ${fastest.speed ? ` · ${fastest.speed}` : ""}
        </p>
    `
    : `<p><strong>Fastest lap:</strong> —</p>`;

    const podiumHtml = podium.length
    ? `
        <p><strong>Podium:</strong><br>
        ${podium.map(p => `${p.pos}. ${p.name}`).join("<br>")}
        </p>
    `
    : `<p><strong>Podium:</strong> —</p>`;

  
    detailsContent.html(`
      <h3 style="margin:0 0 10px 0;">${race.name} (${race.year})</h3>
      <p><strong>Date:</strong> ${dateText}</p>
      <p><strong>Winner:</strong> ${winnerText}</span></p>
      <p><strong>Team:</strong> ${winnerTeamText}</p>
      ${fastestHtml}
      ${podiumHtml}
    `);
  
    positionTooltip(clickEvent);
    detailsTooltip.style("display", "block");
  }
  

function hideRaceDetails() {
  detailsTooltip.style("display", "none");
}

function positionTooltip(clickEvent) {
  if (!clickEvent) return;
  const padding = 10;
  const offset = 12;
  const tooltipNode = detailsTooltip.node();

  detailsTooltip.style("display", "block");
  const { width: tw, height: th } = tooltipNode.getBoundingClientRect();

  let left = clickEvent.clientX + offset;
  let top = clickEvent.clientY - th - offset;

  const maxLeft = window.innerWidth - tw - padding;
  const minLeft = padding;
  left = Math.min(Math.max(left, minLeft), maxLeft);

  if (top < padding) {
    top = clickEvent.clientY + offset;
  }

  detailsTooltip
    .style("left", `${left}px`)
    .style("top", `${top}px`);
}

/* ------------------ Standalone Auto-Run ------------------ */

if (!__mounted && document.getElementById("timeline")) {
  initTimeline();
}
