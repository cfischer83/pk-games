var gamePlay = true; // whether game is currently being played. Set to false on game lose and win.
var p1, ground, global_ground_width, global_ground_height;
var global_increment_by = 10;
var global_box_size = 50;
var global_player_height = 70;
var global_window_size = window.innerWidth;
var fireArray = new Array();
var downTimer;
var lastKey;
var lastProjectileFired = 0; // will be timestamp to avoid too many firings
var touchEnabled = ('ontouchstart' in document.documentElement);
var allowFiring = true; // allow/disallow firing
var debug = false;
var gameLevel; // defined in level.js


function preloadImage(url) {
	var img=new Image();
	img.src=url;
}

preloadImage("warhawk-standing-down.gif");
preloadImage("warhawk-standing-up.png");
preloadImage("warhawk-standing.gif");
preloadImage("warhawk-walking-down.gif");
preloadImage("warhawk-walking-h.gif");
preloadImage("warhawk-walking-up.gif");
preloadImage("warhawk-destroyed.png");
preloadImage("erppc.gif");
preloadImage("explosion.gif");
preloadImage("destroyed-explosion.gif");


function setCamDimensions() {
	cam.style.width = getWindowWidth();
	cam.style.height = getWindowHeight();
}

window.addEventListener('resize', setCamDimensions);

document.addEventListener("DOMContentLoaded", function(event) {
	// annoying iOS toolbar hiding hack
	window.scrollTo(1, 0);

	p1		= document.getElementById("p1");
	lifeStat= document.getElementById("p1").dataset.life;
	ground	= document.getElementById("ground");
	cam		= document.getElementById("cam");

	p1.style.marginLeft	= "30px";
	p1.style.marginTop = "30px";
	p1.setAttribute("data-x", "30");
	p1.setAttribute("data-y", "30");

	setCamDimensions();
	setInterval("rotateTurrets()", 1000);
	setInterval("promptEnemiesToFire()", 1000);
	setDebug();


	if (touchEnabled) {
		placeTouchControls();
	}



	document.addEventListener("keydown", function(e) {
		if (!gamePlay) {
			return;
		}
		if (e.keyCode == '32' && allowFiring) {
			newFireDate = new Date();
			newFireTime = newFireDate.getTime();
			if (getTimeDifference(lastProjectileFired, newFireTime)) {
				lastProjectileFired = newFireTime;
				fire(p1, "good", "erppc");
				var event = new CustomEvent("fired", { "detail": p1 });
				document.dispatchEvent(event);
			}
			e.preventDefault();
			return false;
		}
		if (!isMovingKey(e.keyCode)) {
			return;
		}
		e.preventDefault();

		// if not still the same key, stop the timer
		if (e.which !== lastKey) {
			if (downTimer) {
				clearInterval(downTimer);
				downTimer = null;
			}
		}

		// remember previous key
		lastKey = e.which;
		if (!downTimer) {
			// start timer
			downTimer = setInterval(function() {
				if (!gamePlay) {
					return;
				}
				if (e.which == 37) {
					moveCharacterLeft(p1);
				} else if (e.which == 38) {
					moveCharacterUp(p1);
				} else if (e.which == 39) {
					moveCharacterRight(p1);
				} else if (e.which == 40) {
					moveCharacterDown(p1);
				} else {
					//
				}
			}, 67);
		}
		return false;
	})
	document.addEventListener("keyup", function(e) {
		if (isMovingKey(e.keyCode)) {
			p1.classList.remove("walk");
			// stop timer
			if (downTimer && lastKey == e.keyCode) {
				clearInterval(downTimer);
				downTimer = null;
				lastKey = 0;
			}
		}
	});


	// disable scrolling
	// left: 37, up: 38, right: 39, down: 40,
	// spacebar: 32, pageup: 33, pagedown: 34, end: 35, home: 36
	var keys = {32: 1, 38: 1, 40: 1, 39: 1, 40: 1, 33: 1, 34: 1, 35: 1, 36: 1};

	function preventDefault(e) {
		e.preventDefault();
	}

	function preventDefaultForScrollKeys(e) {
		if (keys[e.keyCode]) {
			preventDefault(e);
			return false;
		}
	}

	// modern Chrome requires { passive: false } when adding event
	var supportsPassive = false;
	try {
		window.addEventListener("test", null, Object.defineProperty({}, 'passive', {
			get: function () { supportsPassive = true; } 
		}));
	} catch(e) {}

	var wheelOpt = supportsPassive ? { passive: false } : false;
	var wheelEvent = 'onwheel' in document.createElement('div') ? 'wheel' : 'mousewheel';

	// call this to Disable
	function disableScroll() {
		window.addEventListener('DOMMouseScroll', preventDefault, false); // older FF
		window.addEventListener(wheelEvent, preventDefault, wheelOpt); // modern desktop
		window.addEventListener('touchmove', preventDefault, wheelOpt); // mobile
		window.addEventListener('keydown', preventDefaultForScrollKeys, false);
	}

	// call this to Enable
	function enableScroll() {
		window.removeEventListener('DOMMouseScroll', preventDefault, false);
		window.removeEventListener(wheelEvent, preventDefault, wheelOpt); 
		window.removeEventListener('touchmove', preventDefault, wheelOpt);
		window.removeEventListener('keydown', preventDefaultForScrollKeys, false);
	}

	disableScroll();
});

function pkAnalytics(action, label) {
	if (ga) {
		console.log('send to ga');
		ga('send', {
			hitType: 'event',
			eventCategory: 'Game',
			eventAction: action,
			eventLabel: label
		});
	}
}

function placeTouchControls() {
	document.body.classList.add("touchEnabled");
	var touchControls = document.createElement("div");
		touchControls.setAttribute("id", "touch-controls");
		touchControls.setAttribute("class", "touch");
	cam.appendChild(touchControls);
	var touchUp = document.createElement("div");
		touchUp.setAttribute("id", "touch-up");
		touchUp.setAttribute("class", "arrow-up");
	touchControls.appendChild(touchUp);
	var touchDown = document.createElement("div");
		touchDown.setAttribute("id", "touch-down");
		touchDown.setAttribute("class", "arrow-down");
	touchControls.appendChild(touchDown);
	var touchLeft = document.createElement("div");
		touchLeft.setAttribute("id", "touch-left");
		touchLeft.setAttribute("class", "arrow-left");
	touchControls.appendChild(touchLeft);
	var touchRight = document.createElement("div");
		touchRight.setAttribute("id", "touch-right");
		touchRight.setAttribute("class", "arrow-right");
	touchControls.appendChild(touchRight);
	var touchFire = document.createElement("div");
		touchFire.setAttribute("id", "touch-fire");
		touchFire.setAttribute("class", "touch");
	cam.appendChild(touchFire);
}

