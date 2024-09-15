/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/player.js":
/*!***********************!*\
  !*** ./src/player.js ***!
  \***********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   compostState: () => (/* binding */ compostState),
/* harmony export */   playStep: () => (/* binding */ playStep)
/* harmony export */ });
/* harmony import */ var _ui__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./ui */ "./src/ui.js");
/* harmony import */ var tonal__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! tonal */ "./node_modules/tonal/dist/index.mjs");



var compostInputData = window.performance.getEntries().map(function(e) {
  return {t: e.contentType, start: e.startTime, duration: e.duration, size: e.transferSize};
}).filter(function(e){ return 't' in e && e.t !== "" && e.t !== undefined; }).toSorted(function(a, b) {return a.start - b.start});

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


var audioContext = new AudioContext();
var compostState = {
    current: 0,
    abort: false,
    loopAfter: 4000,
    audioContext: audioContext,
    oscList:  [],
    mainGainNode:  audioContext.createGain(),
    contentTypeOscs: new Map(),
    scale: tonal__WEBPACK_IMPORTED_MODULE_1__.Scale.get("c3 pentatonic"),
    scaleDegrees: tonal__WEBPACK_IMPORTED_MODULE_1__.Scale.degrees("c4 pentatonic"),
    inputData: compostInputData,
    contentTypeMapping: contentTypeMapping,
}
compostState.mainGainNode.connect(audioContext.destination);
compostState.mainGainNode.gain.value = 0.2;

var stepSize = 10


function fitNoteToNearest(note, targetNotes){
    let targetNotesWithDistance = targetNotes.map((n) => { return {name: n, distance: tonal__WEBPACK_IMPORTED_MODULE_1__.Interval.num(tonal__WEBPACK_IMPORTED_MODULE_1__.Interval.distance(note, n))}})
        .toSorted((a, b) => { return a.distance - b.distance });
    return targetNotesWithDistance[0].name;
}


function startPlayingNote(n){
    console.log(`playing ${n.note} at ${n.start} for ${n.duration}ms ${n.wave} - ${JSON.stringify(n.sourceData)}`);
    var osc = audioContext.createOscillator();
    osc.connect(compostState.mainGainNode);
    osc.type = n.wave;
    var freq = tonal__WEBPACK_IMPORTED_MODULE_1__.Note.freq(n.note);
    osc.frequency.value = freq;
    let duration = n.duration;
    if (isNaN(duration)){
        console.log(`note duration is nan. randomizing it`)
        duration = Math.random()* 80
    }
    setTimeout(() => {stopOsc(osc)}, duration);
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
        console.log(`rearranging measures to ${JSON.stringify(arrangement)}. measure duration: ${measureDurationMs} and bpm ${tempoBpm}`)
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
            if (measure === undefined){
                console.log(`arrangement requested out of bounds measure ${a} that doesn't exist: ${JSON.stringify(arrangement)}`)
                measure = structuredClone(sourceMeasures[a % sourceMeasures.length]);
            }
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
                var mapping = compostState.contentTypeMapping[contentType];
                if (mapping === null) continue;
                if (mapping === undefined) mapping = compostState.contentTypeMapping["default"];

                let dataInBucketWithContentType = dataByType.get(contentType);
                if (dataInBucketWithContentType.length == 0) continue;

                // Map the *first* size to a note only
                let unmappedNote = tonal__WEBPACK_IMPORTED_MODULE_1__.Note.fromFreq(dataInBucketWithContentType[0].size * mapping.sizePitchFactor % mapping.pitchCap);
                let octave = tonal__WEBPACK_IMPORTED_MODULE_1__.Note.octave(unmappedNote);
                let fitNote = fitNoteToNearest(unmappedNote, key.scale.map((n) => `${n}${octave}`))
                if (fitNote.indexOf("undefined") >= 0){
                    throw new Error(`Note contains undefined ${fitNote}`) // bleh

                }
                console.log(`Item size ${dataInBucketWithContentType[0].size} mapped to note ${fitNote} (before fit, was ${unmappedNote}`);

                notes.push({
                    start: realStart,
                    duration: Math.max(Math.min(dataInBucketWithContentType[0].duration * mapping.durationMultiplier, (bucketDurationMs/2)), measureDurationMs / bucketsPerMeasure),
                    //duration: 120,
                    note: fitNote,
                    sourceData: dataInBucketWithContentType[0],
                    wave: mapping.wave,
                })

                if (dataInBucketWithContentType.length > 1) {
                    // find matching chord
                    let chordName = key.chords.filter((c) => c[0] === fitNote[0])[0];
                    let chordNotes = tonal__WEBPACK_IMPORTED_MODULE_1__.Chord.notes(chordName, fitNote);

                    console.log(`Matched note ${fitNote[0]} to chord: ${chordName} notes ${JSON.stringify(chordNotes)}`)
                    for (let j = 1; j < dataInBucketWithContentType.length; j++) {
                        notes.push({
                            start: realStart,
                            duration: Math.max(Math.min(dataInBucketWithContentType[j].duration * mapping.durationMultiplier, (bucketDurationMs/2)), measureDurationMs / bucketsPerMeasure),
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

function playStep(tempoBpm, bucketsPerMeasure, numMeasures, keyName, arrangement, data) {
    if (compostState.playing) {
        console.log("already playing");
        return;
    }

    if (tempoBpm === undefined) tempoBpm = _ui__WEBPACK_IMPORTED_MODULE_0__.getBpm();
    if (bucketsPerMeasure === undefined) bucketsPerMeasure = _ui__WEBPACK_IMPORTED_MODULE_0__.getQuantizationBuckets();
    if (numMeasures === undefined) numMeasures = _ui__WEBPACK_IMPORTED_MODULE_0__.getMeasures();
    if (keyName === undefined) keyName = _ui__WEBPACK_IMPORTED_MODULE_0__.getCurrentKey();
    if (arrangement === undefined) arrangement = compostState.arrangement;
    if (data === undefined) data = compostInputData;
    // figure out where they are in time first
    var notes = quantize(data, tempoBpm, bucketsPerMeasure, numMeasures, tonal__WEBPACK_IMPORTED_MODULE_1__.Key.majorKey(keyName), arrangement);

    var endTime = notes[notes.length - 1].end;
    const progressStep = 100;

    let progressBar = _ui__WEBPACK_IMPORTED_MODULE_0__.getProgressBar();
    let progressBarState = {time: 0};

    let updateProgressInterval = setInterval(() => {
        if (!progressBarState.time > endTime) {return;}
        let floatProgress = progressBarState.time / endTime;
        progressBar.style.width = `${floatProgress * 100}%`;
        progressBarState.time += progressStep;
    }, progressStep);

    let loopCheckbox = _ui__WEBPACK_IMPORTED_MODULE_0__.getLoopCheckbox();

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

/***/ }),

/***/ "./src/ui.js":
/*!*******************!*\
  !*** ./src/ui.js ***!
  \*******************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getBpm: () => (/* binding */ getBpm),
/* harmony export */   getCurrentKey: () => (/* binding */ getCurrentKey),
/* harmony export */   getLoopCheckbox: () => (/* binding */ getLoopCheckbox),
/* harmony export */   getMeasures: () => (/* binding */ getMeasures),
/* harmony export */   getProgressBar: () => (/* binding */ getProgressBar),
/* harmony export */   getQuantizationBuckets: () => (/* binding */ getQuantizationBuckets),
/* harmony export */   getUiElement: () => (/* binding */ getUiElement)
/* harmony export */ });
/* harmony import */ var _player__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./player */ "./src/player.js");


const uiElementId = "compostUiRoot";
const loopCheckboxId = "compostUiLoopCheckbox"
const keySelectId = "compostUiKeySelect"
const progressId = "compostUiProgress"
const bpmId = "compostUiBpm"
const measuresId = "compostUiMeasures"
const quantizationBucketsId = "compostUiQuantizationBuckets"
const arrangementMeasureOrderId = "compostUiArrangementMeasureOrder"
const arrangementSampleFactorId = "compostUiArrangementSampleFactor"
const contentTypeMapId = "compostUiContentTypeMap"

function setDefault(key, value){
    console.log(`Saving default ${key}: ${value}`)
    localStorage.setItem(`compost.configuration.${key}`, value);
}

function removeDefault(key){
    console.log(`Clearing default ${key}`)
    localStorage.removeItem(`compost.configuration.${key}`);
}

function getDefault(key, defaultValue){
    let valueInStorage = localStorage.getItem(`compost.configuration.${key}`);
    if (valueInStorage === null){
        console.log(`local storage doesn't define a default for ${key}.`)
        return defaultValue;
    }
    console.log(`local storage has a default for ${key}: ${valueInStorage}`)
    return valueInStorage;
}

const saveDefaultsEvent = new Event("saveDefaults");
const clearDefaultsEvent = new Event("clearDefaults");
const uiEvents = new EventTarget();

function getUiElement(){
    let ui = window.document.getElementById(uiElementId);
    if (ui !== null){
        return ui;
    }

    ui = window.document.createElement("div");
    window.document.body.appendChild(ui);
    applyStyleToElement(ui);

    addProgressBar(ui, progressId);

    addCheckbox(ui, loopCheckboxId, "play")
    addSelect(ui, keySelectId, "key", ["A","B","C","D","E","F","G"], 3)
    addNumberInput(ui, bpmId, "bpm", 80, 10, 400)
    addNumberInput(ui, measuresId, "measures", 4, 1, 24)
    addNumberInput(ui, quantizationBucketsId, "quant. buckets", 16, 2, 64)

    addButton(ui, "save defaults", () => {
        uiEvents.dispatchEvent(new Event("saveDefaults"));
    });
    addButton(ui, "reset defaults", () => {
        uiEvents.dispatchEvent(new Event("clearDefaults"));
    });

    let arrangement = detailsContainer(ui, "arrangement")
    let trySetFromJson = (source, targetCb) => {
        try {
            var value = JSON.parse(source);
            targetCb(value);
            console.log(`Successfully set value ${value}`)
        }
        catch {
            alert(`Failed to set value, '${source.value}' is not a valid object`);
        }
    }
    let arrOrder = addTextInput(arrangement, arrangementMeasureOrderId, "measure order", JSON.stringify(_player__WEBPACK_IMPORTED_MODULE_0__.compostState.arrangement.measureOrder));
    arrOrder.addEventListener("keyup", (ev) => {
        if (ev.key === "Enter"){
            trySetFromJson(arrOrder.value, (val) => _player__WEBPACK_IMPORTED_MODULE_0__.compostState.arrangement.measureOrder = val)
        }
    });
    let arrSampF = addTextInput(arrangement, arrangementSampleFactorId, "sample factor", JSON.stringify(_player__WEBPACK_IMPORTED_MODULE_0__.compostState.arrangement.sampleFactor))
    arrSampF.addEventListener("keyup", (ev) => {
        if (ev.key === "Enter"){
            trySetFromJson(arrSampF.value, (val) => _player__WEBPACK_IMPORTED_MODULE_0__.compostState.arrangement.sampleFactor = val)
        }
    });
    ui.appendChild(arrangement);
    let contentTypeMap = detailsContainer(ui, "content type map")
    
    addTextArea(contentTypeMap, contentTypeMapId, JSON.stringify(_player__WEBPACK_IMPORTED_MODULE_0__.compostState.contentTypeMapping, null, 2), 5, (text) => {
        trySetFromJson(text, (val) => _player__WEBPACK_IMPORTED_MODULE_0__.compostState.contentTypeMapping = val);
    })
    ui.appendChild(contentTypeMap);


    return ui;
}

function getLoopCheckbox(){
    return window.document.getElementById(loopCheckboxId);
}

function getCurrentKey(){
    var sel = window.document.getElementById(keySelectId);
    return sel.options[sel.selectedIndex].value;
}

function getBpm(){
    var e = window.document.getElementById(bpmId);
    return parseInt(e.value);
}

function getMeasures(){
    var e = window.document.getElementById(measuresId);
    return parseInt(e.value);
}

function getQuantizationBuckets(){
    var e = window.document.getElementById(quantizationBucketsId);
    return parseInt(e.value);
}

function getProgressBar(){
    return window.document.getElementById(progressId);
}

function applyStyleToElement(ui){
    //ui.style.width = "300px"
    //ui.style.height = "3em"
    ui.style.padding = "0.5em";
    ui.style.border = "2px solid #888888"
    ui.style.background = "#111111"
    ui.style.position = "fixed"
    ui.style.top = "4em"
    ui.style.left = "1em"
    ui.style.zIndex = 99999999
}
function styleFgColor(label){
    label.style.color = "#ffffff";
    return label;
}

function elementContainer(targetElement){
    let c = window.document.createElement("span");
    c.style.margin = "4px";
    targetElement.appendChild(c);
    return styleFgColor(c);
}

function detailsContainer(targetElement, label){
    let arrangement = window.document.createElement("details");
    let arrSummary = window.document.createElement("summary");
    arrSummary.innerText = label;
    arrangement.appendChild(styleFgColor(arrSummary));
    return styleFgColor(arrangement);
}

function addCheckbox(targetElement, id, label) {
    targetElement = elementContainer(targetElement);
    let e = window.document.createElement("input");
    e.type = "checkbox"
    e.id = id
    targetElement.appendChild(e)
    let l = window.document.createElement("label");
    l.htmlFor = id
    l.innerText = label
    targetElement.appendChild(l)
    return e;
}

function addNumberInput(targetElement, id, label, initial, min, max) {
    targetElement = elementContainer(targetElement);
    let l = window.document.createElement("label");
    l.htmlFor = id
    l.innerText = label
    targetElement.appendChild(l)
    let e = window.document.createElement("input");
    e.type = "number"
    e.min = min
    e.max = max
    e.value = getDefault(id, initial)
    e.id = id
    targetElement.appendChild(e)

    uiEvents.addEventListener('saveDefaults', () => {
        setDefault(id, e.value);
    });

    uiEvents.addEventListener('clearDefaults', () => {
        removeDefault(id);
    });

    return e;
}

function addTextInput(targetElement, id, label, initial) {
    targetElement = elementContainer(targetElement);
    let l = window.document.createElement("label");
    l.htmlFor = id
    l.innerText = label
    targetElement.appendChild(l)
    let e = window.document.createElement("input");
    e.type = "text"
    e.value = getDefault(id, initial)
    e.id = id
    targetElement.appendChild(e)


    uiEvents.addEventListener('saveDefaults', () => {
        setDefault(id, e.value);
    });

    uiEvents.addEventListener('clearDefaults', () => {
        removeDefault(id);
    });
    return e;
}

function addButton(targetElement, label, onclick) {
    let b = window.document.createElement("button");
    b.innerHTML= label;
    b.style.padding = "0.2em"
    b.style.margin = "0.2em"
    b.style.background = "#333333"
    b.style.color = "#DDDDDD"
    b.onclick = () => {
        console.log(`button ${label} clicked`)
        onclick()
    };
    targetElement.appendChild(b)
    return b;
}

function addTextArea(targetElement, id, initial, rows, onclick) {
    targetElement = elementContainer(targetElement);
    let e = window.document.createElement("textArea");
    e.rows = rows
    e.value = getDefault(id, initial)
    e.style.width = "100%"
    targetElement.appendChild(e)
    addButton(targetElement, "apply", () => onclick(e.value));

    uiEvents.addEventListener('saveDefaults', () => {
        setDefault(id, e.value);
    });

    uiEvents.addEventListener('clearDefaults', () => {
        removeDefault(id);
    });

    return e;
}

function addSelect(targetElement, id, label, options, initialIndex) {
    targetElement = elementContainer(targetElement);
    let l = window.document.createElement("label");
    l.htmlFor = id
    l.innerText = label
    targetElement.appendChild(l)

    let e = window.document.createElement("select");
    e.id = id
    targetElement.appendChild(e)

    initialIndex = getDefault(id, initialIndex)

    uiEvents.addEventListener('saveDefaults', () => {
        setDefault(id, e.selectedIndex);
    });

    uiEvents.addEventListener('clearDefaults', () => {
        removeDefault(id);
    });

    for (let i = 0; i < options.length; i++) {
        let o = window.document.createElement("option");
        o.value = options[i];
        o.innerText = options[i];
        if (i === initialIndex) o.selected = true;
        e.appendChild(o);
    }
    return e;
}

function addProgressBar(targetElement, id) {
    targetElement = elementContainer(targetElement);
    let outer = window.document.createElement("div");
    outer.id = `${id}_outer`
    outer.style.width = "100%";
    outer.style.background = "#444444";
    targetElement.appendChild(outer)
    let inner = window.document.createElement("div");
    inner.id = `${id}`
    inner.style.width = "1%";
    inner.style.height = "1em";
    inner.style.background = "#cc66ff"
    outer.appendChild(inner)
    return inner;
}

/***/ }),

/***/ "./node_modules/@tonaljs/abc-notation/dist/index.mjs":
/*!***********************************************************!*\
  !*** ./node_modules/@tonaljs/abc-notation/dist/index.mjs ***!
  \***********************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   abcToScientificNotation: () => (/* binding */ abcToScientificNotation),
/* harmony export */   "default": () => (/* binding */ abc_notation_default),
/* harmony export */   distance: () => (/* binding */ distance),
/* harmony export */   scientificToAbcNotation: () => (/* binding */ scientificToAbcNotation),
/* harmony export */   tokenize: () => (/* binding */ tokenize),
/* harmony export */   transpose: () => (/* binding */ transpose)
/* harmony export */ });
/* harmony import */ var _tonaljs_pitch_distance__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @tonaljs/pitch-distance */ "./node_modules/@tonaljs/pitch-distance/dist/index.mjs");
/* harmony import */ var _tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @tonaljs/pitch-note */ "./node_modules/@tonaljs/pitch-note/dist/index.mjs");
// index.ts


var fillStr = (character, times) => Array(times + 1).join(character);
var REGEX = /^(_{1,}|=|\^{1,}|)([abcdefgABCDEFG])([,']*)$/;
function tokenize(str) {
  const m = REGEX.exec(str);
  if (!m) {
    return ["", "", ""];
  }
  return [m[1], m[2], m[3]];
}
function abcToScientificNotation(str) {
  const [acc, letter, oct] = tokenize(str);
  if (letter === "") {
    return "";
  }
  let o = 4;
  for (let i = 0; i < oct.length; i++) {
    o += oct.charAt(i) === "," ? -1 : 1;
  }
  const a = acc[0] === "_" ? acc.replace(/_/g, "b") : acc[0] === "^" ? acc.replace(/\^/g, "#") : "";
  return letter.charCodeAt(0) > 96 ? letter.toUpperCase() + a + (o + 1) : letter + a + o;
}
function scientificToAbcNotation(str) {
  const n = (0,_tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_1__.note)(str);
  if (n.empty || !n.oct && n.oct !== 0) {
    return "";
  }
  const { letter, acc, oct } = n;
  const a = acc[0] === "b" ? acc.replace(/b/g, "_") : acc.replace(/#/g, "^");
  const l = oct > 4 ? letter.toLowerCase() : letter;
  const o = oct === 5 ? "" : oct > 4 ? fillStr("'", oct - 5) : fillStr(",", 4 - oct);
  return a + l + o;
}
function transpose(note2, interval) {
  return scientificToAbcNotation((0,_tonaljs_pitch_distance__WEBPACK_IMPORTED_MODULE_0__.transpose)(abcToScientificNotation(note2), interval));
}
function distance(from, to) {
  return (0,_tonaljs_pitch_distance__WEBPACK_IMPORTED_MODULE_0__.distance)(abcToScientificNotation(from), abcToScientificNotation(to));
}
var abc_notation_default = {
  abcToScientificNotation,
  scientificToAbcNotation,
  tokenize,
  transpose,
  distance
};

//# sourceMappingURL=index.mjs.map

/***/ }),

/***/ "./node_modules/@tonaljs/array/dist/index.mjs":
/*!****************************************************!*\
  !*** ./node_modules/@tonaljs/array/dist/index.mjs ***!
  \****************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   compact: () => (/* binding */ compact),
