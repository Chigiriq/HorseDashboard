const fs = require("fs");
const path = require("path");
const { csvParse, csvFormat, autoType } = require("d3-dsv");

// Read the raw files
// Ensure races.csv and racecourseCoords.csv are in the same folder as this script
const racesRaw = fs.readFileSync(path.join(__dirname, "races.csv"), "utf8");
const coordsRaw = fs.readFileSync(path.join(__dirname, "racecourseCoords.csv"), "utf8");

// Parse them
const races = csvParse(racesRaw, autoType);
const coords = csvParse(coordsRaw, autoType);

// Create a lookup map for coordinates
// Normalizing keys to lowercase can help match 'Tokyo' to 'tokyo' if needed, 
// but here we assume exact matches or standard casing.
const coordMap = new Map(coords.map(c => [c.name, { x: c.x, y: c.y }]));

// Join coordinates into the race data
const joinedData = races.map(race => {
  const c = coordMap.get(race.course);
  return {
    ...race,
    course_x: c ? c.x : null,
    course_y: c ? c.y : null
  };
});

// Output the combined CSV to stdout
process.stdout.write(csvFormat(joinedData));