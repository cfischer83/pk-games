gameLevel = "Dev";

document.addEventListener("DOMContentLoaded", function(event) { 

	p1.style.marginLeft = "600px";
	p1.style.marginTop = "300px";
	p1.setAttribute("data-x",600);
	p1.setAttribute("data-y",300);

	//var enemy1 = addAtlas(1550, 850);
	var enemy2 = addAtlas(1200, 900, "right");
	// var enemy2 = addEnemy("turret", 50, 1550, 1150);
	// var enemy3 = addEnemy("turret", 50, 1500, 2800);
	// var enemy4 = addEnemy("turret", 50, 1800, 2800);
	// var enemy5 = addEnemy("turret", 50, 1400, 3100);
	// var enemy6 = addEnemy("turret", 50, 1700, 3000);
	// var enemy7 = addEnemy("turret", 50, 1400, 3400);
	// var enemy8 = addEnemy("turret", 50, 1700, 3271);
	// var enemy9 = addEnemy("turret", 50, 3282, 742);
	// var enemy10 = addEnemy("turret", 50, 3682, 503);
	// var enemy11 = addEnemy("turret", 50, 3583, 207);

	var obstacle1 = addObstacle(831, 286, 1530, 0);
	var obstacle2 = addObstacle(250, 150, 1300, 0);
	var obstacle3 = addObstacle(390, 350, 2099, 249);
	var obstacle4 = addObstacle(190, 230, 1923, 230);
	var obstacle5 = addObstacle(364, 228, 0, 1001);
	var obstacle6 = addObstacle(173, 144, 318, 1159);
	var obstacle7 = addObstacle(535, 286, 2921, 909);
	var obstacle8 = addObstacle(561, 486, 2698, 1192);
	var obstacleWater1 = addObstacle(2999, 100, 0, 1701, false);
	var obstacleWater2 = addObstacle(200, 500, 2799, 1700, false);
	var obstacleWater3 = addObstacle(1260, 939, 1949, 2099, false);
	var obstacleWater4 = addObstacle(1000, 700, 950, 2099, false);
	var obstacleWater5 = addObstacle(400, 750, 899, 2775, false);
	var obstacleWater6 = addObstacle(70, 100, 1300, 2775, false);
	var obstacleWater7 = addObstacle(1260, 125, 1949, 3184, false);
	var obstacleWater8 = addObstacle(1259, 123, 1949, 3458, false);

	preloadImage("turret-down-left.png");
	preloadImage("turret-down-right.png");
	preloadImage("turret-up-left.png");
	preloadImage("turret-up-right.png");
	preloadImage("missile.gif");
});

// Winning this level is done when all enemies are defeated.
document.addEventListener("enemyKill", function(event) { 
	var enemiesLeft = document.querySelectorAll("[data-kill-required='true']:not(.destroyed)");
	if (enemiesLeft.length == 0) {
		winGame();
		setTimeout('winLevelDev();', 3000);
	}
});


// Winning this level is done when all enemies are defeated.
document.addEventListener("lose", function(event) {
	loseLevelDev();
});

function loseLevelDev() {
	var lowerMessage = document.createElement("div");
		lowerMessage.setAttribute("id", "lowerMessage");
		cam.insertBefore(lowerMessage, ground);
	var lowerMessageText = document.createElement("div");
		lowerMessageText.setAttribute("id", "lowerMessageText");
		lowerMessage.appendChild(lowerMessageText);
		lowerMessageText.innerHTML = "<p>You have lost your battle and brought shame to your family's name.</p><a href='L1.html' class='button'>Try Again</a> <a href='index.html' class='button'>Return To Missions</a>";
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
	document.getElementById("overlaytext").innerHTML = "<h2>Victory!</h2><p>The enemy is disabled and their stronghold is broken. We can now move inland to push the enemy back.</p><br /><a class='button' href='index.html'>Return To Missions</a>";

}

