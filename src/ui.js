import * as Player from "./player"

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

export function getUiElement(){
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
    let arrOrder = addTextInput(arrangement, arrangementMeasureOrderId, "measure order", JSON.stringify(Player.compostState.arrangement.measureOrder));
    arrOrder.addEventListener("keyup", (ev) => {
        if (ev.key === "Enter"){
            trySetFromJson(arrOrder.value, (val) => Player.compostState.arrangement.measureOrder = val)
        }
    });
    let arrSampF = addTextInput(arrangement, arrangementSampleFactorId, "sample factor", JSON.stringify(Player.compostState.arrangement.sampleFactor))
    arrSampF.addEventListener("keyup", (ev) => {
        if (ev.key === "Enter"){
            trySetFromJson(arrSampF.value, (val) => Player.compostState.arrangement.sampleFactor = val)
        }
    });
    ui.appendChild(arrangement);
    let contentTypeMap = detailsContainer(ui, "content type map")
    
    addTextArea(contentTypeMap, contentTypeMapId, JSON.stringify(Player.compostState.contentTypeMapping, null, 2), 5, (text) => {
        trySetFromJson(text, (val) => Player.compostState.contentTypeMapping = val);
    })
    ui.appendChild(contentTypeMap);


    return ui;
}

export function getLoopCheckbox(){
    return window.document.getElementById(loopCheckboxId);
}

export function getCurrentKey(){
    var sel = window.document.getElementById(keySelectId);
    return sel.options[sel.selectedIndex].value;
}

export function getBpm(){
    var e = window.document.getElementById(bpmId);
    return parseInt(e.value);
}

export function getMeasures(){
    var e = window.document.getElementById(measuresId);
    return parseInt(e.value);
}

export function getQuantizationBuckets(){
    var e = window.document.getElementById(quantizationBucketsId);
    return parseInt(e.value);
}

export function getProgressBar(){
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