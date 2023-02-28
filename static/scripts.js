const base32 = "0123456789bcdefghjkmnpqrstuvwxyz"; // (geohash-specific) Base32 map
var tableD;
class Geohash {
  /**
   * Encodes latitude/longitude to geohash, either to specified precision or to automatically
   * evaluated precision.
   *
   * @param   {number} lat - Latitude in degrees.
   * @param   {number} lon - Longitude in degrees.
   * @param   {number} [precision] - Number of characters in resulting geohash.
   * @returns {string} Geohash of supplied latitude/longitude.
   * @throws  Invalid geohash.
   *
   * @example
   *     const geohash = Geohash.encode(52.205, 0.119, 7); // => 'u120fxw'
   */
  static encode(lat, lon, precision) {
    // infer precision?
    if (typeof precision == "undefined") {
      // refine geohash until it matches precision of supplied lat/lon
      for (let p = 1; p <= 12; p++) {
        const hash = Geohash.encode(lat, lon, p);
        const posn = Geohash.decode(hash);
        if (posn.lat == lat && posn.lon == lon) return hash;
      }
      precision = 12; // set to maximum
    }

    lat = Number(lat);
    lon = Number(lon);
    precision = Number(precision);

    if (isNaN(lat) || isNaN(lon) || isNaN(precision))
      throw new Error("Invalid geohash");

    let idx = 0; // index into base32 map
    let bit = 0; // each char holds 5 bits
    let evenBit = true;
    let geohash = "";

    let latMin = -90,
      latMax = 90;
    let lonMin = -180,
      lonMax = 180;

    while (geohash.length < precision) {
      if (evenBit) {
        // bisect E-W longitude
        const lonMid = (lonMin + lonMax) / 2;
        if (lon >= lonMid) {
          idx = idx * 2 + 1;
          lonMin = lonMid;
        } else {
          idx = idx * 2;
          lonMax = lonMid;
        }
      } else {
        // bisect N-S latitude
        const latMid = (latMin + latMax) / 2;
        if (lat >= latMid) {
          idx = idx * 2 + 1;
          latMin = latMid;
        } else {
          idx = idx * 2;
          latMax = latMid;
        }
      }
      evenBit = !evenBit;

      if (++bit == 5) {
        // 5 bits gives us a character: append it and start over
        geohash += base32.charAt(idx);
        bit = 0;
        idx = 0;
      }
    }

    return geohash;
  }

  /**
   * Decode geohash to latitude/longitude (location is approximate centre of geohash cell,
   *     to reasonable precision).
   *
   * @param   {string} geohash - Geohash string to be converted to latitude/longitude.
   * @returns {{lat:number, lon:number}} (Center of) geohashed location.
   * @throws  Invalid geohash.
   *
   * @example
   *     const latlon = Geohash.decode('u120fxw'); // => { lat: 52.205, lon: 0.1188 }
   */
  static decode(geohash) {
    const bounds = Geohash.bounds(geohash); // <-- the hard work
    // now just determine the centre of the cell...

    const latMin = bounds.sw.lat,
      lonMin = bounds.sw.lon;
    const latMax = bounds.ne.lat,
      lonMax = bounds.ne.lon;

    // cell centre
    let lat = (latMin + latMax) / 2;
    let lon = (lonMin + lonMax) / 2;

    // round to close to centre without excessive precision: ⌊2-log10(Δ°)⌋ decimal places
    lat = lat.toFixed(Math.floor(2 - Math.log(latMax - latMin) / Math.LN10));
    lon = lon.toFixed(Math.floor(2 - Math.log(lonMax - lonMin) / Math.LN10));

    return { lat: Number(lat), lon: Number(lon) };
  }

