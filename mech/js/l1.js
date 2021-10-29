document.addEventListener("DOMContentLoaded", function(event) { 
	var enemy1 = addEnemy("turret", 50, 1550, 850);
	var enemy2 = addEnemy("turret", 50, 1550, 1150);

	var obstacle1 = addObstacle(831, 286, 1530, 0);
	var obstacle2 = addObstacle(250, 150, 1300, 0);
	var obstacle3 = addObstacle(390, 350, 2100, 250);
	var obstacle4 = addObstacle(190, 230, 1923, 230);
	var obstacle5 = addObstacle(364, 230, 0, 1000);
	var obstacle6 = addObstacle(173, 144, 318, 1159);
	var obstacle7 = addObstacle(416, 286, 3367, 509);
	var obstacle8 = addObstacle(561, 286, 3148, 675);
});

function addEnemy(enemyType, life, left, top, direction = "left") {
	var ground = document.getElementById("ground");
	var enemy = document.createElement("div");
	var rando = Math.random();
		enemy.setAttribute("class", enemyType + " enemy");
		enemy.setAttribute("id", "enemy" + rando);
		enemy.setAttribute("data-allegiance", "enemy");
		enemy.setAttribute("data-hittable", "true");
		enemy.setAttribute("data-life", life);
		enemy.setAttribute("data-direction", direction);
		ground.appendChild(enemy);
		enemy.style.marginLeft = parseInt(left) + "px";
		enemy.style.marginTop = parseInt(top) + "px";
	return enemy;
}

function addObstacle(width, height, left, top) {
	var ground = document.getElementById("ground");
	var obstacle = document.createElement("div");
	var rando = Math.random();
		obstacle.setAttribute("class", "obstacle");
		obstacle.setAttribute("id", "obstacle" + rando);
		obstacle.setAttribute("data-allegiance", "obstacle");
		obstacle.setAttribute("data-hittable", "true");
		ground.appendChild(obstacle);
		obstacle.style.marginLeft = parseInt(left) + "px";
		obstacle.style.marginTop = parseInt(top) + "px";
		obstacle.style.width = parseInt(width) + "px";
		obstacle.style.height = parseInt(height) + "px";
	return obstacle;
}
