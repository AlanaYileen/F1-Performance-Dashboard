# 🏎️ Formula 1 Performance Dashboard

An interactive web-based dashboard for exploring Formula 1 performance data across seasons, drivers, constructors, and races.  
The project combines multiple coordinated visualizations built with **D3.js** to provide historical and comparative insights into F1 results.

🔗 **Live Demo (GitHub Pages):**  
https://alanayileen.github.io/F1-Performance-Dashboard/

---

## 💡 Features

- **Season selector** to explore different Formula 1 seasons
- **Race results table** with winners, teams, laps, and times
- **Driver standings** by season
- **Team standings** by season
- **Season timeline** showing race progression
- **Interactive circuit map** highlighting host countries and circuits
- **Driver comparison view**
- **Starting vs finishing grid visualization** for individual races
- Cross-view coordination via shared state (season & race selection)

---

## 📁 Project Structure

F1-Performance-Dashboard
│
├── index.html # Main dashboard entry point
├── dashboard.js # Dashboard logic & tab management
├── dashboard.css # Global styles
├── table_data.js # Centralized data loading & processing
│
├── data
│ ├── races.csv
│ ├── circuits.csv
│ ├── drivers.csv
│ ├── constructors.csv
│ ├── results.csv
│ ├── driver_standings.csv
│ └── f1_grid_race_comp.csv
│
├── Circuit_Map
│ ├── index.html
│ ├── script.js
│ └── world.json
│
├── Season_Timeline
│ ├── index.html
│ └── script.js
│
├── Driver_Comparison
│ ├── index.html
│ └── script.js
│
├── Grid
│ ├── index.html
│ └── grid_viz.js
│
└── README.md


---

## 🧠 Technical Overview

- **D3.js (v7)** for all visualizations
- **CSV-based data pipeline**
- Modular visualization architecture
- Responsive SVG layouts
- Relative path handling for GitHub Pages compatibility
- No backend or build step required

---

## 📁 Data Sources & Disclaimer

This project uses publicly available Formula 1 datasets commonly used for educational and analytical purposes.

**Source**: https://www.kaggle.com/datasets/rohanrao/formula-1-world-championship-1950-2020

- Historical race, driver, constructor, and results data
- Data is provided in CSV format and loaded client-side

⚠️ **Disclaimer:**  
All Formula 1 data, names, and trademarks are the property of their respective owners.  
This project is intended for **educational and non-commercial use only**.

---

## 🤖 AI Disclosure

This project was developed with the assistance of **AI-based tools** (including ChatGPT) for:

- Code debugging and refactoring
- Architectural guidance
- Documentation support

All design decisions, data interpretation, and final implementation choices were made by the project author.
