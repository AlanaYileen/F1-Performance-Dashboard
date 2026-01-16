(() => {
    const VB_WIDTH = 900;
    const VB_HEIGHT = 520;
  
    let rootSel = null;
  
    let svg, mapGroup, pointsGroup;
    let projection, countriesPaths, zoomBehavior;
  
    let allRacesData = [];
    let state = {
      selectedYear: 2024,
      activeRaceId: null
    };
  
    // -----------------------------
    // Helpers
    // -----------------------------
  
    function normalizeCountry(name) {
      const mapping = {
        UK: "United Kingdom",
        USA: "United States of America",
        UAE: "United Arab Emirates",
        Korea: "South Korea"
      };
      return mapping[name] || name || "";
    }
  
    function buildDOM(containerSelector) {
      rootSel = d3.select(containerSelector);
      rootSel.html("");
  
      // IMPORTANT: #circuitMap has class "viz" in dashboard HTML
      // (dashed border / grid centering). Override it here so the map can fill.
      rootSel
        .style("position", "relative")
        .style("display", "block")
        .style("padding", "0")
        .style("border", "0")
        .style("background", "transparent");
  
      rootSel.html(`
        <div class="cmap-wrap">
          <div class="cmap-topbar">
            <div class="cmap-legend" aria-label="Map legend">
              <div class="legend-pill"><span class="swatch never"></span><span>Never Hosted</span></div>
              <div class="legend-pill"><span class="swatch history"></span><span>Historical Host</span></div>
              <div class="legend-pill"><span class="swatch active"></span><span>Host (Selected Season)</span></div>
            </div>
          </div>
  
          <div class="cmap-stage" aria-label="Circuit map stage"></div>
  
          <div class="cmap-tooltip hidden" role="dialog" aria-hidden="true">
            <button class="cmap-tip-close" type="button" aria-label="Close tooltip">×</button>
            <div class="cmap-tip-content"></div>
          </div>
        </div>
      `);
  
      // close tooltip by clicking the close button
      rootSel.select(".cmap-tip-close").on("click", (event) => {
        event.stopPropagation();
        deselectAll();
      });
  
      // close tooltip by clicking anywhere in the panel outside the tooltip
      rootSel.on("click", () => deselectAll());
    }
  
    function tooltipSel() {
      return rootSel.select(".cmap-tooltip");
    }
  
    function hideTooltip() {
      const tip = tooltipSel();
      tip.classed("hidden", true).attr("aria-hidden", "true");
    }
  
    function showTooltip(race, x, y) {
      const tip = tooltipSel();
      tip
        .classed("hidden", false)
        .attr("aria-hidden", "false")
        .style("left", `${x + 10}px`)
        .style("top", `${y + 10}px`);
  
      tip.select(".cmap-tip-content").html(`
        <div class="tip-title">${race.name}</div>
        <div class="tip-row"><span class="tip-label">Circuit:</span> ${race.circuitName}</div>
        <div class="tip-row"><span class="tip-label">Country:</span> ${race.country}</div>
        <div class="tip-row"><span class="tip-label">Number of Races:</span> ${race.round}</div>
      `);
    }
  
    function deselectAll() {
      state.activeRaceId = null;
      if (pointsGroup) {
        pointsGroup.selectAll("circle.race-point").classed("is-active", false);
      }
      hideTooltip();
    }
  
    function projectToContainerXY(lng, lat) {
      const [px, py] = projection([lng, lat]);
      const t = d3.zoomTransform(svg.node());
      return [px * t.k + t.x, py * t.k + t.y];
    }
  
    // -----------------------------
    // Data load + init
    // -----------------------------
    function loadDataAndInit() {
      return Promise.all([
        d3.json(`Circuit_Map/world.json`),
        d3.csv(`data/races.csv`, d3.autoType),
        d3.csv(`data/circuits.csv`, d3.autoType)
      ]).then(([world, racesRows, circuitsRows]) => init(world, racesRows, circuitsRows));
    }
  
    function init(worldTopo, racesRows, circuitsRows) {
      const circuitsMap = new Map(circuitsRows.map((c) => [c.circuitId, c]));
  
      allRacesData = racesRows
        .map((race) => {
          const c = circuitsMap.get(race.circuitId);
          return {
            id: +race.raceId,
            year: +race.year,
            round: +race.round,
            name: race.name,
            circuitName: c ? c.name : "Unknown",
            country: normalizeCountry(c ? c.country : ""),
            lat: c ? +c.lat : NaN,
            lng: c ? +c.lng : NaN
          };
        })
        .filter((d) => Number.isFinite(d.lat) && Number.isFinite(d.lng))
        .sort((a, b) => a.round - b.round);
  
      const allHostCountries = new Set(allRacesData.map((d) => d.country));
      createMap(worldTopo, allHostCountries);
      update();
    }
  
    // -----------------------------
    // Map drawing
    // -----------------------------
    function createMap(worldTopo, allHostCountries) {
      const stage = rootSel.select(".cmap-stage");
      stage.selectAll("*").remove();
  
      svg = stage
        .append("svg")
        .attr("viewBox", [0, 0, VB_WIDTH, VB_HEIGHT])
        .attr("preserveAspectRatio", "xMidYMid meet");
  
      mapGroup = svg.append("g").attr("class", "cmap-map");
  
      projection = d3
        .geoMercator()
        .scale(140)
        .translate([VB_WIDTH / 2, VB_HEIGHT / 1.55]);
  
      const path = d3.geoPath().projection(projection);
  
      const countries = topojson.feature(worldTopo, worldTopo.objects.countries).features;
  
      countriesPaths = mapGroup
        .selectAll("path.country")
        .data(countries)
        .join("path")
        .attr("class", (d) =>
          allHostCountries.has(d.properties.name) ? "country has-history" : "country"
        )
        .attr("d", path);

      pointsGroup = mapGroup.append("g").attr("class", "cmap-points");

  
      // Zoom
      zoomBehavior = d3
        .zoom()
        .scaleExtent([1, 16])
        .on("zoom", (event) => {
          mapGroup.attr("transform", event.transform);
  
          const k = event.transform.k;
          pointsGroup
            .selectAll("circle.race-point")
            .attr("r", 6 / k)
            .attr("stroke-width", 1 / k);
        });
  
      svg.call(zoomBehavior);
  
      // Clicking blank map closes tooltip
      svg.on("click", () => deselectAll());
    }
  
    // -----------------------------
    // Update per season
    // -----------------------------
    function update() {
      if (!countriesPaths || !pointsGroup) return;
  
      const currentRaces = allRacesData.filter((d) => d.year === state.selectedYear);
      const activeCountries = new Set(currentRaces.map((d) => d.country));
  
      countriesPaths.classed("active-season", (d) => activeCountries.has(d.properties.name));
  
      const circles = pointsGroup
        .selectAll("circle.race-point")
        .data(currentRaces, (d) => d.id);
  
      circles.exit().remove();
  
      const entered = circles
        .enter()
        .append("circle")
        .attr("class", "race-point")
        .attr("cursor", "pointer")
        .on("click", (event, d) => {
          event.stopPropagation();
          selectRace(d, event);
        });
  
      circles
        .merge(entered)
        .attr("cx", (d) => projection([d.lng, d.lat])[0])
        .attr("cy", (d) => projection([d.lng, d.lat])[1])
        .classed("is-active", (d) => d.id === state.activeRaceId);
  
      pointsGroup.raise();
      pointsGroup.selectAll("circle.race-point").raise();
         
      const k = d3.zoomTransform(svg.node()).k || 1;
      pointsGroup
        .selectAll("circle.race-point")
        .attr("r", 6 / k)
        .attr("stroke-width", 1 / k);
  
      hideTooltip();
    }
  
    function selectRace(race, event) {
      state.activeRaceId = race.id;
  
      pointsGroup
        .selectAll("circle.race-point")
        .classed("is-active", (d) => d.id === race.id);
  
      const x = event.offsetX;
      const y = event.offsetY;
      showTooltip(race, x, y);
    }
  
    // -----------------------------
    // Public API
    // -----------------------------
    window.CircuitMap = window.CircuitMap || {};
  
    window.CircuitMap.mount = function (containerSelector, opts = {}) {
      state.selectedYear = Number(opts.initialYear ?? state.selectedYear);
  
      buildDOM(containerSelector);
      return loadDataAndInit();
    };
  
    window.CircuitMap.setSeason = function (year) {
      state.selectedYear = Number(year);
      state.activeRaceId = null;
      update();
    };
  })();
  
