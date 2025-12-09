---
title: Races Dashboard
---

<link
  rel="stylesheet"
  href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
/>

```js
//---------------- Data ----------------
const races = await FileAttachment("data/racesUpdated.csv").csv({ typed: true });
const raceIds = races.map(d => `${d.course}|${d.date}|${d.race_number}`);

const selection = Mutable(null);

const setSelection = (v) => { selection.value = v; };
```

```js
//---------------- Filtering and Scaling (from filtered data) ----------------
const filtered = selection 
  ? races.filter(d => {
      if (selection.type === "course") return d.course === selection.value;
      if (selection.type === "horse") return d.horse === selection.value;
      if (selection.type === "jockey") return d.jockey === selection.value;
      return true;
    })
  : races;

const winsData = filtered.filter(d => d.pos === 1);

//auto bounds
const getSafeMax = (data, accessor) => {
  const maxVal = d3.max(d3.rollups(data, v => v.length, accessor), d => d[1]) || 0;
  if (maxVal === 0) return 5;
  return Math.max(maxVal + 1, maxVal * 1.05);
};

const maxWinsHorse = getSafeMax(winsData, d => d.horse);
const maxWinsJockey = getSafeMax(winsData, d => d.jockey);
const maxRacesHorse = getSafeMax(filtered, d => d.horse);
const maxRacesJockey = getSafeMax(filtered, d => d.jockey);

const drawStatsAll = races
  .filter(d => d.draw)
  .map(d => ({
    course: d.course,
    draw: +d.draw,
    is_placed: (+d.pos >= 1 && +d.pos <= 3) ? 1 : 0
  }));

const filteredUniqueRaces = new Set(
  filtered.map(d => `${d.course}|${d.date}|${d.race_number}`)
).size;
```

```js
//---------------- Grid Plots ----------------
const clickablePlot = (options, type) =>
  resize(width => {
    // 1. Dynamic Margin Logic:
    const autoMargin = Math.min(180, Math.max(120, width * 0.35));

    // 2. Merge options:
    const plotOptions = {
      ...options,
      width,
      marginLeft: autoMargin,
      style: { ...options.style, overflow: "visible" } 
    };

    const plot = Plot.plot(plotOptions);

    const rects = d3.select(plot).selectAll("rect");
    rects.style("cursor", "pointer");

    rects.on("click", (event, d) => {
      const name = d?.[type];
      if (!name) return;

      const current = selection.value; 
      const isSame = current?.value === name && current?.type === type;
      setSelection(isSame ? null : { type, value: name });
    });

    return plot;
  });
```

```js
//---------------- Map Init ----------------
const mapContext = await (async () => {
  const container = document.createElement("div");
  container.style.height = "500px";
  container.style.width = "100%";
  container.style.zIndex = "0"; 

  const L = await import("npm:leaflet");
  
  const map = L.map(container).setView([37, 137], 5);

  L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    { attribution: "&copy; CartoDB", subdomains: "abcd", maxZoom: 19 }
  ).addTo(map);

  const layerGroup = L.layerGroup().addTo(map);
  
  const legend = L.control({ position: "bottomright" });
  legend.onAdd = function() {
      const div = L.DomUtil.create("div", "info legend");
      div.style.background = "white";
      div.style.padding = "10px";
      div.style.color = "#222";
      div.style.border = "1px solid #ccc";
      div.style.borderRadius = "5px";
      return div;
  };
  legend.addTo(map);

  map.on("click", () => { 
    if (map._ignoreNextClick) {
      return;
    }
    setSelection(null); 
  });

  return { container, map, layerGroup, legend, L };
})();
```

