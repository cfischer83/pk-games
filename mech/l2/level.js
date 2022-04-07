gameLevel = "L2";

document.addEventListener("DOMContentLoaded", function(event) { 
	var enemy1 = addEnemy("tank", 30, 300, 1300, "right");
	var enemy2 = addEnemy("tank", 30, 1800, 1500, "right");
	var enemy3 = addEnemy("turret", 50, 1861, 1765);
	var enemy4 = addEnemy("turret", 50, 4075, 1639);
	var enemy5 = addEnemy("tank", 30, 4267, 1792, "right");
	var enemy6 = addEnemy("tank", 30, 4467, 1792, "right");
	var enemy7 = addEnemy("tank", 30, 4667, 1792, "right");
	var enemy8 = addEnemy("tank", 30, 4867, 1792, "right");
	var enemy9 = addEnemy("tank", 30, 5067, 1792, "right");
	var enemy10 = addEnemy("tank", 30, 5267, 1792, "right");
	var enemy11 = addEnemy("tank", 30, 5467, 1792, "right");
	var enemy12 = addEnemy("tank", 30, 4800, 700, "right");
	var enemy13 = addEnemy("turret", 50, 5585, 1849);
	var enemy14 = addEnemy("turret", 50, 4379, 723);
	var pyramid = addEnemy("pyramid", 50, 5082, 936);
	setInterval('initiateTanks()', 100);

	var obstacle1 = addObstacle(1549, 132, 4235, 528);
	var obstacle2 = addObstacle(40, 1190, 4235, 528);
	var obstacle3 = addObstacle(40, 1140, 5769, 539);
	var obstacle4 = addObstacle(137, 187, 5705, 1478);
	var obstacle5 = addObstacle(447, 192, 4235, 1495);
	var obstacle6 = addObstacle(1000, 500, 765, 0);
	var obstacle7 = addObstacle(535, 332, 996, 494);

	var tree0 = addObstacle(78, 78, 301, 81, true, 'tree tree1', 15);
	var tree1 = addObstacle(78, 78, 4101, 1951, true, 'tree tree1', 15);
	var tree2 = addObstacle(78, 78, 4350, 2150, true, 'tree tree2', 15);
	var tree3 = addObstacle(78, 78, 5101, 1481, true, 'tree tree1', 15);
	var tree4 = addObstacle(78, 78, 5181, 1471, true, 'tree tree2', 15);
	var tree5 = addObstacle(78, 78, 5261, 1501, true, 'tree tree1', 15);
	var tree6 = addObstacle(78, 78, 5341, 1461, true, 'tree tree1', 15);
	var tree7 = addObstacle(78, 78, 5001, 1381, true, 'tree tree1', 15);

	preloadImage("turret-down-left.png");
	preloadImage("turret-down-right.png");
	preloadImage("turret-up-left.png");
	preloadImage("turret-up-right.png");
	preloadImage("turret-destroyed.png");
	preloadImage("pyramid-destroyed.png");
	preloadImage("missile.gif");
	preloadImage("img/tank-destroyed.png");
	preloadImage("img/tank-destroyed-v.png");
	preloadImage("img/tank-down.png");
	preloadImage("img/tank-up.png");
	preloadImage("img/tank.png");
	preloadImage("img/tree1.png");
	preloadImage("img/tree1-destroyed.png");
	preloadImage("img/tree2.png");
	preloadImage("img/tree2-destroyed.png");
});

// Winning this level is done when all enemies are defeated.
document.addEventListener("enemyKill", function(event) { 
	var enemiesLeft = document.querySelectorAll("[data-kill-required='true']:not(.destroyed)");
	if (enemiesLeft.length == 0) {
		winGame();
		setTimeout('winLevel2()', 1000);
	}
});


// Winning this level is done when all enemies are defeated.
document.addEventListener("lose", function(event) {
	loseLevel2();
});

function loseLevel2() {
	var lowerMessage = document.createElement("div");
		lowerMessage.setAttribute("id", "lowerMessage");
		cam.insertBefore(lowerMessage, ground);
	var lowerMessageText = document.createElement("div");
		lowerMessageText.setAttribute("id", "lowerMessageText");
		lowerMessage.appendChild(lowerMessageText);
		lowerMessageText.innerHTML = "<p>You have lost your battle and brought shame to your family's name.</p><a href='L2.html' class='button'>Try Again</a> <a href='index.html' class='button'>Return To Missions</a>";
}

function winLevel2() {
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
	document.getElementById("overlaytext").innerHTML = "<h2>Victory!</h2><p>The enemy pyramid is destroyed. We have received some vital intel and have an urgent mission for you!</p><br /><a class='button' href='index.html'>Return To Missions</a>";

}

