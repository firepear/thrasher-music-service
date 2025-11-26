// terser client.js --compress --mangle > client.js.min
var tag = "v0.7.1";
var proto = window.location.protocol;
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
var mobile = false;

// set up DOM array
var elnames = ["facetlist", "artistlist", "artistfilter", "filter", "main", "maintable", "cover",
               "tracklist", "curtitle", "curaay", "curfacets", "curnum", "vol", "shuffle",
               "help", "searchhelp", "searchhelpbut", "player", "trkinfo"];
elnames.forEach((name) => ( els[name] = document.getElementById(name) ));

// listeners and global setup
window.addEventListener("keydown", (event) => handleKey(event));
setInterval(pingHost, 20000);

async function pingHost() {
    const ping = await fetch(`${proto}//${host}:${port}/ping`).then((r) => {return r.json() });
}

async function initThrasher(plat) {
    if (plat == "mobile") {
        mobile = true;
        checkOrientation();
    }

    const regex = /["'& ]/g;
    const catAF = await fetch(`${proto}//${host}/init`).then((r) => { return r.json() });
    listen = catAF.meta[0];
    host = catAF.meta[1];
    port = catAF.meta[2];
    oport = catAF.meta[3];
    console.log(catAF.meta, listen, host, port);

    catAF.facets.forEach((facet) => {
        const nfacet = facet.replaceAll(regex, "");
        els["facetlist"].insertAdjacentHTML("beforeend", `<div id="fd${nfacet}"><input type="checkbox" id="fc${nfacet}" value="${facet}" onClick="buildCheckQuery(this);" /><label for="fc${nfacet}">${facet}</label></div>`);
        facetdivs.push(document.getElementById(`fd${nfacet}`));
    });
    if (!mobile) {
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
    }

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
        helpPopup("help");
        break;
    case "v":
        showVersion();
        break;
    case " ": // playback controls start here
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
    case "r": // queue modifiers start here
        queryRecent();
        break;
    case "s":
        shuffleMode();
        break;
    case "u":
    case "c":
        uncheckAll();
        break;
    case "`": // volume controls start here
    case "m":
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
    setFilterNet(els["filter"].value);
    document.activeElement.blur();
}

async function setFilterNet(filter, init) {
    filter = filter.replaceAll(/\//g, "%2F");
    let url = `${proto}//${host}:${port}/f/${filter}`;
    url = encodeURI(url)
    console.log(filter, url)
    filterMeta = await fetch(url).then((r) => { return r.json() });
    if (filterMeta.FltrCount == 0) {
        playing == "auto" ? playing = "single" : Function.prototype();
        trks = [];
    }
    if (init) {
        showVersion();
    } else {
        getTrks("y,b,n");
    }
}

async function queryRecent() {
    if (!mobile) {
        els["filter"].value = "";
    }
    let url = `${proto}//${host}:${port}/qr`;
    url = encodeURI(url)
    filterMeta = await fetch(url).then((r) => { return r.json() });
    console.log(filterMeta);
    getTrks("recent");
}

async function getTrks(orderby) {
    trks = [];
    var mt;
    mt = els["maintable"].firstChild;
    mt.replaceChildren();

    trkInfo = [];
    shflHist = [];
    i = 0;
    o = 0;
    let tclass = "";
    let tfclass = "";
    let curalbum = "";
    while (o < filterMeta.FltrCount) {
        const turl = `${proto}//${host}:${port}/i/batch/${orderby}/${o}`;
        qb = await fetch(encodeURI(turl)).then((r) => { return r.json() });
        trks.push(...qb.Trks);
        for (const ti of qb.TIs) {
            if (ti.Album != curalbum) {
                curalbum = ti.Album;
                if (tclass == "track") {
                    tclass = "track2";
                    tfclass = "trackf2";
                } else {
                    tclass = "track";
                    tfclass = "trackf";
                }
            }
            if (ti.Title.length > 70) { ti.Title = `${ti.Title.substring(0,69)}…` }
            if (ti.Artist.length > 70) { ti.Artist = `${ti.Artist.substring(0,69)}…` }
            trkInfo.push(ti);
            mt.insertAdjacentHTML("beforeend", `<tr class="${tclass}" id="trk${i}" onClick="playTrk(${i});"><td>${ti.Num}</td><td>${ti.Title}</td><td>${ti.Artist}</td><td>${ti.Album}</td><td>${ti.Year}</td></tr><tr class="${tfclass}" onClick="playTrk(${i});"><td style="background-color: #556"></td><td colspan="4">${expandFacets(i)}</td></tr>`);
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
    // attempt to uncheck artist and facet selectors
    for (const l of [artistdivs, facetdivs]) {
        l.forEach((div) => {
            if (div.firstChild.checked) {
                div.firstChild.checked = false;
                unchecked++;
            }
        });
    }

    // clear artistfilter and filter boxes
    if (!mobile) {
        els["artistfilter"].value = "";
        filterArtists(null);
        els["filter"].value = "";
    }

    //if (nonet == undefined) {
    setFilterNet("a:=a\\\\=b");
    //}
}

/* ========================================================== Player  */

function playTrk(i) {
    playing = "no";
    trkIdx = i;
    // trk comes with leading /, so don't add it here
    const trkURL = encodeURI(`${proto}//${host}:${port}/music${trks[i]}`);
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
    setVol();
    sound.play();
    if (!mobile) {
        setHighlight(trkIdx);
        displayCover();
    }
}

async function startPlaying() {
    // nothing to play
    if (trks.length == 0) {
        return;
    }
    if (sound == undefined) {
        // no track in flight
        if (shuffle) {
            trkIdx = getNextIdx();
        }
        playTrk(trkIdx);
    } else {
        // a sound is defined, so something should be playing
        if (playing == "auto" || playing == "single") {
            // and we think we're playing something, but the user has
            // hit the button anyway. bluetooth disconnects can cause
            // pauses outside our control, so see if our sound is
            // actually playing or not
            const pos1 = sound.seek();
            await new Promise(r => setTimeout(r, 150));
            const pos2 = sound.seek();
            if (pos1 == pos2) {
                // no change in seek value. sound is has been paused
                // by something external. explicitly pause, then
                // resume playback, as the user expects
                sound.pause();
                sound.play();
                return;
            } else {
                // seek value changed; do nothing
                return;
            }
        }
        // if we make it all the way down here, we've actually been
        // told to start playback of something new, or resume from a
        // user pause
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
    if (!mobile) {
        unsetHighlight(trkIdx);
    }
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
    if (!mobile) {
        unsetHighlight(trkIdx);
    }
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
        toggleButtonColor("shuffle");
        return;
    }
    shuffle = true;
    toggleButtonColor("shuffle");
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
    const url = `${proto}//${host}:${port}/music${path}/cover.jpg`;
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
    if (evt != null && evt.key == "Escape") {
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

function showVersion() {
    alertify.message(`<b>Thrasher ${tag}</b><br/>${filterMeta.TrackCount} tracks in catalog`);
    if (!mobile) {
        alertify.message(`Press '?' for keyboard mappings`);
    }
}

function helpPopup(which, whichbut) {
    toggleButtonColor(whichbut);
    els[which].style.display == "block" ?
        els[which].style.display = "none" : els[which].style.display = "block";
}

function toggleButtonColor(id) {
    if (els[id] == null) {
        return
    }
    if (els[id].nodeName == "BUTTON") {
        window.getComputedStyle(els[id])["backgroundColor"] == "rgb(187, 187, 187)" ?
            els[id].style.backgroundColor = "#cec" : els[id].style.backgroundColor = "#bbb";
    }
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
    document.title = `${trkInfo[trkIdx].Title} by ${trkInfo[trkIdx].Artist}`;
}

function unsetHighlight(old) {
    // reset current track backgrouncColor if possible
    try {
        let ttr = document.getElementById(`trk${old}`);
        for (const ttd of ttr.childNodes) {
            if (ttr.className == "track" || ttr.className == "trackf") {
                ttd.style.backgroundColor = "#aab";
            } else {
                ttd.style.backgroundColor = "#ccd";
            }
        }
        if (ttr.className == "track" || ttr.className == "trackf") {
            ttr.nextSibling.childNodes[1].style.backgroundColor = "#aab";
        } else {
            ttr.nextSibling.childNodes[1].style.backgroundColor = "#ccd";
        }
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

function reloadPage(path) {
    window.location.replace(`${proto}//${host}:${oport}/${path}`);
}