  /**
   * Returns SW/NE latitude/longitude bounds of specified geohash.
   *
   * @param   {string} geohash - Cell that bounds are required of.
   * @returns {{sw: {lat: number, lon: number}, ne: {lat: number, lon: number}}}
   * @throws  Invalid geohash.
   */
  static bounds(geohash) {
    if (geohash.length == 0) throw new Error("Invalid geohash");

    geohash = geohash.toLowerCase();

    let evenBit = true;
    let latMin = -90,
      latMax = 90;
    let lonMin = -180,
      lonMax = 180;

    for (let i = 0; i < geohash.length; i++) {
      const chr = geohash.charAt(i);
      const idx = base32.indexOf(chr);
      if (idx == -1) throw new Error("Invalid geohash");

      for (let n = 4; n >= 0; n--) {
        const bitN = (idx >> n) & 1;
        if (evenBit) {
          // longitude
          const lonMid = (lonMin + lonMax) / 2;
          if (bitN == 1) {
            lonMin = lonMid;
          } else {
            lonMax = lonMid;
          }
        } else {
          // latitude
          const latMid = (latMin + latMax) / 2;
          if (bitN == 1) {
            latMin = latMid;
          } else {
            latMax = latMid;
          }
        }
        evenBit = !evenBit;
      }
    }

    const bounds = {
      sw: { lat: latMin, lon: lonMin },
      ne: { lat: latMax, lon: lonMax },
    };

    return bounds;
  }

  /**
   * Determines adjacent cell in given direction.
   *
   * @param   geohash - Cell to which adjacent cell is required.
   * @param   direction - Direction from geohash (N/S/E/W).
   * @returns {string} Geocode of adjacent cell.
   * @throws  Invalid geohash.
   */
  static adjacent(geohash, direction) {
    // based on github.com/davetroy/geohash-js

    geohash = geohash.toLowerCase();
    direction = direction.toLowerCase();

    if (geohash.length == 0) throw new Error("Invalid geohash");
    if ("nsew".indexOf(direction) == -1) throw new Error("Invalid direction");

    const neighbour = {
      n: [
        "p0r21436x8zb9dcf5h7kjnmqesgutwvy",
        "bc01fg45238967deuvhjyznpkmstqrwx",
      ],
      s: [
        "14365h7k9dcfesgujnmqp0r2twvyx8zb",
        "238967debc01fg45kmstqrwxuvhjyznp",
      ],
      e: [
        "bc01fg45238967deuvhjyznpkmstqrwx",
        "p0r21436x8zb9dcf5h7kjnmqesgutwvy",
      ],
      w: [
        "238967debc01fg45kmstqrwxuvhjyznp",
        "14365h7k9dcfesgujnmqp0r2twvyx8zb",
      ],
    };
    const border = {
      n: ["prxz", "bcfguvyz"],
      s: ["028b", "0145hjnp"],
      e: ["bcfguvyz", "prxz"],
      w: ["0145hjnp", "028b"],
    };

    const lastCh = geohash.slice(-1); // last character of hash
    let parent = geohash.slice(0, -1); // hash without last character

    const type = geohash.length % 2;

    // check for edge-cases which don't share common prefix
    if (border[direction][type].indexOf(lastCh) != -1 && parent != "") {
      parent = Geohash.adjacent(parent, direction);
    }

    // append letter for direction to parent
    return parent + base32.charAt(neighbour[direction][type].indexOf(lastCh));
  }

  /**
   * Returns all 8 adjacent cells to specified geohash.
   *
   * @param   {string} geohash - Geohash neighbours are required of.
   * @returns {{n,ne,e,se,s,sw,w,nw: string}}
   * @throws  Invalid geohash.
   */
  static neighbours(geohash) {
    return {
      n: Geohash.adjacent(geohash, "n"),
      ne: Geohash.adjacent(Geohash.adjacent(geohash, "n"), "e"),
      e: Geohash.adjacent(geohash, "e"),
      se: Geohash.adjacent(Geohash.adjacent(geohash, "s"), "e"),
      s: Geohash.adjacent(geohash, "s"),
      sw: Geohash.adjacent(Geohash.adjacent(geohash, "s"), "w"),
      w: Geohash.adjacent(geohash, "w"),
      nw: Geohash.adjacent(Geohash.adjacent(geohash, "n"), "w"),
    };
  }
}

