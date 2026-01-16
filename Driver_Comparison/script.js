// Load data
Promise.all([
    d3.csv("/data/drivers.csv"),
    d3.csv("/data/races.csv"),
    d3.csv("/data/results.csv"),
    d3.csv("/data/status.csv")
  ]).then(([drivers, races, results, statusCSV]) => {
  
    // initialize data structures
    const raceYear = {};
    races.forEach(r => raceYear[r.raceId] = +r.year);

    const status = {};
    statusCSV.forEach(s => status[s.statusId] = s.status);
  
    const driverStats = {};
    drivers.forEach(d => {
      driverStats[d.driverId] = {
        id: d.driverId,
        name: `${d.forename} ${d.surname}`,
        photo: `images/${d.forename}_${d.surname}.png`,
        nationality: d.nationality,
        dob: d.dob,
        age: calcAge(d.dob),
        seasons: new Set(),
        seasonCount: 0,
        wins: 0,
        fastestLaps: 0,
        championships: 0,
        races: 0,
        seasonPoints: {}
      };
    });
  
    //Process results (compute wins, dnfs, points, seasons, podiums, etc.)
    results.forEach(r => {
      const d = driverStats[r.driverId];
      if (!d) return;
  
      d.races += 1;
  
      if (+r.positionOrder === 1) d.wins += 1;
      if (r.fastestLap === "1") d.fastestLaps += 1;

      d.totalPoints = (d.totalPoints || 0) + (+r.points || 0);
      if (+r.positionOrder >= 1 && +r.positionOrder <= 3) {
        d.podiums = (d.podiums || 0) + 1;
      }
  
      if (r.statusId && status[r.statusId] && status[r.statusId] !== "Finished") {
        d.dnfs = (d.dnfs || 0) + 1;
      }

      const year = raceYear[r.raceId];
      d.seasons.add(year);
      d.seasonPoints[year] = (d.seasonPoints[year] || 0) + (+r.points || 0);
    });
    
    //DEtermine champions for each season
    const seasons = {};
    results.forEach(r => {
      const year = raceYear[r.raceId];
      if (!seasons[year]) seasons[year] = {};
    });
  
    Object.values(driverStats).forEach(d => {
      Object.entries(d.seasonPoints).forEach(([year, pts]) => {
        seasons[year][d.id] = pts;
      });
    });
  
    Object.values(seasons).forEach(season => {
      const championId = Object.entries(season).sort((a,b)=>b[1]-a[1])[0][0];
      driverStats[championId].championships += 1;
    });

    Object.values(driverStats).forEach(d => {
        d.seasonCount = d.seasons.size;
    });
  
    //POPULATE DROPDOWNS
    const select1 = d3.select("#driver1-select");
    const select2 = d3.select("#driver2-select");
  
    drivers.forEach(d => {
      const name = `${d.forename} ${d.surname}`;
      select1.append("option").attr("value", d.driverId).text(name);
      select2.append("option").attr("value", d.driverId).text(name);
    });
  
    new Choices('#driver1-select', { 
        searchEnabled: true, 
        itemSelectText: '',
        placeholder: true,
        placeholderValue: 'Select driver'
    });
      
    new Choices('#driver2-select', { 
        searchEnabled: true, 
        itemSelectText: '',
        placeholder: true,
        placeholderValue: 'Select driver'
    });
  
    //select1.property("value", drivers[0].driverId);
    //select2.property("value", drivers[1].driverId);
  
    select1.on("change", updateUI);
    select2.on("change", updateUI);
  
    updateUI();
  
    // UI Update function
    
    function updateUI() {
        const id1 = select1.property("value");
        const id2 = select2.property("value");
    
        const has1 = id1 && driverStats[id1];
        const has2 = id2 && driverStats[id2];
    
        // CASE 0: No drivers selected
        if (!has1 && !has2) {
            d3.select("#driver1").html("<p>Please select a driver.</p>");
            d3.select("#driver2").html("<p>Please select a driver.</p>");
            d3.select("#bars-container").html("");
            d3.select("#radar-chart").html("");
            return;
        }
    
        // CASE 1: Only Driver 1 selected
        if (has1 && !has2) {
            const d1 = driverStats[id1];
    
            renderDriverPanel("#driver1", d1);
            d3.select("#driver2").html("<p>Please select a second driver.</p>");
    
            const radarData = computeRadarMetrics(d1, d1);
            renderRadar([radarData[0]]);
    
            // No bars
            d3.select("#bars-container").html("");
            return;
        }
    
        // CASE 2: Only Driver 2 selected
        if (!has1 && has2) {
            const d2 = driverStats[id2];
    
            d3.select("#driver1").html("<p>Please select a first driver.</p>");
            renderDriverPanel("#driver2", d2);
    
            // Single-driver radar
            renderRadar([d2]);
    
            d3.select("#bars-container").html("");
            return;
        }
    
        // CASE 3: Both drivers selected
        const d1 = driverStats[id1];
        const d2 = driverStats[id2];
    
        renderDriverPanel("#driver1", d1);
        renderDriverPanel("#driver2", d2);
    
        const radarData = computeRadarMetrics(d1, d2);
        renderRadar(radarData);
    
        renderBars(d1, d2);
    }
    
  
    // DRIVER PANEL (name, photo, stats table)
    function renderDriverPanel(sel, d) {
      const panel = d3.select(sel);
      panel.html("");
  
      panel.append("div")
        .attr("class", "driver-name")
        .style("color", "white")
        .text(d.name);
  
      const photoContainer = panel.append("div")
        .attr("class", "photo-container");

      const img = photoContainer.append("img")
        .attr("class", "driver-photo")
        .attr("src", d.photo)
        .attr("alt", d.name + " photo")
        .on("error", function () {
           d3.select(this).remove();  // Remove img if broken
           photoContainer.append("div")
            .attr("class", "photo-placeholder")
            .text("No photo");
        });

  
      const stats = panel.append("div").attr("class", "basic-stats");
  
      stats.html(`
        <div><strong>Nationality:</strong> ${d.nationality}</div>
        <div><strong>Age:</strong> ${d.age}</div>
        <div><strong>Date of Birth:</strong> ${d.dob}</div>
        <div><strong>Seasons:</strong> ${formatSeasons(d.seasons)}</div>
        <div><strong>Races participated in:</strong> ${d.races}</div>
        <div><strong>Races won:</strong> ${d.wins}</div>
        <div><strong>Championships:</strong> ${d.championships}</div>
      `);
    }
  
    // BAR CHART 

    function renderBars(d1, d2) {
        const container = d3.select("#bars-container");
        container.html("");
    
        const panelWidth = container.node().getBoundingClientRect().width;
        const barHeight = 18;
        const rowHeight = 70;
        const centerX = panelWidth / 2;
        const labelPadding = 70;
        const valuePadding = 40;
        const safeLeftSpace = centerX - labelPadding - valuePadding;
        const safeRightSpace = panelWidth - centerX - labelPadding - valuePadding;
        const maxSafeBarWidth = Math.min(safeLeftSpace, safeRightSpace);

        const maxVal = d3.max([
            d1.seasonCount, d2.seasonCount,
            d1.races, d2.races,
            d1.wins, d2.wins,
            d1.championships, d2.championships
        ]);
    
        const x = d3.scaleLinear()
            .domain([0, maxVal])
            .range([0, maxSafeBarWidth]);
    
        // Metrics displayed
        const metrics = [
            { label: "Seasons", left: d1.seasonCount, right: d2.seasonCount },
            { label: "Races", left: d1.races, right: d2.races },
            { label: "Wins", left: d1.wins, right: d2.wins },
            { label: "Championships", left: d1.championships, right: d2.championships }
        ];
    
        const svg = container.append("svg")
            .attr("width", panelWidth)
            .attr("height", metrics.length * rowHeight);
    
        metrics.forEach((m, i) => {
            const y = i * rowHeight + 20;
    
            const leftWidth = x(m.left);
            const rightWidth = x(m.right);
    
            // Left bar
            svg.append("rect")
                .attr("x", centerX - leftWidth - labelPadding)
                .attr("y", y)
                .attr("width", leftWidth)
                .attr("height", barHeight)
                .attr("fill", "#3f7cff");
    
            svg.append("text")
                .attr("x", centerX - leftWidth - labelPadding - 10)
                .attr("y", y + barHeight - 2)
                .attr("text-anchor", "end")
                .attr("font-size", "12px")
                .attr("class", "bar-value")
                .text(m.left);
    
            // MEetric label
            svg.append("text")
                .attr("x", centerX)
                .attr("y", y + barHeight-2)
                .attr("text-anchor", "middle")
                .attr("class", "metric-label")
                .text(m.label);
    
            // Right bar
            svg.append("rect")
                .attr("x", centerX + labelPadding)
                .attr("y", y)
                .attr("width", rightWidth)
                .attr("height", barHeight)
                .attr("fill", "#f2cc23");
    
            svg.append("text")
                .attr("x", centerX + rightWidth + labelPadding + 10)
                .attr("y", y + barHeight - 2)
                .attr("class", "bar-value")
                .attr("font-size", "12px")
                .text(m.right);
        });
    
        // Driver names under chart
        svg.append("text")
            .attr("x", centerX - labelPadding)
            .attr("y", metrics.length * rowHeight - 5)
            .attr("text-anchor", "end")
            .attr("fill", "#3f7cff")
            .style("font-size", "18px")
            .text(d1.name);
    
        svg.append("text")
            .attr("x", centerX + labelPadding)
            .attr("y", metrics.length * rowHeight - 5)
            .attr("text-anchor", "start")
            .attr("fill", "#f2cc23")
            .style("font-size", "18px")
            .text(d2.name);
    }
    
    // Formating seasins
    function formatSeasons(seasonSet) {
      const years = Array.from(seasonSet).sort((a, b) => a - b);
      if (years.length === 0) return "N/A";
  
      let ranges = [];
      let start = years[0];
      let prev = years[0];
  
      for (let i = 1; i < years.length; i++) {
        if (years[i] !== prev + 1) {
          ranges.push(start === prev ? `${start}` : `${start}–${prev}`);
          start = years[i];
        }
        prev = years[i];
      }
      ranges.push(start === prev ? `${start}` : `${start}–${prev}`);
  
      return ranges.join(", ");
    }
  
    // Calculating age
    function calcAge(dob) {
      const diff = Date.now() - new Date(dob).getTime();
      return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
    }
    
    // Counting top 3 qualifying positions
    function countTop3Qualifying(results, driverId) {
      return results.filter(r => r.driverId === driverId && +r.grid >0 && r.grid <= 3).length;
    }

    // compute radar chart metrics
    function computeRadarMetrics(d1,d2) {
        const top3_1 = countTop3Qualifying(results, d1.id);
        const top3_2 = countTop3Qualifying(results, d2.id);

        const drivers = [d1,d2].map((d,i) => {
            const top3 = i == 0 ? top3_1 : top3_2;
            const races = d.races || 1; // avoid div by 0
            const seasons = d.seasons.size || 1;

            return {
                name: d.name,
                win: d.wins/races,
                podium: d.podiums ? (d.podiums/races) : 0,
                reliability: 1 - (d.dnfs ? (d.dnfs/races) : 0),
                championship: d.championships/seasons,
                pointsProductivity: (d.totalPoints || 0) / races / 25,
                p3qualy: top3/races,
            };

        });
        return drivers;
    }

    const metricDescriptions = {
        win: "Percentage of races the driver has won out of all races started.",
        podium: "Percentage of races where the driver finished in the top 3.",
        reliability: "Percentage of finished races without retiring.",
        championship: "Ttles won compared to seasons competed.",
        pointsProductivity: "Average points per race relative to the 25-point maximum.",
        p3qualy: "Percentage of qualifying sessions ending in a top-3 grid position."
    };

    //rRADAR CHART
    function renderRadar(data, containerId = "#radar-chart", width = 420, height = 420) {
        d3.select(containerId).html("");

        const metrics = [
            { key: "win", label: "Win Rate [%]" },
            { key: "podium", label: "Podium Rate [%]" },
            { key: "reliability", label: "Finish Rate [%]" },
            { key: "championship", label: "Championship Rate [%]" },
            { key: "pointsProductivity", label: "Points Efficiency [%]" },
            { key: "p3qualy", label: "Top 3 Qualifying Rate [%]" }
        ];

        const radius = Math.min(width, height) / 2 - 60;

        const svg = d3.select(containerId)
            .append("svg")
            .attr("width", width)
            .attr("height", height)

        const g = svg.append("g")
            .attr("transform", `translate(${width / 2}, ${height / 2})`);

        //legend for radar chart
        const legend = svg.append("g")
            .attr("class", "radar-legend")
            .attr("transform", `translate(${width - 150}, 20)`);
        const box = 14;

        if (data[0]) {
            legend.append("rect")
              .attr("x", 0)
              .attr("y", 0)
              .attr("width", box)
              .attr("height", box)
              .attr("fill", "#0C7BDC");
            legend.append("text")
              .attr("x", box + 8)
              .attr("y", 11)
              .attr("font-size", "12px")
              .style("fill", "white")
              .text(data[0].name);
        }
        if (data[1]) {
          legend.append("rect")
              .attr("x", 0)
              .attr("y", 22)
              .attr("width", box)
              .attr("height", box)
              .attr("fill", "#FFC20A");
      
          legend.append("text")
              .attr("x", box + 8)
              .attr("y", 33)
              .attr("fill", "white")
              .style("font-size", "13px")
              .text(data[1].name);
        }
        
        const angleSlice = (2 * Math.PI) / metrics.length;

        const gridLevels = 5;
        for (let level = 1; level <= gridLevels; level++) {
            g.append("circle")
                .attr("r", radius * (level / gridLevels))
                .attr("fill", "none")
                .attr("stroke", "#555")
        }

        for (let level = 1; level <= gridLevels; level++) {
            const r = radius * (level / gridLevels);
            g.append("text")
              .attr("x", 0)
              .attr("y", -r)
              .attr("dy", "-4px")
              .attr("text-anchor", "middle")
              .attr("font-size", "11px")
              .style("fill", "#aaa")
              .text((level * 20) + "%");
          }

        metrics.forEach((metric, i) => {
            const angle = i * angleSlice - Math.PI / 2;

            g.append("line")
                .attr("x1", 0)
                .attr("y1", 0)
                .attr("x2", Math.cos(angle) * radius)
                .attr("y2", Math.sin(angle) * radius)
                .attr("stroke", "#777");

            const label = g.append("text")
                .attr("x", Math.cos(angle) * (radius + 15))
                .attr("y", Math.sin(angle) * (radius + 15))
                .attr("text-anchor", "middle")
                .attr("font-size", "11px")
                .style("fill", "white")
                .style("cursor", "help")
                .text(metric.label);
            
            label
                .on("mouseover", (event) =>{
                    const tooltip = d3.select("#radar-tooltip");
                    tooltip
                        .html(metricDescriptions[metric.key])
                        .classed("hidden", false);
                })
                .on("mousemove", (event) => {
                    d3.select("#radar-tooltip")
                      .style("left", (event.clientX + 15) + "px")
                      .style("top", (event.clientY + 15) + "px");
                })
                  .on("mouseout", () => {
                    d3.select("#radar-tooltip").classed("hidden", true);
                });
        });

        function radarPath(d, color) {
            const points = metrics.map((m, i) => {
                const angle = i * angleSlice - Math.PI / 2;
                const value = d[m.key] || 0;
                return [
                    Math.cos(angle) * value * radius,
                    Math.sin(angle) * value * radius
                ];
            });
        
            points.push(points[0]);
        
            const line = d3.line()
                .x(p => p[0])
                .y(p => p[1]);
        
            g.append("path")
                .datum(points)
                .attr("d", line)
                .attr("fill", color)
                .attr("stroke", color)
                .attr("stroke-width", 2)
                .attr("fill-opacity", 0.25);
        }
        
        if (data[0]) radarPath(data[0], "#0C7BDC");

        if (data[1]) radarPath(data[1], "#FFC20A");
        
        d3.select("#radar-chart")
            .on("click", () => {
                showLargeRadar(data);
            });

    }
    // Show larger radar chart in modal
    function showLargeRadar(data) {
        d3.select("#radar-modal").classed("hidden", false);
        d3.select("#radar-chart-large").html("");
        renderRadar(data, "#radar-chart-large", 700, 700);
    }

    // close radar chart
    d3.select("#radar-modal-close")
        .on("click", () => {
            d3.select("#radar-modal").classed("hidden", true);
        });

    d3.select("#radar-modal")
        .on("click", function(event) {
          if (event.target.id === "radar-modal") {
            d3.select("#radar-modal").classed("hidden", true);
          }
        });

  });

  document.getElementById("backToDashboard").addEventListener("click", () => {
    if (window.opener && !window.opener.closed) {
      window.close();
    } else if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "/index.html";
    }
  });
  