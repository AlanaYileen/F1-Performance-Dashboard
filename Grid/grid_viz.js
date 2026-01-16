window.addEventListener("storage", (e) => {
  if (e.key === "f1_selected_raceId") {
    const newRaceId = +e.newValue;
    if (Number.isFinite(newRaceId) && newRaceId !== selectedRaceId) {
      selectedRaceId = newRaceId;
      d3.select("#raceDropdown").property("value", selectedRaceId);
      plotChart();
    }
  }

  if (e.key === "f1_selected_year") {
    const newYear = +e.newValue;
    if (Number.isFinite(newYear) && newYear !== selectedYear) {
      selectedYear = newYear;
      plotRaceDropdown({ preferredRaceId: selectedRaceId });
      plotChart();
    }
  }
});

let selectedYear = null;
let selectedRaceId = null;

const svg = d3.select("#chart");

d3.select("#raceDropdown").on("change", () => {
  selectedRaceId = +d3.select("#raceDropdown").property("value");
  localStorage.setItem("f1_selected_year", selectedYear);
  localStorage.setItem("f1_selected_raceId", selectedRaceId);
  plotChart();
});

// --- Inject minimal styles (since no CSS file) ---
(function injectStyles() {
  if (document.getElementById("grid-viz-style")) return;
  const style = document.createElement("style");
  style.id = "grid-viz-style";
  style.textContent = `
    #chart { width: 100%; height: 100%; display: block; background: #000; }
    select, option { color: #111; }
    ::selection { background: rgba(255,255,255,0.15); }
  `;
  document.head.appendChild(style);
})();

// --- Responsive sizing ---
function getContainerSize() {
  const node = svg.node();
  const parent = node?.parentElement || node;
  const rect = parent.getBoundingClientRect();
  const w = Math.max(520, rect.width || 1000);
  const h = Math.max(520, rect.height || 700);
  return { w, h };
}

let fullData = null;
let driverMap = new Map();
let currentSize = getContainerSize();

// ---------- Load data ----------
Promise.all([
  d3.csv("data/drivers.csv", d3.autoType),
  d3.csv("data/f1_grid_race_comp.csv", d3.autoType),
]).then(([drivers, data]) => {
  drivers.forEach((d) => {
    const fullName = `${d.forename} ${d.surname}`;
    driverMap.set(fullName, +d.driverId);
  });

  data.forEach((d) => {
    d.year = +d.year;
    d.raceId = +d.raceId;
    d.grid = +d.grid;

    // finishing position can be \N
    d.position = d.position === "\\N" ? null : +d.position;

    d.driverId = driverMap.get(d.driverName);

    // OPTIONAL: normalize strings
    d.constructorName = (d.constructorName || "").trim();
    d.driverName = (d.driverName || "").trim();

    // Some datasets call it raceName / gpName / circuitName
    // We'll keep a display label that exists:
    d._raceLabel =
      (d.raceName && d.raceName.trim()) ||
      (d.gp && d.gp.trim()) ||
      (d.circuitName && d.circuitName.trim()) ||
      `Race ${d.raceId}`;
  });

  fullData = data;

  plotYearDropdown();
  // 1️⃣ If dashboard provided a selection, use it
  const storedYear = +localStorage.getItem("f1_selected_year");
  const storedRaceId = +localStorage.getItem("f1_selected_raceId");

  if (Number.isFinite(storedYear) && storedYear > 1900) {
    selectedYear = storedYear;
  } else {
    // fallback: last year in dataset
    const years = [...new Set(fullData.map(d => d.year))].sort((a, b) => a - b);
    selectedYear = years[years.length - 1];
  }
  // build race dropdown for that year
  plotRaceDropdown({ preferredRaceId: storedRaceId });
  // at this point both are guaranteed
  plotChart();

  const node = svg.node();
});

// ---------- Dropdowns ----------
function plotYearDropdown() {
  const years = [...new Set(fullData.map((d) => d.year))].sort((a, b) => a - b);

  const yearSel = d3.select("#yearDropdown");
  yearSel.selectAll("option").remove();

  yearSel
    .selectAll("option")
    .data(years)
    .enter()
    .append("option")
    .text((d) => d)
    .attr("value", (d) => d);

  // Default year (last year in dataset) if none selected
  if (!selectedYear) selectedYear = years[years.length - 1];
  yearSel.property("value", selectedYear);

  yearSel.on("change", () => {
    selectedYear = +yearSel.property("value");
    // rebuild races for that year (keep race if possible)
    plotRaceDropdown({ preferredRaceId: selectedRaceId });
    plotChart();
  });

  // Build initial race dropdown
  plotRaceDropdown({ preferredRaceId: selectedRaceId });
}