function moveCharacterLeft(character) {
	if (!character.classList.contains("walk")) {
		character.classList.add("walk");
	}
	if (!playerObstacles(character,"left")) {
		moveCamLeft(character);
		moveBlockLeft(character, true);
	}
	changeDirection(character, "left");
}
function moveCharacterRight(character) {
	if (!character.classList.contains("walk")) {
		character.classList.add("walk");
	}
	if (!playerObstacles(character,"right")) {
		moveCamRight(character);
		moveBlockRight(character, true);
	}
	changeDirection(character, "right");	
}
function moveCharacterUp(character) {
	if (!character.classList.contains("walk")) {
		character.classList.add("walk");
	}
	if (!playerObstacles(character,"up")) {
		moveCamUp(character);
		moveBlockUp(character, true);
	}
	changeDirection(character, "up");
}
function moveCharacterDown(character) {
	if (!character.classList.contains("walk")) {
		character.classList.add("walk");
	}
	if (!playerObstacles(character,"down")) {
		moveCamDown(character);
		moveBlockDown(character, true);
	}
	changeDirection(character, "down");
}






document.addEventListener("click", function(event) { 
	if (debug) {
		console.log("x = " + event.clientX + "; y = " + event.clientY);
	}
});


function getTimeDifference(time1, time2, diff = 0.5) {
	var diff2 = time2 - time1;
		diff2 = diff2 / 1000;
	if (diff2 >= diff) {
		return true;
	}
	return false;
}

function setDebug() {
	if (location.search.includes("debug")) {
		debug = true;
		document.body.classList.add("debug");
	}
}

function getWindowWidth() {
	global_window_size = window.innerWidth;
	return global_window_size;
}

function getWindowHeight() {
	if (touchEnabled) {
		// remove some height for touch controls
		return document.documentElement.clientHeight - 310;
	}
	return window.innerHeight;
}

function getGroundWidth() {
	if (!global_ground_width) {
		var ground = document.getElementById("ground");
		var groundOffset = ground.getBoundingClientRect();
		var groundWidth = groundOffset.width ? parseInt(groundOffset.width) : 0;
		global_ground_width = groundWidth;
	}
	return global_ground_width;
}

function getGroundHeight() {
	if (!global_ground_height) {
		var ground = document.getElementById("ground");
		var groundOffset = ground.getBoundingClientRect();
		var groundHeight = groundOffset.height ? parseInt(groundOffset.height) : 0;
		global_ground_height = groundHeight;
	}
	return global_ground_height;
}



/* Is this left, up, right, down key */
function isMovingKey(k) {
	if (k == "37" || k == "38" || k == "39" || k == "40") {
		return true;
	}
	return false;
}

function playerObstacles(player, direction) {
	obstacles = document.getElementsByClassName("obstacle");
	enemies = document.getElementsByClassName("enemy");
	var allObstacles = [...obstacles, ...enemies];
	for (i = 0; i < allObstacles.length; i++) {
		if (willBlocksOverlap(player, allObstacles[i], direction)) {
			return true;
		}
	}
	return false;
}



function moveBlockLeft(block, windowBoundary = false, increment = global_increment_by) {
	var marginLeft = block.style.marginLeft ? parseInt(block.style.marginLeft) : 0;
	var newMarginLeft = marginLeft - increment;
	if (newMarginLeft >= 0 || !windowBoundary) {
		block.setAttribute("data-x", newMarginLeft);
		block.style.marginLeft = newMarginLeft + "px";
	}
}
function moveBlockRight(block, windowBoundary = false, increment = global_increment_by) {
	var marginLeft = block.style.marginLeft ? parseInt(block.style.marginLeft) : 0;
	var newMarginLeft = marginLeft + increment;
	if (newMarginLeft <= (getGroundWidth() - global_box_size) || !windowBoundary) {
		block.setAttribute("data-x", newMarginLeft);
		block.style.marginLeft = newMarginLeft + "px";
	}
}
function moveBlockUp(block, windowBoundary = false, increment = global_increment_by) {
	var marginTop = block.style.marginTop ? parseInt(block.style.marginTop) : 0;
	var newMarginTop = marginTop - increment;
	if (newMarginTop >= 0 || !windowBoundary) {
		block.setAttribute("data-y", newMarginTop);
		block.style.marginTop = newMarginTop + "px";
	}
}
function moveBlockDown(block, windowBoundary = false, increment = global_increment_by) {
	var marginTop = block.style.marginTop ? parseInt(block.style.marginTop) : 0;
	var newMarginTop = marginTop + increment;
	if (newMarginTop <= (getGroundHeight() - global_box_size) || !windowBoundary) {
		block.setAttribute("data-y", newMarginTop);
		block.style.marginTop = newMarginTop + "px";
	}
}

// addMargin is to look in the future
function doBlocksOverLap(box1, box2) {
	var box1viewportOffset = box1.getBoundingClientRect();
	var box1XStart	= box1viewportOffset.x ? parseInt(box1viewportOffset.x) : 0;
	var box1XEnd 	= box1XStart + box1viewportOffset.width;
	var box1YStart	= box1viewportOffset.y ? parseInt(box1viewportOffset.y) : 0;
	var box1YEnd	= box1YStart + box1viewportOffset.height;

	var box2viewportOffset = box2.getBoundingClientRect();
	var box2XStart	= box2viewportOffset.x ? parseInt(box2viewportOffset.x) : 0;
	var box2XEnd 	= box2XStart + box2.getBoundingClientRect().width;
	var box2YStart	= box2viewportOffset.y ? parseInt(box2viewportOffset.y) : 0;
	var box2YEnd	= box2YStart + box2.getBoundingClientRect().height;

	var xOverlap 	= (box1XEnd >= box2XStart && box1XStart <= box2XEnd);
	var yOverlap 	= (box1YEnd >= box2YStart && box1YStart <= box2YEnd);
	return (xOverlap && yOverlap);
}
function willBlocksOverlap(box1, box2, direction) {
	paddingHorizontal	= 0;
	paddingVertical		= 0;
	if (direction == "left") {
		paddingHorizontal = paddingHorizontal - global_increment_by;
	}
	if (direction == "right") {
		paddingHorizontal = paddingHorizontal + global_increment_by;
	}
	if (direction == "up") {
		paddingVertical = paddingVertical - global_increment_by;
	}
	if (direction == "down") {
		paddingVertical = paddingVertical + global_increment_by;
	}
	//console.log("box1XEnd = " + box1XEnd);
	var box1viewportOffset = box1.getBoundingClientRect();
	// var box1XStart	= (box1viewportOffset.x ? parseInt(box1viewportOffset.x) : 0) + paddingHorizontal;
	// var box1XEnd 	= box1XStart + box1viewportOffset.width + paddingHorizontal;
		//console.log("box1XEnd = " + box1XEnd);
	// var box1YStart	= (box1viewportOffset.y ? parseInt(box1viewportOffset.y) : 0) + paddingVertical;
	// var box1YEnd	= box1YStart + box1viewportOffset.height + paddingVertical;

	var box1dataX = box1.dataset.x || 0;
	var box1dataY = box1.dataset.y || 0;


	var box1XStart	= parseInt(box1dataX) + paddingHorizontal;
	var box1XEnd	= box1XStart + box1viewportOffset.width + paddingHorizontal;
	var box1YStart	= parseInt(box1dataY) + paddingVertical;
	var box1YEnd	= box1YStart + box1viewportOffset.height + paddingVertical;
	// console.log("box1XStart = " +box1XStart+ "-- box1XEnd = " +box1XEnd+ "-- box1YStart = " +box1YStart+ "-- box1YEnd = " +box1YEnd+ "")

	var box2viewportOffset = box2.getBoundingClientRect();
	// var box2XStart	= box2viewportOffset.x ? parseInt(box2viewportOffset.x) : 0;
	// var box2XEnd 	= box2XStart + box2.getBoundingClientRect().width;
	// var box2YStart	= box2viewportOffset.y ? parseInt(box2viewportOffset.y) : 0;
	// var box2YEnd	= box2YStart + box2.getBoundingClientRect().height;

	var box2dataX = box2.dataset.x || 0;
	var box2dataY = box2.dataset.y || 0;

	var box2XStart	= parseInt(box2dataX);
	var box2XEnd 	= box2XStart + box2.getBoundingClientRect().width;
	var box2YStart	= parseInt(box2dataY);
	var box2YEnd	= box2YStart + box2.getBoundingClientRect().height;

	var xOverlap 	= (box1XEnd > box2XStart && box1XStart < box2XEnd);
	var yOverlap 	= (box1YEnd > box2YStart && box1YStart < box2YEnd);
	if ((xOverlap && yOverlap)) {
		//console.log("WILL")
	}
	return (xOverlap && yOverlap);
}

