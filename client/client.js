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
    case "ArrowRight":
    case "n":
        playNext();
        break;
    case "ArrowLeft":
    case "p":
        playPrev();
        break;
    case "s":
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
    default:
        console.log(evt.key);
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

async function setFilterNet(filter) {
    filter = filter.replaceAll(/\//g, "%2F");
    let url = `http://${host}/f/${filter}`;
    url = encodeURI(url)
    //console.log(url)
    filterMeta = await fetch(url).then((r) => { return r.json() });
    alertify.message(`${filterMeta.FltrCount} tracks in queue`);
    if (filterMeta.FltrCount == 0) {
        playing == "auto" ? playing = "single" : Function.prototype();
        trks = [];
    }
    getTrks();
}

async function getTrks() {
    const url = `http://${host}/q/b,n/0/0`;
    const mt = els["maintable"].firstChild;
    mt.replaceChildren();
    trks = await fetch(encodeURI(url)).then((r) => { return r.json() });
    trkInfo = [];
    shflHist = [];
    i = 0;
    for (const trk of trks) {
        const turl = `http://${host}/i/${trk.replaceAll(/\//g, "%2F")}`;
        ti = await fetch(encodeURI(turl)).then((r) => { return r.json() });
        trkInfo.push(ti);
        mt.insertAdjacentHTML("beforeend", `<tr class="track" onClick="playTrk(${i});"><td>${ti.Num}</td><td>${ti.Title}</td><td>${ti.Artist}</td><td>${ti.Album}</td><td>${ti.Year}</td></tr><tr class="trackf" onClick="playTrk(${i});"><td style="background-color: #556"></td><td colspan="4">${expandFacets(i)}</td></tr>`);
        i++;
    }
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
    trkIdx = i;
    const trkURL = encodeURI(`http://${host}/music/${trks[i]}`);
    if (sound != undefined) {
        sound.stop();
    }
    sound = new Howl({
        src: [trkURL],
        html5: true
    });
    sound.once("loaderror", () => {
        alertify.message(`Could not load track, likely due to a networking issue`);
        playing = "no";
    });
    sound.once("playerror", () => {
        alertify.message(`Encountered a playback error, likely due to a networking issue; stopping autoplay`);
        playing = "no";
    });
    sound.once("load", () => {
        const d = document.getElementById("curdur");
        d.replaceChildren();
        d.insertAdjacentHTML("beforeend", formatTime(Math.floor(sound.duration())));
    });

    setVol();
    sound.play();
    playing = "auto";
    updateCurrent();
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
    if (!shuffle && trkIdx >= trks.length - 1) {
        return
    }
    trkIdx = getNextIdx();
    if (trkIdx == -1) {
        return
    }
    playTrk(trkIdx);
}

function playPrev() {
    if (trkIdx <= 0 || trks.length == 0) {
        return
    }
    trkIdx--;
    playTrk(trkIdx);
}

function playPause() {
    console.log(playing);
    if (playing == "auto" || playing == "single") {
        console.log("stop");
        stopPlaying();
    } else {
        console.log("start");
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
    if (!sound.playing()) {
        // we haven't said stop, but the current track is over
        if (trkIdx == trks.length - 1) {
            // we played the last track in the queue; nothing to do
            playing = "paused";
            return;
        }
        if (playing == "auto") {
            // auto mode; play the next track
            playTrk(getNextIdx());
            return;
        }
    }
    // we're playing! update time
    time = document.getElementById("curtime");
    time.replaceChildren();
    time.insertAdjacentHTML("beforeend", formatTime(Math.floor(sound.seek())));
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
    console.log(shuffle, playing, trkIdx);
    if (!shuffle) {
        console.log(shuffle, playing, trkIdx, trkIdx++);
        return trkIdx++;
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
    console.log(els["help"].style.display);
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