var prev_venue = "";

loc_key = "";
google_api = "";
key_ticketMaster = "";

async function getFromIP() {
  return await fetch("https://ipinfo.io/json?token=" + loc_key)
    .then((response) => response.json())
    .then((data) => {
      var lat = data["loc"].split(",")[0];
      var lon = data["loc"].split(",")[1];

      return [lat, lon];
    });
}

async function getFromLocation(loc) {
  return await fetch(
    "https://maps.googleapis.com/maps/api/geocode/json?address=" +
      loc +
      "&key=" +
      google_api
  )
    .then((response) => response.json())
    .then((data) => {
      var lat = data["results"][0]["geometry"]["location"]["lat"];
      var lon = data["results"][0]["geometry"]["location"]["lng"];

      return [lat, lon];
    });
}

async function getDetails(sp) {
  st = "https://webtechhw6-378807.wl.r.appspot.com/get_card1?" + "id" + "=" + sp;
  let response = await fetch(st, {
    method: "GET",
    // mode: "no-cors",
    // credentials: 'include',
    // headers: {
    //     "Access-Control-Allow-Origin" : "*",
    //     "Access-Control-Allow-Credentials" : true,
    // },
  });
  data = await response.json();
  populateCard1(data);
}

async function populateCard1(data) {

  let c = document.getElementById("Card1");
  if(c){
    c.remove();
  }

  const elements = document.getElementsByClassName("downarrow");
  while (elements.length > 0) {
    elements[0].parentNode.removeChild(elements[0]);
  }
  const elements2 = document.getElementById("showVenueDetails");
  if (elements2) {
    elements2.remove();
  }

  let c2 = document.getElementById("container")
  if(c2){
    c2.remove();
  }

  let crd = document.getElementById("crd");
  let card1 = document.createElement("div");
  card1.setAttribute("id", "Card1");

  const innerDiv = document.createElement("div");
  innerDiv.setAttribute("id", "card1InnerDiv");
  innerDiv.style.padding = "15px";

  //Heading
  const nameDiv = document.createElement("label");
  nameDiv.setAttribute("id", "card1Heading");
  nameDiv.innerHTML = data["card1"][0]["title"];
  innerDiv.appendChild(nameDiv);

  const containerDiv = document.createElement("div");
  containerDiv.setAttribute("id", "containerCard1");

  const leftDiv = document.createElement("div");
  leftDiv.setAttribute("id", "sectionCard1");

  if (data["card1"][0]["date"] != undefined) {
    const label1 = document.createElement("label");
    label1.setAttribute("id", "sectionCard1Text1");
    label1.innerHTML = "Date" + "<br>";
    const label2 = document.createElement("label");
    label2.setAttribute("id", "sectionCard1Text2");
    label2.innerHTML =
      data["card1"][0]["date"] + " " + data["card1"][0]["time"] + "<br><br>";
    leftDiv.append(label1);
    leftDiv.append(label2);
  }

  if (data["card1"][0]["artist_team"] != undefined) {
    const label1 = document.createElement("label");
    label1.setAttribute("id", "sectionCard1Text1");
    label1.innerHTML = "Artist/Team" + "<br>";
    const label2 = document.createElement("label");
    label2.setAttribute("id", "sectionCard1Text2");
    label2.innerHTML =
      "<a href='" +
      data["card1"][0]["url"] +
      "' target='_blank'>" +
      data["card1"][0]["artist_team"] +
      "</a><br><br>";
    leftDiv.append(label1);
    leftDiv.append(label2);
  }

  if (data["card1"][0]["venue"] != undefined) {
    const label1 = document.createElement("label");
    label1.setAttribute("id", "sectionCard1Text1");
    label1.innerHTML = "Venue" + "<br>";
    const label2 = document.createElement("label");
    label2.setAttribute("id", "sectionCard1Text2");
    label2.innerHTML = data["card1"][0]["venue"] + "<br><br>";
    leftDiv.append(label1);
    leftDiv.append(label2);
  }

  if (data["card1"][0]["genre"] != "") {
    const label1 = document.createElement("label");
    label1.setAttribute("id", "sectionCard1Text1");
    label1.innerHTML = "Genres" + "<br>";
    const label2 = document.createElement("label");
    label2.setAttribute("id", "sectionCard1Text2");
    label2.innerHTML = data["card1"][0]["genre"] + "<br><br>";
    leftDiv.append(label1);
    leftDiv.append(label2);
  }

  if (data["card1"][0]["price_ranges"] != undefined) {
    const label1 = document.createElement("label");
    label1.setAttribute("id", "sectionCard1Text1");
    label1.innerHTML = "Price Ranges" + "<br>";
    const label2 = document.createElement("label");
    label2.setAttribute("id", "sectionCard1Text2");
    label2.innerHTML = data["card1"][0]["price_ranges"] + "<br><br>";
    leftDiv.append(label1);
    leftDiv.append(label2);
  }

  if (data["card1"][0]["ticket_status"] != undefined) {
    const label1 = document.createElement("label");
    label1.setAttribute("id", "sectionCard1Text1");
    label1.innerHTML = "Ticket Status" + "<br>";
    const label2 = document.createElement("label");
    label2.setAttribute("id", "sectionCard1Text2");

    if (data["card1"][0]["ticket_status"] == "onsale") {
      label2.setAttribute("class", "onsale");
      label2.innerHTML = "On Sale";
    } else if (data["card1"][0]["ticket_status"] == "offsale") {
      label2.setAttribute("class", "offsale");
      label2.innerHTML = "Off Sale";
    } else if (data["card1"][0]["ticket_status"] == "cancelled") {
      label2.setAttribute("class", "cancelled");
      label2.innerHTML = "Cancelled";
    } else {
      label2.setAttribute("class", "rescheduled");
      label2.innerHTML = "Rescheduled";
    }
    leftDiv.append(label1);
    leftDiv.append(label2);
    leftDiv.innerHTML += "<br><br>";
  }

  if (data["card1"][0]["buy_ticket_at"] != undefined) {
    const label1 = document.createElement("label");
    label1.setAttribute("id", "sectionCard1Text1");
    label1.innerHTML = "Buy Ticket At" + "<br>";
    const label2 = document.createElement("label");
    label2.setAttribute("id", "sectionCard1Text2");
    label2.innerHTML =
      "<a href='" +
      data["card1"][0]["buy_ticket_at"] +
      "' + target='_blank'>TicketMaster</a><br><br>";
    leftDiv.append(label1);
    leftDiv.append(label2);
  }

  containerDiv.append(leftDiv);

  const rightDiv = document.createElement("div");
  rightDiv.setAttribute("id", "sectionCard2");

  const im = document.createElement("img");
  im.setAttribute("id", "rightDivImg");
  im.src = data["card1"][0]["seat_map"];

  rightDiv.append(im);
  containerDiv.append(rightDiv);

  innerDiv.append(containerDiv);
  card1.appendChild(innerDiv);

  const showVenueDetails = document.createElement("label");
  showVenueDetails.setAttribute("id", "showVenueDetails");
  showVenueDetails.innerHTML = "Show Venue Details";

  const arrowDiv = document.createElement("div");
  arrowDiv.setAttribute("class", "downarrow");
  arrowDiv.setAttribute("id", data["card1"][0]["venue"]);
  arrowDiv.setAttribute("onclick", "card2(this.id)");

  prev_venue = data["card1"][0]["venue"];

  crd.append(card1);
  crd.append(showVenueDetails);
  crd.append(arrowDiv);
  crd.scrollIntoView();
}

