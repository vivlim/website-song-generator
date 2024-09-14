
const uiElementId = "compostUiRoot";
const loopCheckboxId = "compostUiLoopCheckbox"

export function getUiElement(){
    let ui = window.document.getElementById(uiElementId);
    if (ui !== null){
        return ui;
    }

    ui = window.document.createElement("div");
    window.document.body.appendChild(ui);
    applyStyleToElement(ui);

    addCheckbox(ui, loopCheckboxId, "play")

    return ui;
}

export function getLoopCheckbox(){
    return window.document.getElementById(loopCheckboxId);
}

function applyStyleToElement(ui){
    ui.style.width = "300px"
    ui.style.height = "3em"
    ui.style.border = "2px solid #888888"
    ui.style.background = "#111111"
    ui.style.position = "fixed"
    ui.style.top = "1em"
    ui.style.left = "30%"
    ui.style.zIndex = "300"
}

function addCheckbox(targetElement, id, label) {
    let e = window.document.createElement("input");
    e.type = "checkbox"
    e.id = id
    targetElement.appendChild(e)
    let l = window.document.createElement("label");
    l.htmlFor = id
    l.innerText = label
    targetElement.appendChild(l)
}