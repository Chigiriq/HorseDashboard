---
title: Races Dashboard
---

<link
  rel="stylesheet"
  href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
/>

```js
const races = await FileAttachment("data/races.csv").csv({ typed: true });

const raceIds = races.map(d => `${d.course}|${d.date}|${d.race_number}`);
const uniqueRaceCount = new Set(raceIds).size;



const selection = Mutable(null);

const filtered = () =>
  races.filter(d => {
    if (!selection.value) return true;

    if (selection.value.type === "course")
      return d.course === selection.value.value;

    if (selection.value.type === "horse")
      return d.horse === selection.value.value;

    if (selection.value.type === "jockey")
      return d.jockey === selection.value.value;

    return true;
  });


const clickablePlot = (options, type) =>
  resize(width => {
    const plot = Plot.plot({ ...options, width });

    const rects = d3.select(plot).selectAll("rect");
    rects.style("cursor", "pointer");

    rects.on("click", (event, d) => {
      const name = d?.[type];
      if (!name) return;

      selection.value =
        selection.value?.value === name
          ? null
          : { type, value: name };
    });

    return plot;
  });


const raceMap = (() => {
  const container = document.createElement("div");
  container.style.height = "500px";
  container.style.width = "100%";

  import("npm:leaflet").then(L => {
    const map = L.map(container).setView([37, 137], 5);

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      {
        attribution: "&copy; CartoDB",
        subdomains: "abcd",
        maxZoom: 19
      }
    ).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);

    const legend = L.control({ position: "bottomright" });

    function draw() {
      layerGroup.clearLayers();

      const pts = filtered().filter(d => d.x != null && d.y != null);

      // Count races per course
      const racesByCourse = d3.rollups(
        pts,
        v => {
          // Unique races within this course
          const uniqueRaces = d3.group(v, d => `${d.date}|${d.race_name}`);
          return uniqueRaces.size;
        },
        d => d.course
      );


      const courseData = racesByCourse.map(([course, raceCount]) => {
        const any = pts.find(d => d.course === course);
        return {
          course,
          count: raceCount,
          lat: any.y,
          lng: any.x
        };
      });


      // Color scale
      const courses = courseData.map(d => d.course);
      const colorScale = d3.scaleOrdinal(d3.schemeTableau10).domain(courses);

      // Markers
      courseData.forEach(d => {
        const isSelected =
          selection.value?.type === "course" &&
          selection.value?.value === d.course;

        const circle = L.circleMarker([d.lat, d.lng], {
          radius: Math.max(6, Math.sqrt(d.count) * 2.2),
          color: isSelected ? "#ef4444" : colorScale(d.course),
          fillColor: isSelected ? "#ef4444" : colorScale(d.course),
          fillOpacity: 0.65,
          weight: isSelected ? 3 : 1
        })
        .bindPopup(`<strong>${d.course}</strong><br>${d.count} races`)
        .addTo(layerGroup);

        circle.on("click", () => {
          selection.value =
            isSelected ? null : { type: "course", value: d.course };
        });
      });

      // Legend
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

        courseData.forEach(d => {
          const color = colorScale(d.course);
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
              ${d.course}
            </div>
          `;
        });

        return div;
      };

      legend.addTo(map);
    }


    // ✅ Initial draw
    draw();

    // ✅ ✅ ✅ THIS IS THE KEY FIX — PROPER FRAMEWORK REACTIVITY
    Generators.observe(() => {
      selection.value;
      draw();
    });


  });

  return container;
})();

```
<div class="grid grid-cols-2">
  <div class="card">
    <div class="big">${filtered().length.toLocaleString()}</div>
    <div class="muted">Available Races</div>
  </div>
</div>

<div class="grid grid-cols-1">
  <div class="card">
    <h2>Racecourse Activity Map</h2>
    ${raceMap}
  </div>
</div>

<div class="grid grid-cols-2">

  <div class="card">
    <h2>Top 5 Winningest Horses</h2>
    ${clickablePlot({
      height: 300,
      marginLeft: 150,
      x: { label: "Wins", grid: true },
      y: { label: null },
      marks: [
        Plot.barX(
          filtered().filter(d => d.pos === 1),
          Plot.groupY({ x: "count" }, {
            y: "horse",
            sort: { y: "x", reverse: true, limit: 5 },
            fill: d =>
              selection.value?.value === d.horse ? "#ef4444" : "#10b981",
            tip: true
          })
        ),
        Plot.ruleX([0])
      ]
    }, "horse")}
  </div>

  <div class="card">
    <h2>Top 5 Winningest Jockeys</h2>
    ${clickablePlot({
      height: 300,
      marginLeft: 150,
      x: { label: "Wins", grid: true },
      y: { label: null },
      marks: [
        Plot.barX(
          filtered().filter(d => d.pos === 1),
          Plot.groupY({ x: "count" }, {
            y: "jockey",
            sort: { y: "x", reverse: true, limit: 5 },
            fill: d =>
              selection.value?.value === d.jockey ? "#ef4444" : "#3b82f6",
            tip: true
          })
        ),
        Plot.ruleX([0])
      ]
    }, "jockey")}
  </div>

  <div class="card">
    <h2>Top 5 Most Races (Horses)</h2>
    ${clickablePlot({
      height: 300,
      marginLeft: 150,
      x: { label: "Starts", grid: true },
      y: { label: null },
      marks: [
        Plot.barX(
          filtered(),
          Plot.groupY({ x: "count" }, {
            y: "horse",
            sort: { y: "x", reverse: true, limit: 5 },
            fill: d =>
              selection.value?.value === d.horse ? "#ef4444" : "#f59e0b",
            tip: true
          })
        ),
        Plot.ruleX([0])
      ]
    }, "horse")}
  </div>

  <div class="card">
    <h2>Top 5 Most Races (Jockeys)</h2>
    ${clickablePlot({
      height: 300,
      marginLeft: 150,
      x: { label: "Starts", grid: true },
      y: { label: null },
      marks: [
        Plot.barX(
          filtered(),
          Plot.groupY({ x: "count" }, {
            y: "jockey",
            sort: { y: "x", reverse: true, limit: 5 },
            fill: d =>
              selection.value?.value === d.jockey ? "#ef4444" : "#6366f1",
            tip: true
          })
        ),
        Plot.ruleX([0])
      ]
    }, "jockey")}
  </div>

</div>