async function populateCard2(data) {
  const elements = document.getElementsByClassName("downarrow");
  while (elements.length > 0) {
    elements[0].parentNode.removeChild(elements[0]);
  }

  const elements2 = document.getElementById("showVenueDetails");
  if (elements2) {
    elements2.remove();
  }

  const elements3 = document.getElementById('container')
  if(elements3){
    elements3.remove();
  }

  let parent = document.getElementById("parentcard2");
  let container = document.createElement("div");
  container.setAttribute("id", "container");
  let card2div = document.createElement("card2div");
  card2div.setAttribute("id", "card2div");
  let h = document.createElement("h1");
  h.setAttribute("id", "ttle");
  h.innerText = data["venue"];
  card2div.appendChild(h);
  if (data['logo'] != 'nologo'){
    let photo = document.createElement("div");
    photo.setAttribute("id", "photo");
    let i = document.createElement("img");
    i.setAttribute("src", data['logo'])
    photo.appendChild(i);
    card2div.appendChild(photo);
  }
  let sections = document.createElement("div");
  sections.setAttribute("id", "sections");
  let section1 = document.createElement("div");
  section1.setAttribute("id", "section1");
  let subcontainer = document.createElement("div");
  subcontainer.setAttribute("id", "subcontainer");
  let sub1 = document.createElement("div");
  sub1.setAttribute("id", "sub1");
  let p1 = document.createElement("p");
  p1.setAttribute("id", "p1");
  p1.innerText = "Address:";
  sub1.appendChild(p1);
  subcontainer.appendChild(sub1);
  let sub2 = document.createElement("div");
  sub2.setAttribute("id", "sub2");
  let p2 = document.createElement("p");
  p2.setAttribute("id", "p2");
  p2.innerHTML =
    data["address"] +
    "<br>" +
    data["city"] +
    ", " +
    data["stateCode"] +
    "<br>" +
    data["postal_code"];
  sub2.appendChild(p2);
  subcontainer.appendChild(sub2);
  section1.appendChild(subcontainer);
  let an = document.createElement("a");
  an.setAttribute("class", "an");
  an.href = data["map"];
  an.innerText = "Open in Google Maps";
  an.setAttribute("target", "_blank");
  section1.appendChild(an);
  sections.appendChild(section1);
  let section2 = document.createElement("div");
  section2.setAttribute("id", "section2");
  let an2 = document.createElement("a");
  an2.setAttribute("class", "an");
  an2.href = data["url"];
  an2.setAttribute("target", "_blank");
  an2.innerText = "More events at this venue";
  // an2.target = blank
  section2.appendChild(an2);
  sections.appendChild(section2);
  card2div.appendChild(sections);
  container.appendChild(card2div);
  parent.appendChild(container);
  parent.style.display = 'block';
  parent.scrollIntoView();
}