/* harmony export */   permutations: () => (/* binding */ permutations),
/* harmony export */   range: () => (/* binding */ range),
/* harmony export */   rotate: () => (/* binding */ rotate),
/* harmony export */   shuffle: () => (/* binding */ shuffle),
/* harmony export */   sortedNoteNames: () => (/* binding */ sortedNoteNames),
/* harmony export */   sortedUniqNoteNames: () => (/* binding */ sortedUniqNoteNames)
/* harmony export */ });
/* harmony import */ var _tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @tonaljs/pitch-note */ "./node_modules/@tonaljs/pitch-note/dist/index.mjs");
// index.ts

function ascR(b, n) {
  const a = [];
  for (; n--; a[n] = n + b)
    ;
  return a;
}
function descR(b, n) {
  const a = [];
  for (; n--; a[n] = b - n)
    ;
  return a;
}
function range(from, to) {
  return from < to ? ascR(from, to - from + 1) : descR(from, from - to + 1);
}
function rotate(times, arr) {
  const len = arr.length;
  const n = (times % len + len) % len;
  return arr.slice(n, len).concat(arr.slice(0, n));
}
function compact(arr) {
  return arr.filter((n) => n === 0 || n);
}
function sortedNoteNames(notes) {
  const valid = notes.map((n) => (0,_tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_0__.note)(n)).filter((n) => !n.empty);
  return valid.sort((a, b) => a.height - b.height).map((n) => n.name);
}
function sortedUniqNoteNames(arr) {
  return sortedNoteNames(arr).filter((n, i, a) => i === 0 || n !== a[i - 1]);
}
function shuffle(arr, rnd = Math.random) {
  let i;
  let t;
  let m = arr.length;
  while (m) {
    i = Math.floor(rnd() * m--);
    t = arr[m];
    arr[m] = arr[i];
    arr[i] = t;
  }
  return arr;
}
function permutations(arr) {
  if (arr.length === 0) {
    return [[]];
  }
  return permutations(arr.slice(1)).reduce((acc, perm) => {
    return acc.concat(
      arr.map((e, pos) => {
        const newPerm = perm.slice();
        newPerm.splice(pos, 0, arr[0]);
        return newPerm;
      })
    );
  }, []);
}

//# sourceMappingURL=index.mjs.map

/***/ }),

/***/ "./node_modules/@tonaljs/chord-detect/dist/index.mjs":
/*!***********************************************************!*\
  !*** ./node_modules/@tonaljs/chord-detect/dist/index.mjs ***!
  \***********************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ chord_detect_default),
/* harmony export */   detect: () => (/* binding */ detect)
/* harmony export */ });
/* harmony import */ var _tonaljs_chord_type__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @tonaljs/chord-type */ "./node_modules/@tonaljs/chord-type/dist/index.mjs");
/* harmony import */ var _tonaljs_pcset__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @tonaljs/pcset */ "./node_modules/@tonaljs/pcset/dist/index.mjs");
/* harmony import */ var _tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @tonaljs/pitch-note */ "./node_modules/@tonaljs/pitch-note/dist/index.mjs");
// index.ts



var namedSet = (notes) => {
  const pcToName = notes.reduce((record, n) => {
    const chroma = (0,_tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_2__.note)(n).chroma;
    if (chroma !== void 0) {
      record[chroma] = record[chroma] || (0,_tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_2__.note)(n).name;
    }
    return record;
  }, {});
  return (chroma) => pcToName[chroma];
};
function detect(source, options = {}) {
  const notes = source.map((n) => (0,_tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_2__.note)(n).pc).filter((x) => x);
  if (_tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_2__.note.length === 0) {
    return [];
  }
  const found = findMatches(notes, 1, options);
  return found.filter((chord) => chord.weight).sort((a, b) => b.weight - a.weight).map((chord) => chord.name);
}
var BITMASK = {
  // 3m 000100000000
  // 3M 000010000000
  anyThirds: 384,
  // 5P 000000010000
  perfectFifth: 16,
  // 5d 000000100000
  // 5A 000000001000
  nonPerfectFifths: 40,
  anySeventh: 3
};
var testChromaNumber = (bitmask) => (chromaNumber) => Boolean(chromaNumber & bitmask);
var hasAnyThird = testChromaNumber(BITMASK.anyThirds);
var hasPerfectFifth = testChromaNumber(BITMASK.perfectFifth);
var hasAnySeventh = testChromaNumber(BITMASK.anySeventh);
var hasNonPerfectFifth = testChromaNumber(BITMASK.nonPerfectFifths);
function hasAnyThirdAndPerfectFifthAndAnySeventh(chordType) {
  const chromaNumber = parseInt(chordType.chroma, 2);
  return hasAnyThird(chromaNumber) && hasPerfectFifth(chromaNumber) && hasAnySeventh(chromaNumber);
}
function withPerfectFifth(chroma) {
  const chromaNumber = parseInt(chroma, 2);
  return hasNonPerfectFifth(chromaNumber) ? chroma : (chromaNumber | 16).toString(2);
}
function findMatches(notes, weight, options) {
  const tonic = notes[0];
  const tonicChroma = (0,_tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_2__.note)(tonic).chroma;
  const noteName = namedSet(notes);
  const allModes = (0,_tonaljs_pcset__WEBPACK_IMPORTED_MODULE_1__.modes)(notes, false);
  const found = [];
  allModes.forEach((mode, index) => {
    const modeWithPerfectFifth = options.assumePerfectFifth && withPerfectFifth(mode);
    const chordTypes = (0,_tonaljs_chord_type__WEBPACK_IMPORTED_MODULE_0__.all)().filter((chordType) => {
      if (options.assumePerfectFifth && hasAnyThirdAndPerfectFifthAndAnySeventh(chordType)) {
        return chordType.chroma === modeWithPerfectFifth;
      }
      return chordType.chroma === mode;
    });
    chordTypes.forEach((chordType) => {
      const chordName = chordType.aliases[0];
      const baseNote = noteName(index);
      const isInversion = index !== tonicChroma;
      if (isInversion) {
        found.push({
          weight: 0.5 * weight,
          name: `${baseNote}${chordName}/${tonic}`
        });
      } else {
        found.push({ weight: 1 * weight, name: `${baseNote}${chordName}` });
      }
    });
  });
  return found;
}
var chord_detect_default = { detect };

//# sourceMappingURL=index.mjs.map

/***/ }),

/***/ "./node_modules/@tonaljs/chord-type/dist/index.mjs":
/*!*********************************************************!*\
  !*** ./node_modules/@tonaljs/chord-type/dist/index.mjs ***!
  \*********************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   add: () => (/* binding */ add),
/* harmony export */   addAlias: () => (/* binding */ addAlias),
/* harmony export */   all: () => (/* binding */ all),
/* harmony export */   chordType: () => (/* binding */ chordType),
/* harmony export */   "default": () => (/* binding */ chord_type_default),
/* harmony export */   entries: () => (/* binding */ entries),
/* harmony export */   get: () => (/* binding */ get),
/* harmony export */   keys: () => (/* binding */ keys),
/* harmony export */   names: () => (/* binding */ names),
/* harmony export */   removeAll: () => (/* binding */ removeAll),
/* harmony export */   symbols: () => (/* binding */ symbols)
/* harmony export */ });
/* harmony import */ var _tonaljs_pcset__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @tonaljs/pcset */ "./node_modules/@tonaljs/pcset/dist/index.mjs");
// index.ts


// data.ts
var CHORDS = [
  // ==Major==
  ["1P 3M 5P", "major", "M ^  maj"],
  ["1P 3M 5P 7M", "major seventh", "maj7 \u0394 ma7 M7 Maj7 ^7"],
  ["1P 3M 5P 7M 9M", "major ninth", "maj9 \u03949 ^9"],
  ["1P 3M 5P 7M 9M 13M", "major thirteenth", "maj13 Maj13 ^13"],
  ["1P 3M 5P 6M", "sixth", "6 add6 add13 M6"],
  ["1P 3M 5P 6M 9M", "sixth added ninth", "6add9 6/9 69 M69"],
  ["1P 3M 6m 7M", "major seventh flat sixth", "M7b6 ^7b6"],
  [
    "1P 3M 5P 7M 11A",
    "major seventh sharp eleventh",
    "maj#4 \u0394#4 \u0394#11 M7#11 ^7#11 maj7#11"
  ],
  // ==Minor==
  // '''Normal'''
  ["1P 3m 5P", "minor", "m min -"],
  ["1P 3m 5P 7m", "minor seventh", "m7 min7 mi7 -7"],
  [
    "1P 3m 5P 7M",
    "minor/major seventh",
    "m/ma7 m/maj7 mM7 mMaj7 m/M7 -\u03947 m\u0394 -^7 -maj7"
  ],
  ["1P 3m 5P 6M", "minor sixth", "m6 -6"],
  ["1P 3m 5P 7m 9M", "minor ninth", "m9 -9"],
  ["1P 3m 5P 7M 9M", "minor/major ninth", "mM9 mMaj9 -^9"],
  ["1P 3m 5P 7m 9M 11P", "minor eleventh", "m11 -11"],
  ["1P 3m 5P 7m 9M 13M", "minor thirteenth", "m13 -13"],
  // '''Diminished'''
  ["1P 3m 5d", "diminished", "dim \xB0 o"],
  ["1P 3m 5d 7d", "diminished seventh", "dim7 \xB07 o7"],
  ["1P 3m 5d 7m", "half-diminished", "m7b5 \xF8 -7b5 h7 h"],
  // ==Dominant/Seventh==
  // '''Normal'''
  ["1P 3M 5P 7m", "dominant seventh", "7 dom"],
  ["1P 3M 5P 7m 9M", "dominant ninth", "9"],
  ["1P 3M 5P 7m 9M 13M", "dominant thirteenth", "13"],
  ["1P 3M 5P 7m 11A", "lydian dominant seventh", "7#11 7#4"],
  // '''Altered'''
  ["1P 3M 5P 7m 9m", "dominant flat ninth", "7b9"],
  ["1P 3M 5P 7m 9A", "dominant sharp ninth", "7#9"],
  ["1P 3M 7m 9m", "altered", "alt7"],
  // '''Suspended'''
  ["1P 4P 5P", "suspended fourth", "sus4 sus"],
  ["1P 2M 5P", "suspended second", "sus2"],
  ["1P 4P 5P 7m", "suspended fourth seventh", "7sus4 7sus"],
  ["1P 5P 7m 9M 11P", "eleventh", "11"],
  [
    "1P 4P 5P 7m 9m",
    "suspended fourth flat ninth",
    "b9sus phryg 7b9sus 7b9sus4"
  ],
  // ==Other==
  ["1P 5P", "fifth", "5"],
  ["1P 3M 5A", "augmented", "aug + +5 ^#5"],
  ["1P 3m 5A", "minor augmented", "m#5 -#5 m+"],
  ["1P 3M 5A 7M", "augmented seventh", "maj7#5 maj7+5 +maj7 ^7#5"],
  [
    "1P 3M 5P 7M 9M 11A",
    "major sharp eleventh (lydian)",
    "maj9#11 \u03949#11 ^9#11"
  ],
  // ==Legacy==
  ["1P 2M 4P 5P", "", "sus24 sus4add9"],
  ["1P 3M 5A 7M 9M", "", "maj9#5 Maj9#5"],
  ["1P 3M 5A 7m", "", "7#5 +7 7+ 7aug aug7"],
  ["1P 3M 5A 7m 9A", "", "7#5#9 7#9#5 7alt"],
  ["1P 3M 5A 7m 9M", "", "9#5 9+"],
  ["1P 3M 5A 7m 9M 11A", "", "9#5#11"],
  ["1P 3M 5A 7m 9m", "", "7#5b9 7b9#5"],
  ["1P 3M 5A 7m 9m 11A", "", "7#5b9#11"],
  ["1P 3M 5A 9A", "", "+add#9"],
  ["1P 3M 5A 9M", "", "M#5add9 +add9"],
  ["1P 3M 5P 6M 11A", "", "M6#11 M6b5 6#11 6b5"],
  ["1P 3M 5P 6M 7M 9M", "", "M7add13"],
  ["1P 3M 5P 6M 9M 11A", "", "69#11"],
  ["1P 3m 5P 6M 9M", "", "m69 -69"],
  ["1P 3M 5P 6m 7m", "", "7b6"],
  ["1P 3M 5P 7M 9A 11A", "", "maj7#9#11"],
  ["1P 3M 5P 7M 9M 11A 13M", "", "M13#11 maj13#11 M13+4 M13#4"],
  ["1P 3M 5P 7M 9m", "", "M7b9"],
  ["1P 3M 5P 7m 11A 13m", "", "7#11b13 7b5b13"],
  ["1P 3M 5P 7m 13M", "", "7add6 67 7add13"],
  ["1P 3M 5P 7m 9A 11A", "", "7#9#11 7b5#9 7#9b5"],
  ["1P 3M 5P 7m 9A 11A 13M", "", "13#9#11"],
  ["1P 3M 5P 7m 9A 11A 13m", "", "7#9#11b13"],
  ["1P 3M 5P 7m 9A 13M", "", "13#9"],
  ["1P 3M 5P 7m 9A 13m", "", "7#9b13"],
  ["1P 3M 5P 7m 9M 11A", "", "9#11 9+4 9#4"],
  ["1P 3M 5P 7m 9M 11A 13M", "", "13#11 13+4 13#4"],
  ["1P 3M 5P 7m 9M 11A 13m", "", "9#11b13 9b5b13"],
  ["1P 3M 5P 7m 9m 11A", "", "7b9#11 7b5b9 7b9b5"],
  ["1P 3M 5P 7m 9m 11A 13M", "", "13b9#11"],
  ["1P 3M 5P 7m 9m 11A 13m", "", "7b9b13#11 7b9#11b13 7b5b9b13"],
  ["1P 3M 5P 7m 9m 13M", "", "13b9"],
  ["1P 3M 5P 7m 9m 13m", "", "7b9b13"],
  ["1P 3M 5P 7m 9m 9A", "", "7b9#9"],
  ["1P 3M 5P 9M", "", "Madd9 2 add9 add2"],
  ["1P 3M 5P 9m", "", "Maddb9"],
  ["1P 3M 5d", "", "Mb5"],
  ["1P 3M 5d 6M 7m 9M", "", "13b5"],
  ["1P 3M 5d 7M", "", "M7b5"],
  ["1P 3M 5d 7M 9M", "", "M9b5"],
  ["1P 3M 5d 7m", "", "7b5"],
  ["1P 3M 5d 7m 9M", "", "9b5"],
  ["1P 3M 7m", "", "7no5"],
  ["1P 3M 7m 13m", "", "7b13"],
  ["1P 3M 7m 9M", "", "9no5"],
  ["1P 3M 7m 9M 13M", "", "13no5"],
  ["1P 3M 7m 9M 13m", "", "9b13"],
  ["1P 3m 4P 5P", "", "madd4"],
  ["1P 3m 5P 6m 7M", "", "mMaj7b6"],
  ["1P 3m 5P 6m 7M 9M", "", "mMaj9b6"],
  ["1P 3m 5P 7m 11P", "", "m7add11 m7add4"],
  ["1P 3m 5P 9M", "", "madd9"],
  ["1P 3m 5d 6M 7M", "", "o7M7"],
  ["1P 3m 5d 7M", "", "oM7"],
  ["1P 3m 6m 7M", "", "mb6M7"],
  ["1P 3m 6m 7m", "", "m7#5"],
  ["1P 3m 6m 7m 9M", "", "m9#5"],
  ["1P 3m 5A 7m 9M 11P", "", "m11A"],
  ["1P 3m 6m 9m", "", "mb6b9"],
  ["1P 2M 3m 5d 7m", "", "m9b5"],
  ["1P 4P 5A 7M", "", "M7#5sus4"],
  ["1P 4P 5A 7M 9M", "", "M9#5sus4"],
  ["1P 4P 5A 7m", "", "7#5sus4"],
  ["1P 4P 5P 7M", "", "M7sus4"],
  ["1P 4P 5P 7M 9M", "", "M9sus4"],
  ["1P 4P 5P 7m 9M", "", "9sus4 9sus"],
  ["1P 4P 5P 7m 9M 13M", "", "13sus4 13sus"],
  ["1P 4P 5P 7m 9m 13m", "", "7sus4b9b13 7b9b13sus4"],
  ["1P 4P 7m 10m", "", "4 quartal"],
  ["1P 5P 7m 9m 11P", "", "11b9"]
];
var data_default = CHORDS;

// index.ts
var NoChordType = {
  ..._tonaljs_pcset__WEBPACK_IMPORTED_MODULE_0__.EmptyPcset,
  name: "",
  quality: "Unknown",
  intervals: [],
  aliases: []
};
var dictionary = [];
var index = {};
function get(type) {
  return index[type] || NoChordType;
}
var chordType = get;
function names() {
  return dictionary.map((chord) => chord.name).filter((x) => x);
}
function symbols() {
  return dictionary.map((chord) => chord.aliases[0]).filter((x) => x);
}
function keys() {
  return Object.keys(index);
}
function all() {
  return dictionary.slice();
}
var entries = all;
function removeAll() {
  dictionary = [];
  index = {};
}
function add(intervals, aliases, fullName) {
  const quality = getQuality(intervals);
  const chord = {
    ...(0,_tonaljs_pcset__WEBPACK_IMPORTED_MODULE_0__.get)(intervals),
    name: fullName || "",
    quality,
    intervals,
    aliases
  };
  dictionary.push(chord);
  if (chord.name) {
    index[chord.name] = chord;
  }
  index[chord.setNum] = chord;
  index[chord.chroma] = chord;
  chord.aliases.forEach((alias) => addAlias(chord, alias));
}
function addAlias(chord, alias) {
  index[alias] = chord;
}
function getQuality(intervals) {
  const has = (interval) => intervals.indexOf(interval) !== -1;
  return has("5A") ? "Augmented" : has("3M") ? "Major" : has("5d") ? "Diminished" : has("3m") ? "Minor" : "Unknown";
}
data_default.forEach(
  ([ivls, fullName, names2]) => add(ivls.split(" "), names2.split(" "), fullName)
);
dictionary.sort((a, b) => a.setNum - b.setNum);
var chord_type_default = {
  names,
  symbols,
  get,
  all,
  add,
  removeAll,
  keys,
  // deprecated
  entries,
  chordType
};

//# sourceMappingURL=index.mjs.map

/***/ }),

/***/ "./node_modules/@tonaljs/chord/dist/index.mjs":
/*!****************************************************!*\
  !*** ./node_modules/@tonaljs/chord/dist/index.mjs ***!
  \****************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   chord: () => (/* binding */ chord),
/* harmony export */   chordScales: () => (/* binding */ chordScales),
/* harmony export */   "default": () => (/* binding */ chord_default),
/* harmony export */   degrees: () => (/* binding */ degrees),
/* harmony export */   detect: () => (/* reexport safe */ _tonaljs_chord_detect__WEBPACK_IMPORTED_MODULE_0__.detect),
/* harmony export */   extended: () => (/* binding */ extended),
/* harmony export */   get: () => (/* binding */ get),
/* harmony export */   getChord: () => (/* binding */ getChord),
/* harmony export */   notes: () => (/* binding */ notes),
/* harmony export */   reduced: () => (/* binding */ reduced),
/* harmony export */   steps: () => (/* binding */ steps),
/* harmony export */   tokenize: () => (/* binding */ tokenize),
/* harmony export */   transpose: () => (/* binding */ transpose)
/* harmony export */ });
/* harmony import */ var _tonaljs_chord_detect__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @tonaljs/chord-detect */ "./node_modules/@tonaljs/chord-detect/dist/index.mjs");
/* harmony import */ var _tonaljs_chord_type__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @tonaljs/chord-type */ "./node_modules/@tonaljs/chord-type/dist/index.mjs");
/* harmony import */ var _tonaljs_interval__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @tonaljs/interval */ "./node_modules/@tonaljs/interval/dist/index.mjs");
/* harmony import */ var _tonaljs_pcset__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @tonaljs/pcset */ "./node_modules/@tonaljs/pcset/dist/index.mjs");
/* harmony import */ var _tonaljs_pitch_distance__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @tonaljs/pitch-distance */ "./node_modules/@tonaljs/pitch-distance/dist/index.mjs");
/* harmony import */ var _tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @tonaljs/pitch-note */ "./node_modules/@tonaljs/pitch-note/dist/index.mjs");
/* harmony import */ var _tonaljs_scale_type__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @tonaljs/scale-type */ "./node_modules/@tonaljs/scale-type/dist/index.mjs");
// index.ts








