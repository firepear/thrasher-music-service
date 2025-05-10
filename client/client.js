async function setFilter(evt) {
    if (evt.key != "Enter") {
        return;
    }
    setFilterNet(els["filter"].value);
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
        return;
    }
    getTrks();
}

async function getTrks() {
    const url = `http://${host}/q/b,n/0/0`;
    const mt = els["maintable"].firstChild;
    mt.replaceChildren();
    trks = await fetch(encodeURI(url)).then((r) => { return r.json() });
    trkInfo = [];
    i = 0;
    for (const trk of trks) {
        const turl = `http://${host}/i/${trk.replaceAll(/\//g, "%2F")}`;
        ti = await fetch(encodeURI(turl)).then((r) => { return r.json() });
        trkInfo.push(ti);
        mt.insertAdjacentHTML("beforeend", `<tr class="track" onClick="playTrk(${i});"><td>${ti.Num}</td><td>${ti.Title}</td><td>${ti.Artist}</td><td>${ti.Album}</td><td>${ti.Year}</td></tr><tr class="trackf" onClick="playTrk(${i});"><td style="background-color: #556"></td><td colspan="4">${expandFacets(i)}</td></tr>`);
        i++;
    }
    // handle the case of loading a new queue during playback
    playing == "single" ? playing = "auto" : Function.prototype();
    playing == "auto" ? trkIdx = -1 : trkIdx = 0;
    console.log(filterMeta.FltrCount, playing);
}

function buildCheckQuery(type) {
    let q = ""
    let el;
    if (type == "artist") {
        el = artistdivs;
        q = "a:"
    } else {
        el = facetdivs;
        q = "f:"
    }
    el.forEach((div) => {
        const box = div.firstChild;
        if (box.checked) {
            if (q == "a:" || q == "f:") {
                q = `${q}${box.value}`;
            } else {
                q = `${q}//${box.value}`;
            }
        }
    });
    console.log(type, q);
    if (q == "a:" || q == "f:") {
        q = "a:=a\\\\=b";
        els["maintable"].firstChild.replaceChildren();
    }
    setFilterNet(q);
}

function filterArtists() {
    const v = els["artistfilter"].value.toLowerCase();
    for (const [name, div] of Object.entries(artistdivs)) {
        if (div.textContent.toLowerCase().includes(v)) {
            div.style.display = "block";
        } else {
            div.style.display = "none";
        }
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
}

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

    sound.play();
    playing = "auto";
    updateCurrent();
}

function startPlaying() {
    if (playing == "auto" || playing == "single" ) {
        return
    }
    if (sound == undefined) {
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
    if (!playing) {
        return
    }
    if (sound != undefined) {
        sound.pause();
        playing = "paused";
    }
}

function playNext() {
    if (trkIdx >= trks.length - 1) {
        return
    }
    if (sound != undefined) {
        sound.stop();
    }
    trkIdx++;
    playTrk(trkIdx);
}

function playPrev() {
    if (trkIdx <= 0 || trks.length == 0) {
        return
    }
    if (sound != undefined) {
        sound.stop();
    }
    trkIdx--;
    playTrk(trkIdx);
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
            trkIdx++;
            playTrk(trkIdx);
            return;
        }
    }
    // we're playing! update time
    time = document.getElementById("curtime");
    time.replaceChildren();
    time.insertAdjacentHTML("beforeend", formatTime(Math.floor(sound.seek())));
}