async function card2(keyword) {
  // TO CHANGE- https://webtechhw6-378807.wl.r.appspot.com
  // http://127.0.0.1:5000
  st = "https://webtechhw6-378807.wl.r.appspot.com/get_card2?" + "keyword=" + keyword;
  let response = await fetch(st, {
    method: "GET",
    // mode: "no-cors",
    // credentials: 'include',
    // headers: {
    //     "Access-Control-Allow-Origin" : "*",
    //     "Access-Control-Allow-Credentials" : true,
    // },
  });
  data = await response.json();
  populateCard2(data);
}

async function populateTable(tableData) {
  let mytable = document.getElementById("eventsList");
  clearTable();

  let tst = document.getElementById("headt");
  if(tst){
    tst.remove();
  }

  let tst2 = document.getElementById("nodata");
  if(tst2){
    tst2.remove();
  }

  if(tableData['events'] == 0){
    let pr = document.createElement("div");
    pr.setAttribute("id", "nodata");
    pr.innerText = "No Records Found";
    mytable.append(pr)
    mytable.style.display = "table";
    return;
  }

  tst = document.getElementById("headt")
  if(tst){
    tst.remove();
  }

  let headt = document.createElement("thead")
  headt.setAttribute("id", "headt")
    let an = document.createElement("tr")
      let child1 = document.createElement("th")
      child1.setAttribute("class", "cur")
      child1.setAttribute("onclick", "sortTable('date')")
      child1.innerHTML = 'Date'
    an.appendChild(child1)
      let child2 = document.createElement("th")
      child2.setAttribute("class", "cur")
      child2.innerHTML = 'Icon'
    an.appendChild(child2)
      let child3 = document.createElement("th")
      child3.setAttribute("class", "cur")
      child3.setAttribute("onclick", "sortTable('event')")
      child3.innerHTML = 'Event'
    an.appendChild(child3)
      let child4 = document.createElement("th")
      child4.setAttribute("class", "cur")
      child4.setAttribute("onclick", "sortTable('genre')")
      child4.innerHTML = 'Genre'
    an.appendChild(child4)
      let child5 = document.createElement("th")
      child5.setAttribute("class", "cur")
      child5.setAttribute("onclick", "sortTable('venue')")
      child5.innerHTML = 'Venue'
      an.appendChild(child5)
  headt.appendChild(an)  
  mytable.append(headt)


  for (var i = 0; i < tableData["events"].length; i++) {
    let newRow = document.createElement("tr");

    // Date

    var date = document.createElement("td");
    date.setAttribute("id", "Dte");
    date.innerHTML =
      tableData["events"][i]["date"] + "<br>" + tableData["events"][i]["time"];
    newRow.appendChild(date);

    // Icon
    var img = document.createElement("td");
    img.setAttribute("id", "Icon");
    img.innerHTML =
      '<img src="' +
      tableData["events"][i]["icon"] +
      '" style = "height: 50px; width: 100px"/>';
    img.src = tableData["events"][i]["icon"];
    newRow.appendChild(img);

    let cell3 = document.createElement("td");

    cell3.innerHTML =
      '<label id="' +
      tableData["events"][i]["id"] +
      '" onClick="getDetails(this.id)" class="abc" >' +
      tableData["events"][i]["event"] +
      "</label>";
    newRow.appendChild(cell3);

    // Genre
    let cell4 = document.createElement("td");
    cell4.innerText = tableData["events"][i]["genre"];
    newRow.appendChild(cell4);

    // Venue
    let cell5 = document.createElement("td");
    cell5.innerText = tableData["events"][i]["venue"];
    newRow.appendChild(cell5);

    mytable.appendChild(newRow);
  }

  mytable.style.display = "table";
  mytable.scrollIntoView();
}