var NoChord = {
  empty: true,
  name: "",
  symbol: "",
  root: "",
  bass: "",
  rootDegree: 0,
  type: "",
  tonic: null,
  setNum: NaN,
  quality: "Unknown",
  chroma: "",
  normalized: "",
  aliases: [],
  notes: [],
  intervals: []
};
function tokenize(name) {
  const [letter, acc, oct, type] = (0,_tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_5__.tokenizeNote)(name);
  if (letter === "") {
    return tokenizeBass("", name);
  } else if (letter === "A" && type === "ug") {
    return tokenizeBass("", "aug");
  } else {
    return tokenizeBass(letter + acc, oct + type);
  }
}
function tokenizeBass(note2, chord2) {
  const split = chord2.split("/");
  if (split.length === 1) {
    return [note2, split[0], ""];
  }
  const [letter, acc, oct, type] = (0,_tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_5__.tokenizeNote)(split[1]);
  if (letter !== "" && oct === "" && type === "") {
    return [note2, split[0], letter + acc];
  } else {
    return [note2, chord2, ""];
  }
}
function get(src) {
  if (Array.isArray(src)) {
    return getChord(src[1] || "", src[0], src[2]);
  } else if (src === "") {
    return NoChord;
  } else {
    const [tonic, type, bass] = tokenize(src);
    const chord2 = getChord(type, tonic, bass);
    return chord2.empty ? getChord(src) : chord2;
  }
}
function getChord(typeName, optionalTonic, optionalBass) {
  const type = (0,_tonaljs_chord_type__WEBPACK_IMPORTED_MODULE_1__.get)(typeName);
  const tonic = (0,_tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_5__.note)(optionalTonic || "");
  const bass = (0,_tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_5__.note)(optionalBass || "");
  if (type.empty || optionalTonic && tonic.empty || optionalBass && bass.empty) {
    return NoChord;
  }
  const bassInterval = (0,_tonaljs_pitch_distance__WEBPACK_IMPORTED_MODULE_4__.distance)(tonic.pc, bass.pc);
  const bassIndex = type.intervals.indexOf(bassInterval);
  const hasRoot = bassIndex >= 0;
  const root = hasRoot ? bass : (0,_tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_5__.note)("");
  const rootDegree = bassIndex === -1 ? NaN : bassIndex + 1;
  const hasBass = bass.pc && bass.pc !== tonic.pc;
  const intervals = Array.from(type.intervals);
  if (hasRoot) {
    for (let i = 1; i < rootDegree; i++) {
      const num = intervals[0][0];
      const quality = intervals[0][1];
      const newNum = parseInt(num, 10) + 7;
      intervals.push(`${newNum}${quality}`);
      intervals.shift();
    }
  } else if (hasBass) {
    const ivl = (0,_tonaljs_interval__WEBPACK_IMPORTED_MODULE_2__.subtract)((0,_tonaljs_pitch_distance__WEBPACK_IMPORTED_MODULE_4__.distance)(tonic.pc, bass.pc), "8P");
    if (ivl) intervals.unshift(ivl);
  }
  const notes2 = tonic.empty ? [] : intervals.map((i) => (0,_tonaljs_pitch_distance__WEBPACK_IMPORTED_MODULE_4__.transpose)(tonic.pc, i));
  typeName = type.aliases.indexOf(typeName) !== -1 ? typeName : type.aliases[0];
  const symbol = `${tonic.empty ? "" : tonic.pc}${typeName}${hasRoot && rootDegree > 1 ? "/" + root.pc : hasBass ? "/" + bass.pc : ""}`;
  const name = `${optionalTonic ? tonic.pc + " " : ""}${type.name}${hasRoot && rootDegree > 1 ? " over " + root.pc : hasBass ? " over " + bass.pc : ""}`;
  return {
    ...type,
    name,
    symbol,
    tonic: tonic.pc,
    type: type.name,
    root: root.pc,
    bass: hasBass ? bass.pc : "",
    intervals,
    rootDegree,
    notes: notes2
  };
}
var chord = get;
function transpose(chordName, interval) {
  const [tonic, type, bass] = tokenize(chordName);
  if (!tonic) {
    return chordName;
  }
  const tr = (0,_tonaljs_pitch_distance__WEBPACK_IMPORTED_MODULE_4__.transpose)(bass, interval);
  const slash = tr ? "/" + tr : "";
  return (0,_tonaljs_pitch_distance__WEBPACK_IMPORTED_MODULE_4__.transpose)(tonic, interval) + type + slash;
}
function chordScales(name) {
  const s = get(name);
  const isChordIncluded = (0,_tonaljs_pcset__WEBPACK_IMPORTED_MODULE_3__.isSupersetOf)(s.chroma);
  return (0,_tonaljs_scale_type__WEBPACK_IMPORTED_MODULE_6__.all)().filter((scale) => isChordIncluded(scale.chroma)).map((scale) => scale.name);
}
function extended(chordName) {
  const s = get(chordName);
  const isSuperset = (0,_tonaljs_pcset__WEBPACK_IMPORTED_MODULE_3__.isSupersetOf)(s.chroma);
  return (0,_tonaljs_chord_type__WEBPACK_IMPORTED_MODULE_1__.all)().filter((chord2) => isSuperset(chord2.chroma)).map((chord2) => s.tonic + chord2.aliases[0]);
}
function reduced(chordName) {
  const s = get(chordName);
  const isSubset = (0,_tonaljs_pcset__WEBPACK_IMPORTED_MODULE_3__.isSubsetOf)(s.chroma);
  return (0,_tonaljs_chord_type__WEBPACK_IMPORTED_MODULE_1__.all)().filter((chord2) => isSubset(chord2.chroma)).map((chord2) => s.tonic + chord2.aliases[0]);
}
function notes(chordName, tonic) {
  const chord2 = get(chordName);
  const note2 = tonic || chord2.tonic;
  if (!note2 || chord2.empty) return [];
  return chord2.intervals.map((ivl) => (0,_tonaljs_pitch_distance__WEBPACK_IMPORTED_MODULE_4__.transpose)(note2, ivl));
}
function degrees(chordName, tonic) {
  const chord2 = get(chordName);
  const note2 = tonic || chord2.tonic;
  const transpose2 = (0,_tonaljs_pitch_distance__WEBPACK_IMPORTED_MODULE_4__.tonicIntervalsTransposer)(chord2.intervals, note2);
  return (degree) => degree ? transpose2(degree > 0 ? degree - 1 : degree) : "";
}
function steps(chordName, tonic) {
  const chord2 = get(chordName);
  const note2 = tonic || chord2.tonic;
  return (0,_tonaljs_pitch_distance__WEBPACK_IMPORTED_MODULE_4__.tonicIntervalsTransposer)(chord2.intervals, note2);
}
var chord_default = {
  getChord,
  get,
  detect: _tonaljs_chord_detect__WEBPACK_IMPORTED_MODULE_0__.detect,
  chordScales,
  extended,
  reduced,
  tokenize,
  transpose,
  degrees,
  steps,
  notes,
  chord
};

//# sourceMappingURL=index.mjs.map

/***/ }),

/***/ "./node_modules/@tonaljs/collection/dist/index.mjs":
/*!*********************************************************!*\
  !*** ./node_modules/@tonaljs/collection/dist/index.mjs ***!
  \*********************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   compact: () => (/* binding */ compact),
/* harmony export */   "default": () => (/* binding */ collection_default),
/* harmony export */   permutations: () => (/* binding */ permutations),
/* harmony export */   range: () => (/* binding */ range),
/* harmony export */   rotate: () => (/* binding */ rotate),
/* harmony export */   shuffle: () => (/* binding */ shuffle)
/* harmony export */ });
// index.ts
function ascR(b, n) {
  const a = [];
  for (; n--; a[n] = n + b) ;
  return a;
}
function descR(b, n) {
  const a = [];
  for (; n--; a[n] = b - n) ;
  return a;
}
function range(from, to) {
  return from < to ? ascR(from, to - from + 1) : descR(from, from - to + 1);
}
function rotate(times, arr) {
  const len = arr.length;
  const n = (times % len + len) % len;
  return arr.slice(n, len).concat(arr.slice(0, n));
}
function compact(arr) {
  return arr.filter((n) => n === 0 || n);
}
function shuffle(arr, rnd = Math.random) {
  let i;
  let t;
  let m = arr.length;
  while (m) {
    i = Math.floor(rnd() * m--);
    t = arr[m];
    arr[m] = arr[i];
    arr[i] = t;
  }
  return arr;
}
function permutations(arr) {
  if (arr.length === 0) {
    return [[]];
  }
  return permutations(arr.slice(1)).reduce((acc, perm) => {
    return acc.concat(
      arr.map((e, pos) => {
        const newPerm = perm.slice();
        newPerm.splice(pos, 0, arr[0]);
        return newPerm;
      })
    );
  }, []);
}
var collection_default = {
  compact,
  permutations,
  range,
  rotate,
  shuffle
};

//# sourceMappingURL=index.mjs.map

/***/ }),

/***/ "./node_modules/@tonaljs/core/dist/index.mjs":
/*!***************************************************!*\
  !*** ./node_modules/@tonaljs/core/dist/index.mjs ***!
  \***************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   accToAlt: () => (/* reexport safe */ _tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_3__.accToAlt),
/* harmony export */   altToAcc: () => (/* reexport safe */ _tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_3__.altToAcc),
/* harmony export */   chroma: () => (/* reexport safe */ _tonaljs_pitch__WEBPACK_IMPORTED_MODULE_0__.chroma),
/* harmony export */   coordToInterval: () => (/* reexport safe */ _tonaljs_pitch_interval__WEBPACK_IMPORTED_MODULE_2__.coordToInterval),
/* harmony export */   coordToNote: () => (/* reexport safe */ _tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_3__.coordToNote),
/* harmony export */   coordinates: () => (/* reexport safe */ _tonaljs_pitch__WEBPACK_IMPORTED_MODULE_0__.coordinates),
/* harmony export */   deprecate: () => (/* binding */ deprecate),
/* harmony export */   distance: () => (/* reexport safe */ _tonaljs_pitch_distance__WEBPACK_IMPORTED_MODULE_1__.distance),
/* harmony export */   fillStr: () => (/* binding */ fillStr),
/* harmony export */   height: () => (/* reexport safe */ _tonaljs_pitch__WEBPACK_IMPORTED_MODULE_0__.height),
/* harmony export */   interval: () => (/* reexport safe */ _tonaljs_pitch_interval__WEBPACK_IMPORTED_MODULE_2__.interval),
/* harmony export */   isNamed: () => (/* binding */ isNamed),
/* harmony export */   isNamedPitch: () => (/* reexport safe */ _tonaljs_pitch__WEBPACK_IMPORTED_MODULE_0__.isNamedPitch),
/* harmony export */   isPitch: () => (/* reexport safe */ _tonaljs_pitch__WEBPACK_IMPORTED_MODULE_0__.isPitch),
/* harmony export */   midi: () => (/* reexport safe */ _tonaljs_pitch__WEBPACK_IMPORTED_MODULE_0__.midi),
/* harmony export */   note: () => (/* reexport safe */ _tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_3__.note),
/* harmony export */   pitch: () => (/* reexport safe */ _tonaljs_pitch__WEBPACK_IMPORTED_MODULE_0__.pitch),
/* harmony export */   stepToLetter: () => (/* reexport safe */ _tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_3__.stepToLetter),
/* harmony export */   tokenizeInterval: () => (/* reexport safe */ _tonaljs_pitch_interval__WEBPACK_IMPORTED_MODULE_2__.tokenizeInterval),
/* harmony export */   tokenizeNote: () => (/* reexport safe */ _tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_3__.tokenizeNote),
/* harmony export */   tonicIntervalsTransposer: () => (/* reexport safe */ _tonaljs_pitch_distance__WEBPACK_IMPORTED_MODULE_1__.tonicIntervalsTransposer),
/* harmony export */   transpose: () => (/* reexport safe */ _tonaljs_pitch_distance__WEBPACK_IMPORTED_MODULE_1__.transpose)
/* harmony export */ });
/* harmony import */ var _tonaljs_pitch__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @tonaljs/pitch */ "./node_modules/@tonaljs/pitch/dist/index.mjs");
/* harmony import */ var _tonaljs_pitch_distance__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @tonaljs/pitch-distance */ "./node_modules/@tonaljs/pitch-distance/dist/index.mjs");
/* harmony import */ var _tonaljs_pitch_interval__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @tonaljs/pitch-interval */ "./node_modules/@tonaljs/pitch-interval/dist/index.mjs");
/* harmony import */ var _tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @tonaljs/pitch-note */ "./node_modules/@tonaljs/pitch-note/dist/index.mjs");
// index.ts





var fillStr = (s, n) => Array(Math.abs(n) + 1).join(s);
function deprecate(original, alternative, fn) {
  return function(...args) {
    console.warn(`${original} is deprecated. Use ${alternative}.`);
    return fn.apply(this, args);
  };
}
var isNamed = deprecate("isNamed", "isNamedPitch", _tonaljs_pitch__WEBPACK_IMPORTED_MODULE_0__.isNamedPitch);

//# sourceMappingURL=index.mjs.map

/***/ }),

/***/ "./node_modules/@tonaljs/duration-value/dist/index.mjs":
/*!*************************************************************!*\
  !*** ./node_modules/@tonaljs/duration-value/dist/index.mjs ***!
  \*************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ duration_value_default),
/* harmony export */   fraction: () => (/* binding */ fraction),
/* harmony export */   get: () => (/* binding */ get),
/* harmony export */   names: () => (/* binding */ names),
/* harmony export */   shorthands: () => (/* binding */ shorthands),
/* harmony export */   value: () => (/* binding */ value)
/* harmony export */ });
// data.ts
var DATA = [
  [
    0.125,
    "dl",
    ["large", "duplex longa", "maxima", "octuple", "octuple whole"]
  ],
  [0.25, "l", ["long", "longa"]],
  [0.5, "d", ["double whole", "double", "breve"]],
  [1, "w", ["whole", "semibreve"]],
  [2, "h", ["half", "minim"]],
  [4, "q", ["quarter", "crotchet"]],
  [8, "e", ["eighth", "quaver"]],
  [16, "s", ["sixteenth", "semiquaver"]],
  [32, "t", ["thirty-second", "demisemiquaver"]],
  [64, "sf", ["sixty-fourth", "hemidemisemiquaver"]],
  [128, "h", ["hundred twenty-eighth"]],
  [256, "th", ["two hundred fifty-sixth"]]
];
var data_default = DATA;

// index.ts
var VALUES = [];
data_default.forEach(
  ([denominator, shorthand, names2]) => add(denominator, shorthand, names2)
);
var NoDuration = {
  empty: true,
  name: "",
  value: 0,
  fraction: [0, 0],
  shorthand: "",
  dots: "",
  names: []
};
function names() {
  return VALUES.reduce((names2, duration) => {
    duration.names.forEach((name) => names2.push(name));
    return names2;
  }, []);
}
function shorthands() {
  return VALUES.map((dur) => dur.shorthand);
}
var REGEX = /^([^.]+)(\.*)$/;
function get(name) {
  const [_, simple, dots] = REGEX.exec(name) || [];
  const base = VALUES.find(
    (dur) => dur.shorthand === simple || dur.names.includes(simple)
  );
  if (!base) {
    return NoDuration;
  }
  const fraction2 = calcDots(base.fraction, dots.length);
  const value2 = fraction2[0] / fraction2[1];
  return { ...base, name, dots, value: value2, fraction: fraction2 };
}
var value = (name) => get(name).value;
var fraction = (name) => get(name).fraction;
var duration_value_default = { names, shorthands, get, value, fraction };
function add(denominator, shorthand, names2) {
  VALUES.push({
    empty: false,
    dots: "",
    name: "",
    value: 1 / denominator,
    fraction: denominator < 1 ? [1 / denominator, 1] : [1, denominator],
    shorthand,
    names: names2
  });
}
function calcDots(fraction2, dots) {
  const pow = Math.pow(2, dots);
  let numerator = fraction2[0] * pow;
  let denominator = fraction2[1] * pow;
  const base = numerator;
  for (let i = 0; i < dots; i++) {
    numerator += base / Math.pow(2, i + 1);
  }
  while (numerator % 2 === 0 && denominator % 2 === 0) {
    numerator /= 2;
    denominator /= 2;
  }
  return [numerator, denominator];
}

//# sourceMappingURL=index.mjs.map

/***/ }),

/***/ "./node_modules/@tonaljs/interval/dist/index.mjs":
/*!*******************************************************!*\
  !*** ./node_modules/@tonaljs/interval/dist/index.mjs ***!
  \*******************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   add: () => (/* binding */ add),
/* harmony export */   addTo: () => (/* binding */ addTo),
/* harmony export */   "default": () => (/* binding */ interval_default),
/* harmony export */   distance: () => (/* binding */ distance),
/* harmony export */   fromSemitones: () => (/* binding */ fromSemitones),
/* harmony export */   get: () => (/* binding */ get),
/* harmony export */   invert: () => (/* binding */ invert),
/* harmony export */   name: () => (/* binding */ name),
/* harmony export */   names: () => (/* binding */ names),
/* harmony export */   num: () => (/* binding */ num),
/* harmony export */   quality: () => (/* binding */ quality),
/* harmony export */   semitones: () => (/* binding */ semitones),
/* harmony export */   simplify: () => (/* binding */ simplify),
/* harmony export */   subtract: () => (/* binding */ subtract),
/* harmony export */   transposeFifths: () => (/* binding */ transposeFifths)
/* harmony export */ });
/* harmony import */ var _tonaljs_pitch_distance__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @tonaljs/pitch-distance */ "./node_modules/@tonaljs/pitch-distance/dist/index.mjs");
/* harmony import */ var _tonaljs_pitch_interval__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @tonaljs/pitch-interval */ "./node_modules/@tonaljs/pitch-interval/dist/index.mjs");
// index.ts


