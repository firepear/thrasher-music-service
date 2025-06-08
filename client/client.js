// terser client.js --compress --mangle > client.js.min
var tag = "v0.6.0";
var host = window.location.host;
var port = window.location.port;
var oport = 0;
var els = {};
var facetdivs = [];
var artistdivs = [];
var trks = [];
var trkInfo = [];
var trkIdx = 0;
var filterMeta = [];
var playing = "no";
var shuffle = false;
var shflHist = [];
var sound;
var cover;

var elnames = ["facetlist", "artistlist", "artistfilter", "filter", "main", "maintable", "cover",
               "tracklist", "curtitle", "curaay", "curfacets", "curnum", "vol", "help"];
elnames.forEach((name) => ( els[name] = document.getElementById(name) ));

window.addEventListener("keydown", (event) => handleKey(event));

setInterval(pingHost, 30000);

async function pingHost() {
    const ping = await fetch(`http://${host}:${port}/ping`).then((r) => {return r.json() });
}

async function initThrasher() {
    const regex = /["'& ]/g;
    const catAF = await fetch(`http://${host}/init`).then((r) => { return r.json() });
    host = catAF.meta[0];
    port = catAF.meta[1];
    oport = catAF.meta[2];
    catAF.facets.forEach((facet) => {
        const nfacet = facet.replaceAll(regex, "");
        els["facetlist"].insertAdjacentHTML("beforeend", `<div id="fd${nfacet}"><input type="checkbox" id="fc${nfacet}" value="${facet}" onClick="buildCheckQuery(this);" /><label for="fc${nfacet}">${facet}</label></div>`);
        facetdivs.push(document.getElementById(`fd${nfacet}`));
    });
    catAF.artists.forEach((artist) => {
        let nartist = artist.replaceAll(regex, "");
        artist = artist.replaceAll(/"/g, "&quot;");
        els["artistlist"].insertAdjacentHTML("beforeend", `<div id="ad${nartist}"><input type="checkbox" id="ac${nartist}" value="${artist}" onClick="buildCheckQuery(this);" /><label for="ac${nartist}">${artist}</label></div>`);
        artistdivs.push(document.getElementById(`ad${nartist}`));
    });
    // set facetlit height
    els["facetlist"].style.height = (els["facetlist"].parentNode.clientHeight - els["facetlist"].previousElementSibling.clientHeight) + "px";
    // set artistlist height
    els["artistlist"].style.height = (els["artistlist"].parentNode.clientHeight - els["artistlist"].previousElementSibling.clientHeight - els["artistlist"].previousElementSibling.previousElementSibling.clientHeight) + "px";
    // set tracklist height
    els["tracklist"].style.height = (els["tracklist"].parentNode.clientHeight - els["tracklist"].previousElementSibling.clientHeight) + "px";

    // start the isPlaying ticker
    setInterval(isPlaying, 333);
    // say hello
    setFilterNet("a:a\\\\b", true);
}

function handleKey(evt) {
    if (els["filter"] === document.activeElement || els["artistfilter"] === document.activeElement) {
        return
    }
    switch (evt.key) {
    case "?":
    case "h":
        helpPopup();
        break;
    case " ":
        playPause();
        break;
    case "p":
        playPrev();
        break;
    case "n":
        playNext();
        break;
    case "ArrowRight":
        soundSeek(10);
        break
    case "ArrowLeft":
        soundSeek(-10);
        break
    case "r":
        queryRecent();
        break;
    case "s":
        shuffleMode();
        break;
    case "u":
        uncheckAll();
        break;
    case "m":
    case "`":
        els["vol"].value = 0;
        setVol();
        break;
    case "1":
    case "2":
    case "3":
    case "4":
    case "5":
    case "6":
    case "7":
    case "8":
    case "9":
        els["vol"].value = evt.key * 10;
        setVol();
        break;
    case "0":
        els["vol"].value = 100;
        setVol();
        break;
    //default:
    //    console.log(evt.key);
    }
}

/* ================================================= Filter and Queue */

async function setFilter(evt) {
    if (evt.key != "Enter") {
        return;
    }
    uncheckAll(true);
    setFilterNet(els["filter"].value);
    document.activeElement.blur();
}

async function setFilterNet(filter, init) {
    filter = filter.replaceAll(/\//g, "%2F");
    let url = `http://${host}:${port}/f/${filter}`;
    url = encodeURI(url)
    //console.log(url)
    filterMeta = await fetch(url).then((r) => { return r.json() });
    if (filterMeta.FltrCount == 0) {
        playing == "auto" ? playing = "single" : Function.prototype();
        trks = [];
    }
    if (init) {
        alertify.message(`<b>Thrasher ${tag}</b><br/>${filterMeta.TrackCount} tracks in collection<br/>Press '?' for keyboard mappings`);
    } else {
        getTrks();
    }
}

async function queryRecent() {
    trks = [];
    const mt = els["maintable"].firstChild;
    mt.replaceChildren();
    trkInfo = [];
    shflHist = [];
    i = 0;
    let url = `http://${host}:${port}/qr`;
    url = encodeURI(url)
    qb = await fetch(url).then((r) => { return r.json() });
    trks.push(...qb.Trks);
    filterMeta.FltrCount = trks.length;
    for (const ti of qb.TIs) {
        if (ti.Title.length > 70) { ti.Title = `${ti.Title.substring(0,69)}…` }
        if (ti.Artist.length > 70) { ti.Artist = `${ti.Artist.substring(0,69)}…` }
        trkInfo.push(ti);
        mt.insertAdjacentHTML("beforeend", `<tr class="track" id="trk${i}" onClick="playTrk(${i});"><td>${ti.Num}</td><td>${ti.Title}</td><td>${ti.Artist}</td><td>${ti.Album}</td><td>${ti.Year}</td></tr><tr class="trackf" onClick="playTrk(${i});"><td style="background-color: #556"></td><td colspan="4">${expandFacets(i)}</td></tr>`);
        i++;
    }
    alertify.message(`${filterMeta.FltrCount} tracks in queue`);
    // handle loading a new queue during playback
    playing == "single" ? playing = "auto" : Function.prototype();
    playing == "auto" ? trkIdx = -1 : trkIdx = 0;
}

async function getTrks(recent) {
    trks = [];
    const mt = els["maintable"].firstChild;
    mt.replaceChildren();
    trkInfo = [];
    shflHist = [];
    i = 0;
    o = 0;
    while (o < filterMeta.FltrCount) {
        const turl = `http://${host}:${port}/i/batch/y,b,n/${o}`;
        qb = await fetch(encodeURI(turl)).then((r) => { return r.json() });
        trks.push(...qb.Trks);
        for (const ti of qb.TIs) {
            if (ti.Title.length > 70) { ti.Title = `${ti.Title.substring(0,69)}…` }
            if (ti.Artist.length > 70) { ti.Artist = `${ti.Artist.substring(0,69)}…` }
            trkInfo.push(ti);
            mt.insertAdjacentHTML("beforeend", `<tr class="track" id="trk${i}" onClick="playTrk(${i});"><td>${ti.Num}</td><td>${ti.Title}</td><td>${ti.Artist}</td><td>${ti.Album}</td><td>${ti.Year}</td></tr><tr class="trackf" onClick="playTrk(${i});"><td style="background-color: #556"></td><td colspan="4">${expandFacets(i)}</td></tr>`);
            i++;
        }
        o = o + 100;
    }
    alertify.message(`${filterMeta.FltrCount} tracks in queue`);
    // handle loading a new queue during playback
    playing == "single" ? playing = "auto" : Function.prototype();
    playing == "auto" ? trkIdx = -1 : trkIdx = 0;
}

function buildCheckQuery(el) {
    el.blur();
    let q = ""
    for (const l of [artistdivs, facetdivs]) {
        l.forEach((div) => {
            const box = div.firstChild;
            if (box.checked) {
                div.id.startsWith("ad") ? q = `${q}a:${box.value}||` : q = `${q}f:${box.value}||`;
            }
        });
    }
    q = q.replace(/\|\|$/, "");
    if (q == "") {
        q = "a:=a\\\\=b";
    }
    setFilterNet(q);
}

function uncheckAll(nonet) {
    let unchecked = 0;
    for (const l of [artistdivs, facetdivs]) {
        l.forEach((div) => {
            if (div.firstChild.checked) {
                div.firstChild.checked = false;
                unchecked++;
            }
        });
    }
    if (unchecked == 0) {
        // if we don't actually uncheck anything, don't make changes
        nonet = true;
    }
    if (nonet == undefined) {
        setFilterNet("a:=a\\\\=b");
    }
}

/* ========================================================== Player  */

function playTrk(i) {
    playing = "no";
    trkIdx = i;
    // trk comes with leading /, so don't add it here
    const trkURL = encodeURI(`http://${host}:${port}/music${trks[i]}`);
    if (sound != undefined) {
        sound.stop();
    }
    sound = new Howl({
        src: [trkURL],
        html5: true
    });
    sound.once("loaderror", (sid, err) => { errorHandler(sid, err, {"type": "load", "url": trkURL}) });
    sound.once("playerror", (sid, err) => { errorHandler(sid, err, {"type": "load", "url": trkURL}) });
    sound.once("load", () => {
        updateCurrent();
        const d = document.getElementById("curdur");
        d.replaceChildren();
        d.insertAdjacentHTML("beforeend", formatTime(Math.floor(sound.duration())));
        playing = "auto";
    });
    setHighlight(trkIdx);
    setVol();
    sound.play();
    displayCover();
}

function startPlaying() {
    if (trks.length == 0) {
        return;
    }
    if (playing == "auto" || playing == "single" ) {
        return
    }
    if (sound == undefined) {
        if (shuffle) {
            trkIdx = getNextIdx();
        }
        playTrk(trkIdx);
    } else {
        sound.play();
        if (filterMeta.FltrCount > 1) {
            playing = "auto";
        } else {
            playing = "single";
        }
    }
}

function stopPlaying() {
    if (sound != undefined) {
        playing = "paused";
        sound.pause();
    }
}

function playNext() {
    // set playing to no to minimize spurious calls from isPlaying
    playing = "no";
    if (!shuffle && trkIdx >= trks.length - 1) {
        return
    }
    unsetHighlight(trkIdx);
    trkIdx = getNextIdx();
    if (trkIdx == -1) {
        return
    }
    playTrk(trkIdx);
}

function playPrev() {
    playing = "no";
    if (trkIdx <= 0 || trks.length == 0) {
        return
    }
    unsetHighlight(trkIdx);
    trkIdx--;
    playTrk(trkIdx);
}

function playPause() {
    if (playing == "auto" || playing == "single") {
        stopPlaying();
    } else {
        startPlaying();
    }
}

function isPlaying() {
    if (sound == undefined) {
        return;
    }
    if (playing == "no" || playing == "paused") {
        return;
    }
    if (sound.playing()) {
        time = document.getElementById("curtime");
        time.replaceChildren();
        time.insertAdjacentHTML("beforeend", formatTime(Math.floor(sound.seek())));
    } else {
        if (playing == "auto") {
            playNext();
            return;
        }
    }
}

/* ============================================== Audio modes + utils */

function setVol(vol) {
    if (sound == undefined) {
        return;
    }
    if (vol == undefined) {
        sound.volume(els["vol"].value / 100);
    } else {
        sound.volume(vol / 100);
    }
}

function shuffleMode() {
    if (shuffle) {
        shuffle = false;
        document.getElementById("shuffle").style.backgroundColor = "#bbb";
        return;
    }
    shuffle = true;
    document.getElementById("shuffle").style.backgroundColor = "#cec";
}

function getNextIdx() {
    if (!shuffle) {
        return trkIdx + 1;
    }
    let maxShfl = false;
    let i = Math.floor(Math.random() * trks.length);
    while (shflHist.includes(i)) {
        if (shflHist.length == trks.length - 1) {
            maxShfl = true;
            break;
        }
        i = Math.floor(Math.random() * trks.length);
    }
    if (maxShfl) {
        shuffleMode();
        playing = "no";
        alertify.message(`Every traack in queue has been played; ending shuffle`);
        return -1;
    }
    shflHist.push(i);
    if (shflHist.length > 50) {
        shflHist.shift();
    }
    return i;
}

/* ============================================= UI and display utils */

async function displayCover() {
    var path = trks[trkIdx].split("/");
    path.pop();
    path = path.join("/");
    const url = `http://${host}:${port}/music${path}/cover.jpg`;
    if (cover == url) {
        // do nothing if cover url has not changed
        return;
    }
    const status = await fetch(url, {method: 'HEAD'}).then((r) => { return r.status })
    if (status == 200) {
        els["cover"].src = url;
    } else {
        els["cover"].src = "";
    }
    cover = url;
}

function filterArtists(evt) {
    if (evt.key == "Escape") {
        document.activeElement.blur();
        return;
    }
    const v = els["artistfilter"].value.toLowerCase();
    for (const [name, div] of Object.entries(artistdivs)) {
        if (div.textContent.toLowerCase().includes(v)) {
            div.style.display = "block";
        } else {
            div.style.display = "none";
        }
    }
}

function helpPopup() {
    els["help"].style.display == "block" ?
        els["help"].style.display = "none" : els["help"].style.display = "block";
}

function formatTime(secs) {
    var minutes = Math.floor(secs / 60) || 0;
    var seconds = (secs - minutes * 60) || 0;
    return minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
}

function expandFacets(i) {
    let fj = [];
    let fs = ""
    try {
        fj = JSON.parse(trkInfo[i].Facets);
    } catch (error) {
        return fs;
    }
    fj.forEach((facet) => { fs = `${fs}${facet}, `; });
    fs = fs.slice(0, -2);
    return fs;
}

function updateCurrent() {
    els["curtitle"].replaceChildren();
    els["curaay"].replaceChildren();
    els["curfacets"].replaceChildren();
    els["curnum"].replaceChildren();
    els["curtitle"].insertAdjacentHTML("beforeend", `${trkInfo[trkIdx].Title}`);
    els["curaay"].insertAdjacentHTML("beforeend", `${trkInfo[trkIdx].Artist} / ${trkInfo[trkIdx].Album} / ${trkInfo[trkIdx].Year}`);
    els["curnum"].insertAdjacentHTML("beforeend", `${trkIdx + 1} of ${filterMeta.FltrCount} / <span id="curdur"></span> / <span id="curtime"></span>`);
    els["curfacets"].insertAdjacentHTML("beforeend", `${expandFacets(trkIdx)}`);
}

function unsetHighlight(old) {
    // reset current track backgrouncColor if possible
    try {
        let ttr = document.getElementById(`trk${old}`);
        for (const ttd of ttr.childNodes) {
            ttd.style.backgroundColor = "#bbc";
        }
        ttr.nextSibling.childNodes[1].style.backgroundColor = "#bbc";
    } catch {
        errorHandler(sound.id, "couldn't grab old tr", {"type": "hilite", "i": trkIdx});
    }
}
function setHighlight(cur) {
    // set current track backgrouncColor and scroll to it
    try {
        let ttr = document.getElementById(`trk${cur}`);
        for (const ttd of ttr.childNodes) {
            ttd.style.backgroundColor = "#bbe";
        }
        ttr.nextSibling.childNodes[1].style.backgroundColor = "#bbe";
        ttr.scrollIntoView({block: "center"});
    } catch {
        errorHandler(sound.id, "couldn't grab new tr", {"type": "hilite", "i": trkIdx});
    }
}

function errorHandler(id, err, x) {
    console.log(id, err, playing, x);
    if (x.type == "load" || x.type == "play") {
        alertify.message(`Playback error; halting autoplay`);
        playing = "no";
    }
}

function reloadPage() {
    window.location.replace(`http://${host}:${oport}/`);
}
