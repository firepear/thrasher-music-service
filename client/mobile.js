var prevOrient = null;

function checkOrientation(){
    const o = Math.abs(window.orientation);
    console.log(o, prevOrient);
    if(o !== prevOrient){
        prevOrient = o;
        if (o == 90) {
            setOLandscape();
            return;
        }
        setOPortrait();
    }
};

function setOLandscape() {
    els.tracklist.style.display = "none";
    els.tracklist.style.height = "0vh";
    els.tracklist.style.marginBottom = "0";
    els.player.style.height = "50vh";
}

function setOPortrait() {
    els.player.style.height = "20vh";
    els.tracklist.style.display = "block";
    els.tracklist.style.height = "60vh";
    els.tracklist.style.marginBottom = "0.5em";
}

window.addEventListener("resize", checkOrientation);
window.addEventListener("orientationchange", checkOrientation);