function changeDirection(obj, dir) {
	obj.classList.remove("left", "up", "right", "down");
	obj.classList.add(dir);
	//if (obj.id == "p1") {
		obj.dataset.direction = dir;
	//}
}


function turretDirection(turret) {
	var nearestEnemy = getNearestGoodGuy(turret)
	var p1Details = nearestEnemy.getBoundingClientRect();
	var p1x	= p1Details.x;
	var p1y	= p1Details.y;

	var turretDetails = turret.getBoundingClientRect();
	var tx = turretDetails.x;
	var ty = turretDetails.y;

	if (p1x < tx) {
		turret.classList.remove("right");
		turret.classList.add("left");
		turret.dataset.direction = "left";
	} else {
		turret.classList.remove("left");
		turret.classList.add("right");
		turret.dataset.direction = "right";
	}
	if (p1y < ty) {
		turret.classList.remove("bottom");
		turret.classList.add("top");
		turret.dataset.direction = "up";
	} else {
		turret.classList.remove("top");
		turret.classList.add("bottom");
		turret.dataset.direction = "down";
	}
}


function rotateTurrets() {
	var turrets = document.getElementsByClassName("turret");
	for (i = 0; i < turrets.length; i++) {
		turretDirection(turrets[i]);
	}
}



function initiateTanks() {
	var tankAreas = document.getElementsByClassName("tankArea");
	var tanks = document.getElementsByClassName("tank");
	for (var i=0; i < tankAreas.length; i++) {
		for (var j=0; j < tanks.length; j++) {
			if (doBlocksOverLap(tankAreas[i], tanks[j])) {
				moveTank(tanks[j], tankAreas[i]);
				break;
			}
		}
	}
}

setInterval('initiateTanks()', 100);

function moveTank(tank, tankArea) {
	var taBC = tankArea.getBoundingClientRect();
	var taStartX = parseInt(tankArea.style.marginLeft)
	var taEndX = parseInt(tankArea.style.marginLeft) + (taBC.width);
	var taStartY = parseInt(tankArea.style.marginTop)
	var taEndY = parseInt(tankArea.style.marginTop) + (taBC.height);

	taStartXQ = taStartX - parseInt(tankArea.style.marginLeft);
	taEndXQ = taEndX - parseInt(tankArea.style.marginLeft);
	taStartYQ = taStartY - parseInt(tankArea.style.marginTop);
	taEndYQ = taEndY - parseInt(tankArea.style.marginTop);

	t = tank.getBoundingClientRect();
	characterX = parseInt(tank.style.marginLeft) + (t.width / 2) - taStartX;
	characterY = parseInt(tank.style.marginTop) + (t.height / 2) - taStartY;
	var quadrant = findQuadrant(characterX, characterY, taStartXQ, taEndXQ, taStartYQ, taEndYQ);
	var dataDirection = tank.dataset.direction;
	var isDestroyed = tank.classList.contains("destroyed");
	if (isDestroyed) {
		return;
	}
	if (typeof dataDirection == 'undefined') {
		if (quadrant == 1) {
			changeDirection(tank, "right");
			tank.dataset.direction = "right";
			moveBlockRight(tank);
		}
		else if (quadrant == 2) {
			changeDirection(tank, "down");
			tank.dataset.direction = "down";
			moveBlockDown(tank);
		}
		else if (quadrant == 3) {
			changeDirection(tank, "left");
			tank.dataset.direction = "left";
			moveBlockLeft(tank);
		}
		else if (quadrant == 4) {
			changeDirection(tank, "up");
			tank.dataset.direction = "up";
			moveBlockUp(tank);
		}
	} else {
		var tx = parseInt(tank.style.marginLeft) - taStartX + (t.width / 2);
		var ty = parseInt(tank.style.marginTop) - taStartY + (t.height / 2);
		var taWidth = taBC.width;
		var taHeight = taBC.height;
		//console.log("tx + global_increment_by = " + (tx + global_increment_by) + " < taWidth " + taWidth)
		if (dataDirection == "right") {
			if (tx + global_increment_by < taWidth) {
				moveBlockRight(tank);
			} else {
				changeDirection(tank, "down");
				tank.dataset.direction = "down";
			}
		}
		else if (dataDirection == "down") {
			if (ty + global_increment_by < taHeight) {
				moveBlockDown(tank);
			} else {
				changeDirection(tank, "left");
				tank.dataset.direction = "left";
			}
		}
		else if (dataDirection == "left") {
			if (tx - global_increment_by > 0) {
				moveBlockLeft(tank);
			} else {
				changeDirection(tank, "up");
				tank.dataset.direction = "up";
			}
		}
		else if (dataDirection == "up") {
			if (ty - global_increment_by > 0) {
				moveBlockUp(tank);
			} else {
				changeDirection(tank, "right");
				tank.dataset.direction = "right";
			}
		}
	}
}

function findQuadrant(characterX, characterY, xS, xE, yS, yE) {
	var xMid = Math.round(xE / 2);
	var yMid = Math.round(yE / 2);
	var leftRight = (characterX <= xMid) ? "left" : "right";
	var upDown = (characterY <= yMid) ? "up" : "down";
	if (leftRight == "left" && upDown == "up") {
		return 1;
	}
	else if (leftRight == "right" && upDown == "up") {
		return 2;
	}
	else if (leftRight == "right" && upDown == "down") {
		return 3;
	}
	else if (leftRight == "left" && upDown == "down") {
		return 4;
	} else {
		return 0; // error
	}
}

