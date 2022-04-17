gameLevel = "Lsecret";

document.addEventListener("DOMContentLoaded", function(event) { 

	p1.style.marginLeft = "300px";
	p1.style.marginTop = "300px";
	p1.setAttribute("data-x",300);
	p1.setAttribute("data-y",300);

	var enemy1 = addAtlas(1550, 850);
	var enemy1 = addAtlas(2550, 850);
	setInterval('initNPCMechs();', 50);

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
		setTimeout('winLevelSecret();', 3000);
	}
});


// Winning this level is done when all enemies are defeated.
document.addEventListener("lose", function(event) {
	loseLevelSecret();
});

function loseLevelSecret() {
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
		lowerMessageText.innerHTML = "<p>You have lost and brought shame to your family's name.</p><a href='secret.html' class='button'>Try Again</a> <a href='index.html' class='button'>Return To Missions</a>";
}

function winLevelSecret() {
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
	document.getElementById("overlaytext").innerHTML = "<h2>Victory!</h2><p>The enemy is destroyed and pushed out past the inner sphere!</p><br /><a class='button' href='index.html'>Return To Missions</a>";

}