function names() {
  return "1P 2M 3M 4P 5P 6m 7m".split(" ");
}
var get = _tonaljs_pitch_interval__WEBPACK_IMPORTED_MODULE_1__.interval;
var name = (name2) => (0,_tonaljs_pitch_interval__WEBPACK_IMPORTED_MODULE_1__.interval)(name2).name;
var semitones = (name2) => (0,_tonaljs_pitch_interval__WEBPACK_IMPORTED_MODULE_1__.interval)(name2).semitones;
var quality = (name2) => (0,_tonaljs_pitch_interval__WEBPACK_IMPORTED_MODULE_1__.interval)(name2).q;
var num = (name2) => (0,_tonaljs_pitch_interval__WEBPACK_IMPORTED_MODULE_1__.interval)(name2).num;
function simplify(name2) {
  const i = (0,_tonaljs_pitch_interval__WEBPACK_IMPORTED_MODULE_1__.interval)(name2);
  return i.empty ? "" : i.simple + i.q;
}
function invert(name2) {
  const i = (0,_tonaljs_pitch_interval__WEBPACK_IMPORTED_MODULE_1__.interval)(name2);
  if (i.empty) {
    return "";
  }
  const step = (7 - i.step) % 7;
  const alt = i.type === "perfectable" ? -i.alt : -(i.alt + 1);
  return (0,_tonaljs_pitch_interval__WEBPACK_IMPORTED_MODULE_1__.interval)({ step, alt, oct: i.oct, dir: i.dir }).name;
}
var IN = [1, 2, 2, 3, 3, 4, 5, 5, 6, 6, 7, 7];
var IQ = "P m M m M P d P m M m M".split(" ");
function fromSemitones(semitones2) {
  const d = semitones2 < 0 ? -1 : 1;
  const n = Math.abs(semitones2);
  const c = n % 12;
  const o = Math.floor(n / 12);
  return d * (IN[c] + 7 * o) + IQ[c];
}
var distance = _tonaljs_pitch_distance__WEBPACK_IMPORTED_MODULE_0__.distance;
var add = combinator((a, b) => [a[0] + b[0], a[1] + b[1]]);
var addTo = (interval) => (other) => add(interval, other);
var subtract = combinator((a, b) => [a[0] - b[0], a[1] - b[1]]);
function transposeFifths(interval, fifths) {
  const ivl = get(interval);
  if (ivl.empty) return "";
  const [nFifths, nOcts, dir] = ivl.coord;
  return (0,_tonaljs_pitch_interval__WEBPACK_IMPORTED_MODULE_1__.coordToInterval)([nFifths + fifths, nOcts, dir]).name;
}
var interval_default = {
  names,
  get,
  name,
  num,
  semitones,
  quality,
  fromSemitones,
  distance,
  invert,
  simplify,
  add,
  addTo,
  subtract,
  transposeFifths
};
function combinator(fn) {
  return (a, b) => {
    const coordA = (0,_tonaljs_pitch_interval__WEBPACK_IMPORTED_MODULE_1__.interval)(a).coord;
    const coordB = (0,_tonaljs_pitch_interval__WEBPACK_IMPORTED_MODULE_1__.interval)(b).coord;
    if (coordA && coordB) {
      const coord = fn(coordA, coordB);
      return (0,_tonaljs_pitch_interval__WEBPACK_IMPORTED_MODULE_1__.coordToInterval)(coord).name;
    }
  };
}

//# sourceMappingURL=index.mjs.map

/***/ }),

/***/ "./node_modules/@tonaljs/key/dist/index.mjs":
/*!**************************************************!*\
  !*** ./node_modules/@tonaljs/key/dist/index.mjs ***!
  \**************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ key_default),
/* harmony export */   majorKey: () => (/* binding */ majorKey),
/* harmony export */   majorTonicFromKeySignature: () => (/* binding */ majorTonicFromKeySignature),
/* harmony export */   minorKey: () => (/* binding */ minorKey)
/* harmony export */ });
/* harmony import */ var _tonaljs_note__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @tonaljs/note */ "./node_modules/@tonaljs/note/dist/index.mjs");
/* harmony import */ var _tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @tonaljs/pitch-note */ "./node_modules/@tonaljs/pitch-note/dist/index.mjs");
/* harmony import */ var _tonaljs_roman_numeral__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @tonaljs/roman-numeral */ "./node_modules/@tonaljs/roman-numeral/dist/index.mjs");
// index.ts



var Empty = Object.freeze([]);
var NoKey = {
  type: "major",
  tonic: "",
  alteration: 0,
  keySignature: ""
};
var NoKeyScale = {
  tonic: "",
  grades: Empty,
  intervals: Empty,
  scale: Empty,
  triads: Empty,
  chords: Empty,
  chordsHarmonicFunction: Empty,
  chordScales: Empty
};
var NoMajorKey = {
  ...NoKey,
  ...NoKeyScale,
  type: "major",
  minorRelative: "",
  scale: Empty,
  secondaryDominants: Empty,
  secondaryDominantsMinorRelative: Empty,
  substituteDominants: Empty,
  substituteDominantsMinorRelative: Empty
};
var NoMinorKey = {
  ...NoKey,
  type: "minor",
  relativeMajor: "",
  natural: NoKeyScale,
  harmonic: NoKeyScale,
  melodic: NoKeyScale
};
var mapScaleToType = (scale, list, sep = "") => list.map((type, i) => `${scale[i]}${sep}${type}`);
function keyScale(grades, triads, chords, harmonicFunctions, chordScales) {
  return (tonic) => {
    const intervals = grades.map((gr) => (0,_tonaljs_roman_numeral__WEBPACK_IMPORTED_MODULE_2__.get)(gr).interval || "");
    const scale = intervals.map((interval) => (0,_tonaljs_note__WEBPACK_IMPORTED_MODULE_0__.transpose)(tonic, interval));
    return {
      tonic,
      grades,
      intervals,
      scale,
      triads: mapScaleToType(scale, triads),
      chords: mapScaleToType(scale, chords),
      chordsHarmonicFunction: harmonicFunctions.slice(),
      chordScales: mapScaleToType(scale, chordScales, " ")
    };
  };
}
var distInFifths = (from, to) => {
  const f = (0,_tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_1__.note)(from);
  const t = (0,_tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_1__.note)(to);
  return f.empty || t.empty ? 0 : t.coord[0] - f.coord[0];
};
var MajorScale = keyScale(
  "I II III IV V VI VII".split(" "),
  " m m   m dim".split(" "),
  "maj7 m7 m7 maj7 7 m7 m7b5".split(" "),
  "T SD T SD D T D".split(" "),
  "major,dorian,phrygian,lydian,mixolydian,minor,locrian".split(",")
);
var NaturalScale = keyScale(
  "I II bIII IV V bVI bVII".split(" "),
  "m dim  m m  ".split(" "),
  "m7 m7b5 maj7 m7 m7 maj7 7".split(" "),
  "T SD T SD D SD SD".split(" "),
  "minor,locrian,major,dorian,phrygian,lydian,mixolydian".split(",")
);
var HarmonicScale = keyScale(
  "I II bIII IV V bVI VII".split(" "),
  "m dim aug m   dim".split(" "),
  "mMaj7 m7b5 +maj7 m7 7 maj7 o7".split(" "),
  "T SD T SD D SD D".split(" "),
  "harmonic minor,locrian 6,major augmented,lydian diminished,phrygian dominant,lydian #9,ultralocrian".split(
    ","
  )
);
var MelodicScale = keyScale(
  "I II bIII IV V VI VII".split(" "),
  "m m aug   dim dim".split(" "),
  "m6 m7 +maj7 7 7 m7b5 m7b5".split(" "),
  "T SD T SD D  ".split(" "),
  "melodic minor,dorian b2,lydian augmented,lydian dominant,mixolydian b6,locrian #2,altered".split(
    ","
  )
);
function majorKey(tonic) {
  const pc = (0,_tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_1__.note)(tonic).pc;
  if (!pc) return NoMajorKey;
  const keyScale2 = MajorScale(pc);
  const alteration = distInFifths("C", pc);
  const romanInTonic = (src) => {
    const r = (0,_tonaljs_roman_numeral__WEBPACK_IMPORTED_MODULE_2__.get)(src);
    if (r.empty) return "";
    return (0,_tonaljs_note__WEBPACK_IMPORTED_MODULE_0__.transpose)(tonic, r.interval) + r.chordType;
  };
  return {
    ...keyScale2,
    type: "major",
    minorRelative: (0,_tonaljs_note__WEBPACK_IMPORTED_MODULE_0__.transpose)(pc, "-3m"),
    alteration,
    keySignature: (0,_tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_1__.altToAcc)(alteration),
    secondaryDominants: "- VI7 VII7 I7 II7 III7 -".split(" ").map(romanInTonic),
    secondaryDominantsMinorRelative: "- IIIm7b5 IV#m7 Vm7 VIm7 VIIm7b5 -".split(" ").map(romanInTonic),
    substituteDominants: "- bIII7 IV7 bV7 bVI7 bVII7 -".split(" ").map(romanInTonic),
    substituteDominantsMinorRelative: "- IIIm7 Im7 IIbm7 VIm7 IVm7 -".split(" ").map(romanInTonic)
  };
}
function minorKey(tnc) {
  const pc = (0,_tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_1__.note)(tnc).pc;
  if (!pc) return NoMinorKey;
  const alteration = distInFifths("C", pc) - 3;
  return {
    type: "minor",
    tonic: pc,
    relativeMajor: (0,_tonaljs_note__WEBPACK_IMPORTED_MODULE_0__.transpose)(pc, "3m"),
    alteration,
    keySignature: (0,_tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_1__.altToAcc)(alteration),
    natural: NaturalScale(pc),
    harmonic: HarmonicScale(pc),
    melodic: MelodicScale(pc)
  };
}
function majorTonicFromKeySignature(sig) {
  if (typeof sig === "number") {
    return (0,_tonaljs_note__WEBPACK_IMPORTED_MODULE_0__.transposeFifths)("C", sig);
  } else if (typeof sig === "string" && /^b+|#+$/.test(sig)) {
    return (0,_tonaljs_note__WEBPACK_IMPORTED_MODULE_0__.transposeFifths)("C", (0,_tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_1__.accToAlt)(sig));
  }
  return null;
}
var key_default = { majorKey, majorTonicFromKeySignature, minorKey };

//# sourceMappingURL=index.mjs.map

/***/ }),

/***/ "./node_modules/@tonaljs/midi/dist/index.mjs":
/*!***************************************************!*\
  !*** ./node_modules/@tonaljs/midi/dist/index.mjs ***!
  \***************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   chroma: () => (/* binding */ chroma),
/* harmony export */   "default": () => (/* binding */ midi_default),
/* harmony export */   freqToMidi: () => (/* binding */ freqToMidi),
/* harmony export */   isMidi: () => (/* binding */ isMidi),
/* harmony export */   midiToFreq: () => (/* binding */ midiToFreq),
/* harmony export */   midiToNoteName: () => (/* binding */ midiToNoteName),
/* harmony export */   pcset: () => (/* binding */ pcset),
/* harmony export */   pcsetDegrees: () => (/* binding */ pcsetDegrees),
/* harmony export */   pcsetNearest: () => (/* binding */ pcsetNearest),
/* harmony export */   pcsetSteps: () => (/* binding */ pcsetSteps),
/* harmony export */   toMidi: () => (/* binding */ toMidi)
/* harmony export */ });
/* harmony import */ var _tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @tonaljs/pitch-note */ "./node_modules/@tonaljs/pitch-note/dist/index.mjs");
// index.ts

function isMidi(arg) {
  return +arg >= 0 && +arg <= 127;
}
function toMidi(note) {
  if (isMidi(note)) {
    return +note;
  }
  const n = (0,_tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_0__.note)(note);
  return n.empty ? null : n.midi;
}
function midiToFreq(midi, tuning = 440) {
  return Math.pow(2, (midi - 69) / 12) * tuning;
}
var L2 = Math.log(2);
var L440 = Math.log(440);
function freqToMidi(freq) {
  const v = 12 * (Math.log(freq) - L440) / L2 + 69;
  return Math.round(v * 100) / 100;
}
var SHARPS = "C C# D D# E F F# G G# A A# B".split(" ");
var FLATS = "C Db D Eb E F Gb G Ab A Bb B".split(" ");
function midiToNoteName(midi, options = {}) {
  if (isNaN(midi) || midi === -Infinity || midi === Infinity) return "";
  midi = Math.round(midi);
  const pcs = options.sharps === true ? SHARPS : FLATS;
  const pc = pcs[midi % 12];
  if (options.pitchClass) {
    return pc;
  }
  const o = Math.floor(midi / 12) - 1;
  return pc + o;
}
function chroma(midi) {
  return midi % 12;
}
function pcsetFromChroma(chroma2) {
  return chroma2.split("").reduce((pcset2, val, index) => {
    if (index < 12 && val === "1") pcset2.push(index);
    return pcset2;
  }, []);
}
function pcsetFromMidi(midi) {
  return midi.map(chroma).sort((a, b) => a - b).filter((n, i, a) => i === 0 || n !== a[i - 1]);
}
function pcset(notes) {
  return Array.isArray(notes) ? pcsetFromMidi(notes) : pcsetFromChroma(notes);
}
function pcsetNearest(notes) {
  const set = pcset(notes);
  return (midi) => {
    const ch = chroma(midi);
    for (let i = 0; i < 12; i++) {
      if (set.includes(ch + i)) return midi + i;
      if (set.includes(ch - i)) return midi - i;
    }
    return void 0;
  };
}
function pcsetSteps(notes, tonic) {
  const set = pcset(notes);
  const len = set.length;
  return (step) => {
    const index = step < 0 ? (len - -step % len) % len : step % len;
    const octaves = Math.floor(step / len);
    return set[index] + octaves * 12 + tonic;
  };
}
function pcsetDegrees(notes, tonic) {
  const steps = pcsetSteps(notes, tonic);
  return (degree) => {
    if (degree === 0) return void 0;
    return steps(degree > 0 ? degree - 1 : degree);
  };
}
var midi_default = {
  chroma,
  freqToMidi,
  isMidi,
  midiToFreq,
  midiToNoteName,
  pcsetNearest,
  pcset,
  pcsetDegrees,
  pcsetSteps,
  toMidi
};

//# sourceMappingURL=index.mjs.map

/***/ }),

/***/ "./node_modules/@tonaljs/mode/dist/index.mjs":
/*!***************************************************!*\
  !*** ./node_modules/@tonaljs/mode/dist/index.mjs ***!
  \***************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   all: () => (/* binding */ all),
/* harmony export */   "default": () => (/* binding */ mode_default),
/* harmony export */   distance: () => (/* binding */ distance),
/* harmony export */   entries: () => (/* binding */ entries),
/* harmony export */   get: () => (/* binding */ get),
/* harmony export */   mode: () => (/* binding */ mode),
/* harmony export */   names: () => (/* binding */ names),
/* harmony export */   notes: () => (/* binding */ notes),
/* harmony export */   relativeTonic: () => (/* binding */ relativeTonic),
/* harmony export */   seventhChords: () => (/* binding */ seventhChords),
/* harmony export */   triads: () => (/* binding */ triads)
/* harmony export */ });
/* harmony import */ var _tonaljs_collection__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @tonaljs/collection */ "./node_modules/@tonaljs/collection/dist/index.mjs");
/* harmony import */ var _tonaljs_interval__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @tonaljs/interval */ "./node_modules/@tonaljs/interval/dist/index.mjs");
/* harmony import */ var _tonaljs_pcset__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @tonaljs/pcset */ "./node_modules/@tonaljs/pcset/dist/index.mjs");
/* harmony import */ var _tonaljs_pitch_distance__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @tonaljs/pitch-distance */ "./node_modules/@tonaljs/pitch-distance/dist/index.mjs");
/* harmony import */ var _tonaljs_scale_type__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @tonaljs/scale-type */ "./node_modules/@tonaljs/scale-type/dist/index.mjs");
// index.ts





var MODES = [
  [0, 2773, 0, "ionian", "", "Maj7", "major"],
  [1, 2902, 2, "dorian", "m", "m7"],
  [2, 3418, 4, "phrygian", "m", "m7"],
  [3, 2741, -1, "lydian", "", "Maj7"],
  [4, 2774, 1, "mixolydian", "", "7"],
  [5, 2906, 3, "aeolian", "m", "m7", "minor"],
  [6, 3434, 5, "locrian", "dim", "m7b5"]
];
var NoMode = {
  ..._tonaljs_pcset__WEBPACK_IMPORTED_MODULE_2__.EmptyPcset,
  name: "",
  alt: 0,
  modeNum: NaN,
  triad: "",
  seventh: "",
  aliases: []
};
var modes = MODES.map(toMode);
var index = {};
modes.forEach((mode2) => {
  index[mode2.name] = mode2;
  mode2.aliases.forEach((alias) => {
    index[alias] = mode2;
  });
});
function get(name) {
  return typeof name === "string" ? index[name.toLowerCase()] || NoMode : name && name.name ? get(name.name) : NoMode;
}
var mode = get;
function all() {
  return modes.slice();
}
var entries = all;
function names() {
  return modes.map((mode2) => mode2.name);
}
function toMode(mode2) {
  const [modeNum, setNum, alt, name, triad, seventh, alias] = mode2;
  const aliases = alias ? [alias] : [];
  const chroma = Number(setNum).toString(2);
  const intervals = (0,_tonaljs_scale_type__WEBPACK_IMPORTED_MODULE_4__.get)(name).intervals;
  return {
    empty: false,
    intervals,
    modeNum,
    chroma,
    normalized: chroma,
    name,
    setNum,
    alt,
    triad,
    seventh,
    aliases
  };
}
function notes(modeName, tonic) {
  return get(modeName).intervals.map((ivl) => (0,_tonaljs_pitch_distance__WEBPACK_IMPORTED_MODULE_3__.transpose)(tonic, ivl));
}
function chords(chords2) {
  return (modeName, tonic) => {
    const mode2 = get(modeName);
    if (mode2.empty) return [];
    const triads2 = (0,_tonaljs_collection__WEBPACK_IMPORTED_MODULE_0__.rotate)(mode2.modeNum, chords2);
    const tonics = mode2.intervals.map((i) => (0,_tonaljs_pitch_distance__WEBPACK_IMPORTED_MODULE_3__.transpose)(tonic, i));
    return triads2.map((triad, i) => tonics[i] + triad);
  };
}
var triads = chords(MODES.map((x) => x[4]));
var seventhChords = chords(MODES.map((x) => x[5]));
function distance(destination, source) {
  const from = get(source);
  const to = get(destination);
  if (from.empty || to.empty) return "";
  return (0,_tonaljs_interval__WEBPACK_IMPORTED_MODULE_1__.simplify)((0,_tonaljs_interval__WEBPACK_IMPORTED_MODULE_1__.transposeFifths)("1P", to.alt - from.alt));
}
function relativeTonic(destination, source, tonic) {
  return (0,_tonaljs_pitch_distance__WEBPACK_IMPORTED_MODULE_3__.transpose)(tonic, distance(destination, source));
}
var mode_default = {
  get,
  names,
  all,
  distance,
  relativeTonic,
  notes,
  triads,
  seventhChords,
  // deprecated
  entries,
  mode
};

//# sourceMappingURL=index.mjs.map

/***/ }),

/***/ "./node_modules/@tonaljs/note/dist/index.mjs":
/*!***************************************************!*\
  !*** ./node_modules/@tonaljs/note/dist/index.mjs ***!
  \***************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   accidentals: () => (/* binding */ accidentals),
/* harmony export */   ascending: () => (/* binding */ ascending),
/* harmony export */   chroma: () => (/* binding */ chroma),
/* harmony export */   "default": () => (/* binding */ note_default),
/* harmony export */   descending: () => (/* binding */ descending),
/* harmony export */   distance: () => (/* binding */ distance),
/* harmony export */   enharmonic: () => (/* binding */ enharmonic),
/* harmony export */   freq: () => (/* binding */ freq),
/* harmony export */   fromFreq: () => (/* binding */ fromFreq),
/* harmony export */   fromFreqSharps: () => (/* binding */ fromFreqSharps),
/* harmony export */   fromMidi: () => (/* binding */ fromMidi),
/* harmony export */   fromMidiSharps: () => (/* binding */ fromMidiSharps),
/* harmony export */   get: () => (/* binding */ get),
/* harmony export */   midi: () => (/* binding */ midi),
/* harmony export */   name: () => (/* binding */ name),
/* harmony export */   names: () => (/* binding */ names),
/* harmony export */   octave: () => (/* binding */ octave),
/* harmony export */   pitchClass: () => (/* binding */ pitchClass),
/* harmony export */   simplify: () => (/* binding */ simplify),
/* harmony export */   sortedNames: () => (/* binding */ sortedNames),
/* harmony export */   sortedUniqNames: () => (/* binding */ sortedUniqNames),
/* harmony export */   tr: () => (/* binding */ tr),
/* harmony export */   trBy: () => (/* binding */ trBy),
/* harmony export */   trFifths: () => (/* binding */ trFifths),
/* harmony export */   trFrom: () => (/* binding */ trFrom),
/* harmony export */   transpose: () => (/* binding */ transpose),
/* harmony export */   transposeBy: () => (/* binding */ transposeBy),
/* harmony export */   transposeFifths: () => (/* binding */ transposeFifths),
/* harmony export */   transposeFrom: () => (/* binding */ transposeFrom),
/* harmony export */   transposeOctaves: () => (/* binding */ transposeOctaves)
/* harmony export */ });
/* harmony import */ var _tonaljs_midi__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @tonaljs/midi */ "./node_modules/@tonaljs/midi/dist/index.mjs");
/* harmony import */ var _tonaljs_pitch_distance__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @tonaljs/pitch-distance */ "./node_modules/@tonaljs/pitch-distance/dist/index.mjs");
/* harmony import */ var _tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @tonaljs/pitch-note */ "./node_modules/@tonaljs/pitch-note/dist/index.mjs");
// index.ts