function initiatePlanes(target, direction) {
	var ground = document.getElementById("ground");
	var enemy = document.createElement("div");
	var rando = Math.random();
	if (!direction) {
		var direction = (rando * 6000 > 3000) ? "left" : "right";
	}
	var posX = parseInt(target.style.marginLeft);
	var posY = parseInt(target.style.marginTop);
	var xDiff = (posX > posY) ? (posX - posY) : 0;
	var yDiff = (posY > posX) ? (posY - posX) : 0;
	var shadowBuffer = 700;
	var left,top;
	if (direction == "left") {
		left = posX + posY + shadowBuffer;
		if (posX > posY) {
			top = -Math.abs(yDiff) - shadowBuffer;
		} else {
			top = -shadowBuffer;
		}
	} else {
		left = posX - posY - shadowBuffer;
		if (posX > posY) {
			top = -Math.abs(yDiff) - shadowBuffer;
		} else {
			top = -shadowBuffer;
		}
	}
		enemy.setAttribute("class", "b52 " + direction);
		enemy.setAttribute("id", "enemy" + rando);
		enemy.setAttribute("data-enemy-type", "b52");
		enemy.setAttribute("data-allegiance", "enemy");
		enemy.setAttribute("data-fires", "true");
		enemy.setAttribute("data-kill-required", "false");
		enemy.setAttribute("data-hittable", "false");
		enemy.setAttribute("data-x", left);
		enemy.setAttribute("data-y", top);
		enemy.setAttribute("data-direction", direction);
		ground.appendChild(enemy);
		enemy.style.marginLeft = parseInt(left) + "px";
		enemy.style.marginTop = parseInt(top) + "px";
}

function movePlanes() {
	var planes = document.getElementsByClassName("b52");
	for (var i=0; i < planes.length; i++) {
		movePlane(planes[i]);
		cleanUpPlane(planes[i]);
	}
}

function movePlane(plane) {
	if (plane.classList.contains("left")) {
		moveBlockLeft(plane, false);
	} else {
		moveBlockRight(plane, false);
	}
	moveBlockDown(plane, false);
}

setInterval('movePlanes()', 100);

function cleanUpPlane(plane) {
	if (parseInt(plane.style.marginTop) > parseInt(ground.offsetHeight)) {
		plane.remove();
	}
}

document.addEventListener("enemyKill", function(data) {
	console.log(data);
	var enemyAr = data.detail.split("|")
	var enemyType = enemyAr[0];
	var characterId = enemyAr[1];
	if (enemyType == 'tank') {
		document.getElementById(characterId).classList.remove("enemy");
		document.getElementById(characterId).style.zIndex = 0;
		document.getElementById(characterId).setAttribute("data-hittable", "false")
	}
});



function fire(gunner, allegiance, projectileType) {
	if (!gamePlay) {
		return;
	}
	var gunnerDetails = gunner.getBoundingClientRect();
	var fireStartX	= parseInt(gunner.style.marginLeft) + (gunnerDetails.width / 2);
	var fireStartY	= parseInt(gunner.style.marginTop) + (gunnerDetails.height / 2);
	var projectile = document.createElement("div");
		var rando = Math.random();
		projectile.setAttribute("class", projectileType);
		projectile.setAttribute("id", "projectile" + rando);
		projectile.setAttribute("data-allegiance", allegiance);
		ground.appendChild(projectile);
		document.getElementById("projectile" + rando).style.marginLeft = fireStartX;
		document.getElementById("projectile" + rando).style.marginTop = fireStartY;
	if (gunner.dataset.enemyType == 'b52') {
		projectile.setAttribute("data-air", "true");
	}
	var projectileSpan = document.createElement("span");
	projectile.appendChild(projectileSpan);
	var dir = gunner.dataset.direction;
	fireArray.push("projectile" + rando);
	if (projectileType == "erppc") {
		fireERPPC("projectile" + rando, dir);
	} else {
		fireMissile("projectile" + rando);
	}
}

function fireERPPC(firedArrayElm, dir) {
	fireArray[firedArrayElm] = setInterval(function() {
		projectile = document.getElementById(firedArrayElm);
		if (projectile) {
			hitAllegiance = (projectile.dataset.allegiance == "good") ? "enemy" : "good";
			checkProjectileHittingObject(firedArrayElm, hitAllegiance);
			checkProjectileHittingObject(firedArrayElm, "obstacle");
			switch(dir) {
				case "right" : moveBlockRight(projectile); break;
				case "left" : moveBlockLeft(projectile); break;
				case "up" : moveBlockUp(projectile); break;
				case "down" : moveBlockDown(projectile); break;
				default : "";break;
			}
			
		}
	},20);

	// begin fade out animation
	setTimeout(function() {
		clearInterval(fireArray[firedArrayElm]);
		elm = document.getElementById(firedArrayElm);
		if (elm && elm.classList.contains("explosion")) {
			elm.classList.add("fade");
		}
		if (elm && !elm.classList.contains("explosion")) {
			elm.remove();
		} else {
			// clear item after explosion animation
			setTimeout(function() {
				if (document.getElementById(firedArrayElm)) {
					document.getElementById(firedArrayElm).remove();
				}
			}, 1000);
		}
	}, 3000);
}

function fireMissile(firedArrayElm) {
	var projectile = document.getElementById(firedArrayElm);
	var hitAllegiance = (projectile.dataset.allegiance == "good") ? "enemy" : "good";
	var nearestFoe = getNearestGoodGuy(projectile);
	var directionDetails = homingDirection(projectile, nearestFoe);
	var xDir = directionDetails[2];
	var yDir = directionDetails[3];
	var diff = directionDetails[4];
	
	var moveByDetails = calculateMoveBy(diff);
	var moveBy = moveByDetails[0];
	var helperMoveBy = moveByDetails[1];
	pointProjectile(projectile, moveBy, helperMoveBy, directionDetails);

	//console.log("diff = " + diff+ "; helperMoveBy = " + helperMoveBy)
	fireArray[firedArrayElm] = setInterval(function() {
		if (projectile) {
			hitAllegiance = (projectile.dataset.allegiance == "good") ? "enemy" : "good";
			checkProjectileHittingObject(firedArrayElm, hitAllegiance);
			checkProjectileHittingObject(firedArrayElm, "obstacle");

			if (xDir == "left") {
				moveBlockLeft(projectile, false, moveBy);
			} else if (xDir == "right") {
				moveBlockRight(projectile, false, moveBy);
			}
			if (yDir == "up") {
				moveBlockUp(projectile, false, helperMoveBy);
			} else if (yDir == "down") {
				moveBlockDown(projectile, false, helperMoveBy);
			}
		}
	},30);

	// begin fade out animation
	setTimeout(function() {
		clearInterval(fireArray[firedArrayElm]);
		elm = document.getElementById(firedArrayElm);
		if (elm && elm.classList.contains("explosion")) {
			elm.classList.add("fade");
		}
		if (elm && !elm.classList.contains("explosion")) {
			elm.remove();
		} else {
			// clear item after explosion animation
			setTimeout(function() {
				if (document.getElementById(firedArrayElm)) {
					document.getElementById(firedArrayElm).remove();
				}
			}, 1000);
		}
	}, 4000);
}

