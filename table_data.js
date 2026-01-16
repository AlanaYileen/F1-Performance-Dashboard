(function () {
  const PATH = "data/";

  const state = {
    races: [],
    circuitsById: new Map(),
    driversById: new Map(),
    constructorsById: new Map(),
    driverStandings: [],
    constructorStandings: [],
    results: null, // optional
    resultsByRaceId: new Map(), // optional
  };

  function parseMaybeNumber(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function fmtDateISO(iso) {
    if (!iso || iso === "\\N") return "";

    const dt = new Date(iso);
    return Number.isNaN(dt.getTime())
      ? String(iso)
      : dt.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  }

  function driverName(driver) {
    if (!driver) return "Unknown";
    return `${driver.forename ?? ""} ${driver.surname ?? ""}`.trim() || "Unknown";
  }

  function getSeasons() {
    const years = Array.from(new Set(state.races.map(r => r.year))).sort((a, b) => b - a);
    return years;
  }

  function getLastRaceIdForSeason(year) {
    const seasonRaces = state.races.filter(r => r.year === year);
    if (!seasonRaces.length) return null;
    // last race = max round
    seasonRaces.sort((a, b) => a.round - b.round);
    return seasonRaces[seasonRaces.length - 1].raceId;
  }

  // -----------------------------
  // Public: Races table rows
  // -----------------------------
  function getRaceRowsForSeason(year) {
    const seasonRaces = state.races
      .filter(r => r.year === year)
      .sort((a, b) => a.round - b.round);

    return seasonRaces.map(r => {
      // Basic info always available:
      const date = fmtDateISO(r.date);
      const gp = r.name;

      // Winner/team/laps/time require results.csv
      let winner = "—";
      let team = "—";
      let laps = "—";
      let time = "—";

      if (state.results) {
        const res = state.resultsByRaceId.get(r.raceId);
        if (res) {
          const winnerRow = res.find(x => x.positionOrder === 1);
          if (winnerRow) {
            winner = driverName(state.driversById.get(winnerRow.driverId));
            const ctor = state.constructorsById.get(winnerRow.constructorId);
            team = ctor?.name ?? "—";
            laps = winnerRow.laps ?? "—";
            time = winnerRow.time ?? "—";
          }
        }
      }

      return {
        id: r.raceId,
        gp,
        date,
        winner,
        team,
        laps,
        time,
      };
    });
  }

  // -----------------------------
  // Public: Drivers standings (end-of-season)
  // -----------------------------
  function getDriverRowsForSeason(year) {
    const lastRaceId = getLastRaceIdForSeason(year);
    if (!lastRaceId) return [];

    // driver_standings.csv gives championship standings after each race.
    // We take the standings after the final race of the season.
    const rows = state.driverStandings
      .filter(d => d.raceId === lastRaceId)
      .map(d => ({
        driverId: d.driverId,
        pos: d.position,
        pts: d.points,
        wins: d.wins,
      }))
      .sort((a, b) => a.pos - b.pos);

    // Team requires results.csv (constructorId not in driver_standings.csv)
    let constructorByDriverId = new Map();
    if (state.results) {
      const res = state.resultsByRaceId.get(lastRaceId) || [];
      // Use the constructor from the final race entry for each driver
      res.forEach(r => {
        if (!constructorByDriverId.has(r.driverId)) {
          constructorByDriverId.set(r.driverId, r.constructorId);
        }
      });
    }

    return rows.map(r => {
      const drv = state.driversById.get(r.driverId);
      const ctorId = constructorByDriverId.get(r.driverId);
      const ctor = ctorId ? state.constructorsById.get(ctorId) : null;

      return {
        pos: r.pos,
        driver: driverName(drv),
        nat: drv?.nationality ?? "—",
        team: ctor?.name ?? "—",
        pts: r.pts ?? "—",
        wins: r.wins ?? "—",
      };
    });
  }

  function getConstructorRowsForSeason(year) {
    const lastRaceId = getLastRaceIdForSeason(year);
    if (!lastRaceId) return [];
  
    return state.constructorStandings
      .filter(c => c.raceId === lastRaceId)
      .map(c => {
        const ctor = state.constructorsById.get(c.constructorId);
        return {
          pos: c.position,
          team: ctor?.name ?? "—",
          nationality: ctor?.nationality ?? "—",
          pts: c.points ?? "—",
        };
      })
      .sort((a, b) => a.pos - b.pos);
  }

  // -----------------------------
  // Load all data
  // -----------------------------
  async function loadAll() {
    const [
      races,
      circuits,
      drivers,
      constructors,
      driverStandings,
      constructorStandings,
    ] = await Promise.all([
      d3.csv(`${PATH}races.csv`, d3.autoType),
      d3.csv(`${PATH}circuits.csv`, d3.autoType),
      d3.csv(`${PATH}drivers.csv`, d3.autoType),
      d3.csv(`${PATH}constructors.csv`, d3.autoType),
      d3.csv(`${PATH}driver_standings.csv`, d3.autoType),
      d3.csv(`${PATH}constructor_standings.csv`, d3.autoType),
    ]);

    state.races = races.map(r => ({
      raceId: Number(r.raceId),
      year: Number(r.year),
      round: Number(r.round),
      circuitId: Number(r.circuitId),
      name: r.name,
      date: r.date,
    }));

    state.circuitsById = new Map(circuits.map(c => [Number(c.circuitId), c]));
    state.driversById = new Map(drivers.map(d => [Number(d.driverId), d]));
    state.constructorsById = new Map(constructors.map(c => [Number(c.constructorId), c]));
    state.driverStandings = driverStandings.map(d => ({
      raceId: Number(d.raceId),
      driverId: Number(d.driverId),
      points: parseMaybeNumber(d.points) ?? d.points,
      position: Number(d.position),
      wins: Number(d.wins),
    }));
    state.constructorStandings= constructorStandings.map(c => ({
      raceId: Number(c.raceId),
      constructorId: Number(c.constructorId),
      position: Number(c.position),
      points: parseMaybeNumber(c.points) ?? c.points,
    }));

    // Optional: results.csv
    try {
      const results = await d3.csv(`${PATH}results.csv`, d3.autoType);
      state.results = results.map(r => ({
        raceId: Number(r.raceId),
        driverId: Number(r.driverId),
        constructorId: Number(r.constructorId),
        positionOrder: Number(r.positionOrder ?? r.position), // handle alt column names
        laps: r.laps,
        time: r.time,
      }));

      // index by race
      const byRace = new Map();
      state.results.forEach(r => {
        if (!byRace.has(r.raceId)) byRace.set(r.raceId, []);
        byRace.get(r.raceId).push(r);
      });
      // sort each race results
      byRace.forEach(arr => arr.sort((a, b) => a.positionOrder - b.positionOrder));
      state.resultsByRaceId = byRace;
      console.log("[data] Loaded results.csv ✔");
    } catch (e) {
      console.warn("[data] results.csv not found (race winner/laps/time/team will show as —).");
      state.results = null;
      state.resultsByRaceId = new Map();
    }

    // Expose globals dashboard.js already expects
    window.SEASONS = getSeasons();
    window.getRaceRowsForSeason = getRaceRowsForSeason;
    window.getDriverRowsForSeason = getDriverRowsForSeason;
    window.getConstructorRowsForSeason = getConstructorRowsForSeason;
  }

  // Expose a readiness promise for dashboard.js to await
  window.DATA_READY = loadAll();
})();