var NAMES = ["C", "D", "E", "F", "G", "A", "B"];
var toName = (n) => n.name;
var onlyNotes = (array) => array.map(_tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_2__.note).filter((n) => !n.empty);
function names(array) {
  if (array === void 0) {
    return NAMES.slice();
  } else if (!Array.isArray(array)) {
    return [];
  } else {
    return onlyNotes(array).map(toName);
  }
}
var get = _tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_2__.note;
var name = (note) => get(note).name;
var pitchClass = (note) => get(note).pc;
var accidentals = (note) => get(note).acc;
var octave = (note) => get(note).oct;
var midi = (note) => get(note).midi;
var freq = (note) => get(note).freq;
var chroma = (note) => get(note).chroma;
function fromMidi(midi2) {
  return (0,_tonaljs_midi__WEBPACK_IMPORTED_MODULE_0__.midiToNoteName)(midi2);
}
function fromFreq(freq2) {
  return (0,_tonaljs_midi__WEBPACK_IMPORTED_MODULE_0__.midiToNoteName)((0,_tonaljs_midi__WEBPACK_IMPORTED_MODULE_0__.freqToMidi)(freq2));
}
function fromFreqSharps(freq2) {
  return (0,_tonaljs_midi__WEBPACK_IMPORTED_MODULE_0__.midiToNoteName)((0,_tonaljs_midi__WEBPACK_IMPORTED_MODULE_0__.freqToMidi)(freq2), { sharps: true });
}
function fromMidiSharps(midi2) {
  return (0,_tonaljs_midi__WEBPACK_IMPORTED_MODULE_0__.midiToNoteName)(midi2, { sharps: true });
}
var distance = _tonaljs_pitch_distance__WEBPACK_IMPORTED_MODULE_1__.distance;
var transpose = _tonaljs_pitch_distance__WEBPACK_IMPORTED_MODULE_1__.transpose;
var tr = _tonaljs_pitch_distance__WEBPACK_IMPORTED_MODULE_1__.transpose;
var transposeBy = (interval) => (note) => transpose(note, interval);
var trBy = transposeBy;
var transposeFrom = (note) => (interval) => transpose(note, interval);
var trFrom = transposeFrom;
function transposeFifths(noteName, fifths) {
  return transpose(noteName, [fifths, 0]);
}
var trFifths = transposeFifths;
function transposeOctaves(noteName, octaves) {
  return transpose(noteName, [0, octaves]);
}
var ascending = (a, b) => a.height - b.height;
var descending = (a, b) => b.height - a.height;
function sortedNames(notes, comparator) {
  comparator = comparator || ascending;
  return onlyNotes(notes).sort(comparator).map(toName);
}
function sortedUniqNames(notes) {
  return sortedNames(notes, ascending).filter(
    (n, i, a) => i === 0 || n !== a[i - 1]
  );
}
var simplify = (noteName) => {
  const note = get(noteName);
  if (note.empty) {
    return "";
  }
  return (0,_tonaljs_midi__WEBPACK_IMPORTED_MODULE_0__.midiToNoteName)(note.midi || note.chroma, {
    sharps: note.alt > 0,
    pitchClass: note.midi === null
  });
};
function enharmonic(noteName, destName) {
  const src = get(noteName);
  if (src.empty) {
    return "";
  }
  const dest = get(
    destName || (0,_tonaljs_midi__WEBPACK_IMPORTED_MODULE_0__.midiToNoteName)(src.midi || src.chroma, {
      sharps: src.alt < 0,
      pitchClass: true
    })
  );
  if (dest.empty || dest.chroma !== src.chroma) {
    return "";
  }
  if (src.oct === void 0) {
    return dest.pc;
  }
  const srcChroma = src.chroma - src.alt;
  const destChroma = dest.chroma - dest.alt;
  const destOctOffset = srcChroma > 11 || destChroma < 0 ? -1 : srcChroma < 0 || destChroma > 11 ? 1 : 0;
  const destOct = src.oct + destOctOffset;
  return dest.pc + destOct;
}
var note_default = {
  names,
  get,
  name,
  pitchClass,
  accidentals,
  octave,
  midi,
  ascending,
  descending,
  distance,
  sortedNames,
  sortedUniqNames,
  fromMidi,
  fromMidiSharps,
  freq,
  fromFreq,
  fromFreqSharps,
  chroma,
  transpose,
  tr,
  transposeBy,
  trBy,
  transposeFrom,
  trFrom,
  transposeFifths,
  transposeOctaves,
  trFifths,
  simplify,
  enharmonic
};

//# sourceMappingURL=index.mjs.map

/***/ }),

/***/ "./node_modules/@tonaljs/pcset/dist/index.mjs":
/*!****************************************************!*\
  !*** ./node_modules/@tonaljs/pcset/dist/index.mjs ***!
  \****************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   EmptyPcset: () => (/* binding */ EmptyPcset),
/* harmony export */   chroma: () => (/* binding */ chroma),
/* harmony export */   chromas: () => (/* binding */ chromas),
/* harmony export */   "default": () => (/* binding */ pcset_default),
/* harmony export */   filter: () => (/* binding */ filter),
/* harmony export */   get: () => (/* binding */ get),
/* harmony export */   includes: () => (/* binding */ includes),
/* harmony export */   intervals: () => (/* binding */ intervals),
/* harmony export */   isChroma: () => (/* binding */ isChroma),
/* harmony export */   isEqual: () => (/* binding */ isEqual),
/* harmony export */   isNoteIncludedIn: () => (/* binding */ isNoteIncludedIn),
/* harmony export */   isSubsetOf: () => (/* binding */ isSubsetOf),
/* harmony export */   isSupersetOf: () => (/* binding */ isSupersetOf),
/* harmony export */   modes: () => (/* binding */ modes),
/* harmony export */   notes: () => (/* binding */ notes),
/* harmony export */   num: () => (/* binding */ num),
/* harmony export */   pcset: () => (/* binding */ pcset)
/* harmony export */ });
/* harmony import */ var _tonaljs_collection__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @tonaljs/collection */ "./node_modules/@tonaljs/collection/dist/index.mjs");
/* harmony import */ var _tonaljs_pitch_distance__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @tonaljs/pitch-distance */ "./node_modules/@tonaljs/pitch-distance/dist/index.mjs");
/* harmony import */ var _tonaljs_pitch_interval__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @tonaljs/pitch-interval */ "./node_modules/@tonaljs/pitch-interval/dist/index.mjs");
/* harmony import */ var _tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @tonaljs/pitch-note */ "./node_modules/@tonaljs/pitch-note/dist/index.mjs");
// index.ts




var EmptyPcset = {
  empty: true,
  name: "",
  setNum: 0,
  chroma: "000000000000",
  normalized: "000000000000",
  intervals: []
};
var setNumToChroma = (num2) => Number(num2).toString(2).padStart(12, "0");
var chromaToNumber = (chroma2) => parseInt(chroma2, 2);
var REGEX = /^[01]{12}$/;
function isChroma(set) {
  return REGEX.test(set);
}
var isPcsetNum = (set) => typeof set === "number" && set >= 0 && set <= 4095;
var isPcset = (set) => set && isChroma(set.chroma);
var cache = { [EmptyPcset.chroma]: EmptyPcset };
function get(src) {
  const chroma2 = isChroma(src) ? src : isPcsetNum(src) ? setNumToChroma(src) : Array.isArray(src) ? listToChroma(src) : isPcset(src) ? src.chroma : EmptyPcset.chroma;
  return cache[chroma2] = cache[chroma2] || chromaToPcset(chroma2);
}
var pcset = get;
var chroma = (set) => get(set).chroma;
var intervals = (set) => get(set).intervals;
var num = (set) => get(set).setNum;
var IVLS = [
  "1P",
  "2m",
  "2M",
  "3m",
  "3M",
  "4P",
  "5d",
  "5P",
  "6m",
  "6M",
  "7m",
  "7M"
];
function chromaToIntervals(chroma2) {
  const intervals2 = [];
  for (let i = 0; i < 12; i++) {
    if (chroma2.charAt(i) === "1") intervals2.push(IVLS[i]);
  }
  return intervals2;
}
function notes(set) {
  return get(set).intervals.map((ivl) => (0,_tonaljs_pitch_distance__WEBPACK_IMPORTED_MODULE_1__.transpose)("C", ivl));
}
function chromas() {
  return (0,_tonaljs_collection__WEBPACK_IMPORTED_MODULE_0__.range)(2048, 4095).map(setNumToChroma);
}
function modes(set, normalize = true) {
  const pcs = get(set);
  const binary = pcs.chroma.split("");
  return (0,_tonaljs_collection__WEBPACK_IMPORTED_MODULE_0__.compact)(
    binary.map((_, i) => {
      const r = (0,_tonaljs_collection__WEBPACK_IMPORTED_MODULE_0__.rotate)(i, binary);
      return normalize && r[0] === "0" ? null : r.join("");
    })
  );
}
function isEqual(s1, s2) {
  return get(s1).setNum === get(s2).setNum;
}
function isSubsetOf(set) {
  const s = get(set).setNum;
  return (notes2) => {
    const o = get(notes2).setNum;
    return s && s !== o && (o & s) === o;
  };
}
function isSupersetOf(set) {
  const s = get(set).setNum;
  return (notes2) => {
    const o = get(notes2).setNum;
    return s && s !== o && (o | s) === o;
  };
}
function isNoteIncludedIn(set) {
  const s = get(set);
  return (noteName) => {
    const n = (0,_tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_3__.note)(noteName);
    return s && !n.empty && s.chroma.charAt(n.chroma) === "1";
  };
}
var includes = isNoteIncludedIn;
function filter(set) {
  const isIncluded = isNoteIncludedIn(set);
  return (notes2) => {
    return notes2.filter(isIncluded);
  };
}
var pcset_default = {
  get,
  chroma,
  num,
  intervals,
  chromas,
  isSupersetOf,
  isSubsetOf,
  isNoteIncludedIn,
  isEqual,
  filter,
  modes,
  notes,
  // deprecated
  pcset
};
function chromaRotations(chroma2) {
  const binary = chroma2.split("");
  return binary.map((_, i) => (0,_tonaljs_collection__WEBPACK_IMPORTED_MODULE_0__.rotate)(i, binary).join(""));
}
function chromaToPcset(chroma2) {
  const setNum = chromaToNumber(chroma2);
  const normalizedNum = chromaRotations(chroma2).map(chromaToNumber).filter((n) => n >= 2048).sort()[0];
  const normalized = setNumToChroma(normalizedNum);
  const intervals2 = chromaToIntervals(chroma2);
  return {
    empty: false,
    name: "",
    setNum,
    chroma: chroma2,
    normalized,
    intervals: intervals2
  };
}
function listToChroma(set) {
  if (set.length === 0) {
    return EmptyPcset.chroma;
  }
  let pitch;
  const binary = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < set.length; i++) {
    pitch = (0,_tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_3__.note)(set[i]);
    if (pitch.empty) pitch = (0,_tonaljs_pitch_interval__WEBPACK_IMPORTED_MODULE_2__.interval)(set[i]);
    if (!pitch.empty) binary[pitch.chroma] = 1;
  }
  return binary.join("");
}

//# sourceMappingURL=index.mjs.map

/***/ }),

/***/ "./node_modules/@tonaljs/pitch-distance/dist/index.mjs":
/*!*************************************************************!*\
  !*** ./node_modules/@tonaljs/pitch-distance/dist/index.mjs ***!
  \*************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   distance: () => (/* binding */ distance),
/* harmony export */   tonicIntervalsTransposer: () => (/* binding */ tonicIntervalsTransposer),
/* harmony export */   transpose: () => (/* binding */ transpose)
/* harmony export */ });
/* harmony import */ var _tonaljs_pitch_interval__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @tonaljs/pitch-interval */ "./node_modules/@tonaljs/pitch-interval/dist/index.mjs");
/* harmony import */ var _tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @tonaljs/pitch-note */ "./node_modules/@tonaljs/pitch-note/dist/index.mjs");
// index.ts


function transpose(noteName, intervalName) {
  const note = (0,_tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_1__.note)(noteName);
  const intervalCoord = Array.isArray(intervalName) ? intervalName : (0,_tonaljs_pitch_interval__WEBPACK_IMPORTED_MODULE_0__.interval)(intervalName).coord;
  if (note.empty || !intervalCoord || intervalCoord.length < 2) {
    return "";
  }
  const noteCoord = note.coord;
  const tr = noteCoord.length === 1 ? [noteCoord[0] + intervalCoord[0]] : [noteCoord[0] + intervalCoord[0], noteCoord[1] + intervalCoord[1]];
  return (0,_tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_1__.coordToNote)(tr).name;
}
function tonicIntervalsTransposer(intervals, tonic) {
  const len = intervals.length;
  return (normalized) => {
    if (!tonic) return "";
    const index = normalized < 0 ? (len - -normalized % len) % len : normalized % len;
    const octaves = Math.floor(normalized / len);
    const root = transpose(tonic, [0, octaves]);
    return transpose(root, intervals[index]);
  };
}
function distance(fromNote, toNote) {
  const from = (0,_tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_1__.note)(fromNote);
  const to = (0,_tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_1__.note)(toNote);
  if (from.empty || to.empty) {
    return "";
  }
  const fcoord = from.coord;
  const tcoord = to.coord;
  const fifths = tcoord[0] - fcoord[0];
  const octs = fcoord.length === 2 && tcoord.length === 2 ? tcoord[1] - fcoord[1] : -Math.floor(fifths * 7 / 12);
  const forceDescending = to.height === from.height && to.midi !== null && from.oct === to.oct && from.step > to.step;
  return (0,_tonaljs_pitch_interval__WEBPACK_IMPORTED_MODULE_0__.coordToInterval)([fifths, octs], forceDescending).name;
}

//# sourceMappingURL=index.mjs.map

/***/ }),

/***/ "./node_modules/@tonaljs/pitch-interval/dist/index.mjs":
/*!*************************************************************!*\
  !*** ./node_modules/@tonaljs/pitch-interval/dist/index.mjs ***!
  \*************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   coordToInterval: () => (/* binding */ coordToInterval),
/* harmony export */   interval: () => (/* binding */ interval),
/* harmony export */   tokenizeInterval: () => (/* binding */ tokenizeInterval)
/* harmony export */ });
/* harmony import */ var _tonaljs_pitch__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @tonaljs/pitch */ "./node_modules/@tonaljs/pitch/dist/index.mjs");
// index.ts

var fillStr = (s, n) => Array(Math.abs(n) + 1).join(s);
var NoInterval = Object.freeze({
  empty: true,
  name: "",
  num: NaN,
  q: "",
  type: "",
  step: NaN,
  alt: NaN,
  dir: NaN,
  simple: NaN,
  semitones: NaN,
  chroma: NaN,
  coord: [],
  oct: NaN
});
var INTERVAL_TONAL_REGEX = "([-+]?\\d+)(d{1,4}|m|M|P|A{1,4})";
var INTERVAL_SHORTHAND_REGEX = "(AA|A|P|M|m|d|dd)([-+]?\\d+)";
var REGEX = new RegExp(
  "^" + INTERVAL_TONAL_REGEX + "|" + INTERVAL_SHORTHAND_REGEX + "$"
);
function tokenizeInterval(str) {
  const m = REGEX.exec(`${str}`);
  if (m === null) {
    return ["", ""];
  }
  return m[1] ? [m[1], m[2]] : [m[4], m[3]];
}
var cache = {};
function interval(src) {
  return typeof src === "string" ? cache[src] || (cache[src] = parse(src)) : (0,_tonaljs_pitch__WEBPACK_IMPORTED_MODULE_0__.isPitch)(src) ? interval(pitchName(src)) : (0,_tonaljs_pitch__WEBPACK_IMPORTED_MODULE_0__.isNamedPitch)(src) ? interval(src.name) : NoInterval;
}
var SIZES = [0, 2, 4, 5, 7, 9, 11];
var TYPES = "PMMPPMM";
function parse(str) {
  const tokens = tokenizeInterval(str);
  if (tokens[0] === "") {
    return NoInterval;
  }
  const num = +tokens[0];
  const q = tokens[1];
  const step = (Math.abs(num) - 1) % 7;
  const t = TYPES[step];
  if (t === "M" && q === "P") {
    return NoInterval;
  }
  const type = t === "M" ? "majorable" : "perfectable";
  const name = "" + num + q;
  const dir = num < 0 ? -1 : 1;
  const simple = num === 8 || num === -8 ? num : dir * (step + 1);
  const alt = qToAlt(type, q);
  const oct = Math.floor((Math.abs(num) - 1) / 7);
  const semitones = dir * (SIZES[step] + alt + 12 * oct);
  const chroma = (dir * (SIZES[step] + alt) % 12 + 12) % 12;
  const coord = (0,_tonaljs_pitch__WEBPACK_IMPORTED_MODULE_0__.coordinates)({ step, alt, oct, dir });
  return {
    empty: false,
    name,
    num,
    q,
    step,
    alt,
    dir,
    type,
    simple,
    semitones,
    chroma,
    coord,
    oct
  };
}
function coordToInterval(coord, forceDescending) {
  const [f, o = 0] = coord;
  const isDescending = f * 7 + o * 12 < 0;
  const ivl = forceDescending || isDescending ? [-f, -o, -1] : [f, o, 1];
  return interval((0,_tonaljs_pitch__WEBPACK_IMPORTED_MODULE_0__.pitch)(ivl));
}
function qToAlt(type, q) {
  return q === "M" && type === "majorable" || q === "P" && type === "perfectable" ? 0 : q === "m" && type === "majorable" ? -1 : /^A+$/.test(q) ? q.length : /^d+$/.test(q) ? -1 * (type === "perfectable" ? q.length : q.length + 1) : 0;
}
function pitchName(props) {
  const { step, alt, oct = 0, dir } = props;
  if (!dir) {
    return "";
  }
  const calcNum = step + 1 + 7 * oct;
  const num = calcNum === 0 ? step + 1 : calcNum;
  const d = dir < 0 ? "-" : "";
  const type = TYPES[step] === "M" ? "majorable" : "perfectable";
  const name = d + num + altToQ(type, alt);
  return name;
}
function altToQ(type, alt) {
  if (alt === 0) {
    return type === "majorable" ? "M" : "P";
  } else if (alt === -1 && type === "majorable") {
    return "m";
  } else if (alt > 0) {
    return fillStr("A", alt);
  } else {
    return fillStr("d", type === "perfectable" ? alt : alt + 1);
  }
}

//# sourceMappingURL=index.mjs.map

/***/ }),

/***/ "./node_modules/@tonaljs/pitch-note/dist/index.mjs":
/*!*********************************************************!*\
  !*** ./node_modules/@tonaljs/pitch-note/dist/index.mjs ***!
  \*********************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   accToAlt: () => (/* binding */ accToAlt),
/* harmony export */   altToAcc: () => (/* binding */ altToAcc),
/* harmony export */   coordToNote: () => (/* binding */ coordToNote),
/* harmony export */   note: () => (/* binding */ note),
/* harmony export */   stepToLetter: () => (/* binding */ stepToLetter),
/* harmony export */   tokenizeNote: () => (/* binding */ tokenizeNote)
/* harmony export */ });
/* harmony import */ var _tonaljs_pitch__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @tonaljs/pitch */ "./node_modules/@tonaljs/pitch/dist/index.mjs");
// index.ts