function calculateMoveBy(diff) {
	var moveBy = 10;
	var helperMoveBy = parseFloat(Math.abs(moveBy/diff));
	if (helperMoveBy > moveBy) {
		tmHelperMoveBy = helperMoveBy;
		helperMoveBy = moveBy;
		moveBy = parseFloat(moveBy / tmHelperMoveBy * moveBy);
	}
	return [moveBy, helperMoveBy];
}

/*
Intended to get rotate projectile correctly
*/
function pointProjectile(projectile, moveBy, helperMoveBy, projectileHomingDetails) {
	var span = projectile.children[0];
	xDir = projectileHomingDetails[2];
	yDir = projectileHomingDetails[3];
	var rotateAngle = 0;
	//console.log(xDir + " " + yDir);

	if (xDir == "right" && yDir == "up") {
		if (moveBy > helperMoveBy) {
			rotateAngle = ((moveBy - helperMoveBy) / moveBy * 45) + 45;
			//console.log("45 + (" + (moveBy - helperMoveBy) + " / " + moveBy + " * 45) == " + rotateAngle);
		} else {
			var rotateAngle = moveBy / helperMoveBy * 45;
			//console.log("ELSE " + moveBy + " / " + helperMoveBy + " * 45 == " + rotateAngle);
		}
	}
	if (xDir == "right" && yDir == "down") {
		if (moveBy > helperMoveBy) {
			rotateAngle = (helperMoveBy / moveBy * 45) + 90;
		} else {
			var rotateAngle = Math.abs((helperMoveBy - moveBy) / helperMoveBy * 45) + 135;
			//console.log("Math.abs(("+helperMoveBy+" - "+moveBy+") / "+helperMoveBy+" * 45) + 135 == " + rotateAngle);
		}
	}
	if (xDir == "left" && yDir == "down") {
		if (moveBy > helperMoveBy) {
			rotateAngle = ((moveBy - helperMoveBy) / moveBy * 45) + 225; // ((10-1)/10*45)+225
			//console.log("moveBy = " + moveBy + "; helperMoveBy = " + helperMoveBy + "; rotateAngle = " + rotateAngle);
		} else {
			var rotateAngle = (moveBy / helperMoveBy * 45) + 180; // (1/10*45)+180
			//console.log("ELSE moveBy = " + moveBy + "; helperMoveBy = " + helperMoveBy + "; rotateAngle = " + rotateAngle)
		}
	}
	if (xDir == "left" && yDir == "up") {
		if (moveBy > helperMoveBy) {
			rotateAngle = (helperMoveBy / moveBy * 45) + 270;
		} else {
			var rotateAngle = Math.abs((helperMoveBy - moveBy) / helperMoveBy * 45) + 315;
			//console.log("Math.abs(("+helperMoveBy+" - "+moveBy+") / "+helperMoveBy+" * 45) + 135 == " + rotateAngle);
		}
	}
	span.setAttribute("style", "transform: rotate(" + rotateAngle + "deg)");
}

function getNearestGoodGuy(obj) {
	goods = document.querySelectorAll("[data-allegiance='good'][data-hittable='true']:not(.destroyed)");
	// add all good guys to array so can sort by closest "range"
	goodsArr = new Array();
	for (var i = 0; i < goods.length; i++) {
		goods[i].range = compareObjectRange(goods[i], obj);
		goodsArr[i] = goods[i];
	}
	goodsArr.sort((a,b) => (a.range > b.range) ? 1 : ((b.range > a.range) ? -1 : 0));

	return goodsArr[0];
}

function compareObjectRange(obj1, obj2) {
	var obj1Details = obj1.getBoundingClientRect();
	var obj1X = obj1Details.x + (obj1Details.width / 2);
	var obj1Y = obj1Details.y + (obj1Details.height / 2);

	var obj2Details = obj2.getBoundingClientRect();
	var obj2X = parseInt(obj2Details.x + (obj2Details.width / 2));
	var obj2Y = parseInt(obj2Details.y + (obj2Details.height / 2));

	var obj1Count = Math.abs(obj1X) + Math.abs(obj1Y);
	var obj2Count = Math.abs(obj2X) + Math.abs(obj2Y);

	// Pythagorean
	var xSquared = Math.abs(obj1X - obj2X);
		xSquared = xSquared * xSquared;
	var ySquared = Math.abs(obj1Y - obj2Y);
		ySquared = ySquared * ySquared;

	var zSquared = Math.round(xSquared + ySquared);
	var c = Math.round(Math.sqrt(zSquared));

	//console.log("good " + obj1.id + " = " + obj1X + "x"+obj1Y+" projectile = " + obj2X + "x"+obj2Y+" diff = " + c);

	return Math.abs(c);
}

function homingDirection(projectile, nearestFoe) {
	var projectileDetails = projectile.getBoundingClientRect();
	var nearestFoeDetails = nearestFoe.getBoundingClientRect();
	var x = projectileDetails.x - (nearestFoeDetails.x + (nearestFoeDetails.width / 2));
	var y = projectileDetails.y - (nearestFoeDetails.y + (nearestFoeDetails.height / 2));
	var xDir = (projectileDetails.x > nearestFoeDetails.x) ? "left" : "right";
	var yDir = (projectileDetails.y > nearestFoeDetails.y) ? "up" : "down";
	var diff = x / y;
	//console.log("x = " + x + " y = " + y + " xDir = " + xDir + " yDir = " + yDir + " diff = " + diff);
	return [x, y, xDir, yDir, diff];
}




/*
projectileArrayElm = array key of fired element
hitType = obstacle such as building, or enemy
*/
function checkProjectileHittingObject(projectileArrayElm, hitType) {
	projectile = document.getElementById(projectileArrayElm);
	if (hitType == 'obstacle') {
		obstacles = document.querySelectorAll("[data-allegiance='obstacle'][data-hittable='true']");
	} else {
		obstacles = document.querySelectorAll("[data-allegiance='" + hitType + "'][data-hittable='true']");
	}
	for (i = 0; i < obstacles.length; i++) {
		var friendlyFire = false;
		if (obstacles[i].dataset?.allegiance == projectile.dataset?.allegiance) {
			friendlyFire = true;
		}
		 // not exactly friendly fire but 'air' missiles should bypass obstacles
		if (projectile?.dataset?.air == 'true' && obstacles[i].dataset?.allegiance == 'obstacle') {
			friendlyFire = true;
		}
		//console.log("obstacles[i].dataset?.allegiance = " + obstacles[i].dataset?.allegiance)
		//console.log("projectile.dataset?.allegiance = " + projectile.dataset?.allegiance)
		if (doBlocksOverLap(projectile, obstacles[i]) && !friendlyFire) {
			//console.log("hit");
			clearInterval(fireArray[projectileArrayElm]);
			convertToExplosion(projectile);
			removeLife(obstacles[i]);
			return true;
		}
	}
	return false;
}


