//Menu
const content = document.getElementById("content"); 

//Buttons
const find = document.getElementById("find");
const back = document.getElementById("back");
const done = document.getElementById("done");

//Character Customization
const name_input = document.getElementById("name-input");
const head_color = document.getElementById("head-color");
const torso_color = document.getElementById("torso-color");
const legs_color = document.getElementById("legs-color");
const eyes_color = document.getElementById("eyes-color");
const preview_canvas = document.getElementById("character-preview");
const preview_ctx = preview_canvas.getContext("2d");
var activeCharacter;

//Characters
const characters_box = document.getElementById("characters");
var characters = JSON.parse(getCookie("characters")) || [];

var scene;
var roomId;

//Socket.io
var socket = io();

socket.on("connect", () => {
    console.log("Connected to server");
});

socket.on("roomCreated", (id) => {
    console.log('Room created!');
    roomId = id;
    initialize();
    switchScene('game');
});

socket.on("roomJoined", (id) => {
    console.log('Room joined!')
    roomId = id;
    initialize();
    switchScene('game');
});

socket.on("partnerLeft", () => {
    console.log(`Partner left!`);
});

function main() {
    switchScene("main-menu");
    tippy("#enter-name", {
        content: '1-15 characters required', //Tooltip for creating character
    });
    
    load();
}

window.addEventListener('beforeunload', () => {
    // Mark the socket as disconnected due to navigation
    socket.disconnectedByNavigation = true;
});

content.addEventListener("click", (e) => {
    if(e.target.classList.contains("locked")) return;
    
    // Find closest character-box parent if clicked element is inside one
    const characterBox = e.target.closest('.character-box');
    if(characterBox) {
        let index = parseInt(characterBox.id.substr(10)); //Gets the numerical id in CHARACTER_ID
        let characterData = characters[index];
        let character = new Character(
            characterData.name,
            characterData.headColor,
            characterData.torsoColor, 
            characterData.legsColor,
            characterData.eyesColor
        );
        selectCharacter(character);
        switchScene("match-making");    

        return;
    }

    switch(e.target.id) {
        case "find":
            switchScene("find-match");
            break;
        
        case "back":
            switch(scene) {
                case "find-match":
                    switchScene("main-menu");
                    break;

                case "character-create":
                    switchScene("find-match");
                    break;

                case "match-making":
                    switchScene("find-match");
                    break;

                case "searching":
                    switchScene("match-making");
                    break;

                case "game":
                    leaveMatch();
                    break;
            }
            break;
    
        case "create":
            switchScene("character-create");
            updatePreview();
            break;

        case "done":
            createCharacter(
                name_input.value,
                head_color.value.substring(1),
                torso_color.value.substring(1),
                legs_color.value.substring(1),
                eyes_color.value.substring(1)
            );
            load();
            reset();
            break;

        case "random-match":
            switchScene("searching");
            socket.emit('randomSearch');
            break;
    }
});

name_input.addEventListener('input', () => {
    if(name_input.value.length < 1 || name_input.value.length > 15) {
        done.disabled = true;   
    } else {
        done.disabled = false;
    }
});

// Add color picker event listeners
head_color.addEventListener('input', updatePreview);
torso_color.addEventListener('input', updatePreview);
legs_color.addEventListener('input', updatePreview);
eyes_color.addEventListener('input', updatePreview);

function updatePreview() {
    preview_ctx.clearRect(0, 0, preview_canvas.width, preview_canvas.height);
    let previewCharacter = new Character(
        "Preview",
        head_color.value.substring(1),
        torso_color.value.substring(1),
        legs_color.value.substring(1),
        eyes_color.value.substring(1)
    );
    previewCharacter.render(preview_ctx, preview_canvas.width/2, preview_canvas.height/2);
}

function selectCharacter(character) {
    activeCharacter = character;
}

function setCookie(name,value,days) {
    var expires = "";
    if (days) {
        var date = new Date();
        date.setTime(date.getTime() + (days*24*60*60*1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "")  + expires + "; path=/";
}
function getCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for(var i=0;i < ca.length;i++) {
        var c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1,c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
    }
    return null;
}

function eraseCookie(name) {   
    document.cookie = name +'=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
}

function switchScene(sceneName) {
    scene = sceneName;
    const scenes = document.querySelectorAll('.scene');
    scenes.forEach(scene => {
        if (scene.id === sceneName) {
            scene.style.display = 'block'; // Show the selected scene
        } else {
            scene.style.display = 'none'; // Hide other scenes
        }
    });
}

function createCharacter(name, headColor, torsoColor, legsColor, eyesColor) {
    let character = new Character(name, headColor, torsoColor, legsColor, eyesColor);
    characters.push(character);
    saveCharacters();
}

function saveCharacters() {
    setCookie("characters", JSON.stringify(characters), 60);
}

function reset() {
    name_input.value = "";
    head_color.value = "#ff0000";
    torso_color.value = "#00ff00";
    legs_color.value = "#0000ff";
    eyes_color.value = "#000000";
    switchScene("find-match");
}

function load() {
    characters_box.innerHTML = '';
    characters.forEach((character, i) => {
        let characterDisplay = document.createElement("div");
        characterDisplay.classList.add("character-box");
        characterDisplay.id = "CHARACTER_" + i;
        characterDisplay.style.position = "relative";
        
        let characterName = document.createElement("p");
        characterName.textContent = character.name;
        characterName.style.position = "absolute";
        characterName.style.left = "10px"; // Small offset from left
        characterName.style.top = "10px"; // Small offset from top
        characterName.style.margin = "0";
        characterName.style.zIndex = "2";
        
        // Create canvas for character preview
        let characterCanvas = document.createElement("canvas");
        characterCanvas.width = 100;
        characterCanvas.height = 100;
        characterCanvas.style.position = "relative";
        characterCanvas.style.zIndex = "1"; // Put canvas behind text but still clickable
        let ctx = characterCanvas.getContext("2d");
        
        // Create character instance and render preview
        let characterInstance = new Character(
            character.name,
            character.headColor,
            character.torsoColor,
            character.legsColor,
            character.eyesColor
        );
        characterInstance.render(ctx, characterCanvas.width/2, characterCanvas.height/2);

        characterDisplay.appendChild(characterCanvas);
        characterDisplay.appendChild(characterName);
        characters_box.appendChild(characterDisplay);
    });
}
  
window.onload = main;