var fillStr = (s, n) => Array(Math.abs(n) + 1).join(s);
var NoNote = Object.freeze({
  empty: true,
  name: "",
  letter: "",
  acc: "",
  pc: "",
  step: NaN,
  alt: NaN,
  chroma: NaN,
  height: NaN,
  coord: [],
  midi: null,
  freq: null
});
var cache = /* @__PURE__ */ new Map();
var stepToLetter = (step) => "CDEFGAB".charAt(step);
var altToAcc = (alt) => alt < 0 ? fillStr("b", -alt) : fillStr("#", alt);
var accToAlt = (acc) => acc[0] === "b" ? -acc.length : acc.length;
function note(src) {
  const stringSrc = JSON.stringify(src);
  const cached = cache.get(stringSrc);
  if (cached) {
    return cached;
  }
  const value = typeof src === "string" ? parse(src) : (0,_tonaljs_pitch__WEBPACK_IMPORTED_MODULE_0__.isPitch)(src) ? note(pitchName(src)) : (0,_tonaljs_pitch__WEBPACK_IMPORTED_MODULE_0__.isNamedPitch)(src) ? note(src.name) : NoNote;
  cache.set(stringSrc, value);
  return value;
}
var REGEX = /^([a-gA-G]?)(#{1,}|b{1,}|x{1,}|)(-?\d*)\s*(.*)$/;
function tokenizeNote(str) {
  const m = REGEX.exec(str);
  return m ? [m[1].toUpperCase(), m[2].replace(/x/g, "##"), m[3], m[4]] : ["", "", "", ""];
}
function coordToNote(noteCoord) {
  return note((0,_tonaljs_pitch__WEBPACK_IMPORTED_MODULE_0__.pitch)(noteCoord));
}
var mod = (n, m) => (n % m + m) % m;
var SEMI = [0, 2, 4, 5, 7, 9, 11];
function parse(noteName) {
  const tokens = tokenizeNote(noteName);
  if (tokens[0] === "" || tokens[3] !== "") {
    return NoNote;
  }
  const letter = tokens[0];
  const acc = tokens[1];
  const octStr = tokens[2];
  const step = (letter.charCodeAt(0) + 3) % 7;
  const alt = accToAlt(acc);
  const oct = octStr.length ? +octStr : void 0;
  const coord = (0,_tonaljs_pitch__WEBPACK_IMPORTED_MODULE_0__.coordinates)({ step, alt, oct });
  const name = letter + acc + octStr;
  const pc = letter + acc;
  const chroma = (SEMI[step] + alt + 120) % 12;
  const height = oct === void 0 ? mod(SEMI[step] + alt, 12) - 12 * 99 : SEMI[step] + alt + 12 * (oct + 1);
  const midi = height >= 0 && height <= 127 ? height : null;
  const freq = oct === void 0 ? null : Math.pow(2, (height - 69) / 12) * 440;
  return {
    empty: false,
    acc,
    alt,
    chroma,
    coord,
    freq,
    height,
    letter,
    midi,
    name,
    oct,
    pc,
    step
  };
}
function pitchName(props) {
  const { step, alt, oct } = props;
  const letter = stepToLetter(step);
  if (!letter) {
    return "";
  }
  const pc = letter + altToAcc(alt);
  return oct || oct === 0 ? pc + oct : pc;
}

//# sourceMappingURL=index.mjs.map

/***/ }),

/***/ "./node_modules/@tonaljs/pitch/dist/index.mjs":
/*!****************************************************!*\
  !*** ./node_modules/@tonaljs/pitch/dist/index.mjs ***!
  \****************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   chroma: () => (/* binding */ chroma),
/* harmony export */   coordinates: () => (/* binding */ coordinates),
/* harmony export */   height: () => (/* binding */ height),
/* harmony export */   isNamedPitch: () => (/* binding */ isNamedPitch),
/* harmony export */   isPitch: () => (/* binding */ isPitch),
/* harmony export */   midi: () => (/* binding */ midi),
/* harmony export */   pitch: () => (/* binding */ pitch)
/* harmony export */ });
// index.ts
function isNamedPitch(src) {
  return src !== null && typeof src === "object" && "name" in src && typeof src.name === "string" ? true : false;
}
var SIZES = [0, 2, 4, 5, 7, 9, 11];
var chroma = ({ step, alt }) => (SIZES[step] + alt + 120) % 12;
var height = ({ step, alt, oct, dir = 1 }) => dir * (SIZES[step] + alt + 12 * (oct === void 0 ? -100 : oct));
var midi = (pitch2) => {
  const h = height(pitch2);
  return pitch2.oct !== void 0 && h >= -12 && h <= 115 ? h + 12 : null;
};
function isPitch(pitch2) {
  return pitch2 !== null && typeof pitch2 === "object" && "step" in pitch2 && typeof pitch2.step === "number" && "alt" in pitch2 && typeof pitch2.alt === "number" && !isNaN(pitch2.step) && !isNaN(pitch2.alt) ? true : false;
}
var FIFTHS = [0, 2, 4, -1, 1, 3, 5];
var STEPS_TO_OCTS = FIFTHS.map(
  (fifths) => Math.floor(fifths * 7 / 12)
);
function coordinates(pitch2) {
  const { step, alt, oct, dir = 1 } = pitch2;
  const f = FIFTHS[step] + 7 * alt;
  if (oct === void 0) {
    return [dir * f];
  }
  const o = oct - STEPS_TO_OCTS[step] - 4 * alt;
  return [dir * f, dir * o];
}
var FIFTHS_TO_STEPS = [3, 0, 4, 1, 5, 2, 6];
function pitch(coord) {
  const [f, o, dir] = coord;
  const step = FIFTHS_TO_STEPS[unaltered(f)];
  const alt = Math.floor((f + 1) / 7);
  if (o === void 0) {
    return { step, alt, dir };
  }
  const oct = o + 4 * alt + STEPS_TO_OCTS[step];
  return { step, alt, oct, dir };
}
function unaltered(f) {
  const i = (f + 1) % 7;
  return i < 0 ? 7 + i : i;
}

//# sourceMappingURL=index.mjs.map

/***/ }),

/***/ "./node_modules/@tonaljs/progression/dist/index.mjs":
/*!**********************************************************!*\
  !*** ./node_modules/@tonaljs/progression/dist/index.mjs ***!
  \**********************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ progression_default),
/* harmony export */   fromRomanNumerals: () => (/* binding */ fromRomanNumerals),
/* harmony export */   toRomanNumerals: () => (/* binding */ toRomanNumerals)
/* harmony export */ });
/* harmony import */ var _tonaljs_chord__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @tonaljs/chord */ "./node_modules/@tonaljs/chord/dist/index.mjs");
/* harmony import */ var _tonaljs_pitch_distance__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @tonaljs/pitch-distance */ "./node_modules/@tonaljs/pitch-distance/dist/index.mjs");
/* harmony import */ var _tonaljs_pitch_interval__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @tonaljs/pitch-interval */ "./node_modules/@tonaljs/pitch-interval/dist/index.mjs");
/* harmony import */ var _tonaljs_roman_numeral__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @tonaljs/roman-numeral */ "./node_modules/@tonaljs/roman-numeral/dist/index.mjs");
// index.ts




function fromRomanNumerals(tonic, chords) {
  const romanNumerals = chords.map(_tonaljs_roman_numeral__WEBPACK_IMPORTED_MODULE_3__.get);
  return romanNumerals.map(
    (rn) => (0,_tonaljs_pitch_distance__WEBPACK_IMPORTED_MODULE_1__.transpose)(tonic, (0,_tonaljs_pitch_interval__WEBPACK_IMPORTED_MODULE_2__.interval)(rn)) + rn.chordType
  );
}
function toRomanNumerals(tonic, chords) {
  return chords.map((chord) => {
    const [note, chordType] = (0,_tonaljs_chord__WEBPACK_IMPORTED_MODULE_0__.tokenize)(chord);
    const intervalName = (0,_tonaljs_pitch_distance__WEBPACK_IMPORTED_MODULE_1__.distance)(tonic, note);
    const roman = (0,_tonaljs_roman_numeral__WEBPACK_IMPORTED_MODULE_3__.get)((0,_tonaljs_pitch_interval__WEBPACK_IMPORTED_MODULE_2__.interval)(intervalName));
    return roman.name + chordType;
  });
}
var progression_default = { fromRomanNumerals, toRomanNumerals };

//# sourceMappingURL=index.mjs.map

/***/ }),

/***/ "./node_modules/@tonaljs/range/dist/index.mjs":
/*!****************************************************!*\
  !*** ./node_modules/@tonaljs/range/dist/index.mjs ***!
  \****************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   chromatic: () => (/* binding */ chromatic),
/* harmony export */   "default": () => (/* binding */ range_default),
/* harmony export */   numeric: () => (/* binding */ numeric)
/* harmony export */ });
/* harmony import */ var _tonaljs_collection__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @tonaljs/collection */ "./node_modules/@tonaljs/collection/dist/index.mjs");
/* harmony import */ var _tonaljs_midi__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @tonaljs/midi */ "./node_modules/@tonaljs/midi/dist/index.mjs");
// index.ts


function numeric(notes) {
  const midi = (0,_tonaljs_collection__WEBPACK_IMPORTED_MODULE_0__.compact)(
    notes.map((note) => typeof note === "number" ? note : (0,_tonaljs_midi__WEBPACK_IMPORTED_MODULE_1__.toMidi)(note))
  );
  if (!notes.length || midi.length !== notes.length) {
    return [];
  }
  return midi.reduce(
    (result, note) => {
      const last = result[result.length - 1];
      return result.concat((0,_tonaljs_collection__WEBPACK_IMPORTED_MODULE_0__.range)(last, note).slice(1));
    },
    [midi[0]]
  );
}
function chromatic(notes, options) {
  return numeric(notes).map((midi) => (0,_tonaljs_midi__WEBPACK_IMPORTED_MODULE_1__.midiToNoteName)(midi, options));
}
var range_default = { numeric, chromatic };

//# sourceMappingURL=index.mjs.map

/***/ }),

/***/ "./node_modules/@tonaljs/rhythm-pattern/dist/index.mjs":
/*!*************************************************************!*\
  !*** ./node_modules/@tonaljs/rhythm-pattern/dist/index.mjs ***!
  \*************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   binary: () => (/* binding */ binary),
/* harmony export */   euclid: () => (/* binding */ euclid),
/* harmony export */   hex: () => (/* binding */ hex),
/* harmony export */   onsets: () => (/* binding */ onsets),
/* harmony export */   probability: () => (/* binding */ probability),
/* harmony export */   random: () => (/* binding */ random),
/* harmony export */   rotate: () => (/* binding */ rotate)
/* harmony export */ });
// index.ts
function binary(...numbers) {
  return numbers.reduce((pattern, number) => {
    number.toString(2).split("").forEach((digit) => {
      pattern.push(parseInt(digit));
    });
    return pattern;
  }, []);
}
function hex(hexNumber) {
  const pattern = [];
  for (let i = 0; i < hexNumber.length; i++) {
    const digit = parseInt("0x" + hexNumber[i]);
    const binary2 = isNaN(digit) ? "0000" : digit.toString(2).padStart(4, "0");
    binary2.split("").forEach((digit2) => {
      pattern.push(digit2 === "1" ? 1 : 0);
    });
  }
  return pattern;
}
function onsets(...numbers) {
  return numbers.reduce((pattern, number) => {
    pattern.push(1);
    for (let i = 0; i < number; i++) {
      pattern.push(0);
    }
    return pattern;
  }, []);
}
function random(length, probability2 = 0.5, rnd = Math.random) {
  const pattern = [];
  for (let i = 0; i < length; i++) {
    pattern.push(rnd() >= probability2 ? 1 : 0);
  }
  return pattern;
}
function probability(probabilities, rnd = Math.random) {
  return probabilities.map((probability2) => rnd() <= probability2 ? 1 : 0);
}
function rotate(pattern, rotations) {
  const len = pattern.length;
  const rotated = [];
  for (let i = 0; i < len; i++) {
    const pos = ((i - rotations) % len + len) % len;
    rotated[i] = pattern[pos];
  }
  return rotated;
}
function euclid(steps, beats) {
  const pattern = [];
  let d = -1;
  for (let i = 0; i < steps; i++) {
    const v = Math.floor(i * (beats / steps));
    pattern[i] = v !== d ? 1 : 0;
    d = v;
  }
  return pattern;
}

//# sourceMappingURL=index.mjs.map

/***/ }),

/***/ "./node_modules/@tonaljs/roman-numeral/dist/index.mjs":
/*!************************************************************!*\
  !*** ./node_modules/@tonaljs/roman-numeral/dist/index.mjs ***!
  \************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ roman_numeral_default),
/* harmony export */   get: () => (/* binding */ get),
/* harmony export */   names: () => (/* binding */ names),
/* harmony export */   romanNumeral: () => (/* binding */ romanNumeral),
/* harmony export */   tokenize: () => (/* binding */ tokenize)
/* harmony export */ });
/* harmony import */ var _tonaljs_pitch__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @tonaljs/pitch */ "./node_modules/@tonaljs/pitch/dist/index.mjs");
/* harmony import */ var _tonaljs_pitch_interval__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @tonaljs/pitch-interval */ "./node_modules/@tonaljs/pitch-interval/dist/index.mjs");
/* harmony import */ var _tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @tonaljs/pitch-note */ "./node_modules/@tonaljs/pitch-note/dist/index.mjs");
// index.ts



var NoRomanNumeral = { empty: true, name: "", chordType: "" };
var cache = {};
function get(src) {
  return typeof src === "string" ? cache[src] || (cache[src] = parse(src)) : typeof src === "number" ? get(NAMES[src] || "") : (0,_tonaljs_pitch__WEBPACK_IMPORTED_MODULE_0__.isPitch)(src) ? fromPitch(src) : (0,_tonaljs_pitch__WEBPACK_IMPORTED_MODULE_0__.isNamedPitch)(src) ? get(src.name) : NoRomanNumeral;
}
var romanNumeral = get;
function names(major = true) {
  return (major ? NAMES : NAMES_MINOR).slice();
}
function fromPitch(pitch) {
  return get((0,_tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_2__.altToAcc)(pitch.alt) + NAMES[pitch.step]);
}
var REGEX = /^(#{1,}|b{1,}|x{1,}|)(IV|I{1,3}|VI{0,2}|iv|i{1,3}|vi{0,2})([^IViv]*)$/;
function tokenize(str) {
  return REGEX.exec(str) || ["", "", "", ""];
}
var ROMANS = "I II III IV V VI VII";
var NAMES = ROMANS.split(" ");
var NAMES_MINOR = ROMANS.toLowerCase().split(" ");
function parse(src) {
  const [name, acc, roman, chordType] = tokenize(src);
  if (!roman) {
    return NoRomanNumeral;
  }
  const upperRoman = roman.toUpperCase();
  const step = NAMES.indexOf(upperRoman);
  const alt = (0,_tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_2__.accToAlt)(acc);
  const dir = 1;
  return {
    empty: false,
    name,
    roman,
    interval: (0,_tonaljs_pitch_interval__WEBPACK_IMPORTED_MODULE_1__.interval)({ step, alt, dir }).name,
    acc,
    chordType,
    alt,
    step,
    major: roman === upperRoman,
    oct: 0,
    dir
  };
}
var roman_numeral_default = {
  names,
  get,
  // deprecated
  romanNumeral
};

//# sourceMappingURL=index.mjs.map

/***/ }),

/***/ "./node_modules/@tonaljs/scale-type/dist/index.mjs":
/*!*********************************************************!*\
  !*** ./node_modules/@tonaljs/scale-type/dist/index.mjs ***!
  \*********************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   NoScaleType: () => (/* binding */ NoScaleType),
/* harmony export */   add: () => (/* binding */ add),
/* harmony export */   addAlias: () => (/* binding */ addAlias),
/* harmony export */   all: () => (/* binding */ all),
/* harmony export */   "default": () => (/* binding */ scale_type_default),
/* harmony export */   entries: () => (/* binding */ entries),
/* harmony export */   get: () => (/* binding */ get),
/* harmony export */   keys: () => (/* binding */ keys),
/* harmony export */   names: () => (/* binding */ names),
/* harmony export */   removeAll: () => (/* binding */ removeAll),
/* harmony export */   scaleType: () => (/* binding */ scaleType)
/* harmony export */ });
/* harmony import */ var _tonaljs_pcset__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @tonaljs/pcset */ "./node_modules/@tonaljs/pcset/dist/index.mjs");
// index.ts