function removeLife(obstacle) {
	if (obstacle.dataset?.life) {
		var life = parseInt(obstacle.dataset.life);
		if (life > 0) {
			life = life - 5;
		}
		if (life <= 0) {
			destroyCharacter(obstacle);
		}
		obstacle.setAttribute('data-life', life);
		if (obstacle.id == p1.id) {
			removeLifeStats();
		}
	}
}

function removeLifeStats() {
	var newLifeStat = p1.dataset.life;
	var statPercent = newLifeStat / lifeStat * 100;
	document.getElementById("life-tracking").style.width = statPercent + "%";
}

function destroyCharacter(character) {
	if (!character.classList.contains("destroyed")) {
		character.classList.add("destroyed");
		setTimeout("document.getElementById('" + character.id + "').classList.add('dead');", 2500);
		if (character.id == p1.id) {
			loseGame();
		} else {
			enemyType = getEnemyType(character);
			if (character.dataset.allegiance == "enemy") {
				var event = new CustomEvent("enemyKill", { "detail": enemyType + "|" + character.id });
			} else if (character.dataset.allegiance == "enemy") {
				var event = new CustomEvent("goodKill", { "detail": enemyType + "|" + character.id });
			}

			if (event) {
				document.dispatchEvent(event);
			}
		}
	}
}

function getEnemyType(character) {
	return character.dataset.enemyType || "unknown";
}

function loseGame() {
	gamePlay = false;
	var event = new CustomEvent("lose", { "detail": "level 1" });
	console.log(event);
	document.dispatchEvent(event);
	pkAnalytics("mech:lose", gameLevel);
}

function winGame() {
	gamePlay = false;
	console.log("win!");
	pkAnalytics("mech:win", gameLevel);
}

function promptEnemiesToFire() {
	if (!gamePlay) {
		return;
	}
	var enemies = document.querySelectorAll("[data-allegiance='enemy'][data-fires='true']");
	for (var i = 0; i < enemies.length; i++) {
		if (enemyWithinRange(enemies[i])) {
			makeEnemyFire(enemies[i]);
		}
	}
}

function enemyWithinRange(enemy) {
	// var inRange = 1250;
	// var enemeyDetails = enemy.getBoundingClientRect();
	// var enemyX = enemeyDetails.x + (enemeyDetails.width / 2);
	// var enemyY = enemeyDetails.y + (enemeyDetails.height / 2);

	// var p1Details = p1.getBoundingClientRect();
	// var p1X = p1Details.x + (p1Details.width / 2);
	// var p1Y = p1Details.y + (p1Details.height / 2);

	// var withinX = (p1X - enemyX < inRange && p1X - enemyX > -Math.abs(inRange));
	// var withinY = (p1Y - enemyY < inRange && p1Y - enemyY > -Math.abs(inRange));

	var inRange = 1250;
	goods = document.querySelectorAll("[data-allegiance='good'][data-hittable='true']");
	// add all good guys to array so can sort by closest "range"
	goodsArr = new Array();
	for (var i = 0; i < goods.length; i++) {
		if (compareObjectRange(goods[i], enemy) <= inRange) {
			// just return true if any enemy is within range
			return true;
		}
	}

	return false;
	
	// if (withinX && withinY) {
	// 	return true;
	// }
	// return false;
}

function makeEnemyFire(enemy) {
	if (enemy.classList.contains("destroyed")) {
		return;
	}
	var rando = Math.random() * 3000;
	// every 1/3
	if (rando <= 1000) {
		fire(enemy, "enemy", "missile");
	}
}



/* converts a fired ammo into a 'hit' */
function convertToExplosion(fire) {
	fire.classList.add("explosion");
}



function moveCamRight(p1){
	var cam_center = getWindowWidth() / 2 - global_box_size;
	var groundDetails = ground.getBoundingClientRect();
	var groundWidth	= groundDetails.width;
	var maxLeft = groundWidth - getWindowWidth();
	var p1marginLeft = parseInt(p1.style.marginLeft);
	if (!p1marginLeft) {
		p1marginLeft = 0;
	}
	var cam = document.getElementById("cam");
	var ground_marginLeft = parseInt(ground.style.marginLeft);
	if (!ground_marginLeft) {
		ground_marginLeft = 0;
	}
	//console.log("ground_marginLeft = " + ground_marginLeft + "; maxLeft = " + maxLeft);
	if (p1marginLeft>=cam_center && Math.abs(ground_marginLeft) < maxLeft){
		var new_ground_marginLeft = ground_marginLeft - global_increment_by;
		ground.style.marginLeft = new_ground_marginLeft + "px";
	}
}
function moveCamLeft(p1){
	var cam_center = getWindowWidth() / 2 - global_box_size;
	var groundDetails = ground.getBoundingClientRect();
	var groundWidth	= groundDetails.width;
	var p1marginLeft = parseInt(p1.style.marginLeft);
	if (!p1marginLeft) {
		p1marginLeft = 0;
	}
	var maxLeft = groundWidth - getWindowWidth() + cam_center; // when player is at right-most and goes left
	var cam = document.getElementById("cam");
	var ground_marginLeft = parseInt(ground.style.marginLeft);
	if (!ground_marginLeft) {
		ground_marginLeft = 0;
	}
	//console.log("p1marginLeft = " + p1marginLeft + "; maxLeft = " + maxLeft);
	if (p1marginLeft>=cam_center && Math.abs(p1marginLeft) < maxLeft){
		var new_ground_marginLeft = ground_marginLeft + global_increment_by;
		if (new_ground_marginLeft > 0) {new_ground_marginLeft=0;}
		ground.style.marginLeft = new_ground_marginLeft + "px";
	}
}
function moveCamUp(p1){
	var cam_center = getWindowHeight() / 2 - global_box_size;
	var groundDetails = ground.getBoundingClientRect();
	var groundHeight	= groundDetails.height;
	var maxHeight = Math.floor((groundHeight - getWindowHeight() + cam_center) / 10) * 10;
	var p1marginTop = parseInt(p1.style.marginTop);
	if (!p1marginTop) {
		p1marginTop = 0;
	}
	var cam = document.getElementById("cam");
	var ground_marginTop = parseInt(ground.style.marginTop);
	if (!ground_marginTop) {
		ground_marginTop = 0;
	}
	if (p1marginTop>=cam_center && Math.abs(p1marginTop) < maxHeight && ground_marginTop < 0){
		var new_ground_marginTop = ground_marginTop + global_increment_by;
		ground.style.marginTop = new_ground_marginTop + "px";
	}
}
function moveCamDown(p1){
	var cam_center = getWindowHeight() / 2 - global_player_height;
	var groundDetails = ground.getBoundingClientRect();
	var groundHeight	= groundDetails.height;
	var maxHeight = Math.floor((groundHeight - getWindowHeight()) / 10) * 10;
	var p1marginTop = parseInt(p1.style.marginTop);
	if (!p1marginTop) {
		p1marginTop = 0;
	}
	var cam = document.getElementById("cam");
	var ground_marginTop = parseInt(ground.style.marginTop);
	if (!ground_marginTop) {
		ground_marginTop = 0;
	}
	//console.log("ground_marginTop = " + Math.abs(ground_marginTop) + "; maxHeight = " + maxHeight);
	if (p1marginTop>=cam_center && Math.abs(ground_marginTop) < maxHeight){
		var new_ground_marginTop = ground_marginTop - global_increment_by;
		ground.style.marginTop = new_ground_marginTop + "px";
	}
}