async function clearTable() {
  const mytable = document.getElementById("eventsList");
  mytable.style.display = "none";
  var rowCount = mytable.rows.length;
  for (var x = rowCount - 1; x > 0; x--) {
    mytable.removeChild(mytable.rows[x]);
  }

  const elements = document.getElementsByClassName("downarrow");
  while (elements.length > 0) {
    elements[0].parentNode.removeChild(elements[0]);
  }

  const elements2 = document.getElementById("showVenueDetails");

  if (elements2) {
    elements2.remove();
  }

  const elements3 = document.getElementById('container')
  if(elements3){
    elements3.remove();
  }

  const elements4 = document.getElementById('Card1');
  if(elements4){
    elements4.remove();
  }

}

async function callPythonScript(ge, distance, segmentID, keyword) {
  st =
    "https://webtechhw6-378807.wl.r.appspot.com/get_search_results?" +
    "keyword" +
    "=" +
    keyword +
    "&" +
    "distance" +
    "=" +
    distance +
    "&" +
    "segmentID" +
    "=" +
    segmentID +
    "&" +
    "geoHash" +
    "=" +
    ge;

  let response = await fetch(st, {
    method: "GET",
    // mode: "no-cors",
    // credentials: 'include',
    // headers: {
    //     "Access-Control-Allow-Origin" : "*",
    //     "Access-Control-Allow-Credentials" : true,
    // },
  });

  data = await response.json();
  tableD = data;
  populateTable(data);
}

