```html
<link
  rel="stylesheet"
  href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
/>
```

```js

const races = await FileAttachment("data/races.csv").csv({typed: true});
const dateExtent = d3.extent(races, d => d.date);
const endDate = view(Inputs.date({
  label: "Show data up to",
  min: dateExtent[0],
  max: dateExtent[1],
  value: dateExtent[1] // Default to latest date
}));
const filtered = races;


const raceMap = (() => {
  const container = document.createElement("div");
  container.style.height = "500px";
  container.style.width = "100%";

  import("npm:leaflet").then((L) => {

    const map = L.map(container).setView([37, 137], 5);

    // --- CLEAN GRAY ENGLISH BASEMAP ---
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      {
        attribution: '&copy; CartoDB',
        subdomains: "abcd",
        maxZoom: 19
      }
    ).addTo(map);

    // Filter for valid points
    const pts = filtered.filter(d => d.x != null && d.y != null);

    // Aggregate per course
    const courseData = d3.rollups(
      pts,
      v => ({
        count: v.length,
        lat: v[0].y,
        lng: v[0].x,
        course: v[0].course
      }),
      d => d.course
    );

    // Color scale
    const courses = courseData.map(([course]) => course);
    const colorScale = d3.scaleOrdinal(d3.schemeTableau10).domain(courses);

    // Add markers
    courseData.forEach(([course, data]) => {
      L.circleMarker([data.lat, data.lng], {
        radius: Math.max(4, Math.sqrt(data.count)),
        color: colorScale(course),
        fillColor: colorScale(course),
        fillOpacity: 0.65,
        weight: 1
      })
      .bindPopup(`
        <strong>${course}</strong><br>
        ${data.count} races
      `)
      .addTo(map);
    });

    // --- LEGEND ---
    const legend = L.control({ position: "bottomright" });

    legend.onAdd = function () {
      const div = L.DomUtil.create("div", "info legend");
      div.style.background = "white";
      div.style.padding = "10px";
      div.style.border = "1px solid #ccc";
      div.style.borderRadius = "5px";
      div.style.fontSize = "13px";
      div.style.color = "#222"; 
      div.style.lineHeight = "18px";


      div.innerHTML = "<strong>Courses</strong><br>";

      courses.forEach(course => {
        const color = colorScale(course);
        div.innerHTML += `
          <div style="display:flex; align-items:center; margin-bottom:4px;">
            <span style="
              display:inline-block;
              width:14px;
              height:14px;
              background:${color};
              margin-right:6px;
              border-radius:50%;
            "></span>
            ${course}
          </div>
        `;
      });

      return div;
    };

    legend.addTo(map);

  });

  return container;
})();



```
<!-- Metric Row -->
<div class="grid grid-cols-2">
    <div class="card">
        <div class="big">${filtered.length.toLocaleString()}</div>
        <div class="muted">Available Races</div>
    </div>
</div>

<!-- Map View -->
<div class="grid grid-cols-1">
<div class="card">
<h2>Racecourse Activity Map</h2>
${raceMap}
</div>
</div>

<!-- Charts Grid -->

<div class="grid grid-cols-2">

<!-- 1. Top 5 Winningest Horses -->

<div class="card">
<h2>Top 5 Winningest Horses</h2>
${resize((width) => Plot.plot({
width,
height: 300,
marginLeft: 150,
x: {label: "Wins", grid: true},
y: {label: null},
marks: [
Plot.barX(
filtered.filter(d => d.pos === 1),
Plot.groupY({x: "count"}, {y: "horse", sort: {y: "x", reverse: true, limit: 5}, fill: "#10b981", tip: true})
),
Plot.ruleX([0])
]
}))}
</div>

<!-- 2. Top 5 Winningest Jockeys -->

<div class="card">
<h2>Top 5 Winningest Jockeys</h2>
${resize((width) => Plot.plot({
width,
height: 300,
marginLeft: 150,
x: {label: "Wins", grid: true},
y: {label: null},
marks: [
Plot.barX(
filtered.filter(d => d.pos === 1),
Plot.groupY({x: "count"}, {y: "jockey", sort: {y: "x", reverse: true, limit: 5}, fill: "#3b82f6", tip: true})
),
Plot.ruleX([0])
]
}))}
</div>

<!-- 3. Top 5 Most Races (Horses) -->

<div class="card">
<h2>Top 5 Most Races (Horses)</h2>
${resize((width) => Plot.plot({
width,
height: 300,
marginLeft: 150,
x: {label: "Starts", grid: true},
y: {label: null},
marks: [
Plot.barX(
filtered,
Plot.groupY({x: "count"}, {y: "horse", sort: {y: "x", reverse: true, limit: 5}, fill: "#f59e0b", tip: true})
),
Plot.ruleX([0])
]
}))}
</div>

<!-- 4. Top 5 Most Races (Jockeys) -->

<div class="card">
<h2>Top 5 Most Races (Jockeys)</h2>
${resize((width) => Plot.plot({
width,
height: 300,
marginLeft: 150,
x: {label: "Starts", grid: true},
y: {label: null},
marks: [
Plot.barX(
filtered,
Plot.groupY({x: "count"}, {y: "jockey", sort: {y: "x", reverse: true, limit: 5}, fill: "#6366f1", tip: true})
),
Plot.ruleX([0])
]
}))}
</div>

</div>