function addEnemy(enemyType, life, left, top, direction = "left", fires = "true") {
	var ground = document.getElementById("ground");
	var enemy = document.createElement("div");
	var rando = Math.random();
		enemy.setAttribute("class", enemyType + " enemy");
		enemy.setAttribute("id", "enemy" + rando);
		enemy.setAttribute("data-enemy-type", enemyType);
		enemy.setAttribute("data-allegiance", "enemy");
		enemy.setAttribute("data-fires", fires);
		enemy.setAttribute("data-kill-required", "true");
		enemy.setAttribute("data-hittable", "true");
		enemy.setAttribute("data-x", left);
		enemy.setAttribute("data-y", top);
		enemy.setAttribute("data-life", life);
		enemy.setAttribute("data-direction", direction);
		ground.appendChild(enemy);
		enemy.style.marginLeft = parseInt(left) + "px";
		enemy.style.marginTop = parseInt(top) + "px";
	return enemy;
}

function addObstacle(width, height, left, top, hittable = true, classes = '', life = false) {
	var ground = document.getElementById("ground");
	var obstacle = document.createElement("div");
	var rando = Math.random();
		obstacle.setAttribute("class", "obstacle " + classes);
		obstacle.setAttribute("id", "obstacle" + rando);
		obstacle.setAttribute("data-allegiance", "obstacle");
		obstacle.setAttribute("data-hittable", hittable);
		obstacle.setAttribute("data-x", left);
		obstacle.setAttribute("data-y", top);
		if (life) {
			obstacle.setAttribute("data-life", life);
		}
		ground.appendChild(obstacle);
		obstacle.style.marginLeft = parseInt(left) + "px";
		obstacle.style.marginTop = parseInt(top) + "px";
		obstacle.style.width = parseInt(width) + "px";
		obstacle.style.height = parseInt(height) + "px";
	return obstacle;
}



document.addEventListener("DOMContentLoaded", function(event) { 
	if ('ontouchstart' in document.documentElement) {
		touchControls();
	}
});

function getBounds(el) {
	var pos = el.getBoundingClientRect();
	return {
		x: pos.x,
		y: pos.y,
		w: pos.width,
		h: pos.height
	};
}


function isTouchControlBeingTouched(fingerX, fingerY) {

	var touchUp = getBounds(document.getElementById("touch-up"));
	var touchDown = getBounds(document.getElementById("touch-down"));
	var touchLeft = getBounds(document.getElementById("touch-left"));
	var touchRight = getBounds(document.getElementById("touch-right"));

	// test touchUp
	var rUT = touchUp.x + touchUp.w; // rectangle Up Top
	var rUX = rUT > fingerX && touchUp.x < fingerX; // x-axis
	var rUB = touchUp.y + touchUp.h; // rectangle Up Bottom
	var rUY = rUB > fingerY && touchUp.y < fingerY; // y-axis
	if (rUX && rUY) {
		return "up";
	}

	// test touchRight
	var rRT = touchRight.x + touchRight.w; // rectangle Right Top
	var rUX = rRT > fingerX && touchRight.x < fingerX; // x-axis
	var rRB = touchRight.y + touchRight.h; // rectangle Right Bottom
	var rRY = rRB > fingerY && touchRight.y < fingerY; // y-axis
	if (rUX && rRY) {
		return "right";
	}

	// test touchDown
	var rDT = touchDown.x + touchDown.w; // rectangle Down Top
	var rDX = rDT > fingerX && touchDown.x < fingerX; // x-axis
	var rDB = touchDown.y + touchDown.h; // rectangle Down Bottom
	var rDY = rDB > fingerY && touchDown.y < fingerY; // y-axis
	if (rDX && rDY) {
		return "down";
	}

	// test touchLeft
	var rLT = touchLeft.x + touchLeft.w; // rectangle Left Top
	var rLX = rLT > fingerX && touchLeft.x < fingerX; // x-axis
	var rLB = touchLeft.y + touchLeft.h; // rectangle Left Bottom
	var rLY = rLB > fingerY && touchLeft.y < fingerY; // y-axis
	if (rLX && rLY) {
		return "left";
	}
}

function cancelKeyDirection(key) {
	console.log("cancel: " + key);
	switch(key) {
		case "left"		: notPressingDownLeft(null); break;
		case "right"	: notPressingDownRight(null); break;
		case "up"		: notPressingDownUp(null); break;
		case "down"		: notPressingDownDown(null); break;
	}
}

function changeKeyDirection(key) {
	console.log("change: " + key);
	switch(key) {
		case "left"		: pressingDownLeft(null); break;
		case "right"	: pressingDownRight(null); break;
		case "up"		: pressingDownUp(null); break;
		case "down"		: pressingDownDown(null); break;
	}
}

function touchMove(e) {
	var touchingMultiple = 0; // try to prevent multiple touches on just dpad
	for (var i = 0; i < e.touches.length; i++) {
		var touch = e.touches[i];
		var positionX = touch.pageX;
		var positionY = touch.pageY;
		var key = isTouchControlBeingTouched(positionX, positionY);
		if ((key == "left" || key == "right" || key == "up" || key == "down") && touchingMultiple == 0) {
			touchingMultiple++;
			if (key != keyDirection) {
				console.log("CHANGE INPUT: " + touchingMultiple + " " + keyDirection + " now is " + key);
				cancelKeyDirection(keyDirection);
				keyDirection = key;
				changeKeyDirection(key);
			}
		}
	}
}