// data.ts
var SCALES = [
  // Basic scales
  ["1P 2M 3M 5P 6M", "major pentatonic", "pentatonic"],
  ["1P 2M 3M 4P 5P 6M 7M", "major", "ionian"],
  ["1P 2M 3m 4P 5P 6m 7m", "minor", "aeolian"],
  // Jazz common scales
  ["1P 2M 3m 3M 5P 6M", "major blues"],
  ["1P 3m 4P 5d 5P 7m", "minor blues", "blues"],
  ["1P 2M 3m 4P 5P 6M 7M", "melodic minor"],
  ["1P 2M 3m 4P 5P 6m 7M", "harmonic minor"],
  ["1P 2M 3M 4P 5P 6M 7m 7M", "bebop"],
  ["1P 2M 3m 4P 5d 6m 6M 7M", "diminished", "whole-half diminished"],
  // Modes
  ["1P 2M 3m 4P 5P 6M 7m", "dorian"],
  ["1P 2M 3M 4A 5P 6M 7M", "lydian"],
  ["1P 2M 3M 4P 5P 6M 7m", "mixolydian", "dominant"],
  ["1P 2m 3m 4P 5P 6m 7m", "phrygian"],
  ["1P 2m 3m 4P 5d 6m 7m", "locrian"],
  // 5-note scales
  ["1P 3M 4P 5P 7M", "ionian pentatonic"],
  ["1P 3M 4P 5P 7m", "mixolydian pentatonic", "indian"],
  ["1P 2M 4P 5P 6M", "ritusen"],
  ["1P 2M 4P 5P 7m", "egyptian"],
  ["1P 3M 4P 5d 7m", "neopolitan major pentatonic"],
  ["1P 3m 4P 5P 6m", "vietnamese 1"],
  ["1P 2m 3m 5P 6m", "pelog"],
  ["1P 2m 4P 5P 6m", "kumoijoshi"],
  ["1P 2M 3m 5P 6m", "hirajoshi"],
  ["1P 2m 4P 5d 7m", "iwato"],
  ["1P 2m 4P 5P 7m", "in-sen"],
  ["1P 3M 4A 5P 7M", "lydian pentatonic", "chinese"],
  ["1P 3m 4P 6m 7m", "malkos raga"],
  ["1P 3m 4P 5d 7m", "locrian pentatonic", "minor seven flat five pentatonic"],
  ["1P 3m 4P 5P 7m", "minor pentatonic", "vietnamese 2"],
  ["1P 3m 4P 5P 6M", "minor six pentatonic"],
  ["1P 2M 3m 5P 6M", "flat three pentatonic", "kumoi"],
  ["1P 2M 3M 5P 6m", "flat six pentatonic"],
  ["1P 2m 3M 5P 6M", "scriabin"],
  ["1P 3M 5d 6m 7m", "whole tone pentatonic"],
  ["1P 3M 4A 5A 7M", "lydian #5P pentatonic"],
  ["1P 3M 4A 5P 7m", "lydian dominant pentatonic"],
  ["1P 3m 4P 5P 7M", "minor #7M pentatonic"],
  ["1P 3m 4d 5d 7m", "super locrian pentatonic"],
  // 6-note scales
  ["1P 2M 3m 4P 5P 7M", "minor hexatonic"],
  ["1P 2A 3M 5P 5A 7M", "augmented"],
  ["1P 2M 4P 5P 6M 7m", "piongio"],
  ["1P 2m 3M 4A 6M 7m", "prometheus neopolitan"],
  ["1P 2M 3M 4A 6M 7m", "prometheus"],
  ["1P 2m 3M 5d 6m 7m", "mystery #1"],
  ["1P 2m 3M 4P 5A 6M", "six tone symmetric"],
  ["1P 2M 3M 4A 5A 6A", "whole tone", "messiaen's mode #1"],
  ["1P 2m 4P 4A 5P 7M", "messiaen's mode #5"],
  // 7-note scales
  ["1P 2M 3M 4P 5d 6m 7m", "locrian major", "arabian"],
  ["1P 2m 3M 4A 5P 6m 7M", "double harmonic lydian"],
  [
    "1P 2m 2A 3M 4A 6m 7m",
    "altered",
    "super locrian",
    "diminished whole tone",
    "pomeroy"
  ],
  ["1P 2M 3m 4P 5d 6m 7m", "locrian #2", "half-diminished", "aeolian b5"],
  [
    "1P 2M 3M 4P 5P 6m 7m",
    "mixolydian b6",
    "melodic minor fifth mode",
    "hindu"
  ],
  ["1P 2M 3M 4A 5P 6M 7m", "lydian dominant", "lydian b7", "overtone"],
  ["1P 2M 3M 4A 5A 6M 7M", "lydian augmented"],
  [
    "1P 2m 3m 4P 5P 6M 7m",
    "dorian b2",
    "phrygian #6",
    "melodic minor second mode"
  ],
  [
    "1P 2m 3m 4d 5d 6m 7d",
    "ultralocrian",
    "superlocrian bb7",
    "superlocrian diminished"
  ],
  ["1P 2m 3m 4P 5d 6M 7m", "locrian 6", "locrian natural 6", "locrian sharp 6"],
  ["1P 2A 3M 4P 5P 5A 7M", "augmented heptatonic"],
  // Source https://en.wikipedia.org/wiki/Ukrainian_Dorian_scale
  [
    "1P 2M 3m 4A 5P 6M 7m",
    "dorian #4",
    "ukrainian dorian",
    "romanian minor",
    "altered dorian"
  ],
  ["1P 2M 3m 4A 5P 6M 7M", "lydian diminished"],
  ["1P 2M 3M 4A 5A 7m 7M", "leading whole tone"],
  ["1P 2M 3M 4A 5P 6m 7m", "lydian minor"],
  ["1P 2m 3M 4P 5P 6m 7m", "phrygian dominant", "spanish", "phrygian major"],
  ["1P 2m 3m 4P 5P 6m 7M", "balinese"],
  ["1P 2m 3m 4P 5P 6M 7M", "neopolitan major"],
  ["1P 2M 3M 4P 5P 6m 7M", "harmonic major"],
  ["1P 2m 3M 4P 5P 6m 7M", "double harmonic major", "gypsy"],
  ["1P 2M 3m 4A 5P 6m 7M", "hungarian minor"],
  ["1P 2A 3M 4A 5P 6M 7m", "hungarian major"],
  ["1P 2m 3M 4P 5d 6M 7m", "oriental"],
  ["1P 2m 3m 3M 4A 5P 7m", "flamenco"],
  ["1P 2m 3m 4A 5P 6m 7M", "todi raga"],
  ["1P 2m 3M 4P 5d 6m 7M", "persian"],
  ["1P 2m 3M 5d 6m 7m 7M", "enigmatic"],
  [
    "1P 2M 3M 4P 5A 6M 7M",
    "major augmented",
    "major #5",
    "ionian augmented",
    "ionian #5"
  ],
  ["1P 2A 3M 4A 5P 6M 7M", "lydian #9"],
  // 8-note scales
  ["1P 2m 2M 4P 4A 5P 6m 7M", "messiaen's mode #4"],
  ["1P 2m 3M 4P 4A 5P 6m 7M", "purvi raga"],
  ["1P 2m 3m 3M 4P 5P 6m 7m", "spanish heptatonic"],
  ["1P 2M 3m 3M 4P 5P 6M 7m", "bebop minor"],
  ["1P 2M 3M 4P 5P 5A 6M 7M", "bebop major"],
  ["1P 2m 3m 4P 5d 5P 6m 7m", "bebop locrian"],
  ["1P 2M 3m 4P 5P 6m 7m 7M", "minor bebop"],
  ["1P 2M 3M 4P 5d 5P 6M 7M", "ichikosucho"],
  ["1P 2M 3m 4P 5P 6m 6M 7M", "minor six diminished"],
  [
    "1P 2m 3m 3M 4A 5P 6M 7m",
    "half-whole diminished",
    "dominant diminished",
    "messiaen's mode #2"
  ],
  ["1P 3m 3M 4P 5P 6M 7m 7M", "kafi raga"],
  ["1P 2M 3M 4P 4A 5A 6A 7M", "messiaen's mode #6"],
  // 9-note scales
  ["1P 2M 3m 3M 4P 5d 5P 6M 7m", "composite blues"],
  ["1P 2M 3m 3M 4A 5P 6m 7m 7M", "messiaen's mode #3"],
  // 10-note scales
  ["1P 2m 2M 3m 4P 4A 5P 6m 6M 7M", "messiaen's mode #7"],
  // 12-note scales
  ["1P 2m 2M 3m 3M 4P 5d 5P 6m 6M 7m 7M", "chromatic"]
];
var data_default = SCALES;

// index.ts
var NoScaleType = {
  ..._tonaljs_pcset__WEBPACK_IMPORTED_MODULE_0__.EmptyPcset,
  intervals: [],
  aliases: []
};
var dictionary = [];
var index = {};
function names() {
  return dictionary.map((scale) => scale.name);
}
function get(type) {
  return index[type] || NoScaleType;
}
var scaleType = get;
function all() {
  return dictionary.slice();
}
var entries = all;
function keys() {
  return Object.keys(index);
}
function removeAll() {
  dictionary = [];
  index = {};
}
function add(intervals, name, aliases = []) {
  const scale = { ...(0,_tonaljs_pcset__WEBPACK_IMPORTED_MODULE_0__.get)(intervals), name, intervals, aliases };
  dictionary.push(scale);
  index[scale.name] = scale;
  index[scale.setNum] = scale;
  index[scale.chroma] = scale;
  scale.aliases.forEach((alias) => addAlias(scale, alias));
  return scale;
}
function addAlias(scale, alias) {
  index[alias] = scale;
}
data_default.forEach(
  ([ivls, name, ...aliases]) => add(ivls.split(" "), name, aliases)
);
var scale_type_default = {
  names,
  get,
  all,
  add,
  removeAll,
  keys,
  // deprecated
  entries,
  scaleType
};

//# sourceMappingURL=index.mjs.map

/***/ }),

/***/ "./node_modules/@tonaljs/scale/dist/index.mjs":
/*!****************************************************!*\
  !*** ./node_modules/@tonaljs/scale/dist/index.mjs ***!
  \****************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ scale_default),
/* harmony export */   degrees: () => (/* binding */ degrees),
/* harmony export */   detect: () => (/* binding */ detect),
/* harmony export */   extended: () => (/* binding */ extended),
/* harmony export */   get: () => (/* binding */ get),
/* harmony export */   modeNames: () => (/* binding */ modeNames),
/* harmony export */   names: () => (/* binding */ names),
/* harmony export */   rangeOf: () => (/* binding */ rangeOf),
/* harmony export */   reduced: () => (/* binding */ reduced),
/* harmony export */   scale: () => (/* binding */ scale),
/* harmony export */   scaleChords: () => (/* binding */ scaleChords),
/* harmony export */   scaleNotes: () => (/* binding */ scaleNotes),
/* harmony export */   steps: () => (/* binding */ steps),
/* harmony export */   tokenize: () => (/* binding */ tokenize)
/* harmony export */ });
/* harmony import */ var _tonaljs_chord_type__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @tonaljs/chord-type */ "./node_modules/@tonaljs/chord-type/dist/index.mjs");
/* harmony import */ var _tonaljs_collection__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @tonaljs/collection */ "./node_modules/@tonaljs/collection/dist/index.mjs");
/* harmony import */ var _tonaljs_note__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @tonaljs/note */ "./node_modules/@tonaljs/note/dist/index.mjs");
/* harmony import */ var _tonaljs_pcset__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @tonaljs/pcset */ "./node_modules/@tonaljs/pcset/dist/index.mjs");
/* harmony import */ var _tonaljs_pitch_distance__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @tonaljs/pitch-distance */ "./node_modules/@tonaljs/pitch-distance/dist/index.mjs");
/* harmony import */ var _tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @tonaljs/pitch-note */ "./node_modules/@tonaljs/pitch-note/dist/index.mjs");
/* harmony import */ var _tonaljs_scale_type__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @tonaljs/scale-type */ "./node_modules/@tonaljs/scale-type/dist/index.mjs");
// index.ts







var NoScale = {
  empty: true,
  name: "",
  type: "",
  tonic: null,
  setNum: NaN,
  chroma: "",
  normalized: "",
  aliases: [],
  notes: [],
  intervals: []
};
function tokenize(name) {
  if (typeof name !== "string") {
    return ["", ""];
  }
  const i = name.indexOf(" ");
  const tonic = (0,_tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_5__.note)(name.substring(0, i));
  if (tonic.empty) {
    const n = (0,_tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_5__.note)(name);
    return n.empty ? ["", name] : [n.name, ""];
  }
  const type = name.substring(tonic.name.length + 1).toLowerCase();
  return [tonic.name, type.length ? type : ""];
}
var names = _tonaljs_scale_type__WEBPACK_IMPORTED_MODULE_6__.names;
function get(src) {
  const tokens = Array.isArray(src) ? src : tokenize(src);
  const tonic = (0,_tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_5__.note)(tokens[0]).name;
  const st = (0,_tonaljs_scale_type__WEBPACK_IMPORTED_MODULE_6__.get)(tokens[1]);
  if (st.empty) {
    return NoScale;
  }
  const type = st.name;
  const notes = tonic ? st.intervals.map((i) => (0,_tonaljs_pitch_distance__WEBPACK_IMPORTED_MODULE_4__.transpose)(tonic, i)) : [];
  const name = tonic ? tonic + " " + type : type;
  return { ...st, name, type, tonic, notes };
}
var scale = get;
function detect(notes, options = {}) {
  const notesChroma = (0,_tonaljs_pcset__WEBPACK_IMPORTED_MODULE_3__.chroma)(notes);
  const tonic = (0,_tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_5__.note)(options.tonic ?? notes[0] ?? "");
  const tonicChroma = tonic.chroma;
  if (tonicChroma === void 0) {
    return [];
  }
  const pitchClasses = notesChroma.split("");
  pitchClasses[tonicChroma] = "1";
  const scaleChroma = (0,_tonaljs_collection__WEBPACK_IMPORTED_MODULE_1__.rotate)(tonicChroma, pitchClasses).join("");
  const match = (0,_tonaljs_scale_type__WEBPACK_IMPORTED_MODULE_6__.all)().find((scaleType) => scaleType.chroma === scaleChroma);
  const results = [];
  if (match) {
    results.push(tonic.name + " " + match.name);
  }
  if (options.match === "exact") {
    return results;
  }
  extended(scaleChroma).forEach((scaleName) => {
    results.push(tonic.name + " " + scaleName);
  });
  return results;
}
function scaleChords(name) {
  const s = get(name);
  const inScale = (0,_tonaljs_pcset__WEBPACK_IMPORTED_MODULE_3__.isSubsetOf)(s.chroma);
  return (0,_tonaljs_chord_type__WEBPACK_IMPORTED_MODULE_0__.all)().filter((chord) => inScale(chord.chroma)).map((chord) => chord.aliases[0]);
}
function extended(name) {
  const chroma2 = (0,_tonaljs_pcset__WEBPACK_IMPORTED_MODULE_3__.isChroma)(name) ? name : get(name).chroma;
  const isSuperset = (0,_tonaljs_pcset__WEBPACK_IMPORTED_MODULE_3__.isSupersetOf)(chroma2);
  return (0,_tonaljs_scale_type__WEBPACK_IMPORTED_MODULE_6__.all)().filter((scale2) => isSuperset(scale2.chroma)).map((scale2) => scale2.name);
}
function reduced(name) {
  const isSubset = (0,_tonaljs_pcset__WEBPACK_IMPORTED_MODULE_3__.isSubsetOf)(get(name).chroma);
  return (0,_tonaljs_scale_type__WEBPACK_IMPORTED_MODULE_6__.all)().filter((scale2) => isSubset(scale2.chroma)).map((scale2) => scale2.name);
}
function scaleNotes(notes) {
  const pcset = notes.map((n) => (0,_tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_5__.note)(n).pc).filter((x) => x);
  const tonic = pcset[0];
  const scale2 = (0,_tonaljs_note__WEBPACK_IMPORTED_MODULE_2__.sortedUniqNames)(pcset);
  return (0,_tonaljs_collection__WEBPACK_IMPORTED_MODULE_1__.rotate)(scale2.indexOf(tonic), scale2);
}
function modeNames(name) {
  const s = get(name);
  if (s.empty) {
    return [];
  }
  const tonics = s.tonic ? s.notes : s.intervals;
  return (0,_tonaljs_pcset__WEBPACK_IMPORTED_MODULE_3__.modes)(s.chroma).map((chroma2, i) => {
    const modeName = get(chroma2).name;
    return modeName ? [tonics[i], modeName] : ["", ""];
  }).filter((x) => x[0]);
}
function getNoteNameOf(scale2) {
  const names2 = Array.isArray(scale2) ? scaleNotes(scale2) : get(scale2).notes;
  const chromas = names2.map((name) => (0,_tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_5__.note)(name).chroma);
  return (noteOrMidi) => {
    const currNote = typeof noteOrMidi === "number" ? (0,_tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_5__.note)((0,_tonaljs_note__WEBPACK_IMPORTED_MODULE_2__.fromMidi)(noteOrMidi)) : (0,_tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_5__.note)(noteOrMidi);
    const height = currNote.height;
    if (height === void 0) return void 0;
    const chroma2 = height % 12;
    const position = chromas.indexOf(chroma2);
    if (position === -1) return void 0;
    return (0,_tonaljs_note__WEBPACK_IMPORTED_MODULE_2__.enharmonic)(currNote.name, names2[position]);
  };
}
function rangeOf(scale2) {
  const getName = getNoteNameOf(scale2);
  return (fromNote, toNote) => {
    const from = (0,_tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_5__.note)(fromNote).height;
    const to = (0,_tonaljs_pitch_note__WEBPACK_IMPORTED_MODULE_5__.note)(toNote).height;
    if (from === void 0 || to === void 0) return [];
    return (0,_tonaljs_collection__WEBPACK_IMPORTED_MODULE_1__.range)(from, to).map(getName).filter((x) => x);
  };
}
function degrees(scaleName) {
  const { intervals, tonic } = get(scaleName);
  const transpose2 = (0,_tonaljs_pitch_distance__WEBPACK_IMPORTED_MODULE_4__.tonicIntervalsTransposer)(intervals, tonic);
  return (degree) => degree ? transpose2(degree > 0 ? degree - 1 : degree) : "";
}
function steps(scaleName) {
  const { intervals, tonic } = get(scaleName);
  return (0,_tonaljs_pitch_distance__WEBPACK_IMPORTED_MODULE_4__.tonicIntervalsTransposer)(intervals, tonic);
}
var scale_default = {
  degrees,
  detect,
  extended,
  get,
  modeNames,
  names,
  rangeOf,
  reduced,
  scaleChords,
  scaleNotes,
  steps,
  tokenize,
  // deprecated
  scale
};

//# sourceMappingURL=index.mjs.map

/***/ }),

/***/ "./node_modules/@tonaljs/time-signature/dist/index.mjs":
/*!*************************************************************!*\
  !*** ./node_modules/@tonaljs/time-signature/dist/index.mjs ***!
  \*************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ time_signature_default),
/* harmony export */   get: () => (/* binding */ get),
/* harmony export */   names: () => (/* binding */ names),
/* harmony export */   parse: () => (/* binding */ parse)
/* harmony export */ });
// index.ts
var NONE = {
  empty: true,
  name: "",
  upper: void 0,
  lower: void 0,
  type: void 0,
  additive: []
};
var NAMES = ["4/4", "3/4", "2/4", "2/2", "12/8", "9/8", "6/8", "3/8"];
function names() {
  return NAMES.slice();
}
var REGEX = /^(\d*\d(?:\+\d)*)\/(\d+)$/;
var CACHE = /* @__PURE__ */ new Map();
function get(literal) {
  const stringifiedLiteral = JSON.stringify(literal);
  const cached = CACHE.get(stringifiedLiteral);
  if (cached) {
    return cached;
  }
  const ts = build(parse(literal));
  CACHE.set(stringifiedLiteral, ts);
  return ts;
}
function parse(literal) {
  if (typeof literal === "string") {
    const [_, up2, low] = REGEX.exec(literal) || [];
    return parse([up2, low]);
  }
  const [up, down] = literal;
  const denominator = +down;
  if (typeof up === "number") {
    return [up, denominator];
  }
  const list = up.split("+").map((n) => +n);
  return list.length === 1 ? [list[0], denominator] : [list, denominator];
}
var time_signature_default = { names, parse, get };
var isPowerOfTwo = (x) => Math.log(x) / Math.log(2) % 1 === 0;
function build([up, down]) {
  const upper = Array.isArray(up) ? up.reduce((a, b) => a + b, 0) : up;
  const lower = down;
  if (upper === 0 || lower === 0) {
    return NONE;
  }
  const name = Array.isArray(up) ? `${up.join("+")}/${down}` : `${up}/${down}`;
  const additive = Array.isArray(up) ? up : [];
  const type = lower === 4 || lower === 2 ? "simple" : lower === 8 && upper % 3 === 0 ? "compound" : isPowerOfTwo(lower) ? "irregular" : "irrational";
  return {
    empty: false,
    name,
    type,
    upper,
    lower,
    additive
  };
}

//# sourceMappingURL=index.mjs.map

/***/ }),

/***/ "./node_modules/@tonaljs/voice-leading/dist/index.mjs":
/*!************************************************************!*\
  !*** ./node_modules/@tonaljs/voice-leading/dist/index.mjs ***!
  \************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ voice_leading_default),
/* harmony export */   topNoteDiff: () => (/* binding */ topNoteDiff)
/* harmony export */ });
/* harmony import */ var _tonaljs_note__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @tonaljs/note */ "./node_modules/@tonaljs/note/dist/index.mjs");
// index.ts

var topNoteDiff = (voicings, lastVoicing) => {
  if (!lastVoicing || !lastVoicing.length) {
    return voicings[0];
  }
  const topNoteMidi = (voicing) => _tonaljs_note__WEBPACK_IMPORTED_MODULE_0__["default"].midi(voicing[voicing.length - 1]) || 0;
  const diff = (voicing) => Math.abs(topNoteMidi(lastVoicing) - topNoteMidi(voicing));
  return voicings.sort((a, b) => diff(a) - diff(b))[0];
};
var voice_leading_default = {
  topNoteDiff
};

//# sourceMappingURL=index.mjs.map

/***/ }),

/***/ "./node_modules/@tonaljs/voicing-dictionary/dist/index.mjs":
/*!*****************************************************************!*\
  !*** ./node_modules/@tonaljs/voicing-dictionary/dist/index.mjs ***!
  \*****************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   all: () => (/* binding */ all),
/* harmony export */   "default": () => (/* binding */ voicing_dictionary_default),
/* harmony export */   defaultDictionary: () => (/* binding */ defaultDictionary),
/* harmony export */   lefthand: () => (/* binding */ lefthand),
/* harmony export */   lookup: () => (/* binding */ lookup),
/* harmony export */   triads: () => (/* binding */ triads)
/* harmony export */ });
/* harmony import */ var _tonaljs_chord__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @tonaljs/chord */ "./node_modules/@tonaljs/chord/dist/index.mjs");
// index.ts