```js
//---------------- Reactive Map ----------------
{
  const { map, layerGroup, legend, L } = mapContext;
  
  const currentSelection = selection; 
  const pts = races.filter(d => d.x != null && d.y != null);

  setTimeout(() => map.invalidateSize(), 100);

  layerGroup.clearLayers();

  const racesByCourse = d3.rollups(
    pts,
    v => new Set(v.map(d => `${d.date}|${d.race_name}`)).size,
    d => d.course
  );

  const courseData = racesByCourse.map(([course, count]) => {
    const any = pts.find(d => d.course === course);
    return { course, count, lat: any.y, lng: any.x };
  });

  //hardcoded colorblind mostly friendly
  const TOL_21 = [
    "#882E72", "#B178A6", "#D6C1DE",
    "#1965B0", "#4EB265", "#CAE0AB",
    "#F7EE55", "#F6C141", "#F1932D",
    "#E8601C", "#DC050C", "#72190E",
    "#7F3C8D", "#11A579", "#3969AC",
    "#F2B701", "#E73F74", "#80BA5A",
    "#3F007D"
  ];

  const sortedNames = courseData.map(d => d.course).sort(d3.ascending);

  const colorScale = d3.scaleOrdinal()
    .domain(sortedNames)
    .range(TOL_21.slice(0, sortedNames.length));

  //no idea why the data stores Nagoya as NAGOYA but whatevs
  const formatName = (name) => name === "NAGOYA" ? "Nagoya" : name;

  courseData.forEach(d => {
    const isSelected =
      currentSelection?.type === "course" &&
      currentSelection?.value === d.course;
    
    const isModeCourse = currentSelection?.type === "course";
    const fill = isSelected ? "#ef4444" : colorScale(d.course);
    const stroke = isSelected ? "black" : "#444"; 
    const opacity = isSelected ? 1.0 : (isModeCourse ? 0.3 : 0.9);
    const weight = isSelected ? 3 : 1;

    const circle = L.circleMarker([d.lat, d.lng], {
      radius: Math.max(5, Math.sqrt(d.count) * 2.2),
      color: stroke,
      fillColor: fill,
      fillOpacity: opacity,
      weight: weight
    })
    .addTo(layerGroup);

    //tooltip
    circle.bindTooltip(
      `<strong>${formatName(d.course)}</strong><br>${d.count} races`, 
      { 
        direction: "top", 
        offset: [0, -5], 
        opacity: 1.0,
        permanent: isSelected 
      }
    );

    //click
    circle.on("click", (e) => {
      L.DomEvent.stopPropagation(e.originalEvent);
      map._ignoreNextClick = true;
      setTimeout(() => { map._ignoreNextClick = false; }, 100);

      if (isSelected) {
        setSelection(null);
      } else {
        setSelection({ type: "course", value: d.course });
      }
    });

    //hover
    if (!isSelected) {
      circle.on("mouseover", function() {
        this.openTooltip();
        this.setStyle({ weight: 3, color: "#333", fillOpacity: 1.0 });
      });

      circle.on("mouseout", function() {
        this.closeTooltip();
        this.setStyle({ weight: 1, color: stroke, fillOpacity: opacity });
      });
    }

    if (isSelected) {
      circle.bringToFront();
      circle.openTooltip(); 
    }
  });

  //Legend
  const div = legend.getContainer();
  div.innerHTML = "<strong>Courses</strong><br>";
  const sortedCourses = [...courseData].sort((a, b) => d3.ascending(a.course, b.course));
  
  sortedCourses.forEach(d => {
    const item = document.createElement("div"); //clickable legend items
    item.style.display = "flex";
    item.style.alignItems = "center";
    item.style.marginBottom = "4px";
    item.style.fontSize = "12px";
    item.style.cursor = "pointer"; //clickable legend items

    item.innerHTML = `
      <span style="
        display:inline-block;
        width:12px;
        height:12px;
        background:${colorScale(d.course)};
        margin-right:6px;
        border-radius:50%;
      "></span>
      ${formatName(d.course)}
    `;

    //more click
    item.onclick = (e) => {
      e.stopPropagation();

      const isSelected =
        currentSelection?.type === "course" &&
        currentSelection?.value === d.course;

      setSelection(isSelected ? null : { type: "course", value: d.course });
    };

    div.appendChild(item);
  });

}
```

