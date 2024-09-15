import * as UI from "./ui";
import * as Player from "./player";


window.compostState = Player.compostState;
window.pl = Player.compostState.playStep;

compostState.ui = UI.getUiElement();

let loopCheckbox = UI.getLoopCheckbox();

loopCheckbox.onchange = () => {
    if (loopCheckbox.checked && !compostState.playing){
        Player.playStep();
    }
}


//window.buckets = quantize(169, 16, Key.majorKey("C"), "pentatonic")
//playStep();