import { Interval, Note, Scale } from "tonal";


var compostInputData = window.performance.getEntries().map(function(e) {
  return {t: e.contentType, start: e.startTime, duration: e.duration, size: e.transferSize};
}).filter(function(e){ return 't' in e && e.t !== "" && e.t !== undefined; }).toSorted(function(a, b) {return a.start - b.start});

var lastInput = compostInputData[compostInputData.length-1]

var audioContext = new AudioContext();
window.compostState = {
    current: 0,
    abort: false,
    loopAfter: lastInput.start + lastInput.size,
    audioContext: audioContext,
    oscList:  [],
    mainGainNode:  audioContext.createGain(),
    contentTypeOscs: new Map(),
    scale: Scale.get("c5 pentatonic"),
    scaleDegrees: Scale.degrees("c5 pentatonic"),
    inputData: compostInputData,
}
window.compostState.mainGainNode.connect(audioContext.destination);
window.compostState.mainGainNode.gain.value = 0.5;

// create one osc for each mime type
for (const d of compostInputData){
    if (window.compostState.contentTypeOscs.get(d.t) === undefined){
        var osc = audioContext.createOscillator();
        window.compostState.contentTypeOscs.set(d.t, osc);
        osc.connect(compostState.mainGainNode);
        osc.type = "sine";
    }
}


var stepSize = 10


function playTone(freq) {
  const osc = audioContext.createOscillator();
  osc.connect(mainGainNode);
  osc.type = "sine";

  osc.frequency.value = freq;
  osc.start();

  return osc;
}

function stopAll(){
    window.compostState.abort = true;
    for (const o of window.compostState.contentTypeOscs.values()){
        try {
            o.stop();
        }
        catch {}
    }
}

function stopPlayingData(d, osc){
    console.log("stop started osc");
    d.active = undefined;
    osc.stop()
}


function playStep() {
    if (window.compostState.abort){
        console.log("abort flag set");
        for (const o of window.compostState.contentTypeOscs.values()){
            try {
                o.stop();
            }
            catch {}
        }
        return;
    }
    var now = window.compostState.current;
    console.log("enter step: " + now);
    window.compostState.current += stepSize;
    var active = compostInputData.filter(function(e) { return now >= e.start && now <= e.start + e.duration; })
    for (const d of compostInputData){
        if (d.active !== undefined){
            continue;
        }
        if (d.t === undefined){
            console.log("type was undefined")
            continue;
        }
        var osc = window.compostState.contentTypeOscs.get(d.t);
        if (osc === undefined){
            console.log("osc was undefined for type " + d.t)
            continue;
        }
        try {
            if (now >= d.start && now <= d.start + d.duration) {
                d.active = true;

                var osc = audioContext.createOscillator();
                osc.connect(compostState.mainGainNode);
                osc.type = "sine";
                var degree = d.transferSize % 16 - 8;
                osc.frequency.value = window.compostState.scaleDegrees(degree);
                console.log("start osc " + d.t + " at " + now);
                osc.start();
                setTimeout(stopPlayingData.bind(d, osc), d.duration);
            }
        }
        catch (e) {
            console.log("error (probably benign) " + e);
        }
    }

    if (now < window.compostState.loopAfter){
        setTimeout(playStep, stepSize * 10);
    }
    else {
        console.log("no more");
    }
}
window.compostState.playStep = playStep;
window.compostState.stopAll = stopAll;