function plotRaceDropdown({ preferredRaceId = null } = {}) {
  const year = selectedYear;

  const byRace = new Map();
  fullData
    .filter((d) => d.year === year)
    .forEach((d) => {
      if (!byRace.has(d.raceId)) {
        byRace.set(d.raceId, d._raceLabel);
      }
    });

  const raceEntries = [...byRace.entries()].sort((a, b) => +a[0] - +b[0]); // sort by raceId

  const dropdown = d3.select("#raceDropdown");
  dropdown.selectAll("option").remove();

  dropdown
    .selectAll("option")
    .data(raceEntries, (d) => d[0])
    .enter()
    .append("option")
    .text(d => d[1])
    .attr("value", d => d[0]);

  if (preferredRaceId && byRace.has(preferredRaceId)) {
    dropdown.property("value", preferredRaceId);
    selectedRaceId = preferredRaceId;
  } else {
    selectedRaceId = +raceEntries[0][0];
  }
  dropdown.property("value", selectedRaceId);
  plotChart();
}


// ---------- Main chart ----------
function plotChart() {
  console.log("RENDER:", selectedYear, selectedRaceId);
  if (!fullData) return;

  const year = selectedYear;
  const raceId = selectedRaceId;

  let raceData = fullData.filter(
    (d) => d.year === year && d.raceId === raceId && d.grid > 0
  );

  // Clear everything
  svg.selectAll("*").remove();

  const { w: W, h: H } = currentSize;

  svg.attr("viewBox", `0 0 ${W} ${H}`).attr("preserveAspectRatio", "xMidYMid meet");
  svg.style("background", "#000");

  if (raceData.length === 0) return;

  // ---- Layout ----
  const padding = 18;
  const legendHeight = 90;
  const legendGap = 60;
  const titleHeight = 28;

  const margin = {
    top: padding + titleHeight + legendHeight + legendGap,
    right: Math.max(220, Math.min(320, W * 0.28)),
    bottom: 56,
    left: Math.max(220, Math.min(340, W * 0.30)),
  };

  const innerW = Math.max(240, W - margin.left - margin.right);
  
  const innerH = Math.max(300, H - margin.top - margin.bottom);

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // ---- Scales ----
  const maxPos = d3.max(raceData, d =>
    Math.max(d.grid || 0, d.position || 0)
  );;

  const y = d3.scaleLinear().domain([1, maxPos]).range([0, innerH]);

  const xQuali = 0;
  const xRace = innerW;

  // ---- Colors (constructor palette) ----
  const constructorColor = d3.scaleOrdinal([
    "#771155", "#114477", "#117744", "#AAAA44", "#774411",
    "#77CCCC", "#CC99BB", "#4477AA", "#77AADD", "#117777",
    "#44AAAA", "#44AA77", "#88CCAA", "#777711", "#DDDD77",
    "#AA4488", "#AA7744", "#DDAA77", "#771122", "#AA4455", "#DD7788",
  ]);

  // ---- Lines ----
  g.selectAll(".slope")
    .data(raceData.filter((d) => d.position !== null))
    .enter()
    .append("line")
    .attr("class", "slope")
    .attr("data-constructor", (d) => d.constructorName)
    .attr("x1", xQuali)
    .attr("y1", (d) => y(d.grid))
    .attr("x2", xRace)
    .attr("y2", (d) => y(d.position))
    .attr("stroke", (d) => constructorColor(d.constructorName))
    .attr("stroke-width", 2)
    .attr("stroke-opacity", 0.9);

  // ---- Left labels (Starting) ----
  g.selectAll(".labelQ")
    .data(raceData)
    .enter()
    .append("text")
    .attr("class", "labelQ")
    .attr("x", xQuali - 12)
    .attr("y", (d) => y(d.grid))
    .attr("text-anchor", "end")
    .attr("dominant-baseline", "middle")
    .style("font-size", "12px")
    .style("fill", (d) => (d.position === null ? "rgba(255,255,255,0.55)" : "#fff"))
    .style("cursor", "pointer")
    .text((d) => {
      const dnf = d.position === null ? " (DNF)" : "";
      return `${d.grid}. ${d.driverName}${dnf}`;
    });

  // ---- Right labels (Finishing) ----
  g.selectAll(".labelR")
    .data(raceData.filter((d) => d.position !== null))
    .enter()
    .append("text")
    .attr("class", "labelR")
    .attr("x", xRace + 12)
    .attr("y", (d) => y(d.position))
    .attr("text-anchor", "start")
    .attr("dominant-baseline", "middle")
    .style("font-size", "12px")
    .style("fill", "#fff")
    .style("cursor", "pointer")
    .text((d) => `${d.position}. ${d.driverName}`);

  // ---- Column headers ----
  g.append("text")
    .attr("x", xQuali - 12)
    .attr("y", -18)
    .attr("text-anchor", "end")
    .style("font-size", "15px")
    .style("font-weight", 700)
    .style("fill", "rgba(255,255,255,0.9)")
    .text("Starting Position");

  g.append("text")
    .attr("x", xRace + 12)
    .attr("y", -18)
    .attr("text-anchor", "start")
    .style("font-size", "15px")
    .style("font-weight", 700)
    .style("fill", "rgba(255,255,255,0.9)")
    .text("Finishing Position");

  // ---- Footnote ----
  g.append("text")
    .attr("x", xQuali - 12)
    .attr("y", innerH + 34)
    .attr("text-anchor", "end")
    .style("font-size", "12px")
    .style("fill", "rgba(255,255,255,0.55)")
    .text("DNF = Did Not Finish");

  // ===============================
  // Legend chips (top)
  // ===============================
  const constructors = [...new Set(raceData.map((d) => d.constructorName))];

  const legendRoot = svg.append("g").attr("class", "legend-chips");
  legendRoot
    .raise()
    .style("pointer-events", "all");
  
  const chipPadX = 12;
  const chipGapX = 10;
  const chipGapY = 10;
  const dotR = 6;
  const chipH = 34;

  function measureText(txt, font = "12px system-ui") {
    const ctx =
      measureText._ctx ||
      (measureText._ctx = document.createElement("canvas").getContext("2d"));
    ctx.font = font;
    return ctx.measureText(txt).width;
  }

  let x = 0;
  let yRow = 0;
  const font = "12px system-ui";
  const maxRowW = W - padding * 2;

  const chipData = constructors.map((name) => {
    const textW = measureText(name, font);
    const w = chipPadX * 2 + dotR * 2 + 10 + textW;
    return { name, w };
  });

  const positioned = chipData.map((d) => {
    if (x + d.w > maxRowW) {
      x = 0;
      yRow += chipH + chipGapY;
    }
    const out = { ...d, x, y: yRow };
    x += d.w + chipGapX;
    return out;
  });

  // center each row
  const rows = d3.groups(positioned, (d) => d.y);
  const centered = [];
  rows.forEach(([rowY, items]) => {
    const rowW = d3.sum(items, (d) => d.w) + chipGapX * (items.length - 1);
    const offset = Math.max(0, (maxRowW - rowW) / 2);
    items.forEach((d) => centered.push({ ...d, x: d.x + offset }));
  });

  const chipsG = legendRoot
    .attr("transform", `translate(${padding},${padding + titleHeight + 6})`)
    .selectAll("g.chip")
    .data(centered, (d) => d.name)
    .enter()
    .append("g")
    .attr("class", "chip")
    .attr("data-constructor", (d) => d.name)
    .attr("transform", (d) => `translate(${d.x},${d.y})`)
    .style("cursor", "pointer");

  chipsG
    .append("rect")
    .attr("rx", 12)
    .attr("ry", 12)
    .attr("width", (d) => d.w)
    .attr("height", chipH)
    .attr("fill", "rgba(255,255,255,0.06)")
    .attr("stroke", "rgba(255,255,255,0.18)")
    .attr("stroke-width", 1);

  chipsG
    .append("circle")
    .attr("cx", chipPadX + dotR)
    .attr("cy", chipH / 2)
    .attr("r", dotR)
    .attr("fill", (d) => constructorColor(d.name));

  chipsG
    .append("text")
    .attr("x", chipPadX + dotR * 2 + 10)
    .attr("y", chipH / 2)
    .attr("dominant-baseline", "middle")
    .style("font-size", "12px")
    .style("fill", "#fff")
    .text((d) => d.name);

  chipsG
    .on("mouseover", function () {
      const constructor = d3.select(this).attr("data-constructor");

      g.selectAll(".slope")
        .attr("stroke-opacity", d =>
          d.constructorName === constructor ? 0.95 : 0.1
        );

      g.selectAll(".labelQ, .labelR")
        .style("opacity", d =>
          d.constructorName === constructor ? 1 : 0.22
        );
    })
    .on("mouseout", function () {
      g.selectAll(".slope")
        .attr("stroke-opacity", 0.9);

      g.selectAll(".labelQ, .labelR")
        .style("opacity", 1);
    });
  svg.raise();
  legendRoot.raise();

}
