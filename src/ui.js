
const uiElementId = "compostUiRoot";
const loopCheckboxId = "compostUiLoopCheckbox"
const keySelectId = "compostUiKeySelect"
const progressId = "compostUiProgress"

export function getUiElement(){
    let ui = window.document.getElementById(uiElementId);
    if (ui !== null){
        return ui;
    }

    ui = window.document.createElement("div");
    window.document.body.appendChild(ui);
    applyStyleToElement(ui);

    addCheckbox(ui, loopCheckboxId, "play")
    addSelect(ui, keySelectId, "key", ["A","B","C","D","E","F","G"], 3)
    addProgressBar(ui, progressId);

    return ui;
}

export function getLoopCheckbox(){
    return window.document.getElementById(loopCheckboxId);
}

export function getCurrentKey(){
    var sel = window.document.getElementById(keySelectId);
    return sel.options[sel.selectedIndex].value;
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
    ui.style.top = "1em"
    ui.style.left = "30%"
    ui.style.zIndex = "300"
}

function elementContainer(targetElement){
    let c = window.document.createElement("span");
    c.style.margin = "4px";
    targetElement.appendChild(c);
    return c;
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

function addSelect(targetElement, id, label, options, initialIndex) {
    targetElement = elementContainer(targetElement);
    let l = window.document.createElement("label");
    l.htmlFor = id
    l.innerText = label
    targetElement.appendChild(l)

    let e = window.document.createElement("select");
    e.id = id
    targetElement.appendChild(e)

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
    outer.style.width = "6em";
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