```js
//---------------- HeatMap ----------------
const globalMean = d3.mean(
  races, 
  d => (+d.pos >= 1 && +d.pos <= 3) ? 1 : 0
);

const k = 5;

// Weighted mean (Bayesian smoothed)
const drawBiasData = d3.rollups(
  races.filter(d => d.draw),
  v => {
    const n = v.length;
    const wins = d3.sum(v, d => (+d.pos >= 1 && +d.pos <= 3) ? 1 : 0);
    const raw = wins / n;

    // Empirical Bayes smoothing
    const adjusted = (n * raw + k * globalMean) / (n + k);

    return { raw, adjusted, count: n };
  },
  d => d.course,
  d => +d.draw
)
.map(([course, draws]) =>
  draws.map(([draw, stats]) => ({
    course,
    draw,
    raw: stats.raw,
    mean: stats.adjusted,  // smoothed mean
    count: stats.count
  }))
)
.flat();

const courseOrder = d3.groupSort(races, g => -g.length, d => d.course);

const heatmapPlot = (() => {
  const container = html`<div style="display:flex; flex-direction:column; align-items:center;"></div>`;

  const select = html`
    <select style="margin-bottom:10px;">
      <option value="mean" selected>Adjusted</option>
      <option value="raw">Raw</option>
    </select>
  `;
  container.append(select);

  const legendHolder = html`<div style="margin-bottom: 5px;"></div>`;
  container.append(legendHolder);

  const chartHolder = html`<div style="width:100%; display:flex; justify-content:center;"></div>`;
  container.append(chartHolder);

  function renderChart(metric) {
    legendHolder.innerHTML = "";
    chartHolder.innerHTML = ""; 

    const colorConfig = {
      type: "linear",
      scheme: "viridis",
      domain: [0, .5],
      clamp: true,
      label: metric === "mean" ? "Adj Place Rate" : "Raw Place Rate",
      tickFormat: d3.format(".0%")
    };

    //Standalone Legend
    const legend = Plot.legend({
      color: colorConfig,
      width: 320
    });
    legend.style.background = "none"; 
    legendHolder.append(legend);

    const chart = Plot.plot({
      height: 500,
      marginLeft: 50,
      marginBottom: 80,
      padding: 0,
      x: {
        label: null,
        tickRotate: -45,
        domain: courseOrder
      },
      y: {
        label: "Draw Number",
        domain: d3.range(1, 19),
        tickSize: 0
      },
      color: {
        ...colorConfig,
        legend: false // DISABLE internal legend
      },
      style: {
        fontSize: "13px",
        overflow: "visible"
      },
      marks: [
        Plot.cell(drawBiasData, {
          x: "course",
          y: "draw",
          fill: metric,
          inset: 0.51,
          fillOpacity: d =>
            selection?.type === "course" &&
            selection.value !== d.course ? 0.15 : 1,
          title: null,
          tip: false
        }),

        Plot.text(drawBiasData, {
          x: "course",
          y: "draw",
          text: d => d3.format(".0%")(d[metric]),
          fill: d => d[metric] > 0.25 ? "black" : "darkgray",
          fontWeight: "bold",
          fontSize: 10,
          filter: d =>
            !(selection?.type === "course" &&
              selection.value !== d.course),
          pointerEvents: "none"
        })
      ]
    });

    let selectedCell = null;
    d3.select(chart).selectAll("rect")
      .on("mouseenter", function() {
        if (this.style.fillOpacity !== "0.15" && this !== selectedCell) {
          d3.select(this)
            .style("stroke", "yellow")
            .style("stroke-width", 3)
            .raise();

          d3.select(chart).selectAll("text").raise();
        }
      })
      .on("mouseleave", function() {
        if (this !== selectedCell) {
          d3.select(this)
            .style("stroke", null)
            .style("stroke-width", null);
        }
      });

    d3.select(chart).selectAll("rect")
      .on("click", function(event, d) {
        if (selectedCell === this) {
          d3.select(selectedCell)
            .style("stroke", null)
            .style("stroke-width", null);
          selectedCell = null;
          return;
        }

        if (selectedCell) {
          d3.select(selectedCell)
            .style("stroke", null)
            .style("stroke-width", null);
        }

        selectedCell = this;

        d3.select(this)
          .style("stroke", "yellow")
          .style("stroke-width", 4)
          .raise();

        d3.select(chart).selectAll("text").raise();
      });

    chartHolder.append(chart);
  }

  renderChart("mean");

  select.addEventListener("change", e => {
    renderChart(e.target.value);
  });

  return container;
})();
```


