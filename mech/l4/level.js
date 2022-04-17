gameLevel = "L4";
var obstacle9 = null;

document.addEventListener("DOMContentLoaded", function(event) { 

	p1.style.marginLeft = "20px";
	p1.style.marginTop = "20px";
	p1.setAttribute("data-x",20);
	p1.setAttribute("data-y",20);

	setInterval('initNPCMechs();', 50);

	var obstacle1 = addObstacle(1831, 239, 615, 0, false);
	var obstacle2 = addObstacle(493, 140, 615, 220, false);
	var obstacle3 = addObstacle(560, 2830, 572, 484, false);
	var obstacle4 = addObstacle(190, 290, 2094, 238);
	var obstacle5 = addObstacle(575, 228, 0, 1157, false);
	var obstacle6 = addObstacle(1588, 848, 1593, 502);
	var obstacle7 = addObstacle(561, 1900, 3175, 1347, false);
	var obstacle8 = addObstacle(3575, 220, 1100, 3157, false);
		obstacle9 = addObstacle(490, 490, 1431, 860);

	preloadImage("img/atlas-walk.gif");
	preloadImage("img/atlas-walk-up.gif");
	preloadImage("img/atlas-stand-up.gif");
	preloadImage("img/atlas-walk-down.gif");
	preloadImage("img/atlas-stand.gif");
	preloadImage("img/atlas-stand-down.gif");
	preloadImage("img/atlas-destroyed.gif");
	preloadImage("img/atlas-destroyed-v.png");
});

// Winning this level is done when all enemies are defeated.
document.addEventListener("enemyKill", function(event) { 
	var enemiesLeft = document.querySelectorAll("[data-kill-required='true']:not(.destroyed)");
	if (enemiesLeft.length == 0) {
		winGame();
		setTimeout('winLevelDev();', 3000);
	}
});

function checkAtlas() {
	var atlascheck = document.getElementById("atlas-check");
	if (doBlocksOverLap(p1, atlascheck)) {
		l4CreatAtlas();
		clearInterval(waitForAtlas);
	}
}
var waitForAtlas = setInterval('checkAtlas()', 500);

function l4CreatAtlas() {
	var enemy1 = addAtlas(3000, 3000, "left");
	obstacle9.style.marginLeft = "1111px";
	obstacle9.setAttribute("data-x", "1111px");
}


// Winning this level is done when all enemies are defeated.
document.addEventListener("lose", function(event) {
	loseLevelL4();
});

function loseLevelL4() {
	var mechs = document.querySelectorAll(".npcmech");
	for (var i = 0; i < mechs.length; i++) {
		mechs[i].classList.remove("walk")
	}
	var lowerMessage = document.createElement("div");
		lowerMessage.setAttribute("id", "lowerMessage");
		cam.insertBefore(lowerMessage, ground);
	var lowerMessageText = document.createElement("div");
		lowerMessageText.setAttribute("id", "lowerMessageText");
		lowerMessage.appendChild(lowerMessageText);
		lowerMessageText.innerHTML = "<p>You have lost your battle and brought shame to your family's name.</p><a href='L4.html' class='button'>Try Again</a> <a href='index.html' class='button'>Return To Missions</a>";
}

function winLevelDev() {
	var overlay = document.createElement("div");
		overlay.setAttribute("id", "overlay");
		overlay.setAttribute("class", "active");
	cam.insertBefore(overlay, ground);
		overlay.style.width = global_ground_width;
		overlay.style.height = global_ground_height;

	var text = document.createElement("div");
		text.setAttribute("id", "overlaytext");
		text.setAttribute("class", "overlaytext");
	cam.insertBefore(text, ground);
		//text.style.marginLeft = Math.abs(parseInt(cam.style.marginLeft));// - global_window_size;
		text.style.marginTop = Math.abs(parseInt(cam.style.marginTop)) + 25;
	document.getElementById("overlaytext").innerHTML = "<h2>Victory!</h2><p>The enemy is destroyed and the rest of the city is saved!</p><br /><a class='button' href='index.html'>Return To Missions</a>";

}

