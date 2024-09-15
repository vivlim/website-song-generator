import * as UI from "./ui";
import { Interval, Note, Scale, Range, Key, Chord } from "tonal";

var compostInputData = window.performance.getEntries().map(function(e) {
  return {t: e.contentType, start: e.startTime, duration: e.duration, size: e.transferSize};
}).filter(function(e){ return 't' in e && e.t !== "" && e.t !== undefined; }).toSorted(function(a, b) {return a.start - b.start});

var audioContext = new AudioContext();
export var compostState = {
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
compostState.mainGainNode.connect(audioContext.destination);
compostState.mainGainNode.gain.value = 0.3;

var stepSize = 10

var contentTypeMapping = {
    "default": {
        wave: "square",
        sizePitchFactor: 1,
        pitchCap: 1000,
        durationFactor: 1,
    },
    "text/html": {
        wave: "sine",
        sizePitchFactor: 0.3,
        pitchCap: 700,
        durationMultiplier: 3,
    },
    "text/css": {
        wave: "sine",
        sizePitchFactor: 0.3,
        pitchCap: 1000,
        durationMultiplier: 6,
    },
    "application/json": {
        wave: "square",
        sizePitchFactor: 1,
        pitchCap: 300,
        durationMultiplier: 3,
    },
    "image/png": {
        wave: "square",
        sizePitchFactor: 0.2,
        pitchCap: 600,
        durationMultiplier: 4,
    },
    "application/octet-stream": {
        wave: "sine",
        sizePitchFactor: 0.2,
        pitchCap: 900,
        durationMultiplier: 1,
    },
    "text/event-stream": null,
    /*"application/json": {
    "text/html": {},
    "text/javascript": {},
    */
}

function fitNoteToNearest(note, targetNotes){
    let targetNotesWithDistance = targetNotes.map((n) => { return {name: n, distance: Interval.num(Interval.distance(note, n))}})
        .toSorted((a, b) => { return a.distance - b.distance });
    return targetNotesWithDistance[0].name;
}


function startPlayingNote(n){
    console.log(`playing ${n.note} at ${n.start} for ${n.duration}ms ${n.wave} - ${JSON.stringify(n.sourceData)}`);
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

function quantize(inputData, tempoBpm, bucketsPerMeasure, numMeasures, key, arrangement){
    var beatsPerMillisecond = 60000 / tempoBpm;
    var measureDurationMs = beatsPerMillisecond * 4;
    var bucketDurationMs = measureDurationMs / bucketsPerMeasure;
    let endTime = measureDurationMs * numMeasures;
    console.log("Key: " + JSON.stringify(key))
    var buckets = [];
    for (let i = 0; i < bucketsPerMeasure * numMeasures; i++){
        buckets.push({start: bucketDurationMs * i, items: []});
    }

    console.log(`buckets: ${JSON.stringify(buckets)}`);

    for (let d of inputData){
        let wrappedStart = d.start % (measureDurationMs * numMeasures);
        let bucketsByDistance = buckets.map((b) => { return {bucket: b, distance: Math.abs(b.start - wrappedStart)}})
            .toSorted((a, b) => { return a.distance - b.distance });
        console.log(`Bucketed ${d.start} -> ${bucketsByDistance[0].bucket.start} (distance: ${bucketsByDistance[0].distance}) ${d.t}`);
        bucketsByDistance[0].bucket.items.push(d);
    }

    let measures = [];
    for (let i = 0; i < numMeasures; i++){
        let firstBucket = i * bucketsPerMeasure;
        let measureBuckets = [];
        let measure = {
            start: buckets[firstBucket].start,
            buckets: measureBuckets,
            itemCount: 0,
        };
        for (let j = firstBucket; j < firstBucket + bucketsPerMeasure; j++){
            let bucket = structuredClone(buckets[j])
            if (arrangement !== undefined){
                bucket.items = sampleData(bucket.items, arrangement.sampleFactor[i % arrangement.sampleFactor.length])
            }

            measureBuckets.push(bucket);
            measure.itemCount += bucket.items.length;
        }
        measures.push(measure);
    }

    if (arrangement !== undefined){
        console.log(`rearranging measures to ${JSON.stringify(arrangement)}`)
        let sourceMeasures = measures;
        for (let i = 0; i < sourceMeasures.length; i++){
            let measure = sourceMeasures[i];
            for (let j = 0; j < measure.buckets; j++){
                measure.buckets[j].items = sampleData(measure.buckets[j].items, arrangement.sampleFactor)
            }
        }
        measures = [];
        let measureNewstart = 0;
        for (let a of arrangement.measureOrder){
            let measure = structuredClone(sourceMeasures[a]);
            if (measure === undefined){throw new Error(`arrangement requested out of bounds measure ${a} that doesn't exist: ${JSON.stringify(arrangement)}`)}
            measure.start = measureNewstart;
            measures.push(measure);
            measureNewstart += measureDurationMs;
        }

        endTime = arrangement.measureOrder.length * measureDurationMs;
    }

    var notes = [];

    // process each measure one at a time
    for (let m = 0; m < measures.length; m++){
        let measureBuckets = measures[m].buckets;
        // process each time bucket one at a time
        for (let i = 0; i < measureBuckets.length; i++){
            let bucket = measureBuckets[i];
            let realStart = measures[m].start + (bucketDurationMs * i);
            let dataByType = Map.groupBy(bucket.items, (d) => d.t );

            // nothing at this time.
            if (dataByType.length == 0) continue;

            for (let contentType of dataByType.keys()){
                var mapping = contentTypeMapping[contentType];
                if (mapping === null) continue;
                if (mapping === undefined) mapping = contentTypeMapping["default"];

                let dataInBucketWithContentType = dataByType.get(contentType);
                if (dataInBucketWithContentType.length == 0) continue;

                // Map the *first* size to a note only
                let unmappedNote = Note.fromFreq(dataInBucketWithContentType[0].size * mapping.sizePitchFactor % mapping.pitchCap);
                let octave = Note.octave(unmappedNote);
                let fitNote = fitNoteToNearest(unmappedNote, key.scale.map((n) => `${n}${octave}`))
                console.log(`Item size ${dataInBucketWithContentType[0].size} mapped to note ${fitNote} (before fit, was ${unmappedNote}`);

                notes.push({
                    start: realStart,
                    duration: Math.min(dataInBucketWithContentType[0].duration * mapping.durationMultiplier, (bucketDurationMs/2)),
                    //duration: 120,
                    note: fitNote,
                    sourceData: dataInBucketWithContentType[0],
                    wave: mapping.wave,
                })

                if (dataInBucketWithContentType.length > 1) {
                    // find matching chord
                    let chordName = key.chords.filter((c) => c[0] === fitNote[0])[0];
                    let chordNotes = Chord.notes(chordName, fitNote);

                    console.log(`Matched note ${fitNote[0]} to chord: ${chordName} notes ${JSON.stringify(chordNotes)}`)
                    for (let j = 1; j < dataInBucketWithContentType.length; j++) {
                        notes.push({
                            start: realStart,
                            duration: Math.min(dataInBucketWithContentType[j].duration * mapping.durationMultiplier, (measureDurationMs/2)),
                            note: chordNotes[j],
                            sourceData: dataInBucketWithContentType[j],
                            wave: mapping.wave,
                        })
                    }
                }

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
    }

    // use notes to return the end, too. ugh
    notes.push({
        end: endTime, 
    })
    return notes;
}


function sampleData(dataIn, factor){
    return dataIn.filter((d) => Math.random() < factor);
}

compostState.arrangement = {
        measureOrder: [0, 1, 0, 2, 0, 1, 0, 3],
        //sampleFactor: [0.5, 0.3, 0.5, 0.7],
        sampleFactor: [1,1,1,1],
    };

export function playStep(tempoBpm, bucketsPerMeasure, numMeasures, keyName, arrangement, data) {
    if (compostState.playing) {
        console.log("already playing");
        return;
    }

    if (tempoBpm === undefined) tempoBpm = 80;
    if (bucketsPerMeasure === undefined) bucketsPerMeasure = 16;
    if (numMeasures === undefined) numMeasures = 4;
    if (keyName === undefined) keyName = UI.getCurrentKey();
    if (arrangement === undefined) arrangement = compostState.arrangement;
    if (data === undefined) data = compostInputData;
    // figure out where they are in time first
    var notes = quantize(data, tempoBpm, bucketsPerMeasure, numMeasures, Key.majorKey(keyName), arrangement);

    var endTime = notes[notes.length - 1].end;
    const progressStep = 100;

    let progressBar = UI.getProgressBar();
    let progressBarState = {time: 0};

    let updateProgressInterval = setInterval(() => {
        if (!progressBarState.time > endTime) {return;}
        let floatProgress = progressBarState.time / endTime;
        progressBar.style.width = `${floatProgress * 100}%`;
        progressBarState.time += progressStep;
    }, progressStep);

    let loopCheckbox = UI.getLoopCheckbox();

    setTimeout(() => {
        console.log("finished playStep.")
        compostState.playing = false;
        clearInterval(updateProgressInterval);
        progressBar.style.width = '100%'
        
        if (loopCheckbox.checked){
            // again...
            playStep()
        }
    }, endTime)

    compostState.playing = true;


    for (let n of notes) {
        if (n.start === undefined) continue;
        setTimeout(() => {
            if (loopCheckbox.checked){
                startPlayingNote(n);
            }
        }, n.start)
    }
}
compostState.playStep = playStep;
compostState.quantize = quantize;