```js
//---------------- Data Table ----------------
const visibleColumns = ["date",	"region","course",	"off", "race_name",	"type",	"class", 	"pattern", "rating_band",	"age_band",	"sex_rest",	"dist",	"dist_f",	"dist_m",	"going",	"surface",	"ran",	"num",	"pos",	"draw",	"ovr_btn",	"btn",	"horse",	"age",	"sex",	"lbs",	"hg",	"time",	"secs",	"dec",	"jockey",	"trainer",	"prize",	"or",	"rpr",	"sire",	"dam",	"damsire",	"owner"];

const search = Inputs.search(filtered, {
  placeholder: "Search by course, horse, jockey…",
  columns: visibleColumns
});
const searchValue = Generators.input(search);
```


<!-- ---------------- HEADER ---------------- -->
<div style="margin-bottom: 2rem;">
  <h1 style="margin-bottom: 0.5rem; font-weight: 700;">Japanese Horse Racing Dashboard</h1>
  <div class="muted">
    Rough analysis of race outcomes, track bias, and participant performance. 
    Interact with the map to filter the dataset.
  </div>
</div>

<!-- ---------------- KPI CARDS ---------------- -->
<div class="grid grid-cols-2" style="margin-bottom: 1rem;">
  <div class="card">
    <div class="big">${filteredUniqueRaces}</div>
    <div class="muted">Available Races</div>
  </div>
  
  <div class="card">
    <div class="big">
      ${selection && selection.type === "course" ? selection.value : "All Courses"}
    </div>
    <div class="muted">Selected Course</div>
  </div>
</div>

<!-- ---------------- MAP ---------------- -->
<div class="grid grid-cols-1" style="margin-bottom: 1rem;">
  <div class="card">
    <h2>Racecourse Activity Map</h2>
    <div class="muted" style="margin-bottom: 10px;">
      Geographic distribution of racecourses. Circle size represents the volume of races recorded. 
      <strong>Click a marker on the map or legend</strong> to filter the entire dashboard by that specific location.
    </div>
    ${mapContext.container}
  </div>
</div>