var timerID;
var timerIDLeft, timerIDRight, timerIDUp, timerIDDown;
var timerIDfire;
var counter = 0;
var counterF = 0;
var counterD = 0;
var counterR = 0;
var counterL = 0;
var counterU = 0;
var dPadInUse = "standing";
var countTouches = 0;
function touchControls() {
	// catch dragging so we can change direction w/o touchEnd event
	document.body.addEventListener('touchmove', touchMove, false); 

	var mainTouchContainer = document.querySelector("#touch-controls");
	var leftTouch = document.querySelector("#touch-left");
	var rightTouch = document.querySelector("#touch-right");
	var upTouch = document.querySelector("#touch-up");
	var downTouch = document.querySelector("#touch-down");
	var fireTouch = document.querySelector("#touch-fire");

	mainTouchContainer.addEventListener("mousedown", function(e){e.preventDefault();}, false);
	mainTouchContainer.addEventListener("mouseup", function(e){e.preventDefault();}, false);
	mainTouchContainer.addEventListener("mouseleave", function(e){e.preventDefault();}, false);
	mainTouchContainer.addEventListener("touchstart", function(e){e.preventDefault();}, false);
	mainTouchContainer.addEventListener("touchend", function(e){e.preventDefault();}, false);

	ground.addEventListener("touchstart", function(e){e.preventDefault();}, false);
	ground.addEventListener("touchend", function(e){e.preventDefault();}, false);
	ground.addEventListener("touchmove", function(e){e.preventDefault();}, false);

	leftTouch.addEventListener("mousedown", pressingDownLeft, false);
	leftTouch.addEventListener("mouseup", notPressingDownLeft, false);
	leftTouch.addEventListener("mouseleave", notPressingDownLeft, false);
	leftTouch.addEventListener("touchstart", pressingDownLeft, false);
	leftTouch.addEventListener("touchend", notPressingDownLeft, false);

	rightTouch.addEventListener("mousedown", pressingDownRight, false);
	rightTouch.addEventListener("mouseup", notPressingDownRight, false);
	rightTouch.addEventListener("mouseleave", notPressingDownRight, false);
	rightTouch.addEventListener("touchstart", pressingDownRight, false);
	rightTouch.addEventListener("touchend", notPressingDownRight, false);

	upTouch.addEventListener("mousedown", pressingDownUp, false);
	upTouch.addEventListener("mouseup", notPressingDownUp, false);
	upTouch.addEventListener("mouseleave", notPressingDownUp, false);
	upTouch.addEventListener("touchstart", pressingDownUp, false);
	upTouch.addEventListener("touchend", notPressingDownUp, false);

	downTouch.addEventListener("mousedown", pressingDownDown, false);
	downTouch.addEventListener("mouseup", notPressingDownDown, false);
	downTouch.addEventListener("mouseleave", notPressingDownDown, false);
	downTouch.addEventListener("touchstart", pressingDownDown, false);
	downTouch.addEventListener("touchend", notPressingDownDown, false);

	// fireTouch.addEventListener("mousedown", pressingDownFire, false);
	// fireTouch.addEventListener("mouseup", notPressingDownFire, false);
	// fireTouch.addEventListener("mouseleave", notPressingDownFire, false);
	// fireTouch.addEventListener("touchstart", pressingDownFire, false);
	fireTouch.addEventListener("touchend", notPressingDownFire, false);
	fireTouch.addEventListener("touchstart", pressingDownFire, false);

	document.addEventListener("touchend", documentTouchEnd, false);
}

function documentTouchEnd(e) {
	// don't stop touches if you're just firing
	if (e.changedTouches.length > 0) {
		if (e.changedTouches[0].target.id == "touch-fire") {
			notPressingDownFire(null);
			return;
		}
	}
	notPressingDownLeft(e);
	notPressingDownRight(e);
	notPressingDownUp(e);
	notPressingDownDown(e);
}

function pressingDownFire(e) {
	// Start the timer
	requestAnimationFrame(timerFire);
	if (e) {
		e.preventDefault();
	}
	p1Fire();
}

function notPressingDownFire(e) {
	// Stop the timer
	cancelAnimationFrame(timerIDfire);
	counter = 0;
	counterF = 0;
}

function pressingDownRight(e) {
	if (dPadInUse !== "standing" && dPadInUse !== "right") {
		notPressingDownRight(null);
		return;
	}
	dPadInUse = "right";
	// Start the timer
	requestAnimationFrame(timerRight);
	if (e) {
		e.preventDefault();
	}
	moveCharacterRight(p1);
	keyDirection = "right";
}

function notPressingDownRight(e) {
	// Stop the timer
	dPadInUse = "standing";
	cancelAnimationFrame(timerIDRight);
	counter = 0;
	counterR = 0;
	p1.classList.remove("walk");
	keyDirection = null;
}

function pressingDownLeft(e) {
	if (dPadInUse !== "standing" && dPadInUse !== "left") {
		notPressingDownLeft(null);
		return;
	}
	dPadInUse = "left";
	// Start the timer
	requestAnimationFrame(timerLeft);
	if (e) {
		e.preventDefault();
	}
	moveCharacterLeft(p1);
	keyDirection = "left";
}

function notPressingDownLeft(e) {
	// Stop the timer
	dPadInUse = "standing";
	cancelAnimationFrame(timerIDLeft);
	counter = 0;
	counterL = 0;
	p1.classList.remove("walk");
	keyDirection = null;
}

function pressingDownUp(e) {
	if (dPadInUse !== "standing" && dPadInUse !== "up") {
		notPressingDownUp(null);
		return;
	}
	dPadInUse = "up";
	// Start the timer
	requestAnimationFrame(timerUp);
	if (e) {
		e.preventDefault();
	}
	moveCharacterUp(p1);
	keyDirection = "up";
}

function notPressingDownUp(e) {
	// Stop the timer
	dPadInUse = "standing";
	cancelAnimationFrame(timerIDUp);
	counter = 0;
	counterU = 0;
	p1.classList.remove("walk");
	keyDirection = null;
}

function pressingDownDown(e) {
	if (dPadInUse !== "standing" && dPadInUse !== "down") {
		notPressingDownUp(null);
		return;
	}
	dPadInUse = "down";
	// Start the timer
	requestAnimationFrame(timerDown);
	if (e) {
		e.preventDefault();
	}
	moveCharacterDown(p1);
	keyDirection = "down";
}

function notPressingDownDown(e) {
	// Stop the timer
	dPadInUse = "standing";
	cancelAnimationFrame(timerIDDown);
	counter = 0;
	counterD = 0;
	p1.classList.remove("walk");
	keyDirection = null;
}

//
// Runs at 60fps when you are pressing down
//
function timerLeft() {
	if (counterL % 4 === 0) {
		moveCharacterLeft(p1)
	}
	timerIDLeft = requestAnimationFrame(timerLeft);
	counterL++;
}

function timerRight() {
	if (counterR % 4 === 0) {
		moveCharacterRight(p1)
	}
	timerIDRight = requestAnimationFrame(timerRight);
	counterR++;
}

function timerUp() {
	if (counterU % 4 === 0) {
		moveCharacterUp(p1)
	}
	timerIDUp = requestAnimationFrame(timerUp);
	counterU++;
}

function timerDown() {
	if (counterD % 4 === 0) {
		moveCharacterDown(p1)
	}
	timerIDDown = requestAnimationFrame(timerDown);
	counterD++;
}

function p1Fire(e) {
	if (e) {
		e.preventDefault();
	}
	newFireDate = new Date();
	newFireTime = newFireDate.getTime();
	if (getTimeDifference(lastProjectileFired, newFireTime)) {
		lastProjectileFired = newFireTime;
		fire(p1, "good", "erppc");
		var event = new CustomEvent("fired", { "detail": p1 });
		document.dispatchEvent(event);
	}
}

function timerFire() {
	p1Fire();
	timerIDfire = requestAnimationFrame(timerFire);
}


