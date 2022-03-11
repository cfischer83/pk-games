gameLevel = "L3";
var gameWin = false;
var gameLose = false;

document.addEventListener("DOMContentLoaded", function(event) { 
	var enemy1 = addEnemy("turret", 50, 3650, 850);
	var enemy2 = addEnemy("turret", 50, 3350, 550);
	// var enemy3 = addEnemy("turret", 50, 3000, 750);
	var enemy4 = addEnemy("turret", 50, 3650, 3386);
	var enemy5 = addEnemy("turret", 50, 1400, 2927);
	// var enemy6 = addEnemy("turret", 50, 1700, 3000);
	var enemy7 = addEnemy("turret", 50, 1259, 3386);
	var enemy8 = addEnemy("turret", 50, 1770, 3386);
	var enemy10 = addEnemy("turret", 50, 3067, 5271);
	var enemy11 = addEnemy("turret", 50, 3429, 5271);

	var satellite1 = addEnemy("satellite", 30, 3300, 100, "left", "false");
	var satellite2 = addEnemy("satellite", 30, 300, 2900, "left", "false");

	var obstacle1 = addObstacle(2190, 1514, 789, 0);
	var obstacle2 = addObstacle(190, 514, 655, 0);
	var obstacle3 = addObstacle(1767, 193, 854, 1500);
	var obstacle4 = addObstacle(3250, 775, 0, 2122);
	var obstacle5 = addObstacle(190, 514, 2867, 0);
	var obstacle6 = addObstacle(3300, 775, 558, 3470);
	var obstacle7 = addObstacle(3020, 775, 0, 5370, false);
	var obstacle8 = addObstacle(214, 160, 3000, 5524, false);
	var obstacle9 = addObstacle(450, 142, 3400, 5502, false);
	var obstacle10 = addObstacle(850, 142, 3000, 5912, false);
	var obstacle11 = addObstacle(100, 775, 0, 3470);
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

	setTimeout('initiatePlanes(p1, "right");', 3000);
	var planesInterval = setInterval('initiatePlanesRandom()', 10000);

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
	preloadImage("../img/b52-shadow.png");
	preloadImage("../img/b52.png");
});

var planes_keep_coming = true;
function initiatePlanesRandom() {
	if (!planes_keep_coming) {
		return;
	}
	// 1/2 chance every 10 seconds
	var rando = Math.random() * 3000;
	if (rando <= 2000) {
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

passed_bottom_threshold = false;
function checkBottomThreshold() {
	var ggtanks = document.querySelectorAll(".ggtank:not(.destroyed)");
	var finalRunThreshold = document.getElementById("finalRunThreshold");
	for (var i = 0; i < ggtanks.length; i++) {
		if (doBlocksOverLap(finalRunThreshold, ggtanks[i])) {
			passed_bottom_threshold = true;
		}
	}
}
setInterval("checkBottomThreshold();", 500);

function planesOverThreshold() {
	if (!planes_keep_coming || !passed_bottom_threshold) {
		return;
	}
	var rando = Math.random() * 2000;
	if (rando <= 1000) {
		addEnemy("b52", 5, -700, 3560, "right", "true");
	} else {
		addEnemy("b52", 5, 3840, 3560, "left", "true");
	}
}
setInterval("planesOverThreshold();", 5000);


global_gg_tank_speed = 4;

function initiateConvoy() {
	if (gameWin || gameLose) {
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
			case "up": moveBlockUp(tanks[i], true, global_gg_tank_speed); break;
			case "right": moveBlockRight(tanks[i], true, global_gg_tank_speed); break;
			case "down": moveBlockDown(tanks[i], true, global_gg_tank_speed); break;
			case "left": moveBlockLeft(tanks[i], true, global_gg_tank_speed); break;
			case "win": winGGTanks(); break;
		}
	}
}

function winGGTanks() {
	initTanks = null;
	gameWin = true;
	winGame();
	winLevel3();
}

function stopGGTanks() {
	initTanks = null;
}

var initTanks = null;
setTimeout('initTanks = setInterval("initiateConvoy();",100)', 4000);

// check if all satellites are destroyed
document.addEventListener("enemyKill", function(event) {
	var satellites = document.querySelectorAll(".satellite:not(.destroyed)");
	if (satellites.length == 0) {
		var planes = document.querySelectorAll(".b52");
		var shadowBuffer = 700;
		// if a plane is not in cam view, delete it. Otherwise planes stick around too long
		for (var i = 0; i < planes.length; i++) {
			// plane above viewport
			var planeShadowBottom = parseInt(planes[i].style.marginTop) + shadowBuffer;
			if (Math.abs(parseInt(ground.style.marginTop)) > planeShadowBottom) {
				planes[i].remove();
				continue;
			}
			// plane below viewport
			var planeTop = parseInt(planes[i].style.marginTop);
			var camBottom = Math.abs(ground.style.marginTop) + getWindowHeight();
			if (planeTop > camBottom) {
				planes[i].remove();
			}
		}
		if (planes_keep_coming) {
			initLateTanks();
			planes_keep_coming = false;
		}
	}
});

function initLateTanks() {
	var lateEnemy1 = addEnemy("tank", 30, -100, 2300, "up");
	var lateEnemy2 = addEnemy("tank", 30, 3900, 3370, "right");
	// mid tree section
	setTimeout('addEnemy("tank", 30, -100, 2300, "up");', 15000);
	setTimeout('addEnemy("tank", 30, -100, 2300, "up");', 60000);
	setTimeout('addEnemy("tank", 30, -100, 2300, "up");', 70000);

	// bottom tree section
	setTimeout('addEnemy("tank", 30, 3900, 3370, "right");', 15000);
	setTimeout('addEnemy("tank", 30, 3900, 3370, "right");', 30000);
	setTimeout('addEnemy("tank", 30, 3900, 3370, "right");', 60000);
	setTimeout('addEnemy("tank", 30, 3900, 3370, "right");', 80000);
	setTimeout('addEnemy("tank", 30, 3900, 3370, "right");', 100000);
}

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
	gameLose = true;
	stopGGTanks();
	var lowerMessage = document.createElement("div");
		lowerMessage.setAttribute("id", "lowerMessage");
		cam.insertBefore(lowerMessage, ground);
	var lowerMessageText = document.createElement("div");
		lowerMessageText.setAttribute("id", "lowerMessageText");
		lowerMessage.appendChild(lowerMessageText);
		lowerMessageText.innerHTML = "<p>You have lost your battle and brought shame to your family's name.</p><a href='L3.html' class='button'>Try Again</a> <a href='index.html' class='button'>Return To Missions</a>";
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
	document.getElementById("overlaytext").innerHTML = "<h2>Victory!</h2><p>You have escorted the convoy to its location.</p><br /><a class='button' href='index.html'>Return To Missions</a>";

}

