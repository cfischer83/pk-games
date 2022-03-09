gameLevel = "L3";
var gameWin = false;

document.addEventListener("DOMContentLoaded", function(event) { 
	var enemy1 = addEnemy("turret", 50, 3650, 850);
	var enemy2 = addEnemy("turret", 50, 3350, 550);
	var enemy3 = addEnemy("turret", 50, 3000, 750);
	var enemy4 = addEnemy("turret", 50, 3650, 3386);
	var enemy5 = addEnemy("turret", 50, 1400, 2927);
	var enemy6 = addEnemy("turret", 50, 1700, 3000);
	var enemy7 = addEnemy("turret", 50, 1259, 3386);
	var enemy8 = addEnemy("turret", 50, 1770, 3386);
	// var enemy9 = addEnemy("turret", 50, 3282, 742);
	// var enemy10 = addEnemy("turret", 50, 3682, 503);
	// var enemy11 = addEnemy("turret", 50, 3583, 207);

	var satellite1 = addEnemy("satellite", 30, 3300, 100, "left", "false");
	var satellite2 = addEnemy("satellite", 30, 300, 2900, "left", "false");

	var obstacle1 = addObstacle(2190, 1514, 789, 0);
	var obstacle2 = addObstacle(190, 514, 655, 0);
	var obstacle3 = addObstacle(1767, 193, 854, 1500);
	var obstacle4 = addObstacle(3250, 775, 0, 2122);
	var obstacle5 = addObstacle(190, 514, 2867, 0);
	var obstacle6 = addObstacle(3300, 775, 558, 3470);
	// var obstacle7 = addObstacle(535, 286, 2921, 909);
	// var obstacle8 = addObstacle(561, 486, 2698, 1192);
	// var obstacleWater1 = addObstacle(2999, 100, 0, 1701, false);
	// var obstacleWater2 = addObstacle(200, 500, 2799, 1700, false);
	// var obstacleWater3 = addObstacle(1260, 939, 1949, 2099, false);
	// var obstacleWater4 = addObstacle(1000, 700, 950, 2099, false);
	// var obstacleWater5 = addObstacle(400, 750, 899, 2775, false);
	// var obstacleWater6 = addObstacle(70, 100, 1300, 2775, false);
	// var obstacleWater7 = addObstacle(1260, 125, 1949, 3184, false);
	// var obstacleWater8 = addObstacle(1259, 123, 1949, 3458, false);

	var tree0 = addObstacle(78, 78, 80, 630, true, 'tree tree2', 15);
	var tree1 = addObstacle(78, 78, 40, 823, true, 'tree tree1', 15);
	var tree2 = addObstacle(78, 78, 82, 981, true, 'tree tree1', 15);
	var tree3 = addObstacle(78, 78, 2865, 2145, true, 'tree tree1', 15);
	var tree4 = addObstacle(78, 78, 3620, 500, true, 'tree tree2', 15);
	var tree5 = addObstacle(78, 78, 3663, 354, true, 'tree tree1', 15);
	var tree6 = addObstacle(78, 78, 3626, 160, true, 'tree tree1', 15);

	var planesInterval = setInterval('initiatePlanesRandom()', 5000);

	document.getElementById("ggtank1").style.marginLeft = "150px";
	document.getElementById("ggtank1").style.marginTop = "200px";
	document.getElementById("ggtank2").style.marginLeft = "150px";
	document.getElementById("ggtank2").style.marginTop = "300px";
	document.getElementById("ggtank3").style.marginLeft = "150px";
	document.getElementById("ggtank3").style.marginTop = "400px";

	preloadImage("turret-down-left.png");
	preloadImage("turret-down-right.png");
	preloadImage("turret-up-left.png");
	preloadImage("turret-up-right.png");
	preloadImage("missile.gif");
});

var planes_keep_coming = true;
function initiatePlanesRandom() {
	if (!planes_keep_coming) {
		return;
	}
	// 1/2 chance every 10 seconds
	var rando = Math.random() * 3000;
	if (rando <= 3000) {
		var goods = document.querySelectorAll("[data-allegiance='good'].ggtank:not(.destroyed)");
		var rando2 = Math.random() * 1000;
		var randoMultiplier = 160;
		var randoTracker = 0;
		// 3 tanks should each have 16% chance of being tracked by plane. 52%+ p1.
		for (var i = 0; i < goods.length; i++) {
			randoTracker = randoMultiplier * i;
			if (rando2 < randoTracker) {
				initiatePlanes(goods[i]);
				return;
			}
		}
		// if good tanks didn't get chosen, choose p1
		initiatePlanes(p1);
	}
}

function initiateConvoy() {
	if (gameWin) {
		return;
	}
	var tanks = document.querySelectorAll(".ggtank:not(.destroyed)");
	var turners = document.querySelectorAll(".ggtankturner");
	for (var i = 0; i < tanks.length; i++) {
		for (var j = 0; j < turners.length; j++) {
			if (doBlocksOverLap(tanks[i], turners[j])) {
				direction = turners[j].dataset.direction;
				tanks[i].setAttribute("data-direction", direction);
				changeDirection(tanks[i], direction);
			}
		}
		var tankDir = tanks[i].dataset.direction;
		switch(tankDir) {
			case "up": moveBlockUp(tanks[i], true, 3); break;
			case "right": moveBlockRight(tanks[i], true, 3); break;
			case "down": moveBlockDown(tanks[i], true, 3); break;
			case "left": moveBlockLeft(tanks[i], true, 3); break;
			case "stop": stopGGTanks(); break;
		}
	}
}

function stopGGTanks() {
	initTanks = null;
	gameWin = true;
	winGame();
	winLevel3();
}

var initTanks = null;
setTimeout('initTanks = setInterval("initiateConvoy();",100)', 4000);

// check if all satellites are destroyed
document.addEventListener("enemyKill", function(event) {
	var satellites = document.querySelectorAll(".satellite:not(.destroyed)");
	if (satellites.length == 0) {
		planes_keep_coming = false;
	}
});

// check that good tanks are still alive or lose
document.addEventListener("goodKill", function(event) {
	var tanks = document.querySelectorAll(".ggtank:not(.destroyed)");
	if (tanks.length == 0) {
		loseGame();
	}
});

// Winning this level is done when all enemies are defeated.
document.addEventListener("lose", function(event) {
	loseLevel3();
});

function loseLevel3() {
	var lowerMessage = document.createElement("div");
		lowerMessage.setAttribute("id", "lowerMessage");
		cam.insertBefore(lowerMessage, ground);
	var lowerMessageText = document.createElement("div");
		lowerMessageText.setAttribute("id", "lowerMessageText");
		lowerMessage.appendChild(lowerMessageText);
		lowerMessageText.innerHTML = "<p>You have lost your battle and brought shame to your family's name.</p><a href='L1.html' class='button'>Try Again</a> <a href='index.html' class='button'>Return To Missions</a>";
}

function winLevel3() {
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

