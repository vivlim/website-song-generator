import { Interval, Note, Scale } from "tonal";


var compostInputData = window.performance.getEntries().map(function(e) {
  return {t: e.contentType, start: e.startTime, duration: e.duration, size: e.transferSize};
}).filter(function(e){ return 't' in e && e.t !== "" && e.t !== undefined; }).toSorted(function(a, b) {return a.start - b.start});

var lastInput = compostInputData[compostInputData.length-1]

var audioContext = new AudioContext();
var compostState = {
    current: 0,
    abort: false,
    loopAfter: 4000,
    audioContext: audioContext,
    oscList:  [],
    mainGainNode:  audioContext.createGain(),
    contentTypeOscs: new Map(),
    scale: Scale.get("c3 pentatonic"),
    scaleDegrees: Scale.degrees("c4 pentatonic"),
    inputData: compostInputData,
}
window.compostState = compostState;
compostState.mainGainNode.connect(audioContext.destination);
compostState.mainGainNode.gain.value = 0.3;

var stepSize = 10


function startPlayingData(d){
    console.log("playing data " + d.start);
    var osc = audioContext.createOscillator();
    osc.connect(compostState.mainGainNode);
    osc.type = "square";
    var degree = d.size % 8 - 4;
    var note = window.compostState.scaleDegrees(degree);
    var freq = Note.freq(note);
    console.log("mapped size " + d.size + " to degree " + degree + " to note " + note + " to freq " + freq);
    osc.frequency.value = freq;
    osc.start();
    var duration = d.duration % compostState.loopAfter;
    setTimeout(() => {stopPlayingData(d, osc)}, duration);
}

function stopPlayingData(d, osc){
    console.log("stopping data " + d.start);
    d.active = undefined;
    osc.stop()
}


function playStep() {
    for (let d of compostInputData) {
        var startTime = d.start % compostState.loopAfter;
        console.log("scheduling data " + d.start + " in " + startTime + "ms");
        setTimeout(() => {startPlayingData(d)}, d.start)
    }
}
window.compostState.playStep = playStep;