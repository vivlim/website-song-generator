import { Interval, Note, Scale, Range } from "tonal";


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

var contentTypeMapping = {
    "default": {
        wave: "square",
        sizePitchFactor: 1,
        durationFactor: 1,
    },
    "text/html": {
        wave: "sine",
        sizePitchFactor: 0.3,
        durationMultiplier: 3,
    },
    "text/html": {
        wave: "css",
        sizePitchFactor: 0.3,
        durationMultiplier: 6,
    },
    "application/json": {
        wave: "square",
        sizePitchFactor: 1,
        durationMultiplier: 3,
    },
    "image/png": {
        wave: "square",
        sizePitchFactor: 0.2,
        durationMultiplier: 4,
    },
    "image/octet-stream": {
        wave: "sine",
        sizePitchFactor: 0.2,
        durationMultiplier: 1,
    },
    /*"application/json": {
    "text/html": {},
    "text/javascript": {},
    */
}


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

function startPlayingNote(n){
    console.log(`playing ${n.note} at ${n.start} ${n.wave} - ${JSON.stringify(n.sourceData)}`);
    var osc = audioContext.createOscillator();
    osc.connect(compostState.mainGainNode);
    osc.type = n.wave;
    var freq = Note.freq(n.note);
    osc.frequency.value = freq;
    setTimeout(() => {stopOsc(osc)}, n.duration);
    osc.start();
}

function stopPlayingData(d, osc){
    console.log("stopping data " + d.start);
    d.active = undefined;
    osc.stop()
}

function stopOsc(osc){
    console.log("stopping osc")
    osc.stop()
}

function quantize(tempoBpm, bucketsPerMeasure, key){
    var beatsPerMillisecond = 60000 / tempoBpm;
    var measureDurationMs = beatsPerMillisecond * 4;
    var bucketDurationMs = measureDurationMs / bucketsPerMeasure;
    console.log()
    var buckets = [];
    for (let i = 0; i < bucketsPerMeasure; i++){
        buckets.push({start: bucketDurationMs * i, items: []});
    }

    console.log(`buckets: ${JSON.stringify(buckets)}`);

    for (let d of compostInputData){
        let wrappedStart = d.start % measureDurationMs;
        let bucketsByDistance = buckets.map((b) => { return {bucket: b, distance: Math.abs(b.start - wrappedStart)}})
            .toSorted((a, b) => { return a.distance - b.distance });
        console.log(`Bucketed ${d.start} -> ${bucketsByDistance[0].bucket.start} (distance: ${bucketsByDistance[0].distance}) ${d.t}`);
        bucketsByDistance[0].bucket.items.push(d);
    }

    var notes = [];

    // process each time bucket one at a time
    for (let i = 0; i < bucketsPerMeasure; i++){
        let dataByType = Map.groupBy(buckets[i].items, (d) => d.t );

        // nothing at this time.
        if (dataByType.length == 0) continue;

        for (let contentType of dataByType.keys()){
            var mapping = contentTypeMapping[contentType];
            if (mapping === undefined) mapping = contentTypeMapping["default"];

            var dataInBucketWithContentType = dataByType.get(contentType);
            if (dataInBucketWithContentType.length == 0) continue;

            // Map the *first* size to a note only
            let note = Note.fromFreq(dataInBucketWithContentType[0].size * mapping.sizePitchFactor % 1000);
            console.log(`Item size ${dataInBucketWithContentType[0].size} mapped to note ${note}`);

            notes.push({
                start: buckets[i].start,
                duration: dataInBucketWithContentType[0].duration * mapping.durationMultiplier % (measureDurationMs/2),
                note: note,
                sourceData: dataInBucketWithContentType[0],
                wave: mapping.wave,

            })

            /*
            // random chord from the key
            // or just the first for now
            let chordName = key.chords[0];
            var chord = Range.numeric([0, dataInBucketWithContentType.length]).map(Chord.steps(key.chords[0]))
            for (let d of dataByType.get(contentType)){
                var index = Math.round(((d.size % mapping.byteSizeWrapPoint) / mapping.byteSizeWrapPoint) * 5);
                

            }
            notes.push(noteIndices);

            */

        }

    }
    return notes;
}



function playStep(tempoBpm, bucketsPerMeasure) {
    if (tempoBpm === undefined) tempoBpm = 169;
    if (bucketsPerMeasure === undefined) bucketsPerMeasure = 16;
    // figure out where they are in time first
    var notes = quantize(tempoBpm, bucketsPerMeasure);

    for (let n of notes) {
        //var startTime = d.start % compostState.loopAfter;
        setTimeout(() => {startPlayingNote(n)}, n.start)
    }
}
window.compostState.playStep = playStep;
window.compostState.quantize = quantize;

window.buckets = quantize(169, 16, "C", "pentatonic")
playStep();