//Menu
const content = document.getElementById("content"); 

//Buttons
const find = document.getElementById("find");
const back = document.getElementById("back");
const done = document.getElementById("done");

//Character Customization
const name_input = document.getElementById("name-input");
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
    if(e.target.classList.contains("character-box")) {
        let index = parseInt(e.target.id.substr(10)); //Gets the numerical id in CHARACTER_ID
        let character = characters[index];
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
            break;

        case "done":
            createCharacter(name_input.value);
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

function createCharacter(name) {
    let character = new Character(name);
    characters.push(character);
    saveCharacters();
}

function saveCharacters() {
    setCookie("characters", JSON.stringify(characters), 60);
}

function reset() {
    name_input.value = "";
    switchScene("find-match");
}

function load() {
    characters_box.innerHTML = '';
    characters.forEach((character, i) => {
        let characterDisplay = document.createElement("div");
        characterDisplay.classList.add("character-box");
        characterDisplay.id = "CHARACTER_" + i;
        
        let characterName = document.createElement("p");
        characterName.textContent = character.name;

        characterDisplay.appendChild(characterName);
        characters_box.appendChild(characterDisplay);
    });

}
  
window.onload = main;