async function submitted() {
  var keyword = document.getElementById("keyword").value;
  var distance = document.getElementById("distance").value;
  var category = document.getElementById("category").value;
  var location;
  var string;
  var segmentID = "";

  keyword = keyword.replace(/\s+/g, "+");

  if (keyword == "") {
    return;
  }

  if (distance == "") {
    distance = 10;
  }

  if (category == "music") {
    segmentID = "KZFzniwnSyZfZ7v7nJ";
  } else if (category == "sports") {
    segmentID = "KZFzniwnSyZfZ7v7nE";
  } else if (category == "arts") {
    segmentID = "KZFzniwnSyZfZ7v7na";
  } else if (category == "film") {
    segmentID = "KZFzniwnSyZfZ7v7nn";
  } else if (category == "music") {
    segmentID = "KZFzniwnSyZfZ7v7n1";
  }

  if (document.getElementById("locationCheck").checked) {
    // Detect location using IP
    const location = await getFromIP();
    const ge = Geohash.encode(location[0], location[1]);
    callPythonScript(ge, distance, segmentID, keyword);
  } else {
    location = document.getElementById("locationTextBox").value;
    const loc = await getFromLocation(location);
    const ge = Geohash.encode(loc[0], loc[1]);
    callPythonScript(ge, distance, segmentID, keyword);
  }
}

function locationCheckBox() {
  if (document.getElementById("locationCheck").checked) {
    document.getElementById("locationTextBox").style.display = "none";
    document.getElementById("locationTextBox").required = false;
  } else {
    document.getElementById("locationTextBox").style.display = "block";
    document.getElementById("locationTextBox").required = true;
  }
}

function clearForm() {
  document.getElementById("keyword").value = "";
  document.getElementById("distance").vlaue = "10";
  document.getElementById("category").value = "default";
  document.getElementById("locationCheck").checked = false;
  document.getElementById("locationTextBox").style.display = "block";
  document.getElementById("locationTextBox").required = true;

  const elements = document.getElementsByClassName("downarrow");
  while (elements.length > 0) {
    elements[0].parentNode.removeChild(elements[0]);
  }

  const elements2 = document.getElementById("showVenueDetails");

  if (elements2) {
    elements2.remove();
  }

  const elements3 = document.getElementById('container')
  if(elements3){
    elements3.remove();
  }

  const elements4 = document.getElementById('nodata')
  if(elements4){
    elements4.remove();
  }

  document.getElementById("eventsList").style.display = "none";
  document.getElementById("Card1").style.display = "none";
  // document.getElementById("parentcard2").style.display = "none";
}

let sortDirection1 = false;
let sortDirection2 = false;
let sortDirection3 = false;
let sortDirection4 = false;

function sortTable(col) {
  if (col == "date") {
    sortDirection1 = !sortDirection1;
    sortstr(col, sortDirection1);
  } else if (col == "event") {
    sortDirection2 = !sortDirection2;
    sortstr(col, sortDirection2);
  } else if (col == "genre") {
    sortDirection3 = !sortDirection3;
    sortstr(col, sortDirection3);
  } else if (col == "venue") {
    sortDirection4 = !sortDirection4;
    sortstr(col, sortDirection4);
  }
  populateTable(tableD);
}

function sortstr(col, sortDirection) {
  tableD["events"] = tableD["events"].sort((a, b) => {
    const nameA = a[col].toUpperCase();
    const nameB = b[col].toUpperCase();
    if (sortDirection) {
      if (nameA < nameB) {
        return -1;
      }
      if (nameA > nameB) {
        return 1;
      }
    } else {
      if (nameA < nameB) {
        return 1;
      }
      if (nameA > nameB) {
        return -1;
      }
    }
    return 0;
  });
}