<!-- ---------------- PERFORMANCE CHARTS ---------------- -->
<div class="grid grid-cols-2" style="margin-bottom: 1rem;">
  
  <!-- Top Horses (Wins) -->
  <div class="card">
    <h2>Top 5 Winningest Horses</h2>
    <div class="muted" style="margin-bottom: 10px;">
      The highest performing horses based on total first-place finishes.
    </div>
    ${clickablePlot({
      height: 300,
      x: { label: "Wins", grid: true, nice: true, domain: [0, maxWinsHorse] },
      y: { label: null },
      marks: [
        Plot.barX(
          filtered.filter(d => d.pos === 1),
          Plot.groupY({ x: "count" }, {
            y: "horse",
            sort: { y: "x", reverse: true, limit: 5 },
            fill: d => selection?.value === d.horse ? "#ef4444" : "#10b981",
            tip: true
          })
        ),
        Plot.ruleX([0])
      ]
    }, "horse")}
  </div>

  <!-- Top Jockeys (Wins) -->
  <div class="card">
    <h2>Top 5 Winningest Jockeys</h2>
    <div class="muted" style="margin-bottom: 10px;">
      The highest performing jockeys based on total first-place finishes.
    </div>
    ${clickablePlot({
      height: 300,
      x: { label: "Wins", grid: true, nice: true, domain: [0, maxWinsJockey] },
      y: { label: null },
      marks: [
        Plot.barX(
          filtered.filter(d => d.pos === 1),
          Plot.groupY({ x: "count" }, {
            y: "jockey",
            sort: { y: "x", reverse: true, limit: 5 },
            fill: d => selection?.value === d.jockey ? "#ef4444" : "#3b82f6",
            tip: true
          })
        ),
        Plot.ruleX([0])
      ]
    }, "jockey")}
  </div>

  <!-- Top Horses (Starts) -->
  <div class="card">
    <h2>Top 5 Most Races (Horses)</h2>
    <div class="muted" style="margin-bottom: 10px;">
      Horses with the highest volume of starts. A measure of durability 
      and frequency of competition.
    </div>
    ${clickablePlot({
      height: 300,
      x: { label: "Starts", grid: true, nice: true, domain: [0, maxRacesHorse] },
      y: { label: null },
      marks: [
        Plot.barX(
          filtered,
          Plot.groupY({ x: "count" }, {
            y: "horse",
            sort: { y: "x", reverse: true, limit: 5 },
            fill: d => selection?.value === d.horse ? "#ef4444" : "#f59e0b",
            tip: true
          })
        ),
        Plot.ruleX([0])
      ]
    }, "horse")}
  </div>

  <!-- Top Jockeys (Starts) -->
  <div class="card">
    <h2>Top 5 Most Races (Jockeys)</h2>
    <div class="muted" style="margin-bottom: 10px;">
      Jockeys with the highest volume of starts. A measure of rider talent 
      and frequency of competition.
    </div>
    ${clickablePlot({
      height: 300,
      x: { label: "Starts", grid: true, nice: true, domain: [0, maxRacesJockey] },
      y: { label: null },
      marks: [
        Plot.barX(
          filtered,
          Plot.groupY({ x: "count" }, {
            y: "jockey",
            sort: { y: "x", reverse: true, limit: 5 },
            fill: d => selection?.value === d.jockey ? "#ef4444" : "#6366f1",
            tip: true
          })
        ),
        Plot.ruleX([0])
      ]
    }, "jockey")}
  </div>
</div>

<!-- ---------------- HEATMAP ---------------- -->
<div class="card" style="margin-bottom: 1rem;">
  <h2>Track Bias: Place Rate Heatmap</h2>
  <div class="muted" style="margin-bottom: 10px;">
    This heatmap shows the place rate (top 3 finish %) by draw and racecourse. 
    Values use Bayesian smoothing to reduce noise from low-sample draws, so tracks 
    with only a few races don't appear artificially strong. Select a course on the 
    map to highlight its row here. The dropdown allows toggling between the adjusted rates and raw rates.
  </div>
  ${heatmapPlot}
</div>

<!-- ---------------- DATA TABLE ---------------- -->
<div class="card">
  <h2>Detailed Race Data</h2>
  <div class="muted" style="margin-bottom: 10px;">
    Overall view of the filtered dataset. Use the search bar to find specific 
    horses, jockeys, or dates.
  </div>
  
  <!-- Search -->
  <div style="max-width: 320px; margin-bottom: 10px;">
    ${search}
  </div>
  
  <!-- Table Container -->
  <div style="
    overflow-x: auto;
    overflow-y: hidden;
    max-width: 100%;
    border-top: 1px solid #e5e5e5;
    padding-top: 10px;
  ">
    ${Inputs.table(searchValue, { rows: 16 })}
  </div>
</div>

    
<!-- ---------------- FOOTER NOTE ---------------- -->
<div class="card" style="margin-top: 1rem; border-left: 4px solid #f59e0b;">
  <h3 style="margin-top: 0; display: flex; align-items: center; gap: 8px;">
    Data Quality & Completeness
  </h3>
  <div class="muted" style="margin-top: 0.5rem; line-height: 1.5;">
    Please note that the data visualized in this dashboard is derived from web scraping techniques and is 
    <strong>incomplete at best</strong>. Data was scraped using https://github.com/joenano/rpscrape which utilizes results from www.racingpost.com. Recently, success with retrieving data from this source has been diminishing. Newer records may be fragmented, and data sparsity in certain charts 
    (particularly for specific tracks, dates, or less prominent races) likely reflects gaps in collection 
    rather than an absence of actual racing events. Please interpret statistical outliers and trends with this context in mind.
  </div>
</div>

  