// data.ts
var triads = {
  M: ["1P 3M 5P", "3M 5P 8P", "5P 8P 10M"],
  m: ["1P 3m 5P", "3m 5P 8P", "5P 8P 10m"],
  o: ["1P 3m 5d", "3m 5d 8P", "5d 8P 10m"],
  aug: ["1P 3m 5A", "3m 5A 8P", "5A 8P 10m"]
};
var lefthand = {
  m7: ["3m 5P 7m 9M", "7m 9M 10m 12P"],
  "7": ["3M 6M 7m 9M", "7m 9M 10M 13M"],
  "^7": ["3M 5P 7M 9M", "7M 9M 10M 12P"],
  "69": ["3M 5P 6A 9M"],
  m7b5: ["3m 5d 7m 8P", "7m 8P 10m 12d"],
  "7b9": ["3M 6m 7m 9m", "7m 9m 10M 13m"],
  // b9 / b13
  "7b13": ["3M 6m 7m 9m", "7m 9m 10M 13m"],
  // b9 / b13
  o7: ["1P 3m 5d 6M", "5d 6M 8P 10m"],
  "7#11": ["7m 9M 11A 13A"],
  "7#9": ["3M 7m 9A"],
  mM7: ["3m 5P 7M 9M", "7M 9M 10m 12P"],
  m6: ["3m 5P 6M 9M", "6M 9M 10m 12P"]
};
var all = {
  M: ["1P 3M 5P", "3M 5P 8P", "5P 8P 10M"],
  m: ["1P 3m 5P", "3m 5P 8P", "5P 8P 10m"],
  o: ["1P 3m 5d", "3m 5d 8P", "5d 8P 10m"],
  aug: ["1P 3m 5A", "3m 5A 8P", "5A 8P 10m"],
  m7: ["3m 5P 7m 9M", "7m 9M 10m 12P"],
  "7": ["3M 6M 7m 9M", "7m 9M 10M 13M"],
  "^7": ["3M 5P 7M 9M", "7M 9M 10M 12P"],
  "69": ["3M 5P 6A 9M"],
  m7b5: ["3m 5d 7m 8P", "7m 8P 10m 12d"],
  "7b9": ["3M 6m 7m 9m", "7m 9m 10M 13m"],
  // b9 / b13
  "7b13": ["3M 6m 7m 9m", "7m 9m 10M 13m"],
  // b9 / b13
  o7: ["1P 3m 5d 6M", "5d 6M 8P 10m"],
  "7#11": ["7m 9M 11A 13A"],
  "7#9": ["3M 7m 9A"],
  mM7: ["3m 5P 7M 9M", "7M 9M 10m 12P"],
  m6: ["3m 5P 6M 9M", "6M 9M 10m 12P"]
};

// index.ts
var defaultDictionary = lefthand;
function lookup(symbol, dictionary = defaultDictionary) {
  if (dictionary[symbol]) {
    return dictionary[symbol];
  }
  const { aliases } = _tonaljs_chord__WEBPACK_IMPORTED_MODULE_0__["default"].get("C" + symbol);
  const match = Object.keys(dictionary).find((_symbol) => aliases.includes(_symbol)) || "";
  if (match !== void 0) {
    return dictionary[match];
  }
  return void 0;
}
var voicing_dictionary_default = {
  lookup,
  lefthand,
  triads,
  all,
  defaultDictionary
};

//# sourceMappingURL=index.mjs.map

/***/ }),

/***/ "./node_modules/@tonaljs/voicing/dist/index.mjs":
/*!******************************************************!*\
  !*** ./node_modules/@tonaljs/voicing/dist/index.mjs ***!
  \******************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ voicing_default),
/* harmony export */   get: () => (/* binding */ get),
/* harmony export */   search: () => (/* binding */ search),
/* harmony export */   sequence: () => (/* binding */ sequence)
/* harmony export */ });
/* harmony import */ var _tonaljs_chord__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @tonaljs/chord */ "./node_modules/@tonaljs/chord/dist/index.mjs");
/* harmony import */ var _tonaljs_interval__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @tonaljs/interval */ "./node_modules/@tonaljs/interval/dist/index.mjs");
/* harmony import */ var _tonaljs_note__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @tonaljs/note */ "./node_modules/@tonaljs/note/dist/index.mjs");
/* harmony import */ var _tonaljs_range__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @tonaljs/range */ "./node_modules/@tonaljs/range/dist/index.mjs");
/* harmony import */ var _tonaljs_voice_leading__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @tonaljs/voice-leading */ "./node_modules/@tonaljs/voice-leading/dist/index.mjs");
/* harmony import */ var _tonaljs_voicing_dictionary__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @tonaljs/voicing-dictionary */ "./node_modules/@tonaljs/voicing-dictionary/dist/index.mjs");
// index.ts






var defaultRange = ["C3", "C5"];
var defaultDictionary = _tonaljs_voicing_dictionary__WEBPACK_IMPORTED_MODULE_5__["default"].all;
var defaultVoiceLeading = _tonaljs_voice_leading__WEBPACK_IMPORTED_MODULE_4__["default"].topNoteDiff;
function get(chord, range = defaultRange, dictionary = defaultDictionary, voiceLeading = defaultVoiceLeading, lastVoicing) {
  const voicings = search(chord, range, dictionary);
  if (!lastVoicing || !lastVoicing.length) {
    return voicings[0];
  } else {
    return voiceLeading(voicings, lastVoicing);
  }
}
function search(chord, range = defaultRange, dictionary = _tonaljs_voicing_dictionary__WEBPACK_IMPORTED_MODULE_5__["default"].triads) {
  const [tonic, symbol] = _tonaljs_chord__WEBPACK_IMPORTED_MODULE_0__["default"].tokenize(chord);
  const sets = _tonaljs_voicing_dictionary__WEBPACK_IMPORTED_MODULE_5__["default"].lookup(symbol, dictionary);
  if (!sets) {
    return [];
  }
  const voicings = sets.map((intervals) => intervals.split(" "));
  const notesInRange = _tonaljs_range__WEBPACK_IMPORTED_MODULE_3__["default"].chromatic(range);
  return voicings.reduce((voiced, voicing) => {
    const relativeIntervals = voicing.map(
      (interval) => _tonaljs_interval__WEBPACK_IMPORTED_MODULE_1__["default"].subtract(interval, voicing[0]) || ""
    );
    const bottomPitchClass = _tonaljs_note__WEBPACK_IMPORTED_MODULE_2__["default"].transpose(tonic, voicing[0]);
    const starts = notesInRange.filter((note) => _tonaljs_note__WEBPACK_IMPORTED_MODULE_2__["default"].chroma(note) === _tonaljs_note__WEBPACK_IMPORTED_MODULE_2__["default"].chroma(bottomPitchClass)).filter(
      (note) => (_tonaljs_note__WEBPACK_IMPORTED_MODULE_2__["default"].midi(
        _tonaljs_note__WEBPACK_IMPORTED_MODULE_2__["default"].transpose(
          note,
          relativeIntervals[relativeIntervals.length - 1]
        )
      ) || 0) <= (_tonaljs_note__WEBPACK_IMPORTED_MODULE_2__["default"].midi(range[1]) || 0)
    ).map((note) => _tonaljs_note__WEBPACK_IMPORTED_MODULE_2__["default"].enharmonic(note, bottomPitchClass));
    const notes = starts.map(
      (start) => relativeIntervals.map((interval) => _tonaljs_note__WEBPACK_IMPORTED_MODULE_2__["default"].transpose(start, interval))
    );
    return voiced.concat(notes);
  }, []);
}
function sequence(chords, range = defaultRange, dictionary = defaultDictionary, voiceLeading = defaultVoiceLeading, lastVoicing) {
  const { voicings } = chords.reduce(
    ({ voicings: voicings2, lastVoicing: lastVoicing2 }, chord) => {
      const voicing = get(chord, range, dictionary, voiceLeading, lastVoicing2);
      lastVoicing2 = voicing;
      voicings2.push(voicing);
      return { voicings: voicings2, lastVoicing: lastVoicing2 };
    },
    { voicings: [], lastVoicing }
  );
  return voicings;
}
var voicing_default = {
  get,
  search,
  sequence
};

//# sourceMappingURL=index.mjs.map

/***/ }),

/***/ "./node_modules/tonal/dist/index.mjs":
/*!*******************************************!*\
  !*** ./node_modules/tonal/dist/index.mjs ***!
  \*******************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   AbcNotation: () => (/* reexport module object */ _tonaljs_abc_notation__WEBPACK_IMPORTED_MODULE_0__),
/* harmony export */   Array: () => (/* reexport module object */ _tonaljs_array__WEBPACK_IMPORTED_MODULE_1__),
/* harmony export */   Chord: () => (/* reexport module object */ _tonaljs_chord__WEBPACK_IMPORTED_MODULE_2__),
/* harmony export */   ChordDictionary: () => (/* binding */ ChordDictionary),
/* harmony export */   ChordType: () => (/* reexport module object */ _tonaljs_chord_type__WEBPACK_IMPORTED_MODULE_3__),
/* harmony export */   Collection: () => (/* reexport module object */ _tonaljs_collection__WEBPACK_IMPORTED_MODULE_4__),
/* harmony export */   Core: () => (/* reexport module object */ _tonaljs_core__WEBPACK_IMPORTED_MODULE_22__),
/* harmony export */   DurationValue: () => (/* reexport module object */ _tonaljs_duration_value__WEBPACK_IMPORTED_MODULE_5__),
/* harmony export */   Interval: () => (/* reexport module object */ _tonaljs_interval__WEBPACK_IMPORTED_MODULE_6__),
/* harmony export */   Key: () => (/* reexport module object */ _tonaljs_key__WEBPACK_IMPORTED_MODULE_7__),
/* harmony export */   Midi: () => (/* reexport module object */ _tonaljs_midi__WEBPACK_IMPORTED_MODULE_8__),
/* harmony export */   Mode: () => (/* reexport module object */ _tonaljs_mode__WEBPACK_IMPORTED_MODULE_9__),
/* harmony export */   Note: () => (/* reexport module object */ _tonaljs_note__WEBPACK_IMPORTED_MODULE_10__),
/* harmony export */   PcSet: () => (/* binding */ PcSet),
/* harmony export */   Pcset: () => (/* reexport module object */ _tonaljs_pcset__WEBPACK_IMPORTED_MODULE_11__),
/* harmony export */   Progression: () => (/* reexport module object */ _tonaljs_progression__WEBPACK_IMPORTED_MODULE_12__),
/* harmony export */   Range: () => (/* reexport module object */ _tonaljs_range__WEBPACK_IMPORTED_MODULE_13__),
/* harmony export */   RhythmPattern: () => (/* reexport module object */ _tonaljs_rhythm_pattern__WEBPACK_IMPORTED_MODULE_14__),
/* harmony export */   RomanNumeral: () => (/* reexport module object */ _tonaljs_roman_numeral__WEBPACK_IMPORTED_MODULE_15__),
/* harmony export */   Scale: () => (/* reexport module object */ _tonaljs_scale__WEBPACK_IMPORTED_MODULE_16__),
/* harmony export */   ScaleDictionary: () => (/* binding */ ScaleDictionary),
/* harmony export */   ScaleType: () => (/* reexport module object */ _tonaljs_scale_type__WEBPACK_IMPORTED_MODULE_17__),
/* harmony export */   TimeSignature: () => (/* reexport module object */ _tonaljs_time_signature__WEBPACK_IMPORTED_MODULE_18__),
/* harmony export */   Tonal: () => (/* binding */ Tonal),
/* harmony export */   VoiceLeading: () => (/* reexport module object */ _tonaljs_voice_leading__WEBPACK_IMPORTED_MODULE_19__),
/* harmony export */   Voicing: () => (/* reexport module object */ _tonaljs_voicing__WEBPACK_IMPORTED_MODULE_20__),
/* harmony export */   VoicingDictionary: () => (/* reexport module object */ _tonaljs_voicing_dictionary__WEBPACK_IMPORTED_MODULE_21__),
/* harmony export */   accToAlt: () => (/* reexport safe */ _tonaljs_core__WEBPACK_IMPORTED_MODULE_22__.accToAlt),
/* harmony export */   altToAcc: () => (/* reexport safe */ _tonaljs_core__WEBPACK_IMPORTED_MODULE_22__.altToAcc),
/* harmony export */   chroma: () => (/* reexport safe */ _tonaljs_core__WEBPACK_IMPORTED_MODULE_22__.chroma),
/* harmony export */   coordToInterval: () => (/* reexport safe */ _tonaljs_core__WEBPACK_IMPORTED_MODULE_22__.coordToInterval),
/* harmony export */   coordToNote: () => (/* reexport safe */ _tonaljs_core__WEBPACK_IMPORTED_MODULE_22__.coordToNote),
/* harmony export */   coordinates: () => (/* reexport safe */ _tonaljs_core__WEBPACK_IMPORTED_MODULE_22__.coordinates),
/* harmony export */   deprecate: () => (/* reexport safe */ _tonaljs_core__WEBPACK_IMPORTED_MODULE_22__.deprecate),
/* harmony export */   distance: () => (/* reexport safe */ _tonaljs_core__WEBPACK_IMPORTED_MODULE_22__.distance),
/* harmony export */   fillStr: () => (/* reexport safe */ _tonaljs_core__WEBPACK_IMPORTED_MODULE_22__.fillStr),
/* harmony export */   height: () => (/* reexport safe */ _tonaljs_core__WEBPACK_IMPORTED_MODULE_22__.height),
/* harmony export */   interval: () => (/* reexport safe */ _tonaljs_core__WEBPACK_IMPORTED_MODULE_22__.interval),
/* harmony export */   isNamed: () => (/* reexport safe */ _tonaljs_core__WEBPACK_IMPORTED_MODULE_22__.isNamed),
/* harmony export */   isNamedPitch: () => (/* reexport safe */ _tonaljs_core__WEBPACK_IMPORTED_MODULE_22__.isNamedPitch),
/* harmony export */   isPitch: () => (/* reexport safe */ _tonaljs_core__WEBPACK_IMPORTED_MODULE_22__.isPitch),
/* harmony export */   midi: () => (/* reexport safe */ _tonaljs_core__WEBPACK_IMPORTED_MODULE_22__.midi),
/* harmony export */   note: () => (/* reexport safe */ _tonaljs_core__WEBPACK_IMPORTED_MODULE_22__.note),
/* harmony export */   pitch: () => (/* reexport safe */ _tonaljs_core__WEBPACK_IMPORTED_MODULE_22__.pitch),
/* harmony export */   stepToLetter: () => (/* reexport safe */ _tonaljs_core__WEBPACK_IMPORTED_MODULE_22__.stepToLetter),
/* harmony export */   tokenizeInterval: () => (/* reexport safe */ _tonaljs_core__WEBPACK_IMPORTED_MODULE_22__.tokenizeInterval),
/* harmony export */   tokenizeNote: () => (/* reexport safe */ _tonaljs_core__WEBPACK_IMPORTED_MODULE_22__.tokenizeNote),
/* harmony export */   tonicIntervalsTransposer: () => (/* reexport safe */ _tonaljs_core__WEBPACK_IMPORTED_MODULE_22__.tonicIntervalsTransposer),
/* harmony export */   transpose: () => (/* reexport safe */ _tonaljs_core__WEBPACK_IMPORTED_MODULE_22__.transpose)
/* harmony export */ });
/* harmony import */ var _tonaljs_abc_notation__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @tonaljs/abc-notation */ "./node_modules/@tonaljs/abc-notation/dist/index.mjs");
/* harmony import */ var _tonaljs_array__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @tonaljs/array */ "./node_modules/@tonaljs/array/dist/index.mjs");
/* harmony import */ var _tonaljs_chord__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @tonaljs/chord */ "./node_modules/@tonaljs/chord/dist/index.mjs");
/* harmony import */ var _tonaljs_chord_type__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @tonaljs/chord-type */ "./node_modules/@tonaljs/chord-type/dist/index.mjs");
/* harmony import */ var _tonaljs_collection__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @tonaljs/collection */ "./node_modules/@tonaljs/collection/dist/index.mjs");
/* harmony import */ var _tonaljs_duration_value__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @tonaljs/duration-value */ "./node_modules/@tonaljs/duration-value/dist/index.mjs");
/* harmony import */ var _tonaljs_interval__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @tonaljs/interval */ "./node_modules/@tonaljs/interval/dist/index.mjs");
/* harmony import */ var _tonaljs_key__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @tonaljs/key */ "./node_modules/@tonaljs/key/dist/index.mjs");
/* harmony import */ var _tonaljs_midi__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @tonaljs/midi */ "./node_modules/@tonaljs/midi/dist/index.mjs");
/* harmony import */ var _tonaljs_mode__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @tonaljs/mode */ "./node_modules/@tonaljs/mode/dist/index.mjs");
/* harmony import */ var _tonaljs_note__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @tonaljs/note */ "./node_modules/@tonaljs/note/dist/index.mjs");
/* harmony import */ var _tonaljs_pcset__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @tonaljs/pcset */ "./node_modules/@tonaljs/pcset/dist/index.mjs");
/* harmony import */ var _tonaljs_progression__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @tonaljs/progression */ "./node_modules/@tonaljs/progression/dist/index.mjs");
/* harmony import */ var _tonaljs_range__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @tonaljs/range */ "./node_modules/@tonaljs/range/dist/index.mjs");
/* harmony import */ var _tonaljs_rhythm_pattern__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @tonaljs/rhythm-pattern */ "./node_modules/@tonaljs/rhythm-pattern/dist/index.mjs");
/* harmony import */ var _tonaljs_roman_numeral__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @tonaljs/roman-numeral */ "./node_modules/@tonaljs/roman-numeral/dist/index.mjs");
/* harmony import */ var _tonaljs_scale__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @tonaljs/scale */ "./node_modules/@tonaljs/scale/dist/index.mjs");
/* harmony import */ var _tonaljs_scale_type__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! @tonaljs/scale-type */ "./node_modules/@tonaljs/scale-type/dist/index.mjs");
/* harmony import */ var _tonaljs_time_signature__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! @tonaljs/time-signature */ "./node_modules/@tonaljs/time-signature/dist/index.mjs");
/* harmony import */ var _tonaljs_voice_leading__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! @tonaljs/voice-leading */ "./node_modules/@tonaljs/voice-leading/dist/index.mjs");
/* harmony import */ var _tonaljs_voicing__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! @tonaljs/voicing */ "./node_modules/@tonaljs/voicing/dist/index.mjs");
/* harmony import */ var _tonaljs_voicing_dictionary__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! @tonaljs/voicing-dictionary */ "./node_modules/@tonaljs/voicing-dictionary/dist/index.mjs");
/* harmony import */ var _tonaljs_core__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! @tonaljs/core */ "./node_modules/@tonaljs/core/dist/index.mjs");
// index.ts
























var Tonal = _tonaljs_core__WEBPACK_IMPORTED_MODULE_22__;
var PcSet = _tonaljs_pcset__WEBPACK_IMPORTED_MODULE_11__;
var ChordDictionary = _tonaljs_chord_type__WEBPACK_IMPORTED_MODULE_3__;
var ScaleDictionary = _tonaljs_scale_type__WEBPACK_IMPORTED_MODULE_17__;

//# sourceMappingURL=index.mjs.map

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
/*!**********************!*\
  !*** ./src/index.js ***!
  \**********************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _ui__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./ui */ "./src/ui.js");
/* harmony import */ var _player__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./player */ "./src/player.js");




window.compostState = _player__WEBPACK_IMPORTED_MODULE_1__.compostState;
window.pl = _player__WEBPACK_IMPORTED_MODULE_1__.compostState.playStep;

compostState.ui = _ui__WEBPACK_IMPORTED_MODULE_0__.getUiElement();

let loopCheckbox = _ui__WEBPACK_IMPORTED_MODULE_0__.getLoopCheckbox();

loopCheckbox.onchange = () => {
    if (loopCheckbox.checked && !compostState.playing){
        _player__WEBPACK_IMPORTED_MODULE_1__.playStep();
    }
}


//window.buckets = quantize(169, 16, Key.majorKey("C"), "pentatonic")
//playStep